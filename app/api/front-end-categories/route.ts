import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to generate a slug from a name
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySetCode = searchParams.get('categorySetCode');

    if (!categorySetCode) {
      return NextResponse.json({ error: 'categorySetCode is required.' }, { status: 400 });
    }

    const categories = await prisma.frontEndCategory.findMany({
      where: { categorySetCode },
      include: {
        indicators: {
          include: {
            agency: true,
            dataset: true,
            codeList: true,
            codeListItem: true,
            dataflow: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Sort categories numerically by hierarchyPath segment (e.g., 9.2 comes before 9.10)
    categories.sort((a, b) => {
      const partsA = (a.hierarchyPath || '').split('.').map(Number);
      const partsB = (b.hierarchyPath || '').split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const valA = partsA[i] ?? 0;
        const valB = partsB[i] ?? 0;
        if (valA !== valB) return valA - valB;
      }
      return 0;
    });

    // Map computed displayName resolving ambiguity under the same category node
    const categoriesWithDisplayName = categories.map((cat) => {
      const indicators = cat.indicators;
      
      // Count name occurrences
      const nameCounts = new Map<string, number>();
      for (const ind of indicators) {
        const name = ind.codeListItem?.itemName || ind.indicatorCode;
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }

      const mappedIndicators = indicators.map((ind) => {
        const name = ind.codeListItem?.itemName || ind.indicatorCode;
        const hasCollision = (nameCounts.get(name) || 0) > 1;
        const displayName = hasCollision ? `${name} (${ind.datasetCode})` : name;
        
        return {
          ...ind,
          displayName,
        };
      });

      return {
        ...cat,
        indicators: mappedIndicators,
      };
    });

    return NextResponse.json(categoriesWithDisplayName);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Individual Category Upsert
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      categorySetCode,
      code,
      name,
      description,
      parentCode,
      hierarchyPath,
      slug,
      icon,
      image,
      isVisible = true,
      metaTitle,
      metaDescription,
    } = body;

    if (!categorySetCode || !code || !name || !hierarchyPath) {
      return NextResponse.json(
        { error: 'categorySetCode, code, name, and hierarchyPath are required.' },
        { status: 400 }
      );
    }

    // Verify category set exists
    const setExists = await prisma.categorySet.findUnique({
      where: { code: categorySetCode },
    });
    if (!setExists) {
      return NextResponse.json({ error: `Category Set ${categorySetCode} does not exist.` }, { status: 404 });
    }

    // Verify parent if specified
    if (parentCode) {
      const parentExists = await prisma.frontEndCategory.findUnique({
        where: {
          categorySetCode_code: {
            categorySetCode,
            code: parentCode,
          },
        },
      });
      if (!parentExists) {
        return NextResponse.json({ error: `Parent category ${parentCode} does not exist in set ${categorySetCode}.` }, { status: 400 });
      }
    }

    // Check unique hierarchyPath collision (excluding our own code if updating)
    const duplicatePath = await prisma.frontEndCategory.findFirst({
      where: {
        categorySetCode,
        hierarchyPath,
        NOT: { code },
      },
    });
    if (duplicatePath) {
      return NextResponse.json(
        { error: `Hierarchy path ${hierarchyPath} is already assigned to category ${duplicatePath.code}.` },
        { status: 400 }
      );
    }

    const calculatedDepth = hierarchyPath.split('.').length;
    const finalSlug = slug || slugify(name);

    const category = await prisma.frontEndCategory.upsert({
      where: {
        categorySetCode_code: {
          categorySetCode,
          code,
        },
      },
      update: {
        name,
        description,
        parentCode: parentCode || null,
        hierarchyPath,
        depthLevel: calculatedDepth,
        slug: finalSlug,
        icon: icon || null,
        image: image || null,
        isVisible,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      },
      create: {
        categorySetCode,
        code,
        name,
        description,
        parentCode: parentCode || null,
        hierarchyPath,
        depthLevel: calculatedDepth,
        slug: finalSlug,
        icon: icon || null,
        image: image || null,
        isVisible,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPSERT_FRONT_END_CATEGORY',
        entityType: 'FrontEndCategory',
        entityId: `${categorySetCode}:${code}`,
        newValues: category as any,
      },
    });

    return NextResponse.json(category);
  } catch (err: any) {
    console.error('Upsert Category Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Bulk update tree nodes structure (drag-and-drop updates)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { categorySetCode, updates } = body; // updates = Array<{ code, parentCode, hierarchyPath, depthLevel, sortOrder }>

    if (!categorySetCode || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'categorySetCode and updates array are required.' },
        { status: 400 }
      );
    }

    // Execute in a single Prisma transaction to ensure schema consistency
    await prisma.$transaction(
      updates.map((up) =>
        prisma.frontEndCategory.update({
          where: {
            categorySetCode_code: {
              categorySetCode,
              code: up.code,
            },
          },
          data: {
            parentCode: up.parentCode || null,
            hierarchyPath: up.hierarchyPath,
            depthLevel: up.depthLevel || up.hierarchyPath.split('.').length,
            sortOrder: up.sortOrder ?? 0,
          },
        })
      )
    );

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'BULK_UPDATE_FRONT_END_CATEGORIES',
        entityType: 'CategorySet',
        entityId: categorySetCode,
        newValues: { updatesCount: updates.length } as any,
      },
    });

    return NextResponse.json({ success: true, message: `Successfully updated ${updates.length} categories.` });
  } catch (err: any) {
    console.error('Bulk Category Update Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete Category
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySetCode = searchParams.get('categorySetCode');
    const code = searchParams.get('code');

    if (!categorySetCode || !code) {
      return NextResponse.json({ error: 'categorySetCode and code are required.' }, { status: 400 });
    }

    // Check if category has children to prevent orphan children
    const childCount = await prisma.frontEndCategory.count({
      where: { categorySetCode, parentCode: code },
    });
    if (childCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category because it has subcategories. Delete subcategories first.' },
        { status: 400 }
      );
    }

    await prisma.frontEndCategory.delete({
      where: {
        categorySetCode_code: {
          categorySetCode,
          code,
        },
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE_FRONT_END_CATEGORY',
        entityType: 'FrontEndCategory',
        entityId: `${categorySetCode}:${code}`,
      },
    });

    return NextResponse.json({ success: true, message: `Category ${code} deleted successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
