import { Prisma } from '@prisma/client';

export interface SDMXQueryParams {
  startPeriod?: string;
  endPeriod?: string;
  updatedAfter?: string;
  detail?: string;
  firstNObservations?: number;
  lastNObservations?: number;
}

export function buildPrismaWhere(
  agencyCode: string,
  datasetCode: string,
  key: string,
  params: SDMXQueryParams
): Prisma.ObservationWhereInput {
  const where: Prisma.ObservationWhereInput = {
    isPublished: true, // Only show published observations
  };

  if (agencyCode && agencyCode !== 'all' && agencyCode !== '*') {
    where.agencyCode = agencyCode;
  }
  if (datasetCode && datasetCode !== 'all' && datasetCode !== '*') {
    where.datasetCode = datasetCode;
  }

  if (key && key !== 'all' && key !== '*') {
    const keyParts = key.split('.');
    
    // 1. FREQ (Segment 0)
    if (keyParts[0] && keyParts[0] !== 'all' && keyParts[0] !== '*') {
      const vals = keyParts[0].split('+');
      where.freqCode = vals.length > 1 ? { in: vals } : vals[0];
    }
    
    // 2. INDICATOR (Segment 1)
    if (keyParts[1] && keyParts[1] !== 'all' && keyParts[1] !== '*') {
      const vals = keyParts[1].split('+');
      where.indicatorCode = vals.length > 1 ? { in: vals } : vals[0];
    }
    
    // 3. ECONOMY (Segment 2)
    if (keyParts[2] && keyParts[2] !== 'all' && keyParts[2] !== '*') {
      const vals = keyParts[2].split('+');
      where.economyCode = vals.length > 1 ? { in: vals } : vals[0];
    }
  }

  // Time period filtering
  if (params.startPeriod || params.endPeriod) {
    const periodFilter: any = {};
    if (params.startPeriod) {
      periodFilter.gte = params.startPeriod;
    }
    if (params.endPeriod) {
      periodFilter.lte = params.endPeriod;
    }
    where.period = periodFilter;
  }

  // Incremental update filter
  if (params.updatedAfter) {
    where.updatedAt = { gte: new Date(params.updatedAfter) };
  }

  return where;
}
