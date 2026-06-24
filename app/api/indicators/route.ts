import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LifeCycleStatus } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [indicators, total] = await Promise.all([
      prisma.indicator.findMany({
        where,
        include: {
          indicatorDataflowMapping: {
            include: {
              mainDataflow: true,
            },
          },
        },
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.indicator.count({ where }),
    ]);

    return NextResponse.json({
      indicators,
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      code,
      name,
      description,
      shortName,
      definition,
      defaultUnitCode,
      defaultUnitMultCode,
      defaultFreqCode,
      source,
      methodology,
      category,
      sortOrder,
      status,
    } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and Name are required.' }, { status: 400 });
    }

    const indicator = await prisma.indicator.upsert({
      where: { code },
      update: {
        name,
        description,
        shortName,
        definition,
        defaultUnitCode,
        defaultUnitMultCode,
        defaultFreqCode,
        source,
        methodology,
        category,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        status: status as LifeCycleStatus,
      },
      create: {
        code,
        name,
        description,
        shortName,
        definition,
        defaultUnitCode,
        defaultUnitMultCode,
        defaultFreqCode,
        source,
        methodology,
        category,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        status: (status as LifeCycleStatus) || 'ACTIVE',
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_INDICATOR',
        entityType: 'Indicator',
        entityId: code,
        newValues: { code, name, status } as any,
      },
    });

    return NextResponse.json(indicator);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
