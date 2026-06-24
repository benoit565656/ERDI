import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LifeCycleStatus } from '@prisma/client';

export async function GET() {
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(agencies);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, description, website, contactEmail, status } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and Name are required.' }, { status: 400 });
    }

    const agency = await prisma.agency.upsert({
      where: { code },
      update: { 
        name, 
        description, 
        website, 
        contactEmail, 
        status: status as LifeCycleStatus 
      },
      create: { 
        code, 
        name, 
        description, 
        website, 
        contactEmail, 
        status: (status as LifeCycleStatus) || 'ACTIVE' 
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_AGENCY',
        entityType: 'Agency',
        entityId: code,
        newValues: { code, name, description, website, contactEmail, status } as any,
      },
    });

    return NextResponse.json(agency);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
