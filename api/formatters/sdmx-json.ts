export interface ObservationWithRelations {
  id: string;
  datasetCode: string;
  agencyCode: string;
  mainDataflowCode: string;
  secondaryDataflowCode: string | null;
  indicatorCode: string;
  economyCode: string;
  period: string;
  freqCode: string;
  obsValue: any; // Decimal
  unitCode: string | null;
  unitMultCode: string | null;
  decimalsCode: string | null;
  obsStatusCode: string | null;
  dataSource: string | null;
  footnote: string | null;
  updatedAt: Date;
  indicator: { name: string } | null;
  economy: { name: string } | null;
}

export function formatSDMXJson(
  flowRef: string,
  datasetName: string,
  observations: ObservationWithRelations[],
  detail: string = 'full'
) {
  const preparedDate = new Date().toISOString();
  const senderId = flowRef.split(',')[0] || 'ERDI';

  // 1. Collect unique dimension and attribute values
  const freqs = new Map<string, string>(); // code -> name
  const indicators = new Map<string, string>(); // code -> name
  const economies = new Map<string, string>(); // code -> name
  const periods = new Set<string>();
  const obsStatuses = new Set<string>();
  const units = new Set<string>();
  const unitMults = new Set<string>();
  const decimals = new Set<string>();

  // Frequency name mapping helper
  const getFreqName = (code: string) => {
    switch (code.toUpperCase()) {
      case 'A': return 'Annual';
      case 'Q': return 'Quarterly';
      case 'M': return 'Monthly';
      case 'D': return 'Daily';
      default: return code;
    }
  };

  for (const obs of observations) {
    freqs.set(obs.freqCode, getFreqName(obs.freqCode));
    indicators.set(obs.indicatorCode, obs.indicator?.name || obs.indicatorCode);
    economies.set(obs.economyCode, obs.economy?.name || obs.economyCode);
    periods.add(obs.period);
    if (obs.obsStatusCode) obsStatuses.add(obs.obsStatusCode);
    if (obs.unitCode) units.add(obs.unitCode);
    if (obs.unitMultCode) unitMults.add(obs.unitMultCode);
    if (obs.decimalsCode) decimals.add(obs.decimalsCode);
  }

  // Sort values for consistent indexing
  const freqList = Array.from(freqs.keys()).sort();
  const indicatorList = Array.from(indicators.keys()).sort();
  const economyList = Array.from(economies.keys()).sort();
  const periodList = Array.from(periods).sort();
  const statusList = Array.from(obsStatuses).sort();
  const unitList = Array.from(units).sort();
  const multList = Array.from(unitMults).sort();
  const decimalList = Array.from(decimals).sort();

  // 2. Build dimensions and attributes structures
  const dimensionValues = {
    FREQ: freqList.map(code => ({ id: code, name: freqs.get(code) })),
    INDICATOR: indicatorList.map(code => ({ id: code, name: indicators.get(code) })),
    ECONOMY_CODE: economyList.map(code => ({ id: code, name: economies.get(code) })),
    TIME_PERIOD: periodList.map(p => ({ id: p })),
  };

  const attributeValues = {
    OBS_STATUS: statusList.map(code => ({ id: code, name: code })),
    UNIT: unitList.map(code => ({ id: code, name: code })),
    UNIT_MULT: multList.map(code => ({ id: code, name: code })),
    DECIMALS: decimalList.map(code => ({ id: code, name: code })),
  };

  // 3. Build dataset structure
  const series: { [key: string]: any } = {};

  if (detail !== 'nodata') {
    for (const obs of observations) {
      const fIdx = freqList.indexOf(obs.freqCode);
      const iIdx = indicatorList.indexOf(obs.indicatorCode);
      const eIdx = economyList.indexOf(obs.economyCode);
      const seriesKey = `${fIdx}:${iIdx}:${eIdx}`;

      if (!series[seriesKey]) {
        // Series level attributes: UNIT, UNIT_MULT, DECIMALS
        const seriesAttributes: (number | null)[] = [];
        if (detail === 'full') {
          seriesAttributes.push(
            obs.unitCode ? unitList.indexOf(obs.unitCode) : null,
            obs.unitMultCode ? multList.indexOf(obs.unitMultCode) : null,
            obs.decimalsCode ? decimalList.indexOf(obs.decimalsCode) : null
          );
        }

        series[seriesKey] = {
          attributes: seriesAttributes,
          observations: {},
        };
      }

      if (detail !== 'serieskeysonly') {
        const pIdx = periodList.indexOf(obs.period);
        
        // Observation value and attributes
        const obsValueStr = obs.obsValue ? obs.obsValue.toString() : null;
        const obsVal = obsValueStr !== null ? parseFloat(obsValueStr) : null;
        
        const obsAttributes: (number | null)[] = [];
        if (detail === 'full') {
          obsAttributes.push(
            obs.obsStatusCode ? statusList.indexOf(obs.obsStatusCode) : null
          );
        }

        series[seriesKey].observations[pIdx.toString()] = [obsVal, ...obsAttributes];
      }
    }
  }

  // 4. Construct Final SDMX-JSON Envelope
  const response: any = {
    header: {
      id: `ERDI_${Date.now()}`,
      prepared: preparedDate,
      sender: {
        id: senderId,
        name: senderId === 'ERDI' ? 'ERDI Statistical Platform' : senderId,
      },
    },
    dataSets: [
      {
        action: 'Information',
        series: series,
      },
    ],
    structure: {
      links: [],
      name: datasetName,
      description: `SDMX-JSON data representation for dataflow ${flowRef}`,
      dimensions: {
        dataset: [],
        series: [
          {
            id: 'FREQ',
            name: 'Frequency',
            keyPosition: 0,
            values: dimensionValues.FREQ,
          },
          {
            id: 'INDICATOR',
            name: 'Indicator',
            keyPosition: 1,
            values: dimensionValues.INDICATOR,
          },
          {
            id: 'ECONOMY_CODE',
            name: 'Economy',
            keyPosition: 2,
            values: dimensionValues.ECONOMY_CODE,
          },
        ],
        observation: [
          {
            id: 'TIME_PERIOD',
            name: 'Time Period',
            keyPosition: 3,
            role: 'time',
            values: dimensionValues.TIME_PERIOD,
          },
        ],
      },
      attributes: {
        dataset: [],
        series: [
          {
            id: 'UNIT',
            name: 'Unit of Measure',
            values: attributeValues.UNIT,
          },
          {
            id: 'UNIT_MULT',
            name: 'Unit Multiplier',
            values: attributeValues.UNIT_MULT,
          },
          {
            id: 'DECIMALS',
            name: 'Decimals',
            values: attributeValues.DECIMALS,
          },
        ],
        observation: [
          {
            id: 'OBS_STATUS',
            name: 'Observation Status',
            values: attributeValues.OBS_STATUS,
          },
        ],
      },
    },
  };

  return response;
}
