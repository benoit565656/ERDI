import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export async function GET() {
  try {
    // Query all official dataflow definitions from the Dataflow table
    const allDataflows = await prisma.dataflow.findMany({
      select: {
        code: true,
        name: true,
        description: true,
        datasetCode: true,
      },
      orderBy: { code: 'asc' }
    });

    // Identify main top-level dataflows (e.g., EO, PPL, MFP, GLB, GG, ENV, TC, SDG, ARIC, EGELC)
    // and group sub-dataflows (e.g., PPL_LE, EO_PRIX) under their respective root parent
    const dataflowsMap = new Map<string, any>();

    allDataflows.forEach(df => {
      const parts = df.code.split('_');
      const rootCode = parts[0];

      if (!dataflowsMap.has(rootCode)) {
        // If exact root record exists, use its info; otherwise create placeholder
        const rootRecord = allDataflows.find(d => d.code === rootCode) || df;
        dataflowsMap.set(rootCode, {
          code: rootCode,
          name: rootRecord.code === rootCode ? rootRecord.name : rootCode,
          description: rootRecord.description || '',
          datasetCode: rootRecord.datasetCode,
          subDataflows: []
        });
      }

      if (df.code !== rootCode) {
        dataflowsMap.get(rootCode).subDataflows.push({
          code: df.code,
          name: df.name,
          description: df.description || '',
          datasetCode: df.datasetCode
        });
      }
    });

    const dataflows = Array.from(dataflowsMap.values());

    return NextResponse.json({ dataflows }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
