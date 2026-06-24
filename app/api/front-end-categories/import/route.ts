import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to generate a slug from a name
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { categorySetCode, importType, rows = [] } = body;

    if (!categorySetCode || !importType) {
      return NextResponse.json({ error: 'categorySetCode and importType are required.' }, { status: 400 });
    }

    // Verify category set exists
    const setExists = await prisma.categorySet.findUnique({
      where: { code: categorySetCode },
    });
    if (!setExists) {
      return NextResponse.json({ error: `Category Set ${categorySetCode} does not exist.` }, { status: 404 });
    }

    const errors: string[] = [];

    // --- CASE 1: STRUCTURE IMPORT ---
    if (importType === 'structure') {
      const uniqueCodes = new Set<string>();
      const uniquePaths = new Set<string>();
      const pathMap: Record<string, string> = {}; // path -> code

      // First pass: validate basic fields and collect codes
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const code = (row['Category Code'] || row['code'] || '').toString().trim();
        const name = (row['Category Name'] || row['name'] || '').toString().trim();
        const path = (row['Hierarchy'] || row['hierarchy'] || '').toString().trim();

        const lineNo = i + 1;

        if (!code) {
          errors.push(`Row ${lineNo}: Category Code is required.`);
          continue;
        }
        if (!name) {
          errors.push(`Row ${lineNo}: Category Name is required.`);
          continue;
        }
        if (!path) {
          errors.push(`Row ${lineNo}: Hierarchy path is required.`);
          continue;
        }

        if (uniqueCodes.has(code)) {
          errors.push(`Row ${lineNo}: Duplicate Category Code "${code}" detected in CSV.`);
        }
        uniqueCodes.add(code);

        if (uniquePaths.has(path)) {
          errors.push(`Row ${lineNo}: Duplicate Hierarchy path "${path}" detected in CSV.`);
        }
        uniquePaths.add(path);
        pathMap[path] = code;
      }

      // Second pass: validate parent hierarchy paths exist
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const path = (row['Hierarchy'] || row['hierarchy'] || '').toString().trim();
        if (!path) continue;

        const parts = path.split('.');
        if (parts.length > 1) {
          const parentPath = parts.slice(0, -1).join('.');
          if (!uniquePaths.has(parentPath)) {
            errors.push(`Row ${i + 1}: Parent hierarchy path "${parentPath}" for child "${path}" does not exist in the CSV.`);
          }
        }
      }

      if (errors.length > 0) {
        return NextResponse.json({ success: false, errors }, { status: 400 });
      }

      // Perform DB updates in transaction
      await prisma.$transaction(async (tx) => {
        // Clear all categories under this categorySetCode
        // Cascade will automatically clear mappings in front_end_category_indicators
        await tx.frontEndCategory.deleteMany({
          where: { categorySetCode },
        });

        // Insert new categories (sort by depth Level so parent categories exist first, in case DB needs hierarchical checks)
        const sortedRows = [...rows].sort((a, b) => {
          const pathA = (a['Hierarchy'] || a['hierarchy'] || '').toString().trim();
          const pathB = (b['Hierarchy'] || b['hierarchy'] || '').toString().trim();
          return pathA.split('.').length - pathB.split('.').length;
        });

        for (const row of sortedRows) {
          const code = (row['Category Code'] || row['code'] || '').toString().trim();
          const name = (row['Category Name'] || row['name'] || '').toString().trim();
          const path = (row['Hierarchy'] || row['hierarchy'] || '').toString().trim();
          const description = (row['Description'] || row['description'] || '').toString().trim();
          const visibleVal = (row['Visible'] || row['visible'] || 'true').toString().trim().toLowerCase();
          const isVisible = visibleVal === 'true' || visibleVal === '1' || visibleVal === 'yes';

          const parts = path.split('.');
          let parentCode = null;
          if (parts.length > 1) {
            const parentPath = parts.slice(0, -1).join('.');
            parentCode = pathMap[parentPath] || null;
          }

          await tx.frontEndCategory.create({
            data: {
              categorySetCode,
              code,
              name,
              description: description || null,
              parentCode,
              hierarchyPath: path,
              depthLevel: parts.length,
              sortOrder: parseInt(parts[parts.length - 1], 10) || 0,
              slug: slugify(name),
              isVisible,
            },
          });
        }
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'IMPORT_FRONT_END_CATEGORY_STRUCTURE',
          entityType: 'CategorySet',
          entityId: categorySetCode,
          newValues: { count: rows.length } as any,
        },
      });

      return NextResponse.json({ success: true, message: `Successfully imported ${rows.length} categories structure.` });
    }

    // --- CASE 2: INDICATORS IMPORT ---
    if (importType === 'indicators') {
      const currentCategories = await prisma.frontEndCategory.findMany({
        where: { categorySetCode },
      });
      const categoryCodes = new Set(currentCategories.map((c) => c.code));

      // Fetch valid agencies, datasets, concepts, codelists for speed
      const validAgencies = new Set((await prisma.agency.findMany({ select: { code: true } })).map((a) => a.code));
      const validDatasets = new Set((await prisma.dataset.findMany({ select: { code: true } })).map((d) => d.code));
      
      const uniqueOrders = new Map<string, Set<number>>(); // category -> set of orders
      const uniqueKeys = new Map<string, Set<string>>(); // category -> set of indicator keys

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNo = i + 1;

        const agency = (row['Agency'] || row['agency'] || '').toString().trim();
        const dataset = (row['Dataset'] || row['dataset'] || '').toString().trim();
        const codeList = (row['Indicator Code List'] || row['code_list'] || row['sourceCodeListCode'] || '').toString().trim();
        const indicator = (row['Indicator Code'] || row['indicator_code'] || row['indicator'] || '').toString().trim();
        const dataflow = (row['Dataflow'] || row['dataflow'] || '').toString().trim();
        const category = (row['Category Code'] || row['category_code'] || row['category'] || '').toString().trim();
        const orderVal = (row['Order'] || row['order'] || row['sortOrder'] || '0').toString().trim();
        const order = parseInt(orderVal, 10) || 0;

        if (!category) {
          errors.push(`Row ${lineNo}: Category Code is required.`);
          continue;
        }
        if (!agency) {
          errors.push(`Row ${lineNo}: Agency Code is required.`);
          continue;
        }
        if (!dataset) {
          errors.push(`Row ${lineNo}: Dataset Code is required.`);
          continue;
        }
        if (!codeList) {
          errors.push(`Row ${lineNo}: Indicator Code List is required.`);
          continue;
        }
        if (!indicator) {
          errors.push(`Row ${lineNo}: Indicator Code is required.`);
          continue;
        }

        // Validate category exists in DB (or imported structure)
        if (!categoryCodes.has(category)) {
          errors.push(`Row ${lineNo}: Category "${category}" does not exist in Category Set "${categorySetCode}". Create the category structure first.`);
        }

        // Validate Agency
        if (!validAgencies.has(agency)) {
          errors.push(`Row ${lineNo}: Agency "${agency}" does not exist in the database.`);
        }

        // Validate Dataset
        if (!validDatasets.has(dataset)) {
          errors.push(`Row ${lineNo}: Dataset "${dataset}" does not exist in the database.`);
        }

        // Validate Code List Item
        const codeListItem = await prisma.codeListItem.findUnique({
          where: {
            codeListCode_itemCode: {
              codeListCode: codeList,
              itemCode: indicator,
            },
          },
        });
        if (!codeListItem) {
          errors.push(`Row ${lineNo}: Indicator "${indicator}" does not exist in Code List "${codeList}".`);
        }

        // Validate optional dataflow
        if (dataflow) {
          const df = await prisma.dataflow.findUnique({
            where: {
              datasetCode_code: {
                datasetCode: dataset,
                code: dataflow,
              },
            },
          });
          if (!df) {
            errors.push(`Row ${lineNo}: Dataflow "${dataflow}" does not exist under Dataset "${dataset}".`);
          }
        }

        // Check duplicate order IDs under same category
        if (!uniqueOrders.has(category)) {
          uniqueOrders.set(category, new Set());
        }
        const catOrders = uniqueOrders.get(category)!;
        if (catOrders.has(order)) {
          errors.push(`Row ${lineNo}: Duplicate Indicator Order ID (${order}) detected under Category "${category}". Each indicator assigned to a category must have a unique Order ID.`);
        }
        catOrders.add(order);

        // Check duplicate indicator keys under same category
        const indKey = `${dataset}:${codeList}:${indicator}`;
        if (!uniqueKeys.has(category)) {
          uniqueKeys.set(category, new Set());
        }
        const catKeys = uniqueKeys.get(category)!;
        if (catKeys.has(indKey)) {
          errors.push(`Row ${lineNo}: Duplicate assignment of indicator [${indKey}] under Category "${category}".`);
        }
        catKeys.add(indKey);
      }

      if (errors.length > 0) {
        return NextResponse.json({ success: false, errors }, { status: 400 });
      }

      // Execute assignments database write
      await prisma.$transaction(async (tx) => {
        // Clear all assignments under this categorySetCode
        await tx.frontEndCategoryIndicator.deleteMany({
          where: { categorySetCode },
        });

        // Insert new mappings
        const mappingData = rows.map((row: any) => {
          const agency = (row['Agency'] || row['agency'] || '').toString().trim();
          const dataset = (row['Dataset'] || row['dataset'] || '').toString().trim();
          const codeList = (row['Indicator Code List'] || row['code_list'] || row['sourceCodeListCode'] || '').toString().trim();
          const indicator = (row['Indicator Code'] || row['indicator_code'] || row['indicator'] || '').toString().trim();
          const dataflow = (row['Dataflow'] || row['dataflow'] || '').toString().trim();
          const category = (row['Category Code'] || row['category_code'] || row['category'] || '').toString().trim();
          const orderVal = (row['Order'] || row['order'] || row['sortOrder'] || '0').toString().trim();
          const order = parseInt(orderVal, 10) || 0;

          return {
            categorySetCode,
            categoryCode: category,
            agencyCode: agency,
            datasetCode: dataset,
            sourceCodeListCode: codeList,
            indicatorCode: indicator,
            dataflowCode: dataflow || null,
            sortOrder: order,
          };
        });

        await tx.frontEndCategoryIndicator.createMany({
          data: mappingData,
        });
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'IMPORT_FRONT_END_CATEGORY_INDICATORS',
          entityType: 'CategorySet',
          entityId: categorySetCode,
          newValues: { count: rows.length } as any,
        },
      });

      return NextResponse.json({ success: true, message: `Successfully imported ${rows.length} indicator category assignments.` });
    }

    return NextResponse.json({ error: 'Invalid importType.' }, { status: 400 });
  } catch (err: any) {
    console.error('Import Hierarchy Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
