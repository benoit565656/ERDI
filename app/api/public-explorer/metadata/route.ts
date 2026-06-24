import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const indicatorCode = searchParams.get('indicatorCode');
    const economyCode = searchParams.get('economyCode');
    const counterpartAreaCode = searchParams.get('counterpartAreaCode');
    const datasetCode = searchParams.get('datasetCode');
    const periodsParam = searchParams.get('periods');

    if (!indicatorCode || !datasetCode) {
      return NextResponse.json({ error: 'indicatorCode and datasetCode parameters are required.' }, { status: 400 });
    }

    const periods = periodsParam ? periodsParam.split(',').map(p => p.trim()) : [];

    // 1. Fetch indicator generic details
    const indicator = await prisma.indicator.findUnique({
      where: { code: indicatorCode },
      select: {
        name: true,
        definition: true,
        description: true,
        source: true,
        methodology: true,
        defaultUnitCode: true,
        defaultUnitMultCode: true,
      }
    });

    // 2. Fetch dataset-specific metadata if available
    const datasetMetadata = await prisma.indicatorDatasetMetadata.findFirst({
      where: {
        datasetCode,
        indicatorCode,
      },
      select: {
        description: true,
        sourceNotes: true,
        methodology: true,
      }
    });

    // 3. Resolve indicator name, definition, source
    const name = indicator?.name || indicatorCode;
    const definition = datasetMetadata?.description || indicator?.definition || indicator?.description || '';
    const genericSource = indicator?.source || '';
    const datasetSourceNotes = datasetMetadata?.sourceNotes || '';
    const genericMethodology = datasetMetadata?.methodology || indicator?.methodology || '';

    // 4. Resolve default unit & multiplier details
    let defaultUnitName = '';
    let defaultMultiplierName = '';
    if (indicator?.defaultUnitCode) {
      const u = await prisma.commonUnit.findUnique({ where: { code: indicator.defaultUnitCode } });
      if (u) defaultUnitName = u.name;
    }
    if (indicator?.defaultUnitMultCode) {
      const m = await prisma.commonMultiplier.findUnique({ where: { code: indicator.defaultUnitMultCode } });
      if (m) defaultMultiplierName = m.name;
    }

    // 5. Query observation-specific notes and sources
    const obsWhere: any = {
      datasetCode,
      indicatorCode,
      isPublished: true,
      deletedAt: null,
    };
    
    if (economyCode) {
      obsWhere.economyCode = economyCode;
    }
    if (counterpartAreaCode) {
      obsWhere.counterpartAreaCode = counterpartAreaCode;
    }
    if (periods.length > 0) {
      obsWhere.period = { in: periods };
    }

    const observations = await prisma.observation.findMany({
      where: obsWhere,
      select: {
        period: true,
        dataSource: true,
        footnote: true,
        methodology: true,
      },
      orderBy: { period: 'asc' }
    });

    // 6. Group period-specific notes and sources
    const groupPeriodMetadata = (items: { period: string; text: string }[]) => {
      const valid = items.filter(item => item.text && item.text.trim() !== '');
      if (valid.length === 0) return [];

      const groups = new Map<string, string[]>();
      valid.forEach(item => {
        const text = item.text.trim();
        const pers = groups.get(text) || [];
        pers.push(item.period);
        groups.set(text, pers);
      });

      if (groups.size === 1) {
        const text = groups.keys().next().value || '';
        return [{ text }];
      }

      const result: { periods: string; text: string }[] = [];
      groups.forEach((pers, text) => {
        const formatted = formatPeriodList(pers);
        result.push({ periods: formatted, text });
      });
      return result;
    };

    const groupedSources = groupPeriodMetadata(
      observations.map(o => ({ period: o.period, text: o.dataSource || '' }))
    );

    const groupedNotes = groupPeriodMetadata(
      observations.map(o => ({ period: o.period, text: o.footnote || '' }))
    );

    const groupedMethodologies = groupPeriodMetadata(
      observations.map(o => ({ period: o.period, text: o.methodology || '' }))
    );

    // Fallback if no specific sources are found in observations
    const finalGroupedSources = groupedSources.length > 0 
      ? groupedSources 
      : (datasetSourceNotes || genericSource ? [{ text: datasetSourceNotes || genericSource }] : []);

    const finalGroupedMethodologies = groupedMethodologies.length > 0 
      ? groupedMethodologies 
      : (genericMethodology ? [{ text: genericMethodology }] : []);

    return NextResponse.json({
      indicatorCode,
      name,
      definition,
      defaultUnitName,
      defaultMultiplierName,
      sources: finalGroupedSources,
      notes: groupedNotes,
      methodologies: finalGroupedMethodologies,
    });
  } catch (err: any) {
    console.error('Metadata API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function formatPeriodList(periods: string[]): string {
  const sorted = [...periods].sort((a, b) => Number(a) - Number(b));
  if (sorted.length === 1) return sorted[0];

  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const curr = sorted[i];
    const isContiguous = curr && Number(curr) === Number(prev) + 1;
    if (!isContiguous) {
      if (start === prev) {
        ranges.push(start);
      } else {
        ranges.push(`${start}–${prev}`);
      }
      start = curr;
    }
    prev = curr;
  }

  if (ranges.length === 1) return ranges[0];

  const last = ranges.pop();
  return `${ranges.join(', ')} and ${last}`;
}
