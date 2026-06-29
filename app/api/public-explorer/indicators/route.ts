import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export async function GET() {
  try {
    // 1. Fetch active dataset-indicator-economy mappings from ExplorerCache table
    const cacheRecords = await prisma.explorerCache.findMany({
      select: {
        datasetCode: true,
        indicatorCode: true,
        economyCode: true,
      },
      distinct: ['datasetCode', 'indicatorCode', 'economyCode']
    });

    // Map dataset:indicator -> Set of economy codes
    const indicatorEconomiesMap = new Map<string, Set<string>>();
    cacheRecords.forEach(r => {
      const key = `${r.datasetCode}:${r.indicatorCode}`;
      if (!indicatorEconomiesMap.has(key)) {
        indicatorEconomiesMap.set(key, new Set());
      }
      indicatorEconomiesMap.get(key)!.add(r.economyCode);
    });

    // 2. Fetch all indicators from indicators table
    const indicators = await prisma.indicator.findMany({
      where: { status: 'ACTIVE' },
      include: {
        indicatorDatasetMetadata: {
          select: {
            datasetCode: true,
            name: true,
            description: true,
            sourceNotes: true,
            methodology: true,
          }
        }
      }
    });

    // Create a map of indicatorCode -> indicator record
    const indicatorDetailsMap = new Map<string, any>();
    indicators.forEach(ind => {
      indicatorDetailsMap.set(ind.code, ind);
    });

    // 3. Fetch category indicator mappings
    const categoryIndicators = await prisma.frontEndCategoryIndicator.findMany({
      where: {
        category: {
          categorySetCode: 'DATA_EXPLORER',
          isVisible: true,
        }
      },
      include: {
        category: {
          select: {
            code: true,
            name: true,
            parentCode: true,
            hierarchyPath: true,
          }
        },
        codeListItem: {
          select: {
            itemName: true,
            description: true
          }
        }
      }
    });

    // Get all categories to build ancestor paths
    const allCategories = await prisma.frontEndCategory.findMany({
      where: {
        categorySetCode: 'DATA_EXPLORER',
        isVisible: true,
      },
      select: {
        code: true,
        name: true,
        parentCode: true,
      }
    });

    const catMap = new Map<string, { name: string; parentCode: string | null }>();
    allCategories.forEach(c => {
      catMap.set(c.code, { name: c.name, parentCode: c.parentCode });
    });

    const getCategoryPath = (catCode: string): string[] => {
      const path: string[] = [];
      let current = catMap.get(catCode);
      while (current) {
        path.unshift(current.name);
        current = current.parentCode ? catMap.get(current.parentCode) : undefined;
      }
      return path;
    };

    // 4. Process indicators
    const indicatorsList: any[] = [];

    categoryIndicators.forEach(mapping => {
      const key = `${mapping.datasetCode}:${mapping.indicatorCode}`;
      
      // EEMRIOT indicators are frontend-only
      const hasObs = mapping.datasetCode === 'EEMRIOT' || indicatorEconomiesMap.has(key);
      if (!hasObs) return;

      const indicatorRec = indicatorDetailsMap.get(mapping.indicatorCode);
      
      const resolvedName = mapping.codeListItem?.itemName || mapping.indicatorCode;
      const resolvedDef = indicatorRec?.definition || mapping.codeListItem?.description || indicatorRec?.description || '';
      const resolvedSource = indicatorRec?.source || '';
      const resolvedMethodology = indicatorRec?.methodology || '';

      const compositeKey = `ind:${mapping.datasetCode}:${mapping.indicatorCode}`;
      
      // Fetch specific dataset metadata overrides if any
      const dsMeta = indicatorRec?.indicatorDatasetMetadata?.find((m: any) => m.datasetCode === mapping.datasetCode);
      const name = dsMeta?.name || resolvedName;
      const definition = dsMeta?.description || resolvedDef;
      const source = dsMeta?.sourceNotes || resolvedSource;
      const methodology = dsMeta?.methodology || resolvedMethodology;

      // Resolve active economies for this indicator
      let economies: string[] = [];
      if (mapping.datasetCode === 'EEMRIOT') {
        economies = ['AFG', 'ARM', 'AUS', 'AZE', 'BGD', 'BTN', 'BRN', 'KHM', 'COK', 'FJI', 'GEO', 'HKG', 'IND', 'IDN', 'JPN', 'KAZ', 'KGZ', 'KOR', 'LAO', 'MYS', 'MDV', 'MHL', 'FSM', 'MNG', 'MMR', 'NRU', 'NPL', 'NZL', 'PAK', 'PLW', 'PNG', 'PHL', 'WSM', 'SGP', 'SLB', 'LKA', 'TAP', 'TJK', 'THA', 'TLS', 'TON', 'TKM', 'TUV', 'UZB', 'VUT', 'VNM'];
      } else {
        economies = Array.from(indicatorEconomiesMap.get(key) || []);
      }

      // Path
      const path = getCategoryPath(mapping.categoryCode);

      // Avoid duplicating indicator entries if mapped to multiple UI categories
      const existing = indicatorsList.find(i => i.key === compositeKey);
      if (existing) {
        if (!existing.topics.includes(mapping.category.name)) {
          existing.topics.push(mapping.category.name);
        }
        return;
      }

      indicatorsList.push({
        key: compositeKey,
        code: mapping.indicatorCode,
        name,
        datasetCode: mapping.datasetCode,
        definition,
        source,
        methodology,
        economies,
        topics: [mapping.category.name],
        categoryCode: mapping.categoryCode,
        categoryPath: path,
      });
    });

    const response = NextResponse.json(indicatorsList);
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;
  } catch (err: any) {
    console.error('API indicators error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
