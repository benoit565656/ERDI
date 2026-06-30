import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const { searchParams } = new URL(req.url);

    // Parse SDMX URL path components
    let dataflowCode = 'ALL';
    let freqParam = '';
    let indicatorsParam = '';
    let economiesParam = '';

    if (path && path.length > 0) {
      const flowPart = path[0];
      if (flowPart.includes(',')) {
        dataflowCode = flowPart.split(',')[1];
      } else {
        dataflowCode = flowPart;
      }
    }

    if (path && path.length > 1) {
      const dimPart = path[1];
      const dimSegments = dimPart.split('.');
      freqParam = dimSegments[0] || '';
      indicatorsParam = dimSegments[1] || '';
      economiesParam = dimSegments[2] || '';
    }

    // Support fallback searchParams override if provided
    if (searchParams.get('dataflow')) dataflowCode = searchParams.get('dataflow')!;
    if (searchParams.get('indicator')) indicatorsParam = searchParams.get('indicator')!;
    if (searchParams.get('economy')) economiesParam = searchParams.get('economy')!;

    const startPeriod = searchParams.get('startPeriod') || searchParams.get('start');
    const endPeriod = searchParams.get('endPeriod') || searchParams.get('end');
    const format = searchParams.get('format') || 'sdmx-ml'; // XML by default

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

    // 2. Fetch Observations
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
      take: 5000 // Cap to prevent memory crash
    });

    const uniqueIndicators = Array.from(new Set(observations.map(o => o.indicatorCode)));
    const uniqueEconomies = Array.from(new Set(observations.map(o => o.economyCode)));

    const [indicatorMeta, economyMeta] = await Promise.all([
      prisma.indicator.findMany({ where: { code: { in: uniqueIndicators } }, select: { code: true, name: true } }),
      prisma.economy.findMany({ where: { code: { in: uniqueEconomies } }, select: { code: true, name: true } })
    ]);

    const indicatorMap = new Map(indicatorMeta.map(i => [i.code, i.name]));
    const economyMap = new Map(economyMeta.map(e => [e.code, e.name]));

    // 3. Output as JSON if explicitly requested
    if (format === 'json' || format === 'sdmx-json') {
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

      return NextResponse.json({
        header: {
          id: `ERDI_${Date.now()}`,
          prepared: new Date().toISOString(),
          sender: 'ADB_ERDI',
          source: 'ERDI Data Platform',
          dataflow: dataflowCode,
          totalSeriesCount: seriesMap.size,
          totalObsCount: observations.length
        },
        series: Array.from(seriesMap.values())
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800'
        }
      });
    }

    // 4. Default format: SDMX XML (sdmx-ml)
    const timestamp = new Date().toISOString();
    let xml = `<?xml version="1.0" encoding="utf-8"?>
<message:StructureSpecificData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:ns1="urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=ADB:KIDB_DSD(1.0):ObsLevelDim:TIME_PERIOD" 
  xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/message" 
  xmlns:com="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/common" 
  xmlns:str="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/structure" 
  xmlns:ss="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/structurespecific">
  <message:Header>
    <message:ID>IREF${Math.floor(Math.random() * 1000000)}</message:ID>
    <message:Test>false</message:Test>
    <message:Prepared>${timestamp}</message:Prepared>
    <message:Sender>ADB_ERDI</message:Sender>
    <message:Receiver>Unknown</message:Receiver>
    <message:Structure structureID="ADB_${dataflowCode}_1_0" dimensionAtObservation="TIME_PERIOD" namespace="urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=ADB:${dataflowCode}(1.0)">
      <com:StructureUsage>urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=ADB:${dataflowCode}(1.0)</com:StructureUsage>
    </message:Structure>
    <message:DataSetAction>Information</message:DataSetAction>
    <message:Extracted>${timestamp}</message:Extracted>
    <message:Source>ERDI Database</message:Source>
  </message:Header>
  <message:DataSet ss:structureRef="ADB_KIDB_DSD_1_0" xsi:type="ns1:DataSetType">`;

    // Group observations by Series
    const seriesMap = new Map<string, any[]>();
    observations.forEach(o => {
      const key = `${o.freqCode || 'A'}__${o.indicatorCode}__${o.economyCode}`;
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key)!.push(o);
    });

    for (const [key, obsList] of seriesMap.entries()) {
      const firstObs = obsList[0];
      xml += `\n    <Series FREQ="${firstObs.freqCode || 'A'}" INDICATOR="${firstObs.indicatorCode}" ECONOMY_CODE="${firstObs.economyCode}">`;
      
      obsList.forEach(obs => {
        const obsValue = obs.obsValue !== null ? Number(obs.obsValue) : '';
        const cleanFootnote = obs.footnote ? obs.footnote.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        const cleanDataSource = obs.dataSource ? obs.dataSource.replace(/"/g, '&quot;') : '';
        
        xml += `\n      <Obs TIME_PERIOD="${obs.period}" OBS_VALUE="${obsValue}" UNIT="${obs.unitCode || 'PERSONS'}" UNIT_MULT="${obs.unitMultCode || '0'}" DECIMALS="${obs.decimalsCode || '1'}" OBS_STATUS="${obs.obsStatusCode || 'A'}" REF_YEAR="${obs.refYear || ''}" BASE_YEAR="${obs.baseYear || ''}" DATA_SOURCE="${cleanDataSource}" METHODOLOGY="" FOOTNOTE="${cleanFootnote}"/>`;
      });
      
      xml += `\n    </Series>`;
    }

    xml += `\n  </message:DataSet>\n</message:StructureSpecificData>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800'
      }
    });
  } catch (err: any) {
    return new Response(`<error>${err.message}</error>`, {
      status: 500,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}
