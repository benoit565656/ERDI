import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { memoryCache } from '@/lib/cache';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const { searchParams } = new URL(req.url);

    // Parse SDMX URL path components
    // Example path: ['ADB,PPL_POP', 'A..'] or ['ADB,EO_NA', 'A.NGDP_XDC+NGDPVA_XDC.PHI+SIN+JPN']
    let dataflowCode = 'ALL';
    let freqParam = '';
    let indicatorsParam = '';
    let economiesParam = '';

    if (path && path.length > 0) {
      const flowPart = path[0]; // e.g. 'ADB,PPL_POP' or 'EO_NA' or 'PPL'
      if (flowPart.includes(',')) {
        dataflowCode = flowPart.split(',')[1];
      } else {
        dataflowCode = flowPart;
      }
    }

    if (path && path.length > 1) {
      const dimPart = path[1]; // e.g. 'A..' or 'A.NGDP_XDC+NGDPVA_XDC.PHI+SIN+JPN'
      const dimSegments = dimPart.split('.');
      freqParam = dimSegments[0] || '';
      indicatorsParam = dimSegments[1] || '';
      economiesParam = dimSegments[2] || '';
    }

    // Also support fallback searchParams override if provided
    if (searchParams.get('dataflow')) dataflowCode = searchParams.get('dataflow')!;
    if (searchParams.get('indicator')) indicatorsParam = searchParams.get('indicator')!;
    if (searchParams.get('economy')) economiesParam = searchParams.get('economy')!;

    const startPeriod = searchParams.get('startPeriod') || searchParams.get('start');
    const endPeriod = searchParams.get('endPeriod') || searchParams.get('end');

    // 1. Build whereClause for observations
    const whereClause: any = {
      isPublished: true,
      deletedAt: null
    };

    // Dataflow filter
    if (dataflowCode && dataflowCode !== 'ALL' && dataflowCode !== '*') {
      const dfs = dataflowCode.split('+').flatMap(d => d.split(',')).map(d => d.trim());
      whereClause.OR = [
        { mainDataflowCode: { in: dfs } },
        { secondaryDataflowCode: { in: dfs } },
      ];
    }

    // Indicator filter (Empty, '.', '*', or missing = ALL indicators)
    if (indicatorsParam && indicatorsParam !== '.' && indicatorsParam !== '*' && indicatorsParam !== 'ALL') {
      const rawInds = indicatorsParam.split('+').flatMap(i => i.split(',')).map(i => i.trim()).filter(Boolean);
      if (rawInds.length > 0) {
        whereClause.indicatorCode = { in: rawInds };
      }
    }

    // Economy filter (Empty, '.', '*', or missing = ALL economies)
    if (economiesParam && economiesParam !== '.' && economiesParam !== '*' && economiesParam !== 'ALL') {
      const rawEcons = economiesParam.split('+').flatMap(e => e.split(',')).map(e => e.trim()).filter(Boolean);
      if (rawEcons.length > 0) {
        whereClause.economyCode = { in: rawEcons };
      }
    }

    // Period range filter
    if (startPeriod || endPeriod) {
      whereClause.period = {};
      if (startPeriod) whereClause.period.gte = startPeriod;
      if (endPeriod) whereClause.period.lte = endPeriod;
    }

    // Frequency filter
    if (freqParam && freqParam !== '*' && freqParam !== '.') {
      whereClause.freqCode = freqParam;
    }

    // 2. Fetch Observations cleanly
    const observations = await prisma.observation.findMany({
      where: whereClause,
      select: {
        id: true,
        datasetCode: true,
        mainDataflowCode: true,
        secondaryDataflowCode: true,
        indicatorCode: true,
        economyCode: true,
        period: true,
        freqCode: true,
        obsValue: true,
        unitCode: true,
        unitMultCode: true,
        dataSource: true,
        footnote: true,
        decimalsCode: true,
        obsStatusCode: true,
        refYear: true,
        baseYear: true
      },
      orderBy: [
        { indicatorCode: 'asc' },
        { economyCode: 'asc' },
        { period: 'asc' }
      ],
      take: 5000 // Cap to prevent memory crash on massive queries
    });

    // 3. Fast metadata lookups
    const uniqueIndicators = Array.from(new Set(observations.map(o => o.indicatorCode)));
    const uniqueEconomies = Array.from(new Set(observations.map(o => o.economyCode)));

    const [indicatorMeta, economyMeta] = await Promise.all([
      prisma.indicator.findMany({ where: { code: { in: uniqueIndicators } }, select: { code: true, name: true } }),
      prisma.economy.findMany({ where: { code: { in: uniqueEconomies } }, select: { code: true, name: true } })
    ]);

    const indicatorMap = new Map(indicatorMeta.map(i => [i.code, i.name]));
    const economyMap = new Map(economyMeta.map(e => [e.code, e.name]));

    // 4. Group observations into SDMX Series
    const seriesMap = new Map<string, any>();

    observations.forEach(obs => {
      const seriesKey = `${obs.indicatorCode}__${obs.economyCode}__${obs.freqCode || 'A'}`;
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          freq: obs.freqCode || 'A',
          indicatorCode: obs.indicatorCode,
          indicatorName: indicatorMap.get(obs.indicatorCode) || obs.indicatorCode,
          economyCode: obs.economyCode,
          economyName: economyMap.get(obs.economyCode) || obs.economyCode,
          datasetCode: obs.datasetCode,
          dataflowCode: obs.secondaryDataflowCode || obs.mainDataflowCode || dataflowCode,
          observations: []
        });
      }

      seriesMap.get(seriesKey).observations.push({
        period: obs.period,
        obsValue: obs.obsValue !== null ? Number(obs.obsValue) : null,
        unitCode: obs.unitCode || '',
        multiplierCode: obs.unitMultCode || '',
        decimals: obs.decimalsCode || '1',
        status: obs.obsStatusCode || 'A',
        refYear: obs.refYear || '',
        baseYear: obs.baseYear || '',
        dataSource: obs.dataSource || '',
        footnote: obs.footnote || ''
      });
    });

    const seriesList = Array.from(seriesMap.values());

    return NextResponse.json({
      header: {
        id: `ERDI_${Date.now()}`,
        prepared: new Date().toISOString(),
        sender: 'ADB_ERDI',
        source: 'ERDI Data Platform',
        dataflow: dataflowCode,
        totalSeriesCount: seriesList.length,
        totalObsCount: observations.length
      },
      series: seriesList
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
