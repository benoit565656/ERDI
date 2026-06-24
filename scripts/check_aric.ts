import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const economies = await prisma.explorerCache.findMany({
    where: { datasetCode: 'ARIC' },
    select: { economyCode: true },
    distinct: ['economyCode']
  });
  console.log('ARIC economies in cache:', economies.map(e => e.economyCode));

  const indicators = await prisma.explorerCache.findMany({
    where: { datasetCode: 'ARIC' },
    select: { indicatorCode: true },
    distinct: ['indicatorCode']
  });
  console.log('ARIC indicators in cache:', indicators.map(i => i.indicatorCode));
}

main().finally(() => prisma.$disconnect());
