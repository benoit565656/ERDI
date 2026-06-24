import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Explorer Cache Rebuild ---');
  const startTime = Date.now();

  try {
    // 1. Clear existing cache
    console.log('Clearing existing explorer cache...');
    await prisma.explorerCache.deleteMany();

    // 2. Fetch and aggregate observations
    console.log('Aggregating published observations from database...');
    const aggregations = await prisma.$queryRaw<any[]>`
      SELECT
        "dataset_code" as "datasetCode",
        "indicator_code" as "indicatorCode",
        "economy_code" as "economyCode",
        "freq_code" as "freqCode",
        string_agg(DISTINCT "period", ',' ORDER BY "period" ASC) as "periods",
        max("period") as "latestPeriod",
        count(*)::integer as "obsCount"
      FROM "observations"
      WHERE "is_published" = true AND "deleted_at" IS NULL
      GROUP BY "dataset_code", "indicator_code", "economy_code", "freq_code"
    `;

    console.log(`Found ${aggregations.length} distinct series. Rebuilding cache table...`);

    // 3. Insert in chunks to avoid query parameter size limits
    const chunkSize = 5000;
    for (let i = 0; i < aggregations.length; i += chunkSize) {
      const chunk = aggregations.slice(i, i + chunkSize);
      await prisma.explorerCache.createMany({
        data: chunk.map(row => ({
          datasetCode: row.datasetCode,
          indicatorCode: row.indicatorCode,
          economyCode: row.economyCode,
          freqCode: row.freqCode,
          periods: row.periods,
          latestPeriod: row.latestPeriod,
          obsCount: row.obsCount,
        }))
      });
      console.log(`Inserted chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✔ Cache rebuild completed successfully in ${elapsed}s! Total series cached: ${aggregations.length}`);
  } catch (err) {
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
