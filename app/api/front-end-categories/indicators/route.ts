import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { categorySetCode, categoryCode, assignments = [] } = body;

    if (!categorySetCode || !categoryCode) {
      return NextResponse.json({ error: 'categorySetCode and categoryCode are required.' }, { status: 400 });
    }

    // Verify category exists
    const categoryExists = await prisma.frontEndCategory.findUnique({
      where: {
        categorySetCode_code: {
          categorySetCode,
          code: categoryCode,
        },
      },
    });
    if (!categoryExists) {
      return NextResponse.json({ error: `Category ${categoryCode} does not exist in Category Set ${categorySetCode}.` }, { status: 404 });
    }

    // 1. Validate all assignments in memory
    const uniqueOrders = new Set<number>();
    const uniqueKeys = new Set<string>();

    for (let i = 0; i < assignments.length; i++) {
      const ass = assignments[i];
      const { agencyCode, datasetCode, sourceCodeListCode, indicatorCode, dataflowCode, sortOrder = 0 } = ass;

      if (!agencyCode || !datasetCode || !sourceCodeListCode || !indicatorCode) {
        return NextResponse.json(
          { error: `Assignment at index ${i} is missing required fields (agencyCode, datasetCode, sourceCodeListCode, indicatorCode).` },
          { status: 400 }
        );
      }

      // Check unique sortOrder within this category assignment set
      if (uniqueOrders.has(sortOrder)) {
        return NextResponse.json(
          { error: `Duplicate Indicator Order ID (${sortOrder}) detected. Each indicator assigned to a category must have a unique Order ID.` },
          { status: 400 }
        );
      }
      uniqueOrders.add(sortOrder);

      // Check duplicate indicator assignments in payload
      const uniqueKey = `${datasetCode}:${sourceCodeListCode}:${indicatorCode}`;
      if (uniqueKeys.has(uniqueKey)) {
        return NextResponse.json(
          { error: `Duplicate indicator [${uniqueKey}] detected in assignment list.` },
          { status: 400 }
        );
      }
      uniqueKeys.add(uniqueKey);

      // Verify agency exists in DB
      const agency = await prisma.agency.findUnique({ where: { code: agencyCode } });
      if (!agency) {
        return NextResponse.json({ error: `Agency ${agencyCode} does not exist in the database.` }, { status: 400 });
      }

      // Verify dataset exists in DB
      const dataset = await prisma.dataset.findUnique({ where: { code: datasetCode } });
      if (!dataset) {
        return NextResponse.json({ error: `Dataset ${datasetCode} does not exist in the database.` }, { status: 400 });
      }

      // Verify CodeListItem exists (combining codeListCode and itemCode)
      const codeListItem = await prisma.codeListItem.findUnique({
        where: {
          codeListCode_itemCode: {
            codeListCode: sourceCodeListCode,
            itemCode: indicatorCode,
          },
        },
      });
      if (!codeListItem) {
        return NextResponse.json(
          { error: `Indicator ${indicatorCode} does not exist in Code List ${sourceCodeListCode}.` },
          { status: 400 }
        );
      }

      // Verify optional dataflow matches if provided
      if (dataflowCode) {
        const dataflow = await prisma.dataflow.findUnique({
          where: {
            datasetCode_code: {
              datasetCode,
              code: dataflowCode,
            },
          },
        });
        if (!dataflow) {
          return NextResponse.json(
            { error: `Dataflow ${dataflowCode} does not exist under Dataset ${datasetCode}.` },
            { status: 400 }
          );
        }
      }
    }

    // 2. Perform updates inside a database transaction
    await prisma.$transaction(async (tx) => {
      // Clear current assignments
      await tx.frontEndCategoryIndicator.deleteMany({
        where: { categorySetCode, categoryCode },
      });

      // Insert new assignments
      if (assignments.length > 0) {
        await tx.frontEndCategoryIndicator.createMany({
          data: assignments.map((ass: any) => ({
            categorySetCode,
            categoryCode,
            agencyCode: ass.agencyCode,
            datasetCode: ass.datasetCode,
            sourceCodeListCode: ass.sourceCodeListCode,
            indicatorCode: ass.indicatorCode,
            dataflowCode: ass.dataflowCode || null,
            sortOrder: ass.sortOrder ?? 0,
          })),
        });
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_CATEGORY_INDICATOR_ASSIGNMENTS',
        entityType: 'FrontEndCategory',
        entityId: `${categorySetCode}:${categoryCode}`,
        newValues: { count: assignments.length } as any,
      },
    });

    return NextResponse.json({ success: true, message: `Successfully mapped ${assignments.length} indicators.` });
  } catch (err: any) {
    console.error('Assign Indicators Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { categorySetCode, updates } = body; // updates = Array<{ id, categoryCode, sortOrder }>

    if (!categorySetCode || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'categorySetCode and updates array are required.' },
        { status: 400 }
      );
    }

    // Fetch existing mappings for this category set
    const existing = await prisma.frontEndCategoryIndicator.findMany({
      where: { categorySetCode },
    });

    // Merge updates with existing records to construct the new list
    const newRecords = existing.map((rec) => {
      const up = updates.find((u: any) => u.id === rec.id);
      if (up) {
        return {
          categorySetCode: rec.categorySetCode,
          categoryCode: up.categoryCode,
          agencyCode: rec.agencyCode,
          datasetCode: rec.datasetCode,
          sourceCodeListCode: rec.sourceCodeListCode,
          indicatorCode: rec.indicatorCode,
          dataflowCode: rec.dataflowCode,
          sortOrder: up.sortOrder,
        };
      }
      return {
        categorySetCode: rec.categorySetCode,
        categoryCode: rec.categoryCode,
        agencyCode: rec.agencyCode,
        datasetCode: rec.datasetCode,
        sourceCodeListCode: rec.sourceCodeListCode,
        indicatorCode: rec.indicatorCode,
        dataflowCode: rec.dataflowCode,
        sortOrder: rec.sortOrder,
      };
    });

    // Execute clear and insert inside a transaction to prevent unique constraint conflicts
    await prisma.$transaction(async (tx) => {
      // Clear all mappings for this category set
      await tx.frontEndCategoryIndicator.deleteMany({
        where: { categorySetCode },
      });
      
      // Insert new mapped assignments
      if (newRecords.length > 0) {
        await tx.frontEndCategoryIndicator.createMany({
          data: newRecords,
        });
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'BULK_UPDATE_CATEGORY_INDICATORS',
        entityType: 'CategorySet',
        entityId: categorySetCode,
        newValues: { updatesCount: updates.length } as any,
      },
    });

    return NextResponse.json({ success: true, message: `Successfully updated ${updates.length} indicator positions.` });
  } catch (err: any) {
    console.error('Bulk Indicator Update Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
