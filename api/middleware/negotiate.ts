import { Request, Response, NextFunction } from 'express';

export type ResponseFormat = 'jsondata' | 'csv' | 'xml';

export function negotiateFormat(req: Request, res: Response, next: NextFunction) {
  const formatParam = req.query.format as string;
  let format: ResponseFormat = 'jsondata';

  if (formatParam) {
    const norm = formatParam.toLowerCase();
    if (norm === 'csv') {
      format = 'csv';
    } else if (norm === 'xml' || norm === 'genericdata') {
      format = 'xml';
    } else {
      format = 'jsondata';
    }
  } else {
    const accept = req.headers.accept || '';
    if (accept.includes('application/vnd.sdmx.data+csv') || accept.includes('text/csv')) {
      format = 'csv';
    } else if (
      accept.includes('application/vnd.sdmx.genericdata+xml') ||
      accept.includes('application/xml') ||
      accept.includes('text/xml')
    ) {
      format = 'xml';
    } else {
      format = 'jsondata'; // Default to SDMX-JSON
    }
  }

  res.locals.format = format;
  next();
}
