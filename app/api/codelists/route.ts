import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const codelists = await prisma.codeList.findMany({
      include: {
        codeListItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(codelists);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, codeListCode, code, name, description, parentItemCode, sortOrder } = body;

    // Support two actions: create code list or create item
    if (action === 'CREATE_CODELIST') {
      if (!code || !name) {
        return NextResponse.json({ error: 'Code and Name are required.' }, { status: 400 });
      }

      const list = await prisma.codeList.create({
        data: { code, name, description, isGlobal: true },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: 'CREATE_CODELIST',
          entityType: 'CodeList',
          entityId: code,
          newValues: { code, name } as any,
        },
      });

      return NextResponse.json(list);
    }

    if (action === 'UPSERT_ITEM') {
      if (!codeListCode || !code || !name) {
        return NextResponse.json({ error: 'codeListCode, item code, and name are required.' }, { status: 400 });
      }

      const item = await prisma.codeListItem.upsert({
        where: {
          codeListCode_itemCode: {
            codeListCode,
            itemCode: code,
          },
        },
        update: {
          itemName: name,
          description: description || null,
          parentItemCode: parentItemCode || null,
          sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        },
        create: {
          codeListCode,
          itemCode: code,
          itemName: name,
          description: description || null,
          parentItemCode: parentItemCode || null,
          sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: 'UPSERT_CODELIST_ITEM',
          entityType: 'CodeListItem',
          entityId: `${codeListCode}:${code}`,
          newValues: { codeListCode, itemCode: code, itemName: name, parentItemCode } as any,
        },
      });

      return NextResponse.json(item);
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    console.error('Codelists API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
