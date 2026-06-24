import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  console.log('--- Triggered Cache Rebuild via API ---');
  const startTime = Date.now();

  try {
    // 1. Clear existing cache
    await prisma.explorerCache.deleteMany();

    // 2. Fetch and aggregate observations
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

    // 3. Insert in chunks
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
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    return NextResponse.json({
      success: true,
      message: `Cache rebuilt successfully in ${elapsed}s!`,
      seriesCached: aggregations.length
    });
  } catch (err: any) {
    console.error('API Cache Rebuild Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
