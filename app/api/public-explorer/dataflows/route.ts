import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export async function GET() {
  try {
    // Fetch all categories under DATA_EXPLORER category set
    const categories = await prisma.frontEndCategory.findMany({
      where: {
        categorySetCode: 'DATA_EXPLORER',
        isVisible: true,
      },
      select: {
        code: true,
        name: true,
        description: true,
        parentCode: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' }
    });

    const rootCategories = categories.filter(c => !c.parentCode);
    const dataflows = rootCategories.map(root => {
      const children = categories.filter(c => c.parentCode === root.code);
      return {
        code: root.code,
        name: root.name,
        description: root.description || '',
        subTopics: children.map(sub => ({
          code: sub.code,
          name: sub.name,
          description: sub.description || ''
        }))
      };
    });

    return NextResponse.json({ dataflows }, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
