import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
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
      prisma.dataset.count(),
      prisma.dataflow.count(),
      prisma.indicator.count(),
      prisma.economy.count(),
      prisma.observation.count(),
      prisma.observation.count({ where: { workflowStatus: 'DRAFT' } }),
      prisma.observation.count({ where: { workflowStatus: 'PUBLISHED' } }),
      prisma.importBatch.findMany({
        orderBy: { uploadedAt: 'desc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
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
