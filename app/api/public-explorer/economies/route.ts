import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ISO3_TO_ISO2 } from '@/lib/country';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetsParam = searchParams.get('datasets');
    const indicatorsParam = searchParams.get('indicators');

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

    // 2. Determine selected indicators
    let selectedIndicators: string[] = [];
    if (indicatorsParam && indicatorsParam !== '') {
      selectedIndicators = indicatorsParam.split(',').map(i => i.trim());
    }

    // 3. Find active economies from Cache
    const whereClause: any = {
      datasetCode: { in: selectedDatasets }
    };
    if (selectedIndicators.length > 0) {
      whereClause.indicatorCode = { in: selectedIndicators };
    }

    const cacheRecords = await prisma.explorerCache.findMany({
      where: whereClause,
      select: {
        economyCode: true
      },
      distinct: ['economyCode']
    });

    const activeEconomyCodes = cacheRecords.map(r => r.economyCode);

    if (activeEconomyCodes.length === 0) {
      return NextResponse.json([]);
    }

    // 4. Fetch all active countries
    const countries = await prisma.economy.findMany({
      where: {
        code: { in: activeEconomyCodes },
        isActive: true,
      },
      orderBy: { code: 'asc' }
    });

    // 5. Fetch their parent regions
    const activeRegionCodes = Array.from(new Set(countries.map(c => c.parentCode).filter(Boolean))) as string[];
    const regions = await prisma.economy.findMany({
      where: {
        code: { in: activeRegionCodes },
        isActive: true,
      },
      orderBy: { code: 'asc' }
    });

    // 6. Build nested hierarchy tree (Region -> Country)
    const nodeMap = new Map<string, any>();
    regions.forEach(reg => {
      nodeMap.set(reg.code, {
        key: `reg:${reg.code}`,
        title: reg.name,
        code: reg.code,
        isLeaf: false,
        children: []
      });
    });

    const rootNodes: any[] = [];
    countries.forEach(c => {
      const countryNode = {
        key: `eco:${c.code}`,
        title: c.name,
        code: c.code,
        isLeaf: true,
        iso2: ISO3_TO_ISO2[c.code.toUpperCase()] || null,
      };

      if (c.parentCode && nodeMap.has(c.parentCode)) {
        const regionNode = nodeMap.get(c.parentCode);
        regionNode.children.push(countryNode);
      } else {
        rootNodes.push(countryNode);
      }
    });

    // Add regions to root if they have any visible children
    regions.forEach(reg => {
      const node = nodeMap.get(reg.code);
      if (node.children.length > 0) {
        rootNodes.push(node);
      }
    });

    // Sort root nodes (regions first, then orphan countries)
    rootNodes.sort((a, b) => {
      const isALeaf = a.isLeaf ? 1 : 0;
      const isBLeaf = b.isLeaf ? 1 : 0;
      if (isALeaf !== isBLeaf) return isALeaf - isBLeaf;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json(rootNodes);
  } catch (err: any) {
    console.error('Public Economies API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
