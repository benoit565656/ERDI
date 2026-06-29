import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { memoryCache } from '@/lib/cache';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetsParam = searchParams.get('datasets');
    const dataflowsParam = searchParams.get('dataflows') || searchParams.get('dataflow');
    const indicatorsParam = searchParams.get('indicators') || searchParams.get('indicator');
    const economiesParam = searchParams.get('economies') || searchParams.get('economy');
    const periodsParam = searchParams.get('periods') || searchParams.get('period');
    const startPeriod = searchParams.get('startPeriod') || searchParams.get('start');
    const endPeriod = searchParams.get('endPeriod') || searchParams.get('end');

    // 1. Parse indicator codes (Support + or , and wildcard . / * / ALL)
    let selectedIndicators: string[] = [];
    let isAllIndicators = false;

    if (indicatorsParam && indicatorsParam !== '.' && indicatorsParam !== '*' && indicatorsParam !== 'ALL') {
      selectedIndicators = indicatorsParam.split('+').flatMap(i => i.split(',')).map(i => i.trim()).filter(Boolean);
    } else if (dataflowsParam && dataflowsParam !== '.' && dataflowsParam !== '*' && dataflowsParam !== 'ALL') {
      const dfs = dataflowsParam.split('+').flatMap(d => d.split(',')).map(d => d.trim()).filter(Boolean);
      const categoryMappings = await prisma.frontEndCategoryIndicator.findMany({
        where: {
          category: {
            categorySetCode: 'DATA_EXPLORER',
            isVisible: true,
            OR: dfs.map(df => ({
              OR: [
                { code: df },
                { parentCode: df },
                { hierarchyPath: { contains: df } }
              ]
            }))
          }
        },
        select: { indicatorCode: true }
      });
      selectedIndicators = Array.from(new Set(categoryMappings.map(m => m.indicatorCode)));
    } else {
      isAllIndicators = true;
    }

    // 2. Parse economy codes (Support + or , and wildcard . / * / ALL)
    let selectedEconomies: string[] = [];
    let isAllEconomies = false;

    if (economiesParam && economiesParam !== '.' && economiesParam !== '*' && economiesParam !== 'ALL') {
      selectedEconomies = economiesParam.split('+').flatMap(e => e.split(',')).map(e => e.trim()).filter(Boolean);
    } else {
      isAllEconomies = true;
    }

    const counterpartParam = searchParams.get('counterparts');
    const selectedCounterparts = counterpartParam && counterpartParam !== ''
      ? counterpartParam.split('+').flatMap(c => c.split(',')).map(c => c.trim()).filter(Boolean)
      : [];

    // 3. Resolve datasets
    let selectedDatasets: string[] = [];
    if (datasetsParam && datasetsParam !== 'ALL') {
      selectedDatasets = datasetsParam.split('+').flatMap(d => d.split(',')).map(d => d.trim());
    } else {
      const allDs = await prisma.dataset.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true }
      });
      selectedDatasets = allDs.map(d => d.code);
    }

    // 4. Build base where clause
    const whereClause: any = {
      datasetCode: { in: selectedDatasets },
      isPublished: true,
      deletedAt: null,
    };

    if (!isAllIndicators && selectedIndicators.length > 0) {
      whereClause.indicatorCode = { in: selectedIndicators };
    }

    if (!isAllEconomies && selectedEconomies.length > 0) {
      whereClause.economyCode = { in: selectedEconomies };
    }

    // If dataflow parameter was passed specifically, filter by main or secondary dataflow
    if (dataflowsParam && dataflowsParam !== '.' && dataflowsParam !== '*' && dataflowsParam !== 'ALL') {
      const dfs = dataflowsParam.split('+').flatMap(d => d.split(',')).map(d => d.trim());
      whereClause.OR = [
        { mainDataflowCode: { in: dfs } },
        { secondaryDataflowCode: { in: dfs } },
      ];
    }

    if (selectedCounterparts.length > 0) {
      const cpCondition = {
        OR: [
          { datasetCode: { not: 'ARIC' } },
          { datasetCode: 'ARIC', counterpartAreaCode: { in: selectedCounterparts } }
        ]
      };
      if (whereClause.AND) {
        whereClause.AND.push(cpCondition);
      } else {
        whereClause.AND = [cpCondition];
      }
    }

    // Period filtering
    if (startPeriod || endPeriod) {
      whereClause.period = {};
      if (startPeriod) whereClause.period.gte = startPeriod;
      if (endPeriod) whereClause.period.lte = endPeriod;
    } else if (periodsParam && periodsParam !== '' && periodsParam !== '.' && periodsParam !== '*' && periodsParam !== 'ALL') {
      const pList = periodsParam.split('+').flatMap(p => p.split(',')).map(p => p.trim());
      whereClause.period = { in: pList };
    }

    // 5. Fast O(1) lookup maps with memory cache
    let unitNames = memoryCache.get<any[]>('commonUnits');
    if (!unitNames) {
      unitNames = await prisma.commonUnit.findMany({ select: { code: true, name: true } });
      memoryCache.set('commonUnits', unitNames, 3600);
    }

    let multiplierNames = memoryCache.get<any[]>('commonMultipliers');
    if (!multiplierNames) {
      multiplierNames = await prisma.commonMultiplier.findMany({ select: { code: true, name: true, factor: true } });
      memoryCache.set('commonMultipliers', multiplierNames, 3600);
    }

    // 6. Fetch observations
    const observations = await prisma.observation.findMany({
      where: whereClause,
      select: {
        id: true,
        datasetCode: true,
        mainDataflowCode: true,
        secondaryDataflowCode: true,
        indicatorCode: true,
        economyCode: true,
        counterpartAreaCode: true,
        period: true,
        freqCode: true,
        obsValue: true,
        unitCode: true,
        unitMultCode: true,
        dataSource: true,
        footnote: true,
      },
      orderBy: [
        { indicatorCode: 'asc' },
        { economyCode: 'asc' },
        { period: 'asc' }
      ],
      take: 5000
    });

    // 7. Extract unique codes for fast metadata lookup maps
    const uniqueIndicators = Array.from(new Set(observations.map(o => o.indicatorCode)));
    const uniqueEconomies = Array.from(new Set(observations.map(o => o.economyCode)));
    const uniquePeriods = Array.from(new Set(observations.map(o => o.period))).sort();

    const [indicatorNames, economyNames] = await Promise.all([
      prisma.indicator.findMany({ where: { code: { in: uniqueIndicators } }, select: { code: true, name: true } }),
      prisma.economy.findMany({ where: { code: { in: uniqueEconomies } }, select: { code: true, name: true } }),
    ]);

    const indicatorMap = new Map(indicatorNames.map(i => [i.code, i.name]));
    const economyMap   = new Map(economyNames.map(e => [e.code, e.name]));
    const unitMap      = new Map(unitNames.map(u => [u.code, u.name]));
    const multMap      = new Map(multiplierNames.map(m => [m.code, { name: m.name, factor: m.factor }]));

    // 8. Map to flat format
    const formattedData = observations.map(obs => {
      const mult = obs.unitMultCode ? multMap.get(obs.unitMultCode) : undefined;
      return {
        id: obs.id,
        datasetCode: obs.datasetCode,
        dataflowCode: obs.secondaryDataflowCode || obs.mainDataflowCode || '',
        indicatorCode: obs.indicatorCode,
        indicatorName: indicatorMap.get(obs.indicatorCode) || obs.indicatorCode,
        economyCode: obs.economyCode,
        economyName: economyMap.get(obs.economyCode) || obs.economyCode,
        counterpartAreaCode: obs.counterpartAreaCode || '',
        period: obs.period,
        freqCode: obs.freqCode || 'A',
        obsValue: obs.obsValue !== null && obs.obsValue !== undefined ? Number(obs.obsValue) : null,
        unitCode: obs.unitCode || '',
        unitName: obs.unitCode ? (unitMap.get(obs.unitCode) || obs.unitCode) : '',
        multiplierCode: obs.unitMultCode || '',
        multiplierName: mult?.name || '',
        multiplierFactor: mult?.factor ? Number(mult.factor) : 1,
        dataSource: obs.dataSource || '',
        footnote: obs.footnote || ''
      };
    });

    // 9. Also build SDMX-style Series grouped list
    const seriesMap = new Map<string, any>();
    formattedData.forEach(obs => {
      const seriesKey = `${obs.indicatorCode}__${obs.economyCode}__${obs.freqCode}`;
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          freq: obs.freqCode,
          indicatorCode: obs.indicatorCode,
          indicatorName: obs.indicatorName,
          economyCode: obs.economyCode,
          economyName: obs.economyName,
          datasetCode: obs.datasetCode,
          dataflowCode: obs.dataflowCode,
          observations: []
        });
      }
      seriesMap.get(seriesKey).observations.push({
        period: obs.period,
        obsValue: obs.obsValue,
        unitCode: obs.unitCode,
        unitName: obs.unitName,
        multiplierCode: obs.multiplierCode,
        multiplierName: obs.multiplierName,
        dataSource: obs.dataSource,
        footnote: obs.footnote
      });
    });

    const seriesList = Array.from(seriesMap.values());

    const response = NextResponse.json({
      header: {
        totalSeriesCount: seriesList.length,
        totalObsCount: formattedData.length,
        periods: uniquePeriods
      },
      data: formattedData,
      series: seriesList,
      periods: uniquePeriods
    });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return response;
  } catch (err: any) {
    console.error('Public Data API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
