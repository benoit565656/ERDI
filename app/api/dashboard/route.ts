import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agencyCode = searchParams.get('agencyCode');
    const datasetCode = searchParams.get('datasetCode');

    // 1. Build where clauses for filtering
    const datasetWhere: any = {};
    if (agencyCode) datasetWhere.agencyCode = agencyCode;
    if (datasetCode) datasetWhere.code = datasetCode;

    const dataflowWhere: any = {};
    if (datasetCode) {
      dataflowWhere.datasetCode = datasetCode;
    } else if (agencyCode) {
      dataflowWhere.dataset = { agencyCode };
    }

    const indicatorWhere: any = {};
    if (datasetCode) {
      indicatorWhere.observations = {
        some: { datasetCode },
      };
    } else if (agencyCode) {
      indicatorWhere.observations = {
        some: { agencyCode },
      };
    } else {
      indicatorWhere.observations = {
        some: {},
      };
    }

    const economyWhere: any = {};
    if (datasetCode) {
      economyWhere.observations = {
        some: { datasetCode },
      };
    } else if (agencyCode) {
      economyWhere.observations = {
        some: { agencyCode },
      };
    } else {
      economyWhere.observations = {
        some: {},
      };
    }

    const obsWhere: any = {};
    if (datasetCode) {
      obsWhere.datasetCode = datasetCode;
    } else if (agencyCode) {
      obsWhere.agencyCode = agencyCode;
    }

    const importWhere: any = {};
    if (datasetCode) {
      importWhere.datasetCode = datasetCode;
    } else if (agencyCode) {
      importWhere.dataset = { agencyCode };
    }

    const auditLogWhere: any = {};
    if (datasetCode) {
      auditLogWhere.OR = [
        { entityId: datasetCode },
        { newValues: { path: ['datasetCode'], equals: datasetCode } },
      ];
    } else if (agencyCode) {
      auditLogWhere.OR = [
        { entityId: agencyCode },
        { newValues: { path: ['agencyCode'], equals: agencyCode } },
      ];
    }

    // 2. Fetch counts in parallel
    const [
      datasetsCount,
      dataflowsCount,
      indicatorsCount,
      economiesCount,
      totalObservations,
      draftObservations,
      publishedObservations,
      recentImports,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.dataset.count({ where: datasetWhere }),
      prisma.dataflow.count({ where: dataflowWhere }),
      prisma.indicator.count({ where: indicatorWhere }),
      prisma.economy.count({ where: economyWhere }),
      prisma.observation.count({ where: obsWhere }),
      prisma.observation.count({ where: { ...obsWhere, workflowStatus: 'DRAFT' } }),
      prisma.observation.count({ where: { ...obsWhere, workflowStatus: 'PUBLISHED' } }),
      prisma.importBatch.findMany({
        where: importWhere,
        orderBy: { uploadedAt: 'desc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
        where: auditLogWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      counts: {
        datasets: datasetsCount,
        dataflows: dataflowsCount,
        indicators: indicatorsCount,
        economies: economiesCount,
        observations: totalObservations,
        draft: draftObservations,
        published: publishedObservations,
      },
      recentImports,
      recentActivity: recentAuditLogs,
    });
  } catch (err: any) {
    console.error('Dashboard API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
