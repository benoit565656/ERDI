import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sets = await prisma.categorySet.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(sets);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, description } = body;

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and Name are required.' }, { status: 400 });
    }

    const set = await prisma.categorySet.upsert({
      where: { code },
      update: { name, description },
      create: { code, name, description },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_CATEGORY_SET',
        entityType: 'CategorySet',
        entityId: code,
        newValues: { code, name, description } as any,
      },
    });

    return NextResponse.json(set);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code is required.' }, { status: 400 });
    }

    // Delete category set (will cascade delete categories and indicator assignments due to cascade constraints in DB)
    await prisma.categorySet.delete({
      where: { code },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_CATEGORY_SET',
        entityType: 'CategorySet',
        entityId: code,
      },
    });

    return NextResponse.json({ success: true, message: `Category Set ${code} deleted successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
