console.log('LOADED SEED FILE');
import { PrismaClient, WorkflowStatus, ValueType, EconomyType, ComponentType, AttachmentLevel } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function parseCsv<T>(filePath: string): T[] {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse<T>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

function generateObservationHash(obs: {
  datasetCode: string;
  mainDataflowCode: string;
  secondaryDataflowCode?: string | null;
  indicatorCode: string;
  economyCode: string;
  freqCode: string;
  period: string;
  extraDimensions?: { conceptCode: string; codeValue: string }[];
}) {
  const sec = obs.secondaryDataflowCode || '';
  const dims = (obs.extraDimensions || [])
    .sort((a, b) => a.conceptCode.localeCompare(b.conceptCode))
    .map(d => `${d.conceptCode}=${d.codeValue}`)
    .join('|');
  const canonical = `dataset=${obs.datasetCode}|main_dataflow=${obs.mainDataflowCode}|secondary_dataflow=${sec}|indicator=${obs.indicatorCode}|economy=${obs.economyCode}|freq=${obs.freqCode}|period=${obs.period}|dims:${dims}`;
  return createHash('sha256').update(canonical).digest('hex');
}

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed Dataset
  console.log('Seeding Dataset...');
  const dataset = await prisma.dataset.upsert({
    where: { code: 'KIDB' },
    update: {},
    create: {
      code: 'KIDB',
      name: 'Key Indicators Database',
      description: 'ADB Key Indicators Database',
      divisionCode: 'ERDI',
    },
  });

  // 2. Seed Concept Schemes & Concepts
  console.log('Seeding Concept Schemes and Concepts...');
  const conceptsCsvPath = path.join(__dirname, '../output/concept_scheme_concepts.csv');
  const conceptsData = parseCsv<any>(conceptsCsvPath);

  // Group concept schemes
  const conceptSchemesMap = new Map<string, any>();
  for (const row of conceptsData) {
    if (row.CONCEPT_SCHEME_ID) {
      conceptSchemesMap.set(row.CONCEPT_SCHEME_ID, {
        code: row.CONCEPT_SCHEME_ID,
        agency: row.CONCEPT_SCHEME_AGENCY || 'ADB',
        version: row.CONCEPT_SCHEME_VERSION || '1.0',
        name: row.CONCEPT_SCHEME_NAME || row.CONCEPT_SCHEME_ID,
        description: row.CONCEPT_SCHEME_DESCRIPTION || '',
        urn: row.CONCEPT_SCHEME_URN || '',
      });
    }
  }

  for (const cs of Array.from(conceptSchemesMap.values())) {
    await prisma.conceptScheme.upsert({
      where: { code: cs.code },
      update: cs,
      create: cs,
    });
  }

  // Pre-seed referenced Code Lists to prevent foreign key violations
  console.log('Pre-seeding referenced Code Lists...');
  const codeListsSet = new Set<string>();
  for (const row of conceptsData) {
    if (row.CODELIST_ID) {
      codeListsSet.add(row.CODELIST_ID);
    }
  }
  for (const clCode of Array.from(codeListsSet)) {
    await prisma.codeList.upsert({
      where: { code: clCode },
      update: {},
      create: {
        code: clCode,
        name: `${clCode} Codelist`,
        isGlobal: true,
      },
    });
  }

  // Seed Concepts
  const conceptsMap = new Map<string, any>();
  for (const row of conceptsData) {
    if (row.CONCEPT_ID) {
      conceptsMap.set(row.CONCEPT_ID, {
        code: row.CONCEPT_ID,
        name: row.CONCEPT_NAME || row.CONCEPT_ID,
        description: row.CONCEPT_DESCRIPTION || '',
        conceptSchemeCode: row.CONCEPT_SCHEME_ID,
        codeListCode: row.CODELIST_ID || null,
        urn: row.CONCEPT_URN || '',
      });
    }
  }

  for (const concept of Array.from(conceptsMap.values())) {
    await prisma.concept.upsert({
      where: { code: concept.code },
      update: concept,
      create: concept,
    });
  }

  // 3. Seed DSDs and DSD Components
  console.log('Seeding DSDs and DSD Components...');
  const dsdComponentsCsvPath = path.join(__dirname, '../output/dsd_components.csv');
  const dsdComponentsData = parseCsv<any>(dsdComponentsCsvPath);

  const dsdsMap = new Map<string, any>();
  for (const row of dsdComponentsData) {
    if (row.DSD_ID) {
      dsdsMap.set(row.DSD_ID, {
        code: row.DSD_ID,
        agency: row.DSD_AGENCY || 'ADB',
        version: row.DSD_VERSION || '1.0',
        name: row.DSD_NAME || row.DSD_ID,
        description: row.DSD_DESCRIPTION || '',
        urn: row.DSD_URN || '',
      });
    }
  }

  for (const dsd of Array.from(dsdsMap.values())) {
    await prisma.dsd.upsert({
      where: { code: dsd.code },
      update: dsd,
      create: dsd,
    });
  }

  // Seed DSD Components
  for (const row of dsdComponentsData) {
    if (row.COMPONENT_ID) {
      // Map component types to enum
      let componentType: ComponentType = ComponentType.DIMENSION;
      if (row.COMPONENT_TYPE === 'TIME_DIMENSION') componentType = ComponentType.TIME_DIMENSION;
      else if (row.COMPONENT_TYPE === 'MEASURE') componentType = ComponentType.MEASURE;
      else if (row.COMPONENT_TYPE === 'ATTRIBUTE') componentType = ComponentType.ATTRIBUTE;
      else if (row.COMPONENT_TYPE === 'METADATA') componentType = ComponentType.METADATA;

      // Map attachment level
      let attachmentLevel: AttachmentLevel | null = null;
      if (row.ATTRIBUTE_RELATIONSHIP === 'Observation') attachmentLevel = AttachmentLevel.OBSERVATION;
      else if (row.ATTRIBUTE_RELATIONSHIP === 'Series') attachmentLevel = AttachmentLevel.SERIES;
      else if (row.ATTRIBUTE_RELATIONSHIP === 'Dataset') attachmentLevel = AttachmentLevel.DATASET;

      const compData = {
        dsdCode: row.DSD_ID,
        componentCode: row.COMPONENT_ID,
        componentType: componentType,
        conceptCode: row.CONCEPT_ID,
        codeListCode: row.CODELIST_ID || null,
        position: row.POSITION ? parseInt(row.POSITION) : null,
        isRequired: row.MANDATORY === 'Yes' || row.ASSIGNMENT_STATUS === 'Mandatory',
        attachmentLevel: attachmentLevel,
        textType: row.TEXT_TYPE || null,
      };

      await prisma.dsdComponent.upsert({
        where: {
          dsdCode_componentCode: {
            dsdCode: compData.dsdCode,
            componentCode: compData.componentCode,
          },
        },
        update: compData,
        create: compData,
      });
    }
  }

  // 4. Seed Dataflows
  console.log('Seeding Dataflows...');
  const dataflowsCsvPath = path.join(__dirname, '../output/dataflows.csv');
  const dataflowsData = parseCsv<any>(dataflowsCsvPath);

  // Pass 1: Insert all dataflows with mainDataflowCode as null
  for (const row of dataflowsData) {
    if (row.DATAFLOW_CODE) {
      const dataflowLevel = row.DATAFLOW_LEVEL_TYPE === 'SECONDARY' ? 'SECONDARY' : 'MAIN';

      await prisma.dataflow.upsert({
        where: {
          datasetCode_code: {
            datasetCode: dataset.code,
            code: row.DATAFLOW_CODE,
          },
        },
        update: {
          name: row.DATAFLOW_NAME || row.DATAFLOW_CODE,
          description: row.DATAFLOW_DESCRIPTION || null,
          dataflowLevel: dataflowLevel,
          dsdCode: row.DSD_ID || null,
        },
        create: {
          code: row.DATAFLOW_CODE,
          datasetCode: dataset.code,
          name: row.DATAFLOW_NAME || row.DATAFLOW_CODE,
          description: row.DATAFLOW_DESCRIPTION || null,
          dataflowLevel: dataflowLevel,
          dsdCode: row.DSD_ID || null,
        },
      });
    }
  }

  // Pass 2: Set parent mainDataflowCode
  for (const row of dataflowsData) {
    if (row.DATAFLOW_CODE && row.MAIN_DATAFLOW_CODE && row.MAIN_DATAFLOW_CODE !== row.DATAFLOW_CODE) {
      await prisma.dataflow.update({
        where: {
          datasetCode_code: {
            datasetCode: dataset.code,
            code: row.DATAFLOW_CODE,
          },
        },
        data: {
          mainDataflowCode: row.MAIN_DATAFLOW_CODE,
        },
      });
    }
  }

  // 5. Seed Currencies
  console.log('Seeding Currencies...');
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimalPlaces: 2 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
  ];

  for (const curr of currencies) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      update: curr,
      create: curr,
    });
  }

  // 6. Seed Common Units
  console.log('Seeding Common Units...');
  const unitsCsvPath = path.join(__dirname, '../output_codelists/CL_COMMON_UNITS.csv');
  const unitsData = parseCsv<any>(unitsCsvPath);

  const unitsToCreate = unitsData.map(row => ({
    code: row['Code id'],
    name: row['Name'] || row['Code id'],
    description: row['Description'] || null,
  }));

  await prisma.commonUnit.createMany({
    data: unitsToCreate,
    skipDuplicates: true,
  });

  // 7. Seed Common Multipliers
  console.log('Seeding Common Multipliers...');
  const multCsvPath = path.join(__dirname, '../output_codelists/CL_UNIT_MULT.csv');
  const multData = parseCsv<any>(multCsvPath);

  for (const row of multData) {
    if (row['Code id']) {
      const codeId = row['Code id'];
      const factor = Math.pow(10, parseInt(codeId));
      await prisma.commonMultiplier.upsert({
        where: { code: codeId },
        update: {
          name: row['Name'],
          factor: factor,
        },
        create: {
          code: codeId,
          name: row['Name'],
          factor: factor,
        },
      });
    }
  }

  // 8. Seed Code Lists and Code List Items
  console.log('Seeding Code Lists and Code List Items...');
  const codeListsToSeed = [
    { code: 'CL_FREQ', name: 'Frequency Codelist', file: 'CL_FREQ.csv' },
    { code: 'CL_OBS_STATUS', name: 'Observation Status Codelist', file: 'CL_OBS_STATUS.csv' },
    { code: 'CL_UNIT_MULT', name: 'Unit Multiplier Codelist', file: 'CL_UNIT_MULT.csv' },
    { code: 'CL_DECIMALS', name: 'Decimals Codelist', file: 'CL_DECIMALS.csv' },
    { code: 'CL_ECONOMY_CODES', name: 'Economy Codes Codelist', file: 'CL_ECONOMY_CODES.csv' },
    { code: 'CL_COMMON_UNITS', name: 'Common Units Codelist', file: 'CL_COMMON_UNITS.csv' },
    { code: 'CL_KIDB_INDICATORS', name: 'Key Indicators Codelist', file: 'CL_KIDB_INDICATORS.csv' },
    { code: 'CL_KIDB_THEMES', name: 'Key Indicators Themes Codelist', file: 'CL_KIDB_THEMES.csv' },
    { code: 'CL_DIVISION', name: 'Division Codelist', file: 'CL_DIVISION.csv' },
  ];

  for (const cl of codeListsToSeed) {
    await prisma.codeList.upsert({
      where: { code: cl.code },
      update: { name: cl.name, isGlobal: true },
      create: { code: cl.code, name: cl.name, isGlobal: true },
    });

    const clFilePath = path.join(__dirname, `../output_codelists/${cl.file}`);
    if (fs.existsSync(clFilePath)) {
      const clItemsData = parseCsv<any>(clFilePath);

      // Pass 1: Create items with parentItemCode = null
      const itemsToCreate = clItemsData.map(row => ({
        codeListCode: cl.code,
        itemCode: row['Code id'],
        itemName: row['Name'] || row['Code id'],
        description: row['Description'] || null,
        parentItemCode: null,
      }));

      await prisma.codeListItem.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });

      // Pass 2: Update parent relations (only for files that support parent, e.g. Economy, Indicators, Themes)
      for (const row of clItemsData) {
        if (row['Parent'] && row['Code id']) {
          await prisma.codeListItem.update({
            where: {
              codeListCode_itemCode: {
                codeListCode: cl.code,
                itemCode: row['Code id'],
              },
            },
            data: {
              parentItemCode: row['Parent'],
            },
          });
        }
      }
      console.log(`Seeded code list: ${cl.code} (${clItemsData.length} items)`);
    }
  }

  // Manually seed CL_DIVISION items since they do not have CSVs
  console.log('Seeding manual CL_DIVISION items...');
  await prisma.codeListItem.upsert({
    where: {
      codeListCode_itemCode: {
        codeListCode: 'CL_DIVISION',
        itemCode: 'ERDI',
      },
    },
    update: {},
    create: {
      codeListCode: 'CL_DIVISION',
      itemCode: 'ERDI',
      itemName: 'Economic Research and Regional Cooperation Department - Data Division',
      description: 'Data Division under ERCD',
    },
  });

  // 9. Sync Indicators from CL_KIDB_INDICATORS
  console.log('Synchronizing Indicators from Code List...');
  const indFilePath = path.join(__dirname, '../output_codelists/CL_KIDB_INDICATORS.csv');
  const indItems = parseCsv<any>(indFilePath);

  const indicatorsToUpsert = indItems.map(row => ({
    code: row['Code id'],
    name: row['Name'] || row['Code id'],
    description: row['Description'] || null,
    isActive: true,
  }));

  await prisma.indicator.createMany({
    data: indicatorsToUpsert,
    skipDuplicates: true,
  });
  console.log(`Synced ${indicatorsToUpsert.length} shortcut Indicators.`);

  // 10. Sync Economies from CL_ECONOMY_CODES
  console.log('Synchronizing Economies from Code List...');
  const ecoFilePath = path.join(__dirname, '../output_codelists/CL_ECONOMY_CODES.csv');
  const ecoItems = parseCsv<any>(ecoFilePath);

  // Pass 1: Insert economies with parentCode = null
  const economiesToUpsert = ecoItems.map(row => ({
    code: row['Code id'],
    name: row['Name'] || row['Code id'],
    description: row['Description'] || null,
    parentCode: null,
    isActive: true,
  }));

  await prisma.economy.createMany({
    data: economiesToUpsert,
    skipDuplicates: true,
  });

  // Pass 2: Update parentCode on economies
  let ecoParentUpdates = 0;
  for (const row of ecoItems) {
    if (row['Parent'] && row['Code id']) {
      await prisma.economy.update({
        where: { code: row['Code id'] },
        data: { parentCode: row['Parent'] },
      });
      ecoParentUpdates++;
    }
  }
  console.log(`Synced ${economiesToUpsert.length} shortcut Economies (${ecoParentUpdates} hierarchy links).`);

  // 11. Seed Themes
  console.log('Seeding Themes...');
  const themeFilePath = path.join(__dirname, '../output_codelists/CL_KIDB_THEMES.csv');
  const themeItems = parseCsv<any>(themeFilePath);

  // Pass 1: Seed themes with parentCode = null
  const themesToUpsert = themeItems.map(row => ({
    code: row['Code id'],
    name: row['Name'] || row['Code id'],
    description: row['Description'] || null,
    parentCode: null,
  }));

  await prisma.theme.createMany({
    data: themesToUpsert,
    skipDuplicates: true,
  });

  // Pass 2: Update parentCode on themes
  for (const row of themeItems) {
    if (row['Parent'] && row['Code id']) {
      await prisma.theme.update({
        where: { code: row['Code id'] },
        data: { parentCode: row['Parent'] },
      });
    }
  }
  console.log(`Seeded ${themesToUpsert.length} Themes.`);

  // 12. Seed Sample Observations (first 100 rows of ENV.csv)
  console.log('Seeding Sample Observations (100 rows from ENV.csv)...');
  const obsFilePath = path.join(__dirname, '../output_obs/ENV.csv');
  const obsData = parseCsv<any>(obsFilePath).slice(0, 100);

  // Initialize an Import Batch
  const batch = await prisma.importBatch.create({
    data: {
      datasetCode: dataset.code,
      importType: 'OBSERVATIONS',
      fileName: 'ENV.csv',
      status: 'IMPORTED',
      totalRows: obsData.length,
      validRows: obsData.length,
      uploadedBy: 'seed_script',
    },
  });

  for (const row of obsData) {
    const obsVal = row.OBS_VALUE ? parseFloat(row.OBS_VALUE) : null;
    const obsValueDecimal = obsVal !== null ? obsVal : null;

    // Generate hash
    const observationHash = generateObservationHash({
      datasetCode: dataset.code,
      mainDataflowCode: row['MAIN DATAFLOW_CODE'],
      secondaryDataflowCode: row['SECONDARY DATAFLOW_CODE'],
      indicatorCode: row['CL_KIDB_INDICATORS'],
      economyCode: row['CL_ECONOMY_CODES'],
      freqCode: row['CL_FREQ'],
      period: row['PERIOD'],
    });

    const obsRecord = {
      datasetCode: dataset.code,
      mainDataflowCode: row['MAIN DATAFLOW_CODE'],
      secondaryDataflowCode: row['SECONDARY DATAFLOW_CODE'] || null,
      indicatorCode: row['CL_KIDB_INDICATORS'],
      economyCode: row['CL_ECONOMY_CODES'],
      period: row['PERIOD'],
      freqCode: row['CL_FREQ'],
      obsValue: obsValueDecimal,
      unitCode: row['CL_COMMON_UNITS'] || null,
      unitMultCode: row['CL_UNIT_MULT'] || null,
      decimalsCode: row['CL_DECIMALS'] || null,
      obsStatusCode: row['CL_OBS_STATUS'] || null,
      refYear: row['REF_YEAR'] || null,
      dataSource: row['DATA_SOURCE'] || null,
      footnote: row['FOOTNOTE'] || null,
      workflowStatus: WorkflowStatus.PUBLISHED,
      isPublished: true,
      publishedAt: new Date(),
      importBatchId: batch.id,
      sourceFileName: 'ENV.csv',
      observationHash: observationHash,
      valueType: ValueType.REPORTED,
    };

    await prisma.observation.create({
      data: obsRecord,
    });
  }
  console.log(`Successfully seeded ${obsData.length} observations.`);

  // 13. Verification Test: Partial Unique Constraint
  console.log('Verifying partial unique constraint works...');
  
  // Pick one observation we just inserted
  const testObs = obsData[0];
  const testHash = generateObservationHash({
    datasetCode: dataset.code,
    mainDataflowCode: testObs['MAIN DATAFLOW_CODE'],
    secondaryDataflowCode: testObs['SECONDARY DATAFLOW_CODE'],
    indicatorCode: testObs['CL_KIDB_INDICATORS'],
    economyCode: testObs['CL_ECONOMY_CODES'],
    freqCode: testObs['CL_FREQ'],
    period: testObs['PERIOD'],
  });

  console.log(`Attempting to insert a duplicate published observation with hash: ${testHash}`);
  try {
    // Attempt to insert another observation with same hash and isPublished = true
    await prisma.observation.create({
      data: {
        datasetCode: dataset.code,
        mainDataflowCode: testObs['MAIN DATAFLOW_CODE'],
        secondaryDataflowCode: testObs['SECONDARY DATAFLOW_CODE'] || null,
        indicatorCode: testObs['CL_KIDB_INDICATORS'],
        economyCode: testObs['CL_ECONOMY_CODES'],
        period: testObs['PERIOD'],
        freqCode: testObs['CL_FREQ'],
        obsValue: 999.99, // Different value
        workflowStatus: WorkflowStatus.PUBLISHED,
        isPublished: true, // This should trigger the partial unique index violation!
        importBatchId: batch.id,
        observationHash: testHash,
        valueType: ValueType.REPORTED,
      },
    });
    console.error('ERROR: Duplicate published observation was inserted! Partial unique index constraint FAILED.');
  } catch (error: any) {
    console.log('SUCCESS: Duplicate insert threw an error, database unique constraint is working correctly!');
    console.log(`Caught error: ${error.message.split('\n')[0]}`);
  }

  // 14. Verification Test: Non-published duplicate is allowed
  console.log('Verifying that a duplicate non-published (DRAFT) observation IS allowed...');
  try {
    const draftObs = await prisma.observation.create({
      data: {
        datasetCode: dataset.code,
        mainDataflowCode: testObs['MAIN DATAFLOW_CODE'],
        secondaryDataflowCode: testObs['SECONDARY DATAFLOW_CODE'] || null,
        indicatorCode: testObs['CL_KIDB_INDICATORS'],
        economyCode: testObs['CL_ECONOMY_CODES'],
        period: testObs['PERIOD'],
        freqCode: testObs['CL_FREQ'],
        obsValue: 888.88,
        workflowStatus: WorkflowStatus.DRAFT,
        isPublished: false, // isPublished = false should bypass index check!
        importBatchId: batch.id,
        observationHash: testHash,
        valueType: ValueType.REPORTED,
      },
    });
    console.log(`SUCCESS: Successfully inserted duplicate draft observation with ID: ${draftObs.id}`);
  } catch (error: any) {
    console.error('ERROR: Duplicate draft insert failed! It should be allowed.');
    console.error(error);
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
