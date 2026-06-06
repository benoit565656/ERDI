import { ObservationWithRelations } from './sdmx-json';

export function formatSDMXXml(flowRef: string, datasetName: string, observations: ObservationWithRelations[]): string {
  const preparedDate = new Date().toISOString();
  const agencyId = flowRef.split(',')[0] || 'ERDI';
  const datasetCode = flowRef.split(',')[1] || 'KIDB';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<message:GenericData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"\n';
  xml += '                     xmlns:generic="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic"\n';
  xml += '                     xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common"\n';
  xml += '                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  xml += '                     xsi:schemaLocation="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message https://registry.sdmx.org/schemas/v2_1/SDMXMessage.xsd">\n';
  
  // Header
  xml += '  <message:Header>\n';
  xml += `    <message:ID>ERDI_${Date.now()}</message:ID>\n`;
  xml += `    <message:Prepared>${preparedDate}</message:Prepared>\n`;
  xml += `    <message:Sender id="${agencyId}">\n`;
  xml += `      <message:Name xml:lang="en">${agencyId === 'ERDI' ? 'ERDI Statistical Platform' : agencyId}</message:Name>\n`;
  xml += '    </message:Sender>\n';
  xml += `    <message:Structure structureID="${datasetCode}" namespace="generic">\n`;
  xml += '      <common:Structure>\n';
  xml += `        <common:Ref agencyID="${agencyId}" id="${datasetCode}" version="1.0"/>\n`;
  xml += '      </common:Structure>\n';
  xml += '    </message:Structure>\n';
  xml += '  </message:Header>\n';

  // DataSet
  xml += `  <message:DataSet action="Information" structureRef="${datasetCode}">\n`;

  // Group by series
  const seriesMap = new Map<string, ObservationWithRelations[]>();
  for (const obs of observations) {
    const key = `${obs.freqCode}|${obs.indicatorCode}|${obs.economyCode}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, []);
    }
    seriesMap.get(key)!.push(obs);
  }

  const escapeXml = (unsafe: string | null | undefined): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  for (const [key, obsList] of Array.from(seriesMap.entries())) {
    const [freq, indicator, economy] = key.split('|');
    const firstObs = obsList[0];

    xml += '    <generic:Series>\n';
    xml += '      <generic:SeriesKey>\n';
    xml += `        <generic:Value id="FREQ" value="${escapeXml(freq)}"/>\n`;
    xml += `        <generic:Value id="INDICATOR" value="${escapeXml(indicator)}"/>\n`;
    xml += `        <generic:Value id="ECONOMY_CODE" value="${escapeXml(economy)}"/>\n`;
    xml += '      </generic:SeriesKey>\n';

    // Series attributes
    if (firstObs.unitCode || firstObs.unitMultCode || firstObs.decimalsCode) {
      xml += '      <generic:Attributes>\n';
      if (firstObs.unitCode) {
        xml += `        <generic:Value id="UNIT" value="${escapeXml(firstObs.unitCode)}"/>\n`;
      }
      if (firstObs.unitMultCode) {
        xml += `        <generic:Value id="UNIT_MULT" value="${escapeXml(firstObs.unitMultCode)}"/>\n`;
      }
      if (firstObs.decimalsCode) {
        xml += `        <generic:Value id="DECIMALS" value="${escapeXml(firstObs.decimalsCode)}"/>\n`;
      }
      xml += '      </generic:Attributes>\n';
    }

    // Observations
    for (const obs of obsList) {
      xml += '      <generic:Obs>\n';
      xml += `        <generic:ObsDimension value="${escapeXml(obs.period)}"/>\n`;
      if (obs.obsValue !== null && obs.obsValue !== undefined) {
        xml += `        <generic:ObsValue value="${obs.obsValue.toString()}"/>\n`;
      }
      if (obs.obsStatusCode) {
        xml += '        <generic:Attributes>\n';
        xml += `          <generic:Value id="OBS_STATUS" value="${escapeXml(obs.obsStatusCode)}"/>\n`;
        xml += '        </generic:Attributes>\n';
      }
      xml += '      </generic:Obs>\n';
    }

    xml += '    </generic:Series>\n';
  }

  xml += '  </message:DataSet>\n';
  xml += '</message:GenericData>';

  return xml;
}
