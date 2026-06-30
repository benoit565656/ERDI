import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const { searchParams } = new URL(req.url);

    // Dynamic segments: structure_type, agency, structure_id, version
    const structureType = (path[0] || 'all').toLowerCase();
    const agency = path[1] || 'ADB';
    const structureId = path[2] || 'all';
    const version = path[3] || 'latest';
    const format = searchParams.get('format') || 'sdmx-ml'; // XML by default

    const timestamp = new Date().toISOString();

    // 1. Fetch metadata according to structure type
    if (structureType === 'codelist') {
      const idUpper = structureId.toUpperCase();
      const isAll = structureId === 'all';
      
      const isEconomy = idUpper.includes('ECONOMY') || isAll;
      const isIndicator = idUpper.includes('INDICATOR') || isAll;
      const isUnit = idUpper.includes('UNIT') && !idUpper.includes('MULT') || isAll;
      const isUnitMult = idUpper.includes('MULT') || idUpper.includes('MULTIPLIER') || isAll;
      const isObsStatus = idUpper.includes('STATUS') || isAll;

      let economiesList: any[] = [];
      let indicatorsList: any[] = [];
      let unitsList: any[] = [];
      let multipliersList: any[] = [];
      
      const obsStatusesList = [
        { code: 'A', name: 'Normal value' },
        { code: 'E', name: 'Estimated value' },
        { code: 'F', name: 'Forecast value' },
        { code: 'N', name: 'Not significant' },
        { code: 'O', name: 'Missing value' },
        { code: 'P', name: 'Provisional value' }
      ];

      if (isEconomy) {
        economiesList = await prisma.economy.findMany({
          select: { code: true, name: true },
          orderBy: { code: 'asc' }
        });
      }

      if (isIndicator) {
        indicatorsList = await prisma.indicator.findMany({
          select: { code: true, name: true, description: true },
          orderBy: { code: 'asc' },
          take: 1000 // Cap to prevent massive document size
        });
      }

      if (isUnit) {
        unitsList = await prisma.commonUnit.findMany({
          select: { code: true, name: true },
          orderBy: { code: 'asc' }
        });
      }

      if (isUnitMult) {
        multipliersList = await prisma.commonMultiplier.findMany({
          select: { code: true, name: true, factor: true },
          orderBy: { code: 'asc' }
        });
      }

      if (format === 'json' || format === 'sdmx-json') {
        return NextResponse.json({
          header: { id: `STR_${Date.now()}`, prepared: timestamp, sender: agency },
          codelists: [
            ...(isEconomy ? [{ id: 'CL_ECONOMY', name: 'Economy Codelist', agency, codes: economiesList }] : []),
            ...(isIndicator ? [{ id: 'CL_INDICATOR', name: 'Indicator Codelist', agency, codes: indicatorsList }] : []),
            ...(isUnit ? [{ id: 'CL_UNIT', name: 'Unit Codelist', agency, codes: unitsList }] : []),
            ...(isUnitMult ? [{ id: 'CL_UNIT_MULT', name: 'Multiplier Codelist', agency, codes: multipliersList }] : []),
            ...(isObsStatus ? [{ id: 'CL_OBS_STATUS', name: 'Observation Status Codelist', agency, codes: obsStatusesList }] : [])
          ]
        });
      }

      // Default XML response
      let xml = `<?xml version="1.0" encoding="utf-8"?>
<message:Structure xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/message"
  xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/common"
  xmlns:structure="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/structure">
  <message:Header>
    <message:ID>IREF_STR_${Math.floor(Math.random() * 1000000)}</message:ID>
    <message:Prepared>${timestamp}</message:Prepared>
    <message:Sender>${agency}</message:Sender>
  </message:Header>
  <message:Structures>
    <structure:Codelists>`;

      if (isEconomy) {
        xml += `
      <structure:Codelist id="CL_ECONOMY" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">Economy Codelist</common:Name>`;
        economiesList.forEach(e => {
          xml += `
        <structure:Code id="${e.code}">
          <common:Name xml:lang="en">${e.name.replace(/&/g, '&amp;')}</common:Name>
        </structure:Code>`;
        });
        xml += `
      </structure:Codelist>`;
      }

      if (isIndicator) {
        xml += `
      <structure:Codelist id="CL_INDICATOR" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">Indicator Codelist</common:Name>`;
        indicatorsList.forEach(ind => {
          const cleanName = ind.name ? ind.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ind.code;
          const cleanDesc = ind.description ? ind.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
          xml += `
        <structure:Code id="${ind.code}">
          <common:Name xml:lang="en">${cleanName}</common:Name>
          <common:Description xml:lang="en">${cleanDesc}</common:Description>
        </structure:Code>`;
        });
        xml += `
      </structure:Codelist>`;
      }

      if (isUnit) {
        xml += `
      <structure:Codelist id="CL_UNIT" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">Unit Codelist</common:Name>`;
        unitsList.forEach(u => {
          const cleanName = u.name ? u.name.replace(/&/g, '&amp;') : u.code;
          xml += `
        <structure:Code id="${u.code}">
          <common:Name xml:lang="en">${cleanName}</common:Name>
        </structure:Code>`;
        });
        xml += `
      </structure:Codelist>`;
      }

      if (isUnitMult) {
        xml += `
      <structure:Codelist id="CL_UNIT_MULT" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">Unit Multiplier Codelist</common:Name>`;
        multipliersList.forEach(m => {
          xml += `
        <structure:Code id="${m.code}">
          <common:Name xml:lang="en">${m.name.replace(/&/g, '&amp;')} (Factor: ${m.factor})</common:Name>
        </structure:Code>`;
        });
        xml += `
      </structure:Codelist>`;
      }

      if (isObsStatus) {
        xml += `
      <structure:Codelist id="CL_OBS_STATUS" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">Observation Status Codelist</common:Name>`;
        obsStatusesList.forEach(s => {
          xml += `
        <structure:Code id="${s.code}">
          <common:Name xml:lang="en">${s.name}</common:Name>
        </structure:Code>`;
        });
        xml += `
      </structure:Codelist>`;
      }

      xml += `
    </structure:Codelists>
  </message:Structures>
</message:Structure>`;

      return new Response(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (structureType === 'dataflow') {
      const dataflowsList = await prisma.dataflow.findMany({
        select: { code: true, name: true, description: true, datasetCode: true },
        orderBy: { code: 'asc' }
      });

      if (format === 'json' || format === 'sdmx-json') {
        return NextResponse.json({
          header: { id: `DF_${Date.now()}`, prepared: timestamp, sender: agency },
          dataflows: dataflowsList
        });
      }

      let xml = `<?xml version="1.0" encoding="utf-8"?>
<message:Structure xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/message"
  xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/common"
  xmlns:structure="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/structure">
  <message:Header>
    <message:ID>IREF_DF_${Math.floor(Math.random() * 1000000)}</message:ID>
    <message:Prepared>${timestamp}</message:Prepared>
    <message:Sender>${agency}</message:Sender>
  </message:Header>
  <message:Structures>
    <structure:Dataflows>`;

      dataflowsList.forEach(df => {
        const cleanName = df.name ? df.name.replace(/&/g, '&amp;') : df.code;
        const cleanDesc = df.description ? df.description.replace(/&/g, '&amp;') : '';
        xml += `
      <structure:Dataflow id="${df.code}" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">${cleanName}</common:Name>
        <common:Description xml:lang="en">${cleanDesc}</common:Description>
        <structure:Structure>
          <Ref agencyID="${agency}" id="KIDB_DSD" version="1.0" type="DataStructure"/>
        </structure:Structure>
      </structure:Dataflow>`;
      });

      xml += `
    </structure:Dataflows>
  </message:Structures>
</message:Structure>`;

      return new Response(xml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // ConceptScheme, Datastructure, AgencyScheme Fallbacks
    if (format === 'json' || format === 'sdmx-json') {
      return NextResponse.json({
        header: { id: `STR_${Date.now()}`, prepared: timestamp, sender: agency },
        message: `SDMX structure type '${structureType}' successfully parsed`
      });
    }

    const genericXml = `<?xml version="1.0" encoding="utf-8"?>
<message:Structure xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/message"
  xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/common"
  xmlns:structure="http://www.sdmx.org/resources/sdmxml/schemas/v3_0/structure">
  <message:Header>
    <message:ID>IREF_GEN_${Math.floor(Math.random() * 1000000)}</message:ID>
    <message:Prepared>${timestamp}</message:Prepared>
    <message:Sender>${agency}</message:Sender>
  </message:Header>
  <message:Structures>
    <structure:DataStructures>
      <structure:DataStructure id="KIDB_DSD" agencyID="${agency}" version="1.0" isFinal="true">
        <common:Name xml:lang="en">KIDB Key Indicators Data Structure Definition</common:Name>
      </structure:DataStructure>
    </structure:DataStructures>
  </message:Structures>
</message:Structure>`;

    return new Response(genericXml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err: any) {
    return new Response(`<error>${err.message}</error>`, {
      status: 500,
      headers: { 'Content-Type': 'application/xml' }
    });
  }
}
