import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export async function GET() {
  try {
    const mappings = await prisma.frontEndCategoryIndicator.findMany({
      where: {
        category: {
          categorySetCode: 'DATA_EXPLORER',
          isVisible: true
        }
      },
      select: {
        indicatorCode: true,
        category: {
          select: {
            code: true,
            name: true,
            parentCode: true,
            parent: {
              select: {
                code: true,
                name: true
              }
            }
          }
        }
      }
    });

    const indCodes = Array.from(new Set(mappings.map(m => m.indicatorCode)));
    const indicators = await prisma.indicator.findMany({
      where: { code: { in: indCodes } },
      select: { code: true, name: true }
    });
    const indicatorNameMap = new Map(indicators.map(i => [i.code, i.name]));

    const grouped = new Map<string, any>();

    mappings.forEach(m => {
      if (!grouped.has(m.indicatorCode)) {
        grouped.set(m.indicatorCode, {
          indicatorCode: m.indicatorCode,
          indicatorName: indicatorNameMap.get(m.indicatorCode) || m.indicatorCode,
          dataflows: []
        });
      }

      grouped.get(m.indicatorCode).dataflows.push({
        code: m.category.code,
        name: m.category.name,
        parentCode: m.category.parentCode || null,
        parentName: m.category.parent ? m.category.parent.name : null
      });
    });

    const data = Array.from(grouped.values());

    return NextResponse.json({ data }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
