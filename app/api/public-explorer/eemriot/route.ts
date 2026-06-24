import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const codelists = await prisma.codeList.findMany({
      where: {
        code: { in: ['CL_SECTOR', 'CL_INDUSTRY', 'CL_GHG'] }
      },
      include: {
        codeListItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const sectorList = codelists.find(cl => cl.code === 'CL_SECTOR')?.codeListItems || [];
    const industryList = codelists.find(cl => cl.code === 'CL_INDUSTRY')?.codeListItems || [];
    const ghgList = codelists.find(cl => cl.code === 'CL_GHG')?.codeListItems || [];

    return NextResponse.json({
      sectors: sectorList.map(item => ({ code: item.itemCode, name: item.itemName })),
      industries: industryList.map(item => ({ code: item.itemCode, name: item.itemName })),
      ghgs: ghgList.map(item => ({ code: item.itemCode, name: item.itemName })),
    });
  } catch (err: any) {
    console.error('EEMRIOT Codelist API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
