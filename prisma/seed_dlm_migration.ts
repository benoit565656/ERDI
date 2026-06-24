import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting DLM Status Migration and Seeding ---');

  // 1. Map existing null status values to new Status Enum
  console.log('Migrating status flags...');
  await prisma.$executeRawUnsafe(`UPDATE agencies SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE datasets SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE dataflows SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE concept_schemes SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE concepts SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE code_lists SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE indicators SET status = 'ACTIVE' WHERE status IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE dsds SET status = 'ACTIVE' WHERE status IS NULL;`);
  console.log('Status migration completed.');

  // 2. Create the CL_COUNTERPART_AREA code list
  console.log('Ensuring CodeList CL_COUNTERPART_AREA exists...');
  await prisma.codeList.upsert({
    where: { code: 'CL_COUNTERPART_AREA' },
    update: {
      name: 'Counterpart Area Code List',
      description: 'Permitted counterpart areas (partner economies) for Trade and FDI flows',
      agencyCode: 'ERDI',
      relatedConceptCode: 'COUNTERPART_AREA',
      version: '1.0',
      status: 'ACTIVE',
    },
    create: {
      code: 'CL_COUNTERPART_AREA',
      name: 'Counterpart Area Code List',
      description: 'Permitted counterpart areas (partner economies) for Trade and FDI flows',
      agencyCode: 'ERDI',
      relatedConceptCode: 'COUNTERPART_AREA',
      version: '1.0',
      status: 'ACTIVE',
    },
  });

  // 3. Create the COUNTERPART_AREA concept
  console.log('Ensuring Concept COUNTERPART_AREA exists...');
  const cs = await prisma.conceptScheme.findFirst({
    where: { code: 'CS_COMMON' },
  });
  const conceptSchemeCode = cs ? cs.code : 'CS_COMMON';

  // Ensure CS_COMMON exists just in case
  await prisma.conceptScheme.upsert({
    where: { code: conceptSchemeCode },
    update: {},
    create: {
      code: conceptSchemeCode,
      agency: 'ERDI',
      version: '1.0',
      name: 'Common Concept Scheme',
    },
  });

  await prisma.concept.upsert({
    where: { code: 'COUNTERPART_AREA' },
    update: {
      name: 'Counterpart Area',
      description: 'The partner country or geographical area for cross-border transactions',
      conceptSchemeCode: conceptSchemeCode,
      codeListCode: 'CL_COUNTERPART_AREA',
      dataType: 'String',
      defaultRole: 'Dimension',
      isCoded: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'COUNTERPART_AREA',
      name: 'Counterpart Area',
      description: 'The partner country or geographical area for cross-border transactions',
      conceptSchemeCode: conceptSchemeCode,
      codeListCode: 'CL_COUNTERPART_AREA',
      dataType: 'String',
      defaultRole: 'Dimension',
      isCoded: true,
      status: 'ACTIVE',
    },
  });

  // 4. Clone items from CL_ECONOMY_CODES to CL_COUNTERPART_AREA
  console.log('Cloning economy codes to counterpart area code list...');
  const economyItems = await prisma.codeListItem.findMany({
    where: { codeListCode: 'CL_ECONOMY_CODES' },
  });

  const counterpartItems = economyItems.map(item => ({
    codeListCode: 'CL_COUNTERPART_AREA',
    itemCode: item.itemCode,
    itemName: item.itemName,
    description: item.description,
    parentItemCode: item.parentItemCode,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  }));

  console.log(`Inserting ${counterpartItems.length} items into CL_COUNTERPART_AREA...`);
  const inserted = await prisma.codeListItem.createMany({
    data: counterpartItems,
    skipDuplicates: true,
  });
  console.log(`Cloned ${inserted.count} items.`);

  console.log('--- Seeding & Migration Completed ---');
}

main()
  .catch(e => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
