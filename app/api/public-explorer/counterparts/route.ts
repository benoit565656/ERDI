import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const indicatorsParam = searchParams.get('indicators');

    if (!indicatorsParam) {
      return NextResponse.json([]);
    }

    const selectedIndicators = indicatorsParam.split(',').map(i => i.trim());

    // Find all distinct counterpart area codes for these indicators from Observations
    const cacheRecords = await prisma.observation.findMany({
      where: {
        indicatorCode: { in: selectedIndicators },
        isPublished: true,
        deletedAt: null,
        NOT: { counterpartAreaCode: null }
      },
      select: {
        counterpartAreaCode: true
      },
      distinct: ['counterpartAreaCode']
    });

    const activeCounterpartCodes = cacheRecords
      .map(r => r.counterpartAreaCode)
      .filter(Boolean) as string[];

    if (activeCounterpartCodes.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch details of counterpart economies
    const counterparts = await prisma.economy.findMany({
      where: {
        code: { in: activeCounterpartCodes },
        isActive: true
      },
      select: {
        code: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(counterparts);
  } catch (err: any) {
    console.error('Public Counterparts API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
