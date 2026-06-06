import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.pageConfig.findMany({
      include: {
        dataset: true,
        targetUnit: true,
        targetMultiplier: true,
        pageConfigDataflows: true,
        pageConfigIndicators: true,
        pageConfigEconomies: true,
        pageConfigVisualizations: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(configs);
  } catch (err: any) {
    console.error('Explorer PageConfig GET API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      pageType,
      slug,
      title,
      description,
      datasetCode,
      defaultView,
      useHarmonizedValues = false,
      targetUnitCode,
      targetMultiplierCode,
      isPublished = false,
      dataflows = [],
      indicators = [],
      economies = [],
      visualizations = [],
    } = body;

    if (!pageType || !slug || !title || !datasetCode) {
      return NextResponse.json(
        { error: 'Page Type, Slug, Title, and Dataset Code are required.' },
        { status: 400 }
      );
    }

    const data: any = {
      pageType,
      slug,
      title,
      description,
      dataset: { connect: { code: datasetCode } },
      defaultView,
      useHarmonizedValues,
      isPublished,
    };

    if (targetUnitCode) {
      data.targetUnit = { connect: { code: targetUnitCode } };
    }
    if (targetMultiplierCode) {
      data.targetMultiplier = { connect: { code: targetMultiplierCode } };
    }

    let config;
    if (id) {
      // Update
      // Clear existing child lists first
      await Promise.all([
        prisma.pageConfigDataflow.deleteMany({ where: { pageConfigId: id } }),
        prisma.pageConfigIndicator.deleteMany({ where: { pageConfigId: id } }),
        prisma.pageConfigEconomy.deleteMany({ where: { pageConfigId: id } }),
        prisma.pageConfigVisualization.deleteMany({ where: { pageConfigId: id } }),
      ]);

      config = await prisma.pageConfig.update({
        where: { id },
        data: {
          ...data,
          pageConfigDataflows: {
            create: dataflows.map((code: string, idx: number) => ({
              dataflowCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigIndicators: {
            create: indicators.map((code: string, idx: number) => ({
              indicatorCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigEconomies: {
            create: economies.map((code: string, idx: number) => ({
              economyCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigVisualizations: {
            create: visualizations.map((vis: any, idx: number) => ({
              visualizationType: vis.visualizationType,
              title: vis.title || '',
              configJson: vis.configJson || {},
              sortOrder: idx,
              isActive: vis.isActive !== false,
            })),
          },
        },
      });
    } else {
      // Create
      config = await prisma.pageConfig.create({
        data: {
          ...data,
          pageConfigDataflows: {
            create: dataflows.map((code: string, idx: number) => ({
              dataflowCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigIndicators: {
            create: indicators.map((code: string, idx: number) => ({
              indicatorCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigEconomies: {
            create: economies.map((code: string, idx: number) => ({
              economyCode: code,
              sortOrder: idx,
            })),
          },
          pageConfigVisualizations: {
            create: visualizations.map((vis: any, idx: number) => ({
              visualizationType: vis.visualizationType,
              title: vis.title || '',
              configJson: vis.configJson || {},
              sortOrder: idx,
              isActive: vis.isActive !== false,
            })),
          },
        },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: id ? 'UPDATE_PAGE_CONFIG' : 'CREATE_PAGE_CONFIG',
        entityType: 'PageConfig',
        entityId: config.id,
        newValues: body,
      },
    });

    return NextResponse.json(config);
  } catch (err: any) {
    console.error('Explorer PageConfig POST API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
