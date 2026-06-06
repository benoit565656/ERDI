import { ObservationWithRelations } from './sdmx-json';

export function formatSDMXCsv(flowRef: string, observations: ObservationWithRelations[]): string {
  const headers = [
    'STRUCTURE',
    'STRUCTURE_ID',
    'ACTION',
    'FREQ',
    'INDICATOR',
    'ECONOMY_CODE',
    'TIME_PERIOD',
    'OBS_VALUE',
    'OBS_STATUS',
    'UNIT',
    'DECIMALS',
    'UNIT_MULT',
    'DATA_SOURCE',
    'FOOTNOTE'
  ];

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'string' ? val : val.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.join(',')];

  for (const obs of observations) {
    const obsValStr = obs.obsValue ? obs.obsValue.toString() : '';
    const row = [
      'dataflow',
      flowRef,
      'Information',
      obs.freqCode,
      obs.indicatorCode,
      obs.economyCode,
      obs.period,
      obsValStr,
      obs.obsStatusCode || '',
      obs.unitCode || '',
      obs.decimalsCode || '',
      obs.unitMultCode || '',
      obs.dataSource || '',
      obs.footnote || ''
    ];
    rows.push(row.map(escapeCsv).join(','));
  }

  return rows.join('\r\n');
}
