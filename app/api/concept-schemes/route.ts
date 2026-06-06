import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const schemes = await prisma.conceptScheme.findMany({
      include: {
        concepts: true,
      },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(schemes);
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

    const scheme = await prisma.conceptScheme.create({
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
        action: 'CREATE_CONCEPT_SCHEME',
        entityType: 'ConceptScheme',
        entityId: code,
        newValues: scheme as any,
      },
    });

    return NextResponse.json(scheme);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
