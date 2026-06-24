import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const datasetCode = searchParams.get('datasetCode');
    const dataflowCode = searchParams.get('dataflowCode');

    if (type === 'datasets') {
      const list = await prisma.dataset.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(d => ({ label: `[${d.code}] ${d.name}`, value: d.code })));
    }

    if (type === 'dataflows') {
      const where: any = {};
      if (datasetCode) {
        where.datasetCode = datasetCode;
      }
      const list = await prisma.dataflow.findMany({
        where,
        orderBy: { code: 'asc' },
      });
      return NextResponse.json(list.map(d => ({ label: `[${d.code}] ${d.name}`, value: d.code })));
    }

    if (type === 'indicators') {
      const where: any = {};
      if (dataflowCode) {
        // Fetch all dataflows in the same dataset as target to trace child hierarchies
        const targetDf = await prisma.dataflow.findFirst({
          where: { code: dataflowCode }
        });

        if (targetDf) {
          const allDatasetDFs = await prisma.dataflow.findMany({
            where: { datasetCode: targetDf.datasetCode }
          });

          // Build parent-children index
          const childrenMap = new Map<string, string[]>();
          for (const df of allDatasetDFs) {
            if (df.parentCode) {
              if (!childrenMap.has(df.parentCode)) {
                childrenMap.set(df.parentCode, []);
              }
              childrenMap.get(df.parentCode)!.push(df.code);
            }
          }

          // Recursively collect descendant dataflow codes
          const dataflowCodes = new Set<string>([dataflowCode]);
          const collectDescendants = (code: string) => {
            const children = childrenMap.get(code) || [];
            for (const child of children) {
              if (!dataflowCodes.has(child)) {
                dataflowCodes.add(child);
                collectDescendants(child);
              }
            }
          };
          collectDescendants(dataflowCode);

          where.dataflowIndicators = {
            some: {
              dataflowCode: { in: Array.from(dataflowCodes) },
              datasetCode: targetDf.datasetCode
            },
          };
        }
      }
      const list = await prisma.indicator.findMany({
        where,
        orderBy: { code: 'asc' },
      });
      return NextResponse.json(list.map(i => ({ label: `[${i.code}] ${i.name}`, value: i.code })));
    }

    if (type === 'economies') {
      const list = await prisma.economy.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(e => ({ label: `[${e.code}] ${e.name}`, value: e.code })));
    }

    if (type === 'units') {
      const list = await prisma.commonUnit.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(u => ({ label: `[${u.code}] ${u.name}`, value: u.code })));
    }

    if (type === 'multipliers') {
      const list = await prisma.commonMultiplier.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(m => ({ label: `${m.name} (x${m.factor.toString()})`, value: m.code })));
    }

    if (type === 'decimals') {
      const list = await prisma.codeListItem.findMany({
        where: { codeListCode: 'CL_DECIMALS' },
        orderBy: { sortOrder: 'asc' },
      });
      return NextResponse.json(list.map(item => ({ label: `${item.itemName} (${item.itemCode})`, value: item.itemCode })));
    }

    if (type === 'obs_status') {
      const list = await prisma.codeListItem.findMany({
        where: { codeListCode: 'CL_OBS_STATUS' },
        orderBy: { sortOrder: 'asc' },
      });
      return NextResponse.json(list.map(item => ({ label: `[${item.itemCode}] ${item.itemName}`, value: item.itemCode })));
    }

    return NextResponse.json({ error: 'Invalid type parameter.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

