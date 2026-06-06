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
