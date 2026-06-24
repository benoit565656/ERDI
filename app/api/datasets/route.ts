import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LifeCycleStatus } from '@prisma/client';

export async function GET() {
  try {
    const datasets = await prisma.dataset.findMany({
      include: {
        agency: true,
        _count: {
          select: { dataflows: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(datasets);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, description, divisionCode, agencyCode, status, defaultFrequency, sortOrder } = body;

    if (!code || !name || !divisionCode || !agencyCode) {
      return NextResponse.json({ error: 'Code, Name, Division, and Agency are required.' }, { status: 400 });
    }

    const freqArray = Array.isArray(defaultFrequency)
      ? defaultFrequency
      : defaultFrequency
        ? defaultFrequency.split(',').map((f: string) => f.trim())
        : [];

    const dataset = await prisma.dataset.upsert({
      where: { code },
      update: { 
        name, 
        description, 
        divisionCode, 
        agencyCode,
        status: status as LifeCycleStatus,
        defaultFrequency: freqArray,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
      },
      create: { 
        code, 
        name, 
        description, 
        divisionCode, 
        agencyCode,
        status: (status as LifeCycleStatus) || 'ACTIVE',
        defaultFrequency: freqArray,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_DATASET',
        entityType: 'Dataset',
        entityId: code,
        newValues: { code, name, description, divisionCode, agencyCode, status, defaultFrequency, sortOrder } as any,
      },
    });

    return NextResponse.json(dataset);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
