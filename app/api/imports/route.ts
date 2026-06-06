import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const batches = await prisma.importBatch.findMany({
      include: { dataset: true },
      orderBy: { uploadedAt: 'desc' },
    });
    return NextResponse.json(batches);
  } catch (err: any) {
    console.error('Imports GET API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      datasetCode,
      importType,
      fileName,
      status = 'IMPORTED',
      totalRows = 0,
      validRows = 0,
      invalidRows = 0,
      warningRows = 0,
      uploadedBy = 'admin',
    } = body;

    if (!importType || !fileName) {
      return NextResponse.json(
        { error: 'Import Type and File Name are required.' },
        { status: 400 }
      );
    }

    const data: any = {
      importType,
      fileName,
      status,
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      uploadedBy,
      completedAt: new Date(),
    };

    if (datasetCode) {
      data.dataset = { connect: { code: datasetCode } };
    }

    const batch = await prisma.importBatch.create({
      data,
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'IMPORT_BATCH_COMPLETE',
        entityType: 'ImportBatch',
        entityId: batch.id,
        newValues: batch as any,
      },
    });

    return NextResponse.json(batch);
  } catch (err: any) {
    console.error('Imports POST API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
