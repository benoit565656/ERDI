import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { buildPrismaWhere } from '../query/dataQuery';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/sdmx/availableconstraint/:flowRef/:key/:agency/:componentId
router.get('/:flowRef/:key/:agency/:componentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const flowRef = req.params.flowRef as string;
    const key = req.params.key as string;
    const agency = req.params.agency as string;
    const componentId = req.params.componentId as string;

    // Parse flowRef AGENCY,DATASET
    const flowParts = flowRef.split(',');
    if (flowParts.length < 2) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid flowRef format. Expected AGENCY,DATASET (e.g. ERDI,KIDB)',
      });
      return;
    }
    const [agencyCode, datasetCode] = flowParts;

    // Build Prisma query condition (same logic as data queries)
    const where = buildPrismaWhere(agencyCode, datasetCode, key, {
      startPeriod: req.query.startPeriod as string,
      endPeriod: req.query.endPeriod as string,
    });

    let distinctValues: string[] = [];

    // Map componentId to corresponding database field and query distinct values
    const compIdNorm = componentId.toUpperCase();

    if (compIdNorm === 'FREQ') {
      const result = await prisma.observation.groupBy({
        by: ['freqCode'],
        where,
      });
      distinctValues = result.map(r => r.freqCode);
    } else if (compIdNorm === 'INDICATOR') {
      const result = await prisma.observation.groupBy({
        by: ['indicatorCode'],
        where,
      });
      distinctValues = result.map(r => r.indicatorCode);
    } else if (compIdNorm === 'ECONOMY' || compIdNorm === 'ECONOMY_CODE') {
      const result = await prisma.observation.groupBy({
        by: ['economyCode'],
        where,
      });
      distinctValues = result.map(r => r.economyCode);
    } else if (compIdNorm === 'TIME_PERIOD' || compIdNorm === 'PERIOD') {
      const result = await prisma.observation.groupBy({
        by: ['period'],
        where,
      });
      distinctValues = result.map(r => r.period);
    } else {
      res.status(400).json({
        error: 'Bad Request',
        message: `Unknown componentId '${componentId}'. Expected FREQ, INDICATOR, ECONOMY_CODE, or TIME_PERIOD.`,
      });
      return;
    }

    res.status(200).json({
      header: {
        id: `CON_${Date.now()}`,
        prepared: new Date().toISOString(),
        sender: { id: agency || 'ERDI' },
      },
      componentId,
      values: distinctValues.sort(),
    });
  } catch (err: any) {
    console.error('Error fetching constraints:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

export default router;
