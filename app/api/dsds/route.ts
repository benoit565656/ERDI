import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const dsds = await prisma.dsd.findMany({
      include: {
        components: true,
      },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(dsds);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, agency, version, name, description } = body;

    if (!code || !agency || !version || !name) {
      return NextResponse.json({ error: 'Code, Agency, Version, and Name are required.' }, { status: 400 });
    }

    const dsd = await prisma.dsd.create({
      data: {
        code,
        agency,
        version,
        name,
        description,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_DSD',
        entityType: 'Dsd',
        entityId: code,
        newValues: dsd as any,
      },
    });

    return NextResponse.json(dsd);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
