import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DataflowLevel } from '@prisma/client';

export async function GET() {
  try {
    const dataflows = await prisma.dataflow.findMany({
      include: {
        dataset: true,
        parent: true,
        _count: {
          select: { dataflowIndicators: true },
        },
      },
      orderBy: [
        { datasetCode: 'asc' },
        { sortOrder: 'asc' },
        { code: 'asc' },
      ],
    });
    return NextResponse.json(dataflows);
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
        dataflowLevel: dataflowLevel as DataflowLevel,
        parentCode: parentCode || null,
        dsdCode: dsdCode || null,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
      },
      create: {
        code,
        datasetCode,
        name,
        description,
        dataflowLevel: dataflowLevel as DataflowLevel,
        parentCode: parentCode || null,
        dsdCode: dsdCode || null,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
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
