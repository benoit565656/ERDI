import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const datasetCode = searchParams.get('datasetCode');
    const dataflowCode = searchParams.get('dataflowCode');

    if (type === 'datasets') {
      const list = await prisma.dataset.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(d => ({ label: `[${d.code}] ${d.name}`, value: d.code })));
    }

    if (type === 'dataflows') {
      const where: any = {};
      if (datasetCode) {
        where.datasetCode = datasetCode;
      }
      const list = await prisma.dataflow.findMany({
        where,
        orderBy: { code: 'asc' },
      });
      return NextResponse.json(list.map(d => ({ label: `[${d.code}] ${d.name}`, value: d.code })));
    }

    if (type === 'indicators') {
      const where: any = {};
      if (dataflowCode) {
        where.dataflowIndicators = {
          some: {
            dataflowCode,
          },
        };
      }
      const list = await prisma.indicator.findMany({
        where,
        orderBy: { code: 'asc' },
      });
      return NextResponse.json(list.map(i => ({ label: `[${i.code}] ${i.name}`, value: i.code })));
    }

    if (type === 'economies') {
      const list = await prisma.economy.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(e => ({ label: `[${e.code}] ${e.name}`, value: e.code })));
    }

    if (type === 'units') {
      const list = await prisma.commonUnit.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(u => ({ label: `[${u.code}] ${u.name}`, value: u.code })));
    }

    if (type === 'multipliers') {
      const list = await prisma.commonMultiplier.findMany({ orderBy: { code: 'asc' } });
      return NextResponse.json(list.map(m => ({ label: `${m.name} (x${m.factor.toString()})`, value: m.code })));
    }

    return NextResponse.json({ error: 'Invalid type parameter.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

