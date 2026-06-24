import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ConstraintScopeType, ConstraintRuleType } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetCode = searchParams.get('datasetCode');
    const dataflowCode = searchParams.get('dataflowCode');
    const indicatorCode = searchParams.get('indicatorCode');

    if (!datasetCode) {
      return NextResponse.json({ error: 'Missing datasetCode parameter' }, { status: 400 });
    }

    // Fetch active constraints
    const dbConstraints = await prisma.constraint.findMany({
      where: { datasetCode, isActive: true },
      include: { constraintItems: true },
    });

    const datasetConstraints = dbConstraints.filter(c => c.scopeType === ConstraintScopeType.DATASET);
    const dataflowConstraints = dbConstraints.filter(
      c => c.scopeType === ConstraintScopeType.DATAFLOW && c.dataflowCode === dataflowCode
    );

    const indicatorConstraints = dbConstraints.filter(
      c => c.scopeType === ConstraintScopeType.INDICATOR && c.indicatorCode === indicatorCode
    );

    const dataflowIndicatorConstraints = dbConstraints.filter(
      c => c.scopeType === ConstraintScopeType.DATAFLOW_INDICATOR &&
           c.dataflowCode === dataflowCode &&
           c.indicatorCode === indicatorCode
    );

    const getSpecificity = (scope: ConstraintScopeType) => {
      switch (scope) {
        case 'DATAFLOW_INDICATOR': return 4;
        case 'INDICATOR': return 3;
        case 'DATAFLOW': return 2;
        case 'DATASET': return 1;
        default: return 0;
      }
    };

    // Aggregate active constraints
    const allActive = [
      ...datasetConstraints,
      ...dataflowConstraints,
      ...indicatorConstraints,
      ...dataflowIndicatorConstraints
    ];

    // Resolve concept rules by specificity
    const resolvedRules: Record<string, { ruleType: ConstraintRuleType; values: string[] }> = {};
    const conceptSpecificity: Record<string, number> = {};

    for (const c of allActive) {
      const spec = getSpecificity(c.scopeType);
      for (const item of c.constraintItems) {
        const concept = item.conceptCode;
        const currentSpec = conceptSpecificity[concept] ?? -1;

        if (spec > currentSpec) {
          conceptSpecificity[concept] = spec;
          resolvedRules[concept] = {
            ruleType: item.ruleType,
            values: item.codeValue ? [item.codeValue] : []
          };
        } else if (spec === currentSpec) {
          const ruleObj = resolvedRules[concept];
          if (ruleObj && ruleObj.ruleType === item.ruleType && item.codeValue) {
            ruleObj.values.push(item.codeValue);
          }
        }
      }
    }

    return NextResponse.json({
      datasetCode,
      dataflowCode,
      indicatorCode,
      rules: resolvedRules
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
