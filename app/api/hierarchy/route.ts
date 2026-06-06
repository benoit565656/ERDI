import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DataflowLevel } from '@prisma/client';

export async function GET() {
  try {
    const [agencies, datasets, dataflows] = await Promise.all([
      prisma.agency.findMany({ orderBy: { code: 'asc' } }),
      prisma.dataset.findMany({ orderBy: { code: 'asc' } }),
      prisma.dataflow.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    return NextResponse.json({ agencies, datasets, dataflows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { draggedType, draggedCode, datasetCode, targetParentType, targetParentCode } = body;

    if (!draggedType || !draggedCode || !targetParentType || !targetParentCode) {
      return NextResponse.json(
        { error: 'draggedType, draggedCode, targetParentType, and targetParentCode are required.' },
        { status: 400 }
      );
    }

    if (draggedType === 'dataset') {
      // Dragged a dataset under an agency
      if (targetParentType !== 'agency') {
        return NextResponse.json({ error: 'Datasets can only be nested under Agencies.' }, { status: 400 });
      }

      await prisma.dataset.update({
        where: { code: draggedCode },
        data: { agencyCode: targetParentCode },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'MOVE_DATASET',
          entityType: 'Dataset',
          entityId: draggedCode,
          newValues: { agencyCode: targetParentCode } as any,
        },
      });

      return NextResponse.json({ success: true, message: `Dataset ${draggedCode} moved under Agency ${targetParentCode}` });
    }

    if (draggedType === 'dataflow') {
      if (!datasetCode) {
        return NextResponse.json({ error: 'datasetCode is required when moving a dataflow.' }, { status: 400 });
      }

      if (targetParentType === 'dataset') {
        // Nested directly under dataset (root category)
        await prisma.dataflow.update({
          where: {
            datasetCode_code: {
              datasetCode,
              code: draggedCode,
            },
          },
          data: {
            parentCode: null,
            dataflowLevel: DataflowLevel.MAIN,
          },
        });
      } else if (targetParentType === 'dataflow') {
        // Nested under another dataflow (sub-category)
        await prisma.dataflow.update({
          where: {
            datasetCode_code: {
              datasetCode,
              code: draggedCode,
            },
          },
          data: {
            parentCode: targetParentCode,
            dataflowLevel: DataflowLevel.SECONDARY,
          },
        });
      } else {
        return NextResponse.json({ error: 'Dataflows can only be nested under Datasets or other Dataflows.' }, { status: 400 });
      }

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'MOVE_DATAFLOW',
          entityType: 'Dataflow',
          entityId: `${datasetCode}:${draggedCode}`,
          newValues: { parentCode: targetParentCode, targetParentType } as any,
        },
      });

      return NextResponse.json({ success: true, message: `Dataflow ${draggedCode} updated parent to ${targetParentCode}` });
    }

    return NextResponse.json({ error: 'Invalid draggedType.' }, { status: 400 });
  } catch (err: any) {
    console.error('Hierarchy Update Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
