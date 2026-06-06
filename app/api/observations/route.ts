import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const datasetCode = searchParams.get('datasetCode');
    const mainDataflowCode = searchParams.get('mainDataflowCode');
    const indicatorCode = searchParams.get('indicatorCode');
    const economyCode = searchParams.get('economyCode');
    const freqCode = searchParams.get('freqCode');
    const period = searchParams.get('period');

    const where: any = {};
    if (datasetCode) where.datasetCode = datasetCode;
    if (mainDataflowCode) where.mainDataflowCode = mainDataflowCode;
    if (indicatorCode) where.indicatorCode = indicatorCode;
    if (economyCode) where.economyCode = economyCode;
    if (freqCode) where.freqCode = freqCode;
    if (period) where.period = period;

    const [observations, total] = await Promise.all([
      prisma.observation.findMany({
        where,
        orderBy: [
          { freqCode: 'asc' },
          { indicatorCode: 'asc' },
          { economyCode: 'asc' },
          { period: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.observation.count({ where }),
    ]);

    return NextResponse.json({
      observations,
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
