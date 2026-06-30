import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { memoryCache } from '@/lib/cache';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dataflowsParam = searchParams.get('dataflows') || searchParams.get('dataflow');
    const indicatorsParam = searchParams.get('indicators') || searchParams.get('indicator');
    const economiesParam = searchParams.get('economies') || searchParams.get('economy');
    const periodsParam = searchParams.get('periods') || searchParams.get('period');
    const startPeriod = searchParams.get('startPeriod') || searchParams.get('start');
    const endPeriod = searchParams.get('endPeriod') || searchParams.get('end');
    const format = searchParams.get('format') || 'sdmx-ml'; // XML by default

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

    // 3. Build base where clause (Datasets parameter is removed completely)
    const whereClause: any = {
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

    // 4. Fast O(1) lookup maps with memory cache
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

    // 5. Fetch observations
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
      take: 5000
    });

    // 6. Extract unique codes for fast metadata lookup maps
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

    const dataflowCode = dataflowsParam || 'ALL';

    // 7. Output as JSON if explicitly requested
    if (format === 'json' || format === 'sdmx-json') {
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

      const response = NextResponse.json({
        header: {
          totalSeriesCount: seriesMap.size,
          totalObsCount: formattedData.length,
          periods: uniquePeriods
        },
        data: formattedData,
        series: Array.from(seriesMap.values()),
        periods: uniquePeriods
      });
      response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
      return response;
    }

    // 8. Default format: SDMX XML (sdmx-ml)
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
