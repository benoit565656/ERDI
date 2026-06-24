import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LifeCycleStatus } from '@prisma/client';

export async function GET() {
  try {
    const dataflows = await prisma.dataflow.findMany({
      include: {
        dataset: true,
        parent: true,
      },
      orderBy: [
        { datasetCode: 'asc' },
        { sortOrder: 'asc' },
        { code: 'asc' },
      ],
    });

    const indicators = await prisma.dataflowIndicator.findMany({
      where: { isActive: true },
    });

    // Helper to recursively collect all unique indicator codes
    const getRecursiveIndicators = (
      code: string,
      directMap: Map<string, Set<string>>,
      childrenMap: Map<string, string[]>
    ): Set<string> => {
      const result = new Set<string>(directMap.get(code) || []);
      const children = childrenMap.get(code) || [];
      for (const child of children) {
        const childSet = getRecursiveIndicators(child, directMap, childrenMap);
        childSet.forEach(c => result.add(c));
      }
      return result;
    };

    // Group by datasetCode for tree boundaries
    const dfByDataset = new Map<string, typeof dataflows>();
    for (const df of dataflows) {
      if (!dfByDataset.has(df.datasetCode)) {
        dfByDataset.set(df.datasetCode, []);
      }
      dfByDataset.get(df.datasetCode)!.push(df);
    }

    const indByDataset = new Map<string, typeof indicators>();
    for (const ind of indicators) {
      if (!indByDataset.has(ind.datasetCode)) {
        indByDataset.set(ind.datasetCode, []);
      }
      indByDataset.get(ind.datasetCode)!.push(ind);
    }

    const results = dataflows.map(df => {
      const datasetCode = df.datasetCode;
      const datasetDFs = dfByDataset.get(datasetCode) || [];
      const datasetInds = indByDataset.get(datasetCode) || [];

      // Build maps
      const directMap = new Map<string, Set<string>>();
      for (const ind of datasetInds) {
        if (!directMap.has(ind.dataflowCode)) {
          directMap.set(ind.dataflowCode, new Set());
        }
        directMap.get(ind.dataflowCode)!.add(ind.indicatorCode);
      }

      const childrenMap = new Map<string, string[]>();
      for (const d of datasetDFs) {
        if (d.parentCode) {
          if (!childrenMap.has(d.parentCode)) {
            childrenMap.set(d.parentCode, []);
          }
          childrenMap.get(d.parentCode)!.push(d.code);
        }
      }

      const allIndicators = getRecursiveIndicators(df.code, directMap, childrenMap);

      return {
        ...df,
        _count: {
          dataflowIndicators: allIndicators.size
        }
      };
    });

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      code,
      datasetCode,
      name,
      description,
      dataflowLevel,
      parentCode,
      dsdCode,
      sortOrder,
      status,
      indicators, // Array of indicator codes to map
    } = body;

    if (!code || !datasetCode || !name || !dataflowLevel) {
      return NextResponse.json({ error: 'Code, Dataset, Name, and Level are required.' }, { status: 400 });
    }

    // Upsert Dataflow
    const dataflow = await prisma.dataflow.upsert({
      where: {
        datasetCode_code: {
          datasetCode,
          code,
        },
      },
      update: {
        name,
        description,
        dataflowLevel: dataflowLevel ? parseInt(dataflowLevel, 10) : 1,
        parentCode: parentCode || null,
        dsdCode: dsdCode || null,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        status: status as LifeCycleStatus,
      },
      create: {
        code,
        datasetCode,
        name,
        description,
        dataflowLevel: dataflowLevel ? parseInt(dataflowLevel, 10) : 1,
        parentCode: parentCode || null,
        dsdCode: dsdCode || null,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        status: (status as LifeCycleStatus) || 'ACTIVE',
      },
    });

    // If indicator codes are provided, sync mapping (shuttle/transfer list)
    if (Array.isArray(indicators)) {
      // Delete existing
      await prisma.dataflowIndicator.deleteMany({
        where: { datasetCode, dataflowCode: code },
      });

      // Insert new in chunks
      const mappingData = indicators.map(indCode => ({
        datasetCode,
        dataflowCode: code,
        indicatorCode: indCode,
        sortOrder: 0,
      }));

      if (mappingData.length > 0) {
        await prisma.dataflowIndicator.createMany({
          data: mappingData,
          skipDuplicates: true,
        });
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_DATAFLOW',
        entityType: 'Dataflow',
        entityId: `${datasetCode}:${code}`,
        newValues: { code, datasetCode, name, dataflowLevel, parentCode } as any,
      },
    });

    return NextResponse.json(dataflow);
  } catch (err: any) {
    console.error('Dataflow API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
