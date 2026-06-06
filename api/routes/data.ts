import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildPrismaWhere, SDMXQueryParams } from '../query/dataQuery';
import { formatSDMXJson } from '../formatters/sdmx-json';
import { formatSDMXCsv } from '../formatters/sdmx-csv';
import { formatSDMXXml } from '../formatters/sdmx-xml';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/sdmx/data/:flowRef/:key
router.get('/:flowRef/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const flowRef = req.params.flowRef as string;
    const key = req.params.key as string;
    
    // Parse flowRef: AGENCY,DATASET (e.g., ERDI,KIDB)
    const flowParts = flowRef.split(',');
    if (flowParts.length !== 2) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid flowRef format. Expected AGENCY,DATASET (e.g. ERDI,KIDB)',
      });
      return;
    }
    
    const [agencyCode, datasetCode] = flowParts;

    // Check if dataset exists (unless querying 'all')
    let datasetName = 'Key Indicators Database';
    if (datasetCode !== 'all' && datasetCode !== '*') {
      const dbDataset = await prisma.dataset.findUnique({
        where: { code: datasetCode },
      });
      if (!dbDataset) {
        res.status(404).json({
          error: 'Not Found',
          message: `Dataset ${datasetCode} not found under agency ${agencyCode}`,
        });
        return;
      }
      datasetName = dbDataset.name;
    }

    // Parse query params
    const queryParams: SDMXQueryParams = {
      startPeriod: req.query.startPeriod as string,
      endPeriod: req.query.endPeriod as string,
      updatedAfter: req.query.updatedAfter as string,
      detail: (req.query.detail as string) || 'full',
    };

    if (req.query.firstNObservations) {
      queryParams.firstNObservations = parseInt(req.query.firstNObservations as string, 10);
    }
    if (req.query.lastNObservations) {
      queryParams.lastNObservations = parseInt(req.query.lastNObservations as string, 10);
    }

    // Build Prisma query
    const where = buildPrismaWhere(agencyCode, datasetCode, key, queryParams);

    // Query observations
    const observations = await prisma.observation.findMany({
      where,
      orderBy: [
        { freqCode: 'asc' },
        { indicatorCode: 'asc' },
        { economyCode: 'asc' },
        { period: 'asc' },
      ],
      include: {
        indicator: { select: { name: true } },
        economy: { select: { name: true } },
      },
    });

    // Apply per-series paging limits (firstN/lastN)
    let resultObs = observations;
    if (queryParams.firstNObservations || queryParams.lastNObservations) {
      const grouped = new Map<string, typeof observations>();
      for (const obs of observations) {
        const obsKey = `${obs.freqCode}|${obs.indicatorCode}|${obs.economyCode}`;
        if (!grouped.has(obsKey)) {
          grouped.set(obsKey, []);
        }
        grouped.get(obsKey)!.push(obs);
      }

      const sliced: typeof observations = [];
      for (const list of Array.from(grouped.values())) {
        if (queryParams.firstNObservations) {
          sliced.push(...list.slice(0, queryParams.firstNObservations));
        } else if (queryParams.lastNObservations) {
          sliced.push(...list.slice(-queryParams.lastNObservations));
        }
      }
      resultObs = sliced;
    }

    // Send formatted response based on content negotiation
    const format = res.locals.format || 'jsondata';

    if (format === 'csv') {
      const csvData = formatSDMXCsv(flowRef, resultObs as any);
      res.setHeader('Content-Type', 'application/vnd.sdmx.data+csv;version=1.0');
      res.status(200).send(csvData);
    } else if (format === 'xml') {
      const xmlData = formatSDMXXml(flowRef, datasetName, resultObs as any);
      res.setHeader('Content-Type', 'application/vnd.sdmx.genericdata+xml;version=2.1');
      res.status(200).send(xmlData);
    } else {
      const jsonData = formatSDMXJson(flowRef, datasetName, resultObs as any, queryParams.detail);
      res.setHeader('Content-Type', 'application/vnd.sdmx.data+json;version=2.0');
      res.status(200).json(jsonData);
    }
  } catch (err: any) {
    console.error('Error fetching data:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

export default router;
