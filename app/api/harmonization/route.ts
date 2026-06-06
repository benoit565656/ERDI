import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rules = await prisma.harmonizationRule.findMany({
      include: {
        indicator: true,
        dataset: true,
        targetUnit: true,
        targetMultiplier: true,
        ruleItems: {
          include: {
            economy: true,
            sourceUnit: true,
            targetUnit: true,
            sourceMult: true,
            targetMult: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rules);
  } catch (err: any) {
    console.error('Harmonization GET API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      datasetCode,
      dataflowCode,
      indicatorCode,
      ruleName,
      targetUnitCode,
      targetMultiplierCode,
      conversionMethod,
      exchangeRateSource,
      isActive = true,
      ruleItems = [],
    } = body;

    if (!datasetCode || !indicatorCode || !ruleName || !conversionMethod) {
      return NextResponse.json(
        { error: 'Dataset, Indicator, Rule Name, and Conversion Method are required.' },
        { status: 400 }
      );
    }

    const data: any = {
      dataset: { connect: { code: datasetCode } },
      indicator: { connect: { code: indicatorCode } },
      ruleName,
      conversionMethod,
      exchangeRateSource,
      isActive,
    };

    if (dataflowCode) {
      data.dataflow = {
        connect: {
          datasetCode_code: {
            datasetCode,
            code: dataflowCode,
          },
        },
      };
    }

    if (targetUnitCode) {
      data.targetUnit = { connect: { code: targetUnitCode } };
    }

    if (targetMultiplierCode) {
      data.targetMultiplier = { connect: { code: targetMultiplierCode } };
    }

    let rule;
    if (id) {
      // Update
      // Delete existing items first for simplicity during upsert
      await prisma.harmonizationRuleItem.deleteMany({
        where: { harmonizationRuleId: id },
      });

      rule = await prisma.harmonizationRule.update({
        where: { id },
        data: {
          ...data,
          ruleItems: {
            create: ruleItems.map((item: any) => ({
              economyCode: item.economyCode || null,
              sourceUnitCode: item.sourceUnitCode || null,
              sourceMultiplierCode: item.sourceMultiplierCode || null,
              targetUnitCode: item.targetUnitCode || null,
              targetMultiplierCode: item.targetMultiplierCode || null,
            })),
          },
        },
      });
    } else {
      // Create
      rule = await prisma.harmonizationRule.create({
        data: {
          ...data,
          ruleItems: {
            create: ruleItems.map((item: any) => ({
              economyCode: item.economyCode || null,
              sourceUnitCode: item.sourceUnitCode || null,
              sourceMultiplierCode: item.sourceMultiplierCode || null,
              targetUnitCode: item.targetUnitCode || null,
              targetMultiplierCode: item.targetMultiplierCode || null,
            })),
          },
        },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: id ? 'UPDATE_HARMONIZATION_RULE' : 'CREATE_HARMONIZATION_RULE',
        entityType: 'HarmonizationRule',
        entityId: rule.id,
        newValues: body,
      },
    });

    return NextResponse.json(rule);
  } catch (err: any) {
    console.error('Harmonization POST API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
