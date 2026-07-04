const { PrismaClient } = require('@prisma/client-cockroach');
const prisma = new PrismaClient();

async function findKeys() {
  console.log('=== Finding Key Indicator Codes in DB ===');
  const indicators = await prisma.indicator.findMany({
    where: {
      OR: [
        { name: { contains: 'gdp', mode: 'insensitive' } },
        { name: { contains: 'population', mode: 'insensitive' } },
        { name: { contains: 'inflation', mode: 'insensitive' } },
        { name: { contains: 'cpi', mode: 'insensitive' } },
        { name: { contains: 'labor force', mode: 'insensitive' } },
        { name: { contains: 'unemployment', mode: 'insensitive' } }
      ]
    },
    select: { code: true, name: true }
  });

  console.log(`Found ${indicators.length} candidate indicators. Checking observations count...`);

  const results = [];
  for (const ind of indicators) {
    const count = await prisma.observation.count({
      where: { indicatorCode: ind.code }
    });
    if (count > 0) {
      results.push({ code: ind.code, name: ind.name, count });
    }
  }

  // Sort by count descending
  results.sort((a, b) => b.count - a.count);
  console.log('Top Indicators with Observations:');
  console.log(JSON.stringify(results.slice(0, 40), null, 2));

  await prisma.$disconnect();
}

findKeys();
