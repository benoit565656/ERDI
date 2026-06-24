import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dsdCode = searchParams.get('dsdCode');

    if (!dsdCode) {
      return NextResponse.json({ error: 'DSD Code is required.' }, { status: 400 });
    }

    const components = await prisma.dsdComponent.findMany({
      where: { dsdCode },
      orderBy: { componentCode: 'asc' },
    });
    return NextResponse.json(components);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, dsdCode, componentCode, componentType, conceptCode, codeListCode, isRequired, attachmentLevel, defaultValue } = body;

    if (!dsdCode || !componentCode || !componentType || !conceptCode) {
      return NextResponse.json({ error: 'DSD Code, Component Code, Component Type, and Concept Code are required.' }, { status: 400 });
    }

    let component;
    if (id) {
      // Update
      component = await prisma.dsdComponent.update({
        where: { id },
        data: {
          componentCode,
          componentType,
          conceptCode,
          codeListCode: codeListCode || null,
          isRequired: !!isRequired,
          attachmentLevel: attachmentLevel || null,
          defaultValue: defaultValue || null,
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_DSD_COMPONENT',
          entityType: 'DsdComponent',
          entityId: id,
          newValues: component as any,
        },
      });
    } else {
      // Create
      component = await prisma.dsdComponent.create({
        data: {
          dsdCode,
          componentCode,
          componentType,
          conceptCode,
          codeListCode: codeListCode || null,
          isRequired: !!isRequired,
          attachmentLevel: attachmentLevel || null,
          defaultValue: defaultValue || null,
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'CREATE_DSD_COMPONENT',
          entityType: 'DsdComponent',
          entityId: component.id,
          newValues: component as any,
        },
      });
    }

    return NextResponse.json(component);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Component ID is required.' }, { status: 400 });
    }

    const component = await prisma.dsdComponent.delete({
      where: { id },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_DSD_COMPONENT',
        entityType: 'DsdComponent',
        entityId: id,
        newValues: component as any,
      },
    });

    return NextResponse.json({ success: true, component });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
