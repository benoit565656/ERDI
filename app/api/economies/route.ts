import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const economies = await prisma.economy.findMany({
      where,
      include: {
        parent: true,
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json(economies);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, economyType, iso2Code, iso3Code, currencyCode, parentCode } = body;

    if (!code || !name || !economyType) {
      return NextResponse.json({ error: 'Code, Name, and Economy Type are required.' }, { status: 400 });
    }

    const economy = await prisma.economy.upsert({
      where: { code },
      update: {
        name,
        economyType,
        iso2Code: iso2Code || null,
        iso3Code: iso3Code || null,
        currencyCode: currencyCode || null,
        parentCode: parentCode || null,
      },
      create: {
        code,
        name,
        economyType,
        iso2Code: iso2Code || null,
        iso3Code: iso3Code || null,
        currencyCode: currencyCode || null,
        parentCode: parentCode || null,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_ECONOMY',
        entityType: 'Economy',
        entityId: code,
        newValues: { code, name, economyType, iso2Code, iso3Code, currencyCode, parentCode } as any,
      },
    });

    return NextResponse.json(economy);
  } catch (err: any) {
    console.error('Economy API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
