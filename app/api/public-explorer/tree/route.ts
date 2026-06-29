import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetsParam = searchParams.get('datasets');

    // 1. Determine selected datasets
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

    // 2. Fetch active dataset-indicator mappings directly from ExplorerCache table (ultra-fast 400ms query)
    const cacheRecords = await prisma.explorerCache.findMany({
      where: {
        datasetCode: { in: selectedDatasets }
      },
      select: {
        datasetCode: true,
        indicatorCode: true,
      },
      distinct: ['datasetCode', 'indicatorCode']
    });

    const activeSet = new Set(cacheRecords.map(r => `${r.datasetCode}:${r.indicatorCode}`));

    // 3. Fetch categories and indicators for DATA_EXPLORER category set
    const categories = await prisma.frontEndCategory.findMany({
      where: {
        categorySetCode: 'DATA_EXPLORER',
        isVisible: true,
      },
      include: {
        indicators: {
          include: {
            codeListItem: {
              select: {
                itemName: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    // 4. Sort categories by hierarchyPath segment-by-segment (e.g. 9.2 comes before 9.10)
    categories.sort((a, b) => {
      const partsA = (a.hierarchyPath || '').split('.').map(Number);
      const partsB = (b.hierarchyPath || '').split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const valA = partsA[i] ?? 0;
        const valB = partsB[i] ?? 0;
        if (valA !== valB) return valA - valB;
      }
      return 0;
    });

    // 5. Filter indicators inside categories using Cache, and resolve name ambiguity
    const processedCategories = categories.map(cat => {
      // Keep only indicators that have observations in the cache
      const visibleIndicators = cat.indicators.filter(ind => 
        ind.datasetCode === 'EEMRIOT' || activeSet.has(`${ind.datasetCode}:${ind.indicatorCode}`)
      );

      // Count occurrences of names to check for collisions in the same category
      const nameCounts = new Map<string, number>();
      visibleIndicators.forEach(ind => {
        const name = ind.codeListItem?.itemName || ind.indicatorCode;
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      });

      // Build indicator nodes
      const indicatorNodes = visibleIndicators.map(ind => {
        const name = ind.codeListItem?.itemName || ind.indicatorCode;
        const hasCollision = (nameCounts.get(name) || 0) > 1;
        const displayName = hasCollision ? `${name} (${ind.datasetCode})` : name;

        return {
          key: `ind:${ind.datasetCode}:${ind.indicatorCode}`,
          title: displayName,
          code: ind.indicatorCode,
          datasetCode: ind.datasetCode,
          isLeaf: true,
        };
      });

      return {
        ...cat,
        indicatorNodes,
      };
    });

    // 6. Build the tree structure dynamically and prune empty branches
    // Map category code to category node
    const nodeMap = new Map<string, any>();
    processedCategories.forEach(cat => {
      nodeMap.set(cat.code, {
        key: `cat:${cat.code}`,
        title: cat.name,
        code: cat.code,
        parentCode: cat.parentCode,
        isLeaf: false,
        children: [...cat.indicatorNodes],
      });
    });

    // Link parents and children
    const rootNodes: any[] = [];
    processedCategories.forEach(cat => {
      const node = nodeMap.get(cat.code);
      if (cat.parentCode && nodeMap.has(cat.parentCode)) {
        const parentNode = nodeMap.get(cat.parentCode);
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Recursive helper to prune empty categories bottom-up
    const pruneEmptyBranches = (node: any): boolean => {
      if (node.isLeaf) return true; // Leaf indicator nodes are always kept

      // Prune children recursively
      node.children = node.children.filter((child: any) => pruneEmptyBranches(child));

      // Keep this category if it contains any visible indicators or subcategories
      return node.children.length > 0;
    };


    const cleanTree = rootNodes.filter(node => pruneEmptyBranches(node));

    const response = NextResponse.json(cleanTree);
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;
  } catch (err: any) {
    console.error('Public Tree API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
