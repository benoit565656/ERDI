import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLocalCurrencyCode } from '@/lib/localCurrencyCodes';

// ─── Exclusion blocklist ─────────────────────────────────────────────────────
const EXCLUDED_UNIT_KEYWORDS = [
  'usd', 'eur', 'gbp', 'jpy', 'cny', 'lcu', 'currency', 'currencies',
  'local currency', 'national currency', 'current price', 'constant price',
  'dollar', 'euro', 'pound', 'yen', 'yuan', 'franc', 'rupee', 'won',
  'ringgit', 'baht', 'peso', 'sol', 'kip', 'taka', 'kyat', 'riel', 'dong',
  'kwh', 'mwh', 'gwh', 'twh', 'joule', 'kilojoule', 'megajoule', 'gigajoule',
  'toe', 'ktoe', 'mtoe', 'btu', 'mmbtu', 'watt', 'kilowatt', 'megawatt',
  'gigawatt', 'calorie', 'therm',
  'barrel', 'metric ton', 'short ton', 'long ton', 'cubic metre', 'cubic meter',
  'litre', 'liter', 'gallon', 'bushel',
  'index',
];

function isExcluded(unitName: string): boolean {
  const lower = (unitName || '').toLowerCase();
  return EXCLUDED_UNIT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── GET — Unit Distribution Report ─────────────────────────────────────────
// Groups by (indicatorCode, unitCode, economyCode) to count distinct economies
// per unit per indicator, then aggregates into one row per indicator.
export async function GET() {
  try {
    // Group by (indicatorCode, unitCode, economyCode) to get distinct combos
    const rawGroups = await prisma.observation.groupBy({
      by: ['indicatorCode', 'unitCode', 'economyCode'],
      _count: { id: true },
    });

    if (rawGroups.length === 0) return NextResponse.json([]);

    // Collect unique codes for batch name lookups
    const indicatorCodeSet = new Set<string>();
    const unitCodeSet      = new Set<string>();

    for (const g of rawGroups) {
      indicatorCodeSet.add(g.indicatorCode);
      if (g.unitCode) unitCodeSet.add(g.unitCode);
    }

    const [indicators, units] = await Promise.all([
      prisma.indicator.findMany({
        where: { code: { in: Array.from(indicatorCodeSet) } },
        select: { code: true, name: true },
      }),
      prisma.commonUnit.findMany({
        where: { code: { in: Array.from(unitCodeSet) } },
        select: { code: true, name: true },
      }),
    ]);

    const indicatorMap: Record<string, string> = {};
    for (const i of indicators) indicatorMap[i.code] = i.name;

    const unitMap: Record<string, string> = {};
    for (const u of units) unitMap[u.code] = u.name;

    // Build structure: indicatorCode → { unitCode → Set<economyCode> }
    const indicatorUnitEconomies: Record<string, Record<string, Set<string>>> = {};

    for (const g of rawGroups) {
      const unitCode = g.unitCode || '';
      if (!indicatorUnitEconomies[g.indicatorCode]) {
        indicatorUnitEconomies[g.indicatorCode] = {};
      }
      if (!indicatorUnitEconomies[g.indicatorCode][unitCode]) {
        indicatorUnitEconomies[g.indicatorCode][unitCode] = new Set();
      }
      if (g.economyCode) {
        indicatorUnitEconomies[g.indicatorCode][unitCode].add(g.economyCode);
      }
    }

    const result: {
      indicatorCode:          string;
      indicatorName:          string;
      commonUnitCode:         string;
      commonUnitName:         string;
      commonEconomyCount:     number;
      otherUnits:             { unitCode: string; unitName: string; economyCount: number }[];
      otherEconomyCount:      number;
      totalUnitCount:         number;
      hasCurrencyUnit:        boolean;
    }[] = [];

    for (const [indCode, unitMap2] of Object.entries(indicatorUnitEconomies)) {
      const unitCodes = Object.keys(unitMap2);

      // Only report indicators with more than 1 distinct unit
      if (unitCodes.length <= 1) continue;

      // Build unit→count list
      const unitEntries = unitCodes.map((uc) => ({
        unitCode:     uc,
        unitName:     unitMap[uc] || uc,
        economyCount: unitMap2[uc].size,
      }));

      // Find majority unit (highest economy count)
      unitEntries.sort((a, b) => b.economyCount - a.economyCount);
      const majority = unitEntries[0];
      const others   = unitEntries.slice(1);

      // Apply exclusion: skip if majority unit name is currency/energy/index
      if (isExcluded(majority.unitName)) continue;
      // Skip if ALL units (including majority) are excluded
      if (unitEntries.every((e) => isExcluded(e.unitName))) continue;

      const otherEconomyCount = others.reduce((s, e) => s + e.economyCount, 0);

      // Check if any unit (majority or minority) is a local currency code
      const hasCurrencyUnit =
        isLocalCurrencyCode(majority.unitCode) ||
        others.some((o) => isLocalCurrencyCode(o.unitCode));

      result.push({
        indicatorCode:      indCode,
        indicatorName:      indicatorMap[indCode] || indCode,
        commonUnitCode:     majority.unitCode,
        commonUnitName:     majority.unitName,
        commonEconomyCount: majority.economyCount,
        otherUnits:         others,
        otherEconomyCount,
        totalUnitCount:     unitCodes.length,
        hasCurrencyUnit,
      });
    }

    // Sort alphabetically by indicator name
    result.sort((a, b) => a.indicatorName.localeCompare(b.indicatorName));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Unit Discrepancy GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH — Apply Indicator-Wide Unit Fix ───────────────────────────────────
// Replaces unitCode on ALL observations for an indicator where unit ≠ newUnitCode.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { indicatorCode, newUnitCode } = body as {
      indicatorCode: string;
      newUnitCode:   string;
    };

    if (!indicatorCode || !newUnitCode) {
      return NextResponse.json(
        { error: 'indicatorCode and newUnitCode are required.' },
        { status: 400 }
      );
    }

    // Verify target unit exists
    const targetUnit = await prisma.commonUnit.findUnique({ where: { code: newUnitCode } });
    if (!targetUnit) {
      return NextResponse.json(
        { error: `Unit code "${newUnitCode}" not found in the CommonUnit table.` },
        { status: 400 }
      );
    }

    // Find all observations for this indicator where unit ≠ target (need IDs for history)
    const toUpdate = await prisma.observation.findMany({
      where: {
        indicatorCode,
        NOT: { unitCode: newUnitCode },
      },
      select: { id: true, unitCode: true },
    });

    if (toUpdate.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    // Bulk update
    const updateResult = await prisma.observation.updateMany({
      where: {
        indicatorCode,
        NOT: { unitCode: newUnitCode },
      },
      data: {
        unitCode:  newUnitCode,
        updatedAt: new Date(),
      },
    });

    // Write per-row history in batches of 500
    const BATCH = 500;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await prisma.observationHistory.createMany({
        data: batch.map((obs) => ({
          observationId: obs.id,
          changeType:    'UPDATE' as const,
          fieldName:     'unitCode',
          oldValue:      obs.unitCode || '',
          newValue:      newUnitCode,
          reason:        `Indicator-wide unit standardisation from DLM Unit Quality Check (target: ${newUnitCode})`,
          changedBy:     'DLM_Admin',
        })),
      });
    }

    // Single audit log for the bulk operation
    await prisma.auditLog.create({
      data: {
        action:     'BULK_FIX_UNIT',
        entityType: 'Observation',
        entityId:   indicatorCode,
        newValues: {
          indicatorCode,
          newUnitCode,
          updatedCount: updateResult.count,
        } as any,
      },
    });

    return NextResponse.json({ success: true, updatedCount: updateResult.count });
  } catch (err: any) {
    console.error('Unit Discrepancy PATCH Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
