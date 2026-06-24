import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetsParam = searchParams.get('datasets');
    const indicatorsParam = searchParams.get('indicators');
    const economiesParam = searchParams.get('economies');
    const periodsParam = searchParams.get('periods');

    if (!indicatorsParam || !economiesParam) {
      return NextResponse.json({ error: 'indicators and economies parameters are required.' }, { status: 400 });
    }

    const selectedIndicators = indicatorsParam.split(',').map(i => i.trim());
    const selectedEconomies = economiesParam.split(',').map(e => e.trim());
    const counterpartParam = searchParams.get('counterparts');
    const selectedCounterparts = counterpartParam && counterpartParam !== ''
      ? counterpartParam.split(',').map(c => c.trim())
      : [];

    // 1. Resolve datasets
    let selectedDatasets: string[] = [];
    if (datasetsParam && datasetsParam !== 'ALL') {
      selectedDatasets = datasetsParam.split(',').map(d => d.trim());
    } else {
      const allDs = await prisma.dataset.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true }
      });
      selectedDatasets = allDs.map(d => d.code);
    }

    // 2. Build where clause
    const whereClause: any = {
      datasetCode: { in: selectedDatasets },
      indicatorCode: { in: selectedIndicators },
      economyCode: { in: selectedEconomies },
      isPublished: true,
      deletedAt: null,
    };

    if (selectedCounterparts.length > 0) {
      whereClause.AND = [{
        OR: [
          { datasetCode: { not: 'ARIC' } },
          { datasetCode: 'ARIC', counterpartAreaCode: { in: selectedCounterparts } }
        ]
      }];
    }

    // 3. Parallel: cache periods + all lookup tables at once
    const [cacheRecords, indicatorNames, economyNames, unitNames, multiplierNames] = await Promise.all([
      prisma.explorerCache.findMany({
        where: {
          datasetCode: { in: selectedDatasets },
          indicatorCode: { in: selectedIndicators },
          economyCode: { in: selectedEconomies },
        },
        select: { periods: true }
      }),
      prisma.indicator.findMany({
        where: { code: { in: selectedIndicators } },
        select: { code: true, name: true }
      }),
      prisma.economy.findMany({
        where: { code: { in: selectedEconomies } },
        select: { code: true, name: true }
      }),
      prisma.commonUnit.findMany({ select: { code: true, name: true } }),
      prisma.commonMultiplier.findMany({ select: { code: true, name: true, factor: true } }),
    ]);

    // Build fast O(1) lookup maps
    const indicatorMap = new Map(indicatorNames.map(i => [i.code, i.name]));
    const economyMap   = new Map(economyNames.map(e => [e.code, e.name]));
    const unitMap      = new Map(unitNames.map(u => [u.code, u.name]));
    const multMap      = new Map(multiplierNames.map(m => [m.code, { name: m.name, factor: m.factor }]));

    // 4. Aggregate periods from cache
    const allPeriods = new Set<string>();
    cacheRecords.forEach(rec => {
      if (rec.periods) rec.periods.split(',').forEach(p => allPeriods.add(p.trim()));
    });
    const allAvailablePeriods = Array.from(allPeriods).sort();

    // 5. Determine selected periods
    let selectedPeriods: string[] = [];
    if (periodsParam && periodsParam !== '') {
      selectedPeriods = periodsParam.split(',').map(p => p.trim());
    } else {
      selectedPeriods = allAvailablePeriods.slice(-15);
    }

    if (selectedPeriods.length === 0) {
      return NextResponse.json({ data: [], periods: allAvailablePeriods });
    }

    whereClause.period = { in: selectedPeriods };

    // 6. Fetch observations — use select (not include) to avoid expensive JOIN per row
    const observations = await prisma.observation.findMany({
      where: whereClause,
      select: {
        id: true,
        datasetCode: true,
        indicatorCode: true,
        economyCode: true,
        counterpartAreaCode: true,
        period: true,
        freqCode: true,
        obsValue: true,
        unitCode: true,
        unitMultCode: true,
      },
      orderBy: [
        { indicatorCode: 'asc' },
        { economyCode: 'asc' },
        { period: 'asc' }
      ]
    });

    const hasExchangeRateIndicator = selectedIndicators.includes('ENDA_XDC_USD_RATE');
    if (hasExchangeRateIndicator) {
      const fallbackRates = await prisma.fallbackExchangeRate.findMany({
        where: {
          economyCode: { in: selectedEconomies },
          period: { in: selectedPeriods }
        }
      });

      const existingCombinations = new Set(
        observations
          .filter(obs => obs.indicatorCode === 'ENDA_XDC_USD_RATE')
          .map(obs => `${obs.economyCode}_${obs.period}`)
      );

      fallbackRates.forEach(rate => {
        const comboKey = `${rate.economyCode}_${rate.period}`;
        if (!existingCombinations.has(comboKey)) {
          observations.push({
            id: rate.id,
            datasetCode: 'KIDB',
            indicatorCode: 'ENDA_XDC_USD_RATE',
            economyCode: rate.economyCode,
            counterpartAreaCode: null,
            period: rate.period,
            freqCode: 'A',
            obsValue: new Prisma.Decimal(rate.obsValue),
            unitCode: 'NCU_PER_USD',
            unitMultCode: '0',
          });
          existingCombinations.add(comboKey);
        }
      });
    }

    // 7. Fetch counterpart economy names (only if ARIC data present)
    const counterpartCodes = Array.from(new Set(
      observations.map(obs => obs.counterpartAreaCode).filter((c): c is string => !!c)
    ));
    let counterpartAreaMap = new Map<string, string>();
    if (counterpartCodes.length > 0) {
      const cpEconomies = await prisma.economy.findMany({
        where: { code: { in: counterpartCodes } },
        select: { code: true, name: true }
      });
      counterpartAreaMap = new Map(cpEconomies.map(e => [e.code, e.name]));
    }

    // 8. Map to flat format using in-memory lookup maps (no per-row DB calls)
    const formattedData = observations.map(obs => {
      const mult = obs.unitMultCode ? multMap.get(obs.unitMultCode) : undefined;
      return {
        id: obs.id,
        datasetCode: obs.datasetCode,
        indicatorCode: obs.indicatorCode,
        indicatorName: indicatorMap.get(obs.indicatorCode) || obs.indicatorCode,
        economyCode: obs.economyCode,
        economyName: economyMap.get(obs.economyCode) || obs.economyCode,
        counterpartAreaCode: obs.counterpartAreaCode || '',
        counterpartAreaName: obs.counterpartAreaCode
          ? (counterpartAreaMap.get(obs.counterpartAreaCode) || obs.counterpartAreaCode)
          : '',
        period: obs.period,
        freqCode: obs.freqCode,
        obsValue: obs.obsValue !== null && obs.obsValue !== undefined ? Number(obs.obsValue) : null,
        unitCode: obs.unitCode || '',
        unitName: obs.unitCode ? (unitMap.get(obs.unitCode) || obs.unitCode) : '',
        multiplierCode: obs.unitMultCode || '',
        multiplierName: mult?.name || '',
        multiplierFactor: mult?.factor ? Number(mult.factor) : 1,
      };
    });

    return NextResponse.json({ data: formattedData, periods: allAvailablePeriods });
  } catch (err: any) {
    console.error('Public Data API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
