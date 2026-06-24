import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const historyOfObsId = searchParams.get('historyOfObsId');
    if (historyOfObsId) {
      const history = await prisma.observationHistory.findMany({
        where: { observationId: historyOfObsId },
        orderBy: { changedAt: 'desc' },
      });
      return NextResponse.json(history);
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const datasetCode = searchParams.get('datasetCode');
    const mainDataflowCode = searchParams.get('mainDataflowCode');
    const indicatorCode = searchParams.get('indicatorCode');
    const economyCode = searchParams.get('economyCode');
    const freqCode = searchParams.get('freqCode');
    const period = searchParams.get('period');

    const sexCode = searchParams.get('sexCode');
    const ageCode = searchParams.get('ageCode');
    const sectorCode = searchParams.get('sectorCode');
    const occupationCode = searchParams.get('occupationCode');
    const regionCode = searchParams.get('regionCode');
    const sizeClassCode = searchParams.get('sizeClassCode');
    const ownershipCode = searchParams.get('ownershipCode');
    const currencyCode = searchParams.get('currencyCode');
    const adjustmentCode = searchParams.get('adjustmentCode');
    const priceBaseCode = searchParams.get('priceBaseCode');
    const counterpartAreaCode = searchParams.get('counterpartAreaCode');

    const where: any = {};
    if (datasetCode) where.datasetCode = datasetCode;
    if (mainDataflowCode) where.mainDataflowCode = mainDataflowCode;
    if (indicatorCode) where.indicatorCode = indicatorCode;
    if (economyCode) where.economyCode = economyCode;
    if (freqCode) where.freqCode = freqCode;
    if (period) where.period = period;

    if (sexCode) where.sexCode = sexCode;
    if (ageCode) where.ageCode = ageCode;
    if (sectorCode) where.sectorCode = sectorCode;
    if (occupationCode) where.occupationCode = occupationCode;
    if (regionCode) where.regionCode = regionCode;
    if (sizeClassCode) where.sizeClassCode = sizeClassCode;
    if (ownershipCode) where.ownershipCode = ownershipCode;
    if (currencyCode) where.currencyCode = currencyCode;
    if (adjustmentCode) where.adjustmentCode = adjustmentCode;
    if (priceBaseCode) where.priceBaseCode = priceBaseCode;
    if (counterpartAreaCode) where.counterpartAreaCode = counterpartAreaCode;

    const [observations, total] = await Promise.all([
      prisma.observation.findMany({
        where,
        orderBy: [
          { freqCode: 'asc' },
          { indicatorCode: 'asc' },
          { economyCode: 'asc' },
          { period: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.observation.count({ where }),
    ]);

    return NextResponse.json({
      observations,
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, obsValue, obsStatusCode, unitCode, unitMultCode, decimalsCode, dataSource, footnote } = body;

    if (!id) {
      return NextResponse.json({ error: 'Observation ID is required.' }, { status: 400 });
    }

    // Find existing observation
    const oldObs = await prisma.observation.findUnique({
      where: { id },
    });

    if (!oldObs) {
      return NextResponse.json({ error: 'Observation not found.' }, { status: 404 });
    }

    const updatedValue = obsValue !== '' && obsValue !== null && obsValue !== undefined ? parseFloat(obsValue.toString()) : null;
    const updatedStatus = obsStatusCode || null;
    const updatedUnit = unitCode || null;
    const updatedMult = unitMultCode || null;
    const updatedDecimals = decimalsCode || null;
    const updatedSource = dataSource || null;
    const updatedFootnote = footnote || null;

    // Track history for modifications
    const historyEntries = [];
    const fieldsToCompare = [
      { name: 'obsValue', old: oldObs.obsValue ? parseFloat(oldObs.obsValue.toString()) : null, new: updatedValue },
      { name: 'obsStatusCode', old: oldObs.obsStatusCode, new: updatedStatus },
      { name: 'unitCode', old: oldObs.unitCode, new: updatedUnit },
      { name: 'unitMultCode', old: oldObs.unitMultCode, new: updatedMult },
      { name: 'decimalsCode', old: oldObs.decimalsCode, new: updatedDecimals },
      { name: 'dataSource', old: oldObs.dataSource, new: updatedSource },
      { name: 'footnote', old: oldObs.footnote, new: updatedFootnote },
    ];

    for (const field of fieldsToCompare) {
      if (field.old !== field.new) {
        historyEntries.push({
          observationId: id,
          changeType: 'UPDATE' as const,
          fieldName: field.name,
          oldValue: field.old !== null && field.old !== undefined ? String(field.old) : '',
          newValue: field.new !== null && field.new !== undefined ? String(field.new) : '',
          reason: 'Manual edit in DLM panel',
          changedBy: 'DLM_Admin',
        });
      }
    }

    // Update the observation in database
    const updatedObs = await prisma.observation.update({
      where: { id },
      data: {
        obsValue: updatedValue,
        obsStatusCode: updatedStatus,
        unitCode: updatedUnit,
        unitMultCode: updatedMult,
        decimalsCode: updatedDecimals,
        dataSource: updatedSource,
        footnote: updatedFootnote,
        updatedAt: new Date(),
      },
    });

    // Write history entries
    if (historyEntries.length > 0) {
      await prisma.observationHistory.createMany({
        data: historyEntries,
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_OBSERVATION',
        entityType: 'Observation',
        entityId: id,
        newValues: { id, obsValue: updatedValue, obsStatusCode: updatedStatus } as any,
      },
    });

    return NextResponse.json({ success: true, observation: updatedObs });
  } catch (err: any) {
    console.error('Observation Update API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
