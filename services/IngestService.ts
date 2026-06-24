import { PrismaClient, WorkflowStatus, ValueType, ImportStatus, Severity, ComponentType, AttachmentLevel, ChangeType, ConstraintScopeType, ConstraintRuleType } from '@prisma/client';
import { createHash } from 'crypto';
import Papa from 'papaparse';
import { HarmonizationService } from './HarmonizationService';

const prisma = new PrismaClient();

export function generateObservationHash(obs: {
  datasetCode: string;
  mainDataflowCode: string;
  secondaryDataflowCode?: string | null;
  indicatorCode: string;
  economyCode: string;
  freqCode: string;
  period: string;
  sexCode?: string | null;
  ageCode?: string | null;
  sectorCode?: string | null;
  occupationCode?: string | null;
  regionCode?: string | null;
  sizeClassCode?: string | null;
  ownershipCode?: string | null;
  currencyCode?: string | null;
  adjustmentCode?: string | null;
  priceBaseCode?: string | null;
  counterpartAreaCode?: string | null;
  extraDimensions?: { conceptCode: string; codeValue: string }[];
}) {
  const sec = obs.secondaryDataflowCode || '';
  
  // Sort and stringify standard 11 recurring dimensions
  const stdDims = [
    `sex=${obs.sexCode || ''}`,
    `age=${obs.ageCode || ''}`,
    `sector=${obs.sectorCode || ''}`,
    `occupation=${obs.occupationCode || ''}`,
    `region=${obs.regionCode || ''}`,
    `sizeClass=${obs.sizeClassCode || ''}`,
    `ownership=${obs.ownershipCode || ''}`,
    `currency=${obs.currencyCode || ''}`,
    `adjustment=${obs.adjustmentCode || ''}`,
    `priceBase=${obs.priceBaseCode || ''}`,
    `counterpartArea=${obs.counterpartAreaCode || ''}`,
  ].join('|');

  // Any remaining generic dimensions in extraDimensions
  const dims = (obs.extraDimensions || [])
    .sort((a, b) => a.conceptCode.localeCompare(b.conceptCode))
    .map(d => `${d.conceptCode}=${d.codeValue}`)
    .join('|');

  const canonical = `dataset=${obs.datasetCode}|main_dataflow=${obs.mainDataflowCode}|secondary_dataflow=${sec}|indicator=${obs.indicatorCode}|economy=${obs.economyCode}|freq=${obs.freqCode}|period=${obs.period}|std:${stdDims}|dims:${dims}`;
  return createHash('sha256').update(canonical).digest('hex');
}

export class IngestService {
  /**
   * Parse and validate an observation CSV, performing database upserts.
   */
  static async parseAndValidateCsv(
    fileContent: string,
    datasetCode: string,
    fileName: string,
    uploadedBy: string
  ): Promise<any> {
    // 1. Create ImportBatch with status VALIDATING
    const batch = await prisma.importBatch.create({
      data: {
        datasetCode,
        importType: 'OBSERVATIONS',
        fileName,
        status: ImportStatus.VALIDATING,
        uploadedBy,
      },
    });

    try {
      // 2. Parse CSV
      const parseResult = Papa.parse<any>(fileContent, {
        header: true,
        skipEmptyLines: true,
      });

      if (parseResult.errors.length > 0) {
        throw new Error(`CSV Parsing failed: ${parseResult.errors[0].message}`);
      }

      const rows = parseResult.data;
      const headers = parseResult.meta.fields || [];

      if (rows.length === 0) {
        await prisma.importBatch.update({
          where: { id: batch.id },
          data: { status: ImportStatus.FAILED, completedAt: new Date() },
        });
        throw new Error('CSV file is empty.');
      }

      // 3. Load metadata and DSD components for validation
      // Retrieve the first row to determine the main dataflow and resolve DSD
      const firstRow = rows[0];
      const mainDataflowHeader = headers.find(h => 
        ['MAIN DATAFLOW_CODE', 'MAIN_DATAFLOW_CODE', 'MAIN DATAFLOW', 'MAIN_DATAFLOW'].includes(h.toUpperCase())
      );
      const mainDataflowValue = mainDataflowHeader ? firstRow[mainDataflowHeader] : null;

      if (!mainDataflowValue) {
        throw new Error('Could not identify Main Dataflow Code column in CSV.');
      }

      const dataflow = await prisma.dataflow.findUnique({
        where: {
          datasetCode_code: {
            datasetCode,
            code: mainDataflowValue,
          },
        },
        include: {
          dataset: true,
        },
      });

      if (!dataflow) {
        throw new Error(`Dataflow ${mainDataflowValue} does not exist.`);
      }

      const resolvedDsdCode = dataflow.dsdCode || dataflow.dataset?.dsdCode;
      if (!resolvedDsdCode) {
        throw new Error(`Dataflow ${mainDataflowValue} does not have a DSD, and Dataset ${datasetCode} does not have a default DSD.`);
      }

      const dsdComponents = await prisma.dsdComponent.findMany({
        where: { dsdCode: resolvedDsdCode },
      });

      const indicatorComp = dsdComponents.find(c => c.conceptCode === 'INDICATOR');
      const indicatorCodeList = indicatorComp?.codeListCode || 'CL_KIDB_INDICATORS';

      // Cache Code Lists and items in memory
      const clCodes = dsdComponents.map((c) => c.codeListCode).filter((c): c is string => !!c);
      // Pre-seed some standard ones if not referenced but used in shortcut fields
      if (!clCodes.includes('CL_ECONOMY_CODES')) clCodes.push('CL_ECONOMY_CODES');
      if (!clCodes.includes(indicatorCodeList)) clCodes.push(indicatorCodeList);
      if (!clCodes.includes('CL_KIDB_INDICATORS')) clCodes.push('CL_KIDB_INDICATORS');
      if (!clCodes.includes('CL_COMMON_UNITS')) clCodes.push('CL_COMMON_UNITS');
      if (!clCodes.includes('CL_FREQ')) clCodes.push('CL_FREQ');
      if (!clCodes.includes('CL_OBS_STATUS')) clCodes.push('CL_OBS_STATUS');
      if (!clCodes.includes('CL_UNIT_MULT')) clCodes.push('CL_UNIT_MULT');
      if (!clCodes.includes('CL_DECIMALS')) clCodes.push('CL_DECIMALS');

      const clItems = await prisma.codeListItem.findMany({
        where: { codeListCode: { in: clCodes } },
      });

      const clMap = new Map<string, Set<string>>();
      for (const item of clItems) {
        if (!clMap.has(item.codeListCode)) {
          clMap.set(item.codeListCode, new Set());
        }
        clMap.get(item.codeListCode)!.add(item.itemCode);
      }

      // Cache Indicators and Economies shortcut tables
      const dbIndicators = await prisma.indicator.findMany({ select: { code: true } });
      const dbIndicatorSet = new Set(dbIndicators.map((i) => i.code));

      const dbEconomies = await prisma.economy.findMany({ select: { code: true } });
      const dbEconomySet = new Set(dbEconomies.map((e) => e.code));

      // Cache all constraints for this dataset
      const dbConstraints = await prisma.constraint.findMany({
        where: { datasetCode, isActive: true },
        include: { constraintItems: true },
      });

      const datasetConstraints = dbConstraints.filter(c => c.scopeType === ConstraintScopeType.DATASET);
      const dataflowConstraints = dbConstraints.filter(
        c => c.scopeType === ConstraintScopeType.DATAFLOW && c.dataflowCode === dataflow.code
      );
      
      const indicatorConstraintsMap = new Map<string, typeof dbConstraints>();
      const dataflowIndicatorConstraintsMap = new Map<string, typeof dbConstraints>();
      
      for (const c of dbConstraints) {
        if (c.scopeType === ConstraintScopeType.INDICATOR && c.indicatorCode) {
          if (!indicatorConstraintsMap.has(c.indicatorCode)) {
            indicatorConstraintsMap.set(c.indicatorCode, []);
          }
          indicatorConstraintsMap.get(c.indicatorCode)!.push(c);
        } else if (
          c.scopeType === ConstraintScopeType.DATAFLOW_INDICATOR &&
          c.dataflowCode === dataflow.code &&
          c.indicatorCode
        ) {
          if (!dataflowIndicatorConstraintsMap.has(c.indicatorCode)) {
            dataflowIndicatorConstraintsMap.set(c.indicatorCode, []);
          }
          dataflowIndicatorConstraintsMap.get(c.indicatorCode)!.push(c);
        }
      }

      // Cache dataset-level and dataflow-level configured attributes for defaults
      const datasetAttrs = await prisma.datasetAttribute.findMany({
        where: { datasetCode },
      });
      const datasetAttrMap = new Map(datasetAttrs.map((a) => [a.conceptCode, a]));

      const dataflowAttrs = await prisma.dataflowAttribute.findMany({
        where: { datasetCode, dataflowCode: dataflow.code, isActive: true },
      });
      const dataflowAttrMap = new Map(dataflowAttrs.map((a) => [a.conceptCode, a]));

      // 4. Resolve column headers mapping to concept codes
      const resolvedHeaders = new Map<string, string>();
      const coreMappings: { [key: string]: string[] } = {
        mainDataflowCode: ['MAIN DATAFLOW_CODE', 'MAIN_DATAFLOW_CODE', 'MAIN DATAFLOW', 'MAIN_DATAFLOW'],
        secondaryDataflowCode: ['SECONDARY DATAFLOW_CODE', 'SECONDARY_DATAFLOW_CODE', 'SECONDARY DATAFLOW', 'SECONDARY_DATAFLOW'],
        period: ['PERIOD', 'TIME_PERIOD', 'PERIOD_CODE', 'TIME_PERIOD_CODE'],
        obsValue: ['OBS_VALUE', 'OBSVALUE', 'VALUE'],
        divisionCode: ['CL_DIVISION', 'DIVISION_CODE', 'DIVISION'],
      };

      const clean = (s: string) => s.toUpperCase().replace(/[\s_-]/g, '');

      for (const [key, variants] of Object.entries(coreMappings)) {
        const match = headers.find((h) => variants.some((v) => clean(h) === clean(v)));
        if (match) resolvedHeaders.set(key, match);
      }

      for (const comp of dsdComponents) {
        const variants = [
          comp.componentCode,
          comp.conceptCode,
          comp.codeListCode,
        ].filter((v): v is string => !!v);

        const match = headers.find((h) => variants.some((v) => clean(h) === clean(v)));
        if (match) resolvedHeaders.set(comp.conceptCode, match);
      }

      // Check file-level blocking errors for missing core headers
      const missingHeaders: string[] = [];
      if (!resolvedHeaders.has('mainDataflowCode')) missingHeaders.push('MAIN_DATAFLOW_CODE');
      if (!resolvedHeaders.has('period')) missingHeaders.push('TIME_PERIOD');
      if (!resolvedHeaders.has('obsValue')) missingHeaders.push('OBS_VALUE');
      if (!resolvedHeaders.has('FREQ')) missingHeaders.push('FREQ');
      if (!resolvedHeaders.has('INDICATOR')) missingHeaders.push('INDICATOR');
      if (!resolvedHeaders.has('ECONOMY_CODE')) missingHeaders.push('ECONOMY_CODE');

      // Check duplicate headers
      const duplicateHeaders = headers.filter((item, index) => headers.indexOf(item) !== index);

      if (missingHeaders.length > 0 || duplicateHeaders.length > 0) {
        let errMsg = '';
        if (missingHeaders.length > 0) {
          errMsg = `File-level validation failed: Missing mandatory core columns [${missingHeaders.join(', ')}].`;
        } else {
          errMsg = `File-level validation failed: Duplicate column headers detected [${duplicateHeaders.join(', ')}].`;
        }

        // Store file-level error with rowNumber = null
        await prisma.importValidationMessage.create({
          data: {
            importBatchId: batch.id,
            severity: Severity.ERROR,
            message: errMsg,
          },
        });

        await prisma.importBatch.update({
          where: { id: batch.id },
          data: { status: ImportStatus.FAILED, completedAt: new Date() },
        });
        
        throw new Error(errMsg);
      }

      // Helpers to resolve value from CSV row
      const getRowValue = (row: any, key: string): string | null => {
        let header = resolvedHeaders.get(key);
        if (!header) {
          const cleanKey = clean(key);
          const match = headers.find((h) => clean(h) === cleanKey);
          if (match) {
            resolvedHeaders.set(key, match);
            header = match;
          }
        }
        if (!header) return null;
        const val = row[header];
        if (val === undefined || val === null || val.trim() === '') return null;
        return val.trim();
      };

      const getCoreDimensionValue = (row: any, conceptCode: string, codeListCode: string): string | null => {
        // Core dimensions might be mapped via conceptCode (e.g. FREQ) or codeListCode (e.g. CL_FREQ)
        let val = getRowValue(row, conceptCode);
        if (val === null) val = getRowValue(row, codeListCode);
        return val;
      };

      const validationMessages: any[] = [];
      const validRowsData: any[] = [];

      let validRowsCount = 0;
      let warningRowsCount = 0;
      let invalidRowsCount = 0;

      // 5. Validate row-by-row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;
        let rowHasErrors = false;
        let rowHasWarnings = false;

        const rowSecondaryDataflow = getRowValue(row, 'secondaryDataflowCode');

        // Resolve core dimension values
        const freqVal = getCoreDimensionValue(row, 'FREQ', 'CL_FREQ');
        const indicatorVal = getCoreDimensionValue(row, 'INDICATOR', indicatorCodeList);
        const economyVal = getCoreDimensionValue(row, 'ECONOMY_CODE', 'CL_ECONOMY_CODES');
        const periodVal = getRowValue(row, 'period');
        const obsValueStr = getRowValue(row, 'obsValue');
        const divisionVal = getRowValue(row, 'divisionCode');

        // Resolve standard dimension values (only if present in DSD components)
        const hasDsdComp = (cCode: string) => dsdComponents.some(c => c.conceptCode === cCode && c.componentType === ComponentType.DIMENSION);
        
        const sexCode = hasDsdComp('SEX') ? (getRowValue(row, 'SEX') || getRowValue(row, 'CL_SEX')) : null;
        const ageCode = hasDsdComp('AGE') ? (getRowValue(row, 'AGE') || getRowValue(row, 'CL_AGE')) : null;
        const sectorCode = hasDsdComp('SECTOR') ? (getRowValue(row, 'SECTOR') || getRowValue(row, 'CL_SECTOR')) : null;
        const occupationCode = hasDsdComp('OCCUPATION') ? (getRowValue(row, 'OCCUPATION') || getRowValue(row, 'CL_OCCUPATION')) : null;
        const regionCode = hasDsdComp('REGION') ? (getRowValue(row, 'REGION') || getRowValue(row, 'CL_REGION')) : null;
        const sizeClassCode = hasDsdComp('SIZE_CLASS') ? (getRowValue(row, 'SIZE_CLASS') || getRowValue(row, 'CL_SIZE_CLASS')) : null;
        const ownershipCode = hasDsdComp('OWNERSHIP') ? (getRowValue(row, 'OWNERSHIP') || getRowValue(row, 'CL_OWNERSHIP')) : null;
        const currencyCode = hasDsdComp('CURRENCY') ? (getRowValue(row, 'CURRENCY') || getRowValue(row, 'CL_CURRENCY')) : null;
        const adjustmentCode = hasDsdComp('ADJUSTMENT') ? (getRowValue(row, 'ADJUSTMENT') || getRowValue(row, 'CL_ADJUSTMENT')) : null;
        const priceBaseCode = hasDsdComp('PRICE_BASE') ? (getRowValue(row, 'PRICE_BASE') || getRowValue(row, 'CL_PRICE_BASE')) : null;
        const counterpartAreaCode = hasDsdComp('COUNTERPART_AREA') ? (getRowValue(row, 'COUNTERPART_AREA') || getRowValue(row, 'CL_COUNTERPART_AREA')) : null;

        // Generate observation hash early so we can associate errors with it
        let rowHash: string | null = null;
        if (freqVal && indicatorVal && economyVal && periodVal) {
          rowHash = generateObservationHash({
            datasetCode,
            mainDataflowCode: mainDataflowValue,
            secondaryDataflowCode: rowSecondaryDataflow,
            indicatorCode: indicatorVal,
            economyCode: economyVal,
            freqCode: freqVal,
            period: periodVal,
            sexCode,
            ageCode,
            sectorCode,
            occupationCode,
            regionCode,
            sizeClassCode,
            ownershipCode,
            currencyCode,
            adjustmentCode,
            priceBaseCode,
            counterpartAreaCode,
          });
        }

        const logMsg = (severity: Severity, fieldName: string, message: string) => {
          validationMessages.push({
            importBatchId: batch.id,
            rowNumber,
            severity,
            fieldName,
            message,
            rawRow: row as any,
            observationHash: rowHash,
          });
          if (severity === Severity.ERROR) {
            rowHasErrors = true;
          } else if (severity === Severity.WARNING) {
            rowHasWarnings = true;
          }
        };

        // Validate Main Dataflow Code
        const rowMainDataflow = getRowValue(row, 'mainDataflowCode');
        if (!rowMainDataflow) {
          logMsg(Severity.ERROR, 'MAIN_DATAFLOW_CODE', 'Missing Main Dataflow Code.');
          invalidRowsCount++;
          continue;
        } else if (rowMainDataflow !== mainDataflowValue) {
          logMsg(Severity.ERROR, 'MAIN_DATAFLOW_CODE', `Dataflow mismatch. Expected ${mainDataflowValue}, got ${rowMainDataflow}.`);
          invalidRowsCount++;
          continue;
        }

        // Check required core fields
        if (!freqVal) logMsg(Severity.ERROR, 'CL_FREQ', 'Missing Frequency code.');
        if (!indicatorVal) logMsg(Severity.ERROR, indicatorCodeList, 'Missing Indicator code.');
        if (!economyVal) logMsg(Severity.ERROR, 'CL_ECONOMY_CODES', 'Missing Economy code.');
        if (!periodVal) logMsg(Severity.ERROR, 'PERIOD', 'Missing Period.');

        // Validate values against code lists
        if (freqVal && !clMap.get('CL_FREQ')?.has(freqVal)) {
          logMsg(Severity.ERROR, 'CL_FREQ', `Invalid Frequency code: ${freqVal}`);
        }
        if (indicatorVal) {
          if (!clMap.get(indicatorCodeList)?.has(indicatorVal)) {
            logMsg(Severity.ERROR, indicatorCodeList, `Invalid Indicator code: ${indicatorVal}`);
          }
          if (!dbIndicatorSet.has(indicatorVal)) {
            logMsg(Severity.ERROR, indicatorCodeList, `Indicator ${indicatorVal} does not exist in indicators shortcut table.`);
          }
        }
        if (economyVal) {
          if (!clMap.get('CL_ECONOMY_CODES')?.has(economyVal)) {
            logMsg(Severity.ERROR, 'CL_ECONOMY_CODES', `Invalid Economy code: ${economyVal}`);
          }
          if (!dbEconomySet.has(economyVal)) {
            logMsg(Severity.ERROR, 'CL_ECONOMY_CODES', `Economy ${economyVal} does not exist in economies shortcut table.`);
          }
        }

        // Validate multi-level constraints
        if (indicatorVal) {
          // Resolve specificity rules for this row
          const activeRowConstraints: typeof dbConstraints = [];
          activeRowConstraints.push(...datasetConstraints);
          activeRowConstraints.push(...dataflowConstraints);
          activeRowConstraints.push(...(indicatorConstraintsMap.get(indicatorVal) || []));
          activeRowConstraints.push(...(dataflowIndicatorConstraintsMap.get(indicatorVal) || []));

          const getSpecificity = (scope: ConstraintScopeType) => {
            switch (scope) {
              case 'DATAFLOW_INDICATOR': return 4;
              case 'INDICATOR': return 3;
              case 'DATAFLOW': return 2;
              case 'DATASET': return 1;
              default: return 0;
            }
          };

          const conceptRules = new Map<string, { ruleType: ConstraintRuleType; values: Set<string>; specificity: number }>();

          for (const c of activeRowConstraints) {
            const spec = getSpecificity(c.scopeType);
            for (const item of c.constraintItems) {
              const concept = item.conceptCode;
              const existing = conceptRules.get(concept);
              
              if (!existing || spec > existing.specificity) {
                conceptRules.set(concept, {
                  ruleType: item.ruleType,
                  values: new Set(item.codeValue ? [item.codeValue] : []),
                  specificity: spec
                });
              } else if (spec === existing.specificity && item.ruleType === existing.ruleType) {
                if (item.codeValue) {
                  existing.values.add(item.codeValue);
                }
              }
            }
          }

          // Evaluate resolved concept rules
          conceptRules.forEach((rule, cCode) => {
            let val = getRowValue(row, cCode);
            if (val === null) {
              const comp = dsdComponents.find(d => d.conceptCode === cCode);
              if (comp && comp.codeListCode) {
                val = getRowValue(row, comp.codeListCode);
              }
            }

            if (rule.ruleType === 'REQUIRED') {
              if (val === null || val.trim() === '') {
                logMsg(Severity.ERROR, cCode, `Dimension/Attribute ${cCode} is required but missing.`);
              } else if (rule.values.size > 0 && !rule.values.has(val)) {
                logMsg(Severity.ERROR, cCode, `Dimension/Attribute ${cCode} has value "${val}" which is not allowed. Required values: ${Array.from(rule.values).join(', ')}.`);
              }
            } else if (rule.ruleType === 'FORBIDDEN') {
              if (val !== null && val.trim() !== '') {
                if (rule.values.size === 0) {
                  logMsg(Severity.ERROR, cCode, `Dimension/Attribute ${cCode} is forbidden for this indicator.`);
                } else if (rule.values.has(val)) {
                  logMsg(Severity.ERROR, cCode, `Value "${val}" for dimension/attribute ${cCode} is forbidden.`);
                }
              }
            } else if (rule.ruleType === 'ALLOWED') {
              if (val !== null && val.trim() !== '') {
                if (rule.values.size > 0 && !rule.values.has(val)) {
                  logMsg(Severity.ERROR, cCode, `Value "${val}" for dimension/attribute ${cCode} is not allowed. Allowed values: ${Array.from(rule.values).join(', ')}.`);
                }
              }
            }
          });
        }

        // Parse obsValue
        let parsedObsValue: number | null = null;
        if (obsValueStr !== null) {
          const cleaned = obsValueStr.trim();
          const isNaMarker = /^[.…]+$/.test(cleaned) || /^[<>]=?/.test(cleaned) || cleaned === 'n.a.' || cleaned === 'N/A' || cleaned === '-';
          if (isNaMarker) {
            parsedObsValue = null;
            logMsg(Severity.WARNING, 'OBS_VALUE', `Non-numeric observation value treated as null: "${cleaned}"`);
          } else {
            parsedObsValue = parseFloat(cleaned);
            if (isNaN(parsedObsValue)) {
              parsedObsValue = null;
              logMsg(Severity.WARNING, 'OBS_VALUE', `Unrecognised observation value treated as null: "${cleaned}"`);
            }
          }
        }

        // Process other DSD components (attributes and extra dimensions)
        const extraDimensions: { conceptCode: string; codeValue: string }[] = [];
        const attributesMap = new Map<string, string | null>();

        for (const comp of dsdComponents) {
          const cCode = comp.conceptCode;
          if (['FREQ', 'INDICATOR', 'ECONOMY_CODE', 'TIME_PERIOD', 'OBS_VALUE'].includes(cCode)) {
            continue;
          }

          let val = getRowValue(row, cCode);
          if (val === null && comp.codeListCode) {
            val = getRowValue(row, comp.codeListCode);
          }

          if (comp.componentType === ComponentType.DIMENSION) {
            if (!val) {
              logMsg(Severity.ERROR, cCode, `Missing value for extra dimension ${cCode}.`);
            } else {
              if (comp.codeListCode && !clMap.get(comp.codeListCode)?.has(val)) {
                logMsg(Severity.ERROR, cCode, `Invalid value ${val} for extra dimension ${cCode}.`);
              }
              if ([
                'SEX', 'AGE', 'SECTOR', 'OCCUPATION', 'REGION',
                'SIZE_CLASS', 'OWNERSHIP', 'CURRENCY', 'ADJUSTMENT',
                'PRICE_BASE', 'COUNTERPART_AREA'
              ].includes(cCode)) {
                // Std dimension - stored directly in wide column, not fallback table
              } else {
                extraDimensions.push({ conceptCode: cCode, codeValue: val });
              }
            }
          } else if (comp.componentType === ComponentType.ATTRIBUTE) {
            if (val === null) {
              const dfAttr = dataflowAttrMap.get(cCode);
              if (dfAttr && dfAttr.defaultValue) {
                val = dfAttr.defaultValue;
              } else {
                const dsAttr = datasetAttrMap.get(cCode);
                if (dsAttr && dsAttr.defaultValue) {
                  val = dsAttr.defaultValue;
                }
              }
            }

            if (val !== null && comp.codeListCode && !clMap.get(comp.codeListCode)?.has(val)) {
              logMsg(Severity.ERROR, cCode, `Invalid value ${val} for attribute ${cCode}.`);
            }

            if (val === null && comp.isRequired) {
              logMsg(Severity.WARNING, cCode, `Mandatory attribute ${cCode} is missing and has no default value. This observation cannot be published.`);
            }

            attributesMap.set(cCode, val);
          }
        }

        // Determine if row can be written to the database (violates no foreign keys or DB constraints)
        const rowCanBeInserted = !!(
          freqVal &&
          clMap.get('CL_FREQ')?.has(freqVal) &&
          indicatorVal &&
          clMap.get(indicatorCodeList)?.has(indicatorVal) &&
          dbIndicatorSet.has(indicatorVal) &&
          economyVal &&
          clMap.get('CL_ECONOMY_CODES')?.has(economyVal) &&
          dbEconomySet.has(economyVal) &&
          periodVal &&
          rowHash
        );

        if (rowHasErrors) {
          invalidRowsCount++;
        } else if (rowHasWarnings) {
          warningRowsCount++;
        } else {
          validRowsCount++;
        }

        if (rowCanBeInserted && freqVal && indicatorVal && economyVal && periodVal && rowHash) {
          validRowsData.push({
            rowNumber,
            hash: rowHash,
            action: (getRowValue(row, 'ACTION') || 'UPSERT').toUpperCase(),
            obsRecord: {
              datasetCode,
              mainDataflowCode: mainDataflowValue,
              secondaryDataflowCode: rowSecondaryDataflow,
              indicatorCode: indicatorVal,
              economyCode: economyVal,
              period: periodVal,
              freqCode: freqVal,
              obsValue: parsedObsValue,
              unitCode: attributesMap.get('UNIT') || null,
              unitMultCode: attributesMap.get('UNIT_MULT') || null,
              decimalsCode: attributesMap.get('DECIMALS') || null,
              obsStatusCode: attributesMap.get('OBS_STATUS') || null,
              refYear: attributesMap.get('REF_YEAR') || null,
              baseYear: attributesMap.get('BASE_YEAR') || null,
              dataSource: attributesMap.get('DATA_SOURCE') || null,
              methodology: attributesMap.get('METHODOLOGY') || null,
              footnote: attributesMap.get('FOOTNOTE') || null,
              divisionCode: divisionVal || null,
              importBatchId: batch.id,
              sourceFileName: fileName,
              observationHash: rowHash,
              valueType: ValueType.REPORTED,
              // Wide-table standard dimensions
              sexCode,
              ageCode,
              sectorCode,
              occupationCode,
              regionCode,
              sizeClassCode,
              ownershipCode,
              currencyCode,
              adjustmentCode,
              priceBaseCode,
              counterpartAreaCode,
            },
            extraDimensions,
            attributes: Array.from(attributesMap.entries()).map(([k, v]) => ({ conceptCode: k, value: v })),
          });
        }
      }

      // Save all validation messages to the database
      if (validationMessages.length > 0) {
        await prisma.importValidationMessage.createMany({
          data: validationMessages,
        });
      }

      // 6. Database Upserts — chunked to avoid transaction timeouts.
      //    Strategy:
      //      a) Pre-load all existing observation hashes for this dataset in one query.
      //      b) Process validRowsData in chunks of CHUNK_SIZE.
      //      c) Each chunk runs in its own short transaction (60 s limit).
      //    This avoids the single-giant-transaction problem for large files (100k+ rows).

      const CHUNK_SIZE = 500;
      const importedObservationIds: string[] = [];

      // Pre-load all existing observations for this dataset (hash → record)
      // Done outside any transaction so there's no timeout risk.
      console.log(`    Loading existing hashes for dataset ${datasetCode}...`);
      const existingObservations = await prisma.observation.findMany({
        where: { datasetCode },
        select: {
          id: true,
          observationHash: true,
          workflowStatus: true,
          isPublished: true,
          obsValue: true,
          unitCode: true,
          unitMultCode: true,
          decimalsCode: true,
          obsStatusCode: true,
          refYear: true,
          baseYear: true,
          dataSource: true,
          methodology: true,
          footnote: true,
          divisionCode: true,
          deletedAt: true,
        },
      });
      const existingMap = new Map(existingObservations.map((o) => [o.observationHash, o]));
      console.log(`    Found ${existingMap.size} existing observations.`);

      const totalChunks = Math.ceil(validRowsData.length / CHUNK_SIZE);

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const chunk = validRowsData.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
        const chunkIds: string[] = [];
        const warningMsgs: any[] = [];

        await prisma.$transaction(async (tx) => {
          for (const item of chunk) {
            const obsData = item.obsRecord;
            const action = item.action;
            const existing = existingMap.get(obsData.observationHash) ?? null;
            const isSoftDeleted = existing && (existing as any).deletedAt !== null;
            let obsId = '';

            // Handle DELETE action
            if (action === 'DELETE') {
              if (existing && !isSoftDeleted) {
                await tx.observation.update({
                  where: { id: existing.id },
                  data: {
                    deletedAt: new Date(),
                    workflowStatus: WorkflowStatus.ARCHIVED,
                    isPublished: false,
                    publishedAt: null,
                    updatedBy: uploadedBy,
                  },
                });
                // Update cache
                (existing as any).deletedAt = new Date();
                (existing as any).workflowStatus = WorkflowStatus.ARCHIVED;
                (existing as any).isPublished = false;
                obsId = existing.id;
              } else {
                warningMsgs.push({
                  importBatchId: batch.id,
                  rowNumber: item.rowNumber,
                  severity: Severity.WARNING,
                  fieldName: 'ACTION',
                  message: `Observation does not exist or is already deleted for ACTION = DELETE (hash: ${obsData.observationHash}). Delete skipped.`,
                });
              }
              continue; // Do not process extra dimensions/attributes for deleted ones
            }

            // Handle CLEAR_VALUE action
            if (action === 'CLEAR_VALUE') {
              if (existing && !isSoftDeleted) {
                obsId = existing.id;
                
                // Block updates if already published
                if (existing.workflowStatus === WorkflowStatus.PUBLISHED) {
                  warningMsgs.push({
                    importBatchId: batch.id,
                    rowNumber: item.rowNumber,
                    severity: Severity.WARNING,
                    fieldName: 'isPublished',
                    message: `Cannot clear value on published observation (hash: ${obsData.observationHash}). Clear skipped.`,
                  });
                  continue;
                }

                await tx.observation.update({
                  where: { id: existing.id },
                  data: {
                    obsValue: null,
                    workflowStatus: WorkflowStatus.DRAFT,
                    isPublished: false,
                    publishedAt: null,
                    updatedBy: uploadedBy,
                  },
                });
                // Update cache
                existing.obsValue = null;
                existing.workflowStatus = WorkflowStatus.DRAFT;
                existing.isPublished = false;
              } else {
                warningMsgs.push({
                  importBatchId: batch.id,
                  rowNumber: item.rowNumber,
                  severity: Severity.ERROR,
                  fieldName: 'ACTION',
                  message: `Observation does not exist for ACTION = CLEAR_VALUE (hash: ${obsData.observationHash}). Clear skipped.`,
                });
                continue;
              }
            }

            // Handle ADD action (must not exist)
            else if (action === 'ADD') {
              if (existing && !isSoftDeleted) {
                warningMsgs.push({
                  importBatchId: batch.id,
                  rowNumber: item.rowNumber,
                  severity: Severity.ERROR,
                  fieldName: 'ACTION',
                  message: `Observation already exists for ACTION = ADD (hash: ${obsData.observationHash}). Insert skipped.`,
                });
                continue;
              } else if (existing && isSoftDeleted) {
                // Restore deleted one
                obsId = existing.id;
                await tx.observation.update({
                  where: { id: existing.id },
                  data: {
                    ...obsData,
                    deletedAt: null,
                    workflowStatus: WorkflowStatus.DRAFT,
                    isPublished: false,
                    publishedAt: null,
                    updatedBy: uploadedBy,
                  },
                });
                (existing as any).deletedAt = null;
                existing.workflowStatus = WorkflowStatus.DRAFT;
                existing.isPublished = false;
              } else {
                // Create new
                const created = await tx.observation.create({
                  data: {
                    ...obsData,
                    workflowStatus: WorkflowStatus.DRAFT,
                    createdBy: uploadedBy,
                  },
                });
                obsId = created.id;
                existingMap.set(obsData.observationHash, { ...obsData, id: obsId, workflowStatus: WorkflowStatus.DRAFT, isPublished: false, deletedAt: null } as any);
              }
            }

            // Handle UPDATE action (must exist)
            else if (action === 'UPDATE') {
              if (existing && !isSoftDeleted) {
                obsId = existing.id;

                // Block updates if already published
                if (existing.workflowStatus === WorkflowStatus.PUBLISHED) {
                  warningMsgs.push({
                    importBatchId: batch.id,
                    rowNumber: item.rowNumber,
                    severity: Severity.WARNING,
                    fieldName: 'isPublished',
                    message: `Cannot update published observation (hash: ${obsData.observationHash}). Update skipped.`,
                  });
                  continue;
                }

                // Update existing observation
                await tx.observation.update({
                  where: { id: existing.id },
                  data: {
                    ...obsData,
                    workflowStatus: WorkflowStatus.DRAFT,
                    isPublished: false,
                    publishedAt: null,
                    updatedBy: uploadedBy,
                  },
                });
                // Update cache
                existing.workflowStatus = WorkflowStatus.DRAFT;
                existing.isPublished = false;
              } else {
                warningMsgs.push({
                  importBatchId: batch.id,
                  rowNumber: item.rowNumber,
                  severity: Severity.ERROR,
                  fieldName: 'ACTION',
                  message: `Observation does not exist for ACTION = UPDATE (hash: ${obsData.observationHash}). Update skipped.`,
                });
                continue;
              }
            }

            // Handle UPSERT action
            else {
              if (existing) {
                obsId = existing.id;

                // Block updates if already published
                if (existing.workflowStatus === WorkflowStatus.PUBLISHED) {
                  warningMsgs.push({
                    importBatchId: batch.id,
                    rowNumber: item.rowNumber,
                    severity: Severity.WARNING,
                    fieldName: 'isPublished',
                    message: `Cannot update published observation (hash: ${obsData.observationHash}). Update skipped.`,
                  });
                  continue;
                }

                // Update existing observation (or restore deleted)
                await tx.observation.update({
                  where: { id: existing.id },
                  data: {
                    ...obsData,
                    deletedAt: null,
                    workflowStatus: WorkflowStatus.DRAFT,
                    isPublished: false,
                    publishedAt: null,
                    updatedBy: uploadedBy,
                  },
                });
                (existing as any).deletedAt = null;
                existing.workflowStatus = WorkflowStatus.DRAFT;
                existing.isPublished = false;
              } else {
                // Create new
                const created = await tx.observation.create({
                  data: {
                    ...obsData,
                    workflowStatus: WorkflowStatus.DRAFT,
                    createdBy: uploadedBy,
                  },
                });
                obsId = created.id;
                existingMap.set(obsData.observationHash, { ...obsData, id: obsId, workflowStatus: WorkflowStatus.DRAFT, isPublished: false, deletedAt: null } as any);
              }
            }

            chunkIds.push(obsId);

            // Save extra dimensions
            for (const d of item.extraDimensions) {
              await tx.observationExtraDimension.upsert({
                where: { observationId_conceptCode: { observationId: obsId, conceptCode: d.conceptCode } },
                update: { codeValue: d.codeValue },
                create: { observationId: obsId, conceptCode: d.conceptCode, codeValue: d.codeValue },
              });
            }

            // Save attributes
            for (const a of item.attributes) {
              await tx.observationAttribute.upsert({
                where: { observationId_conceptCode: { observationId: obsId, conceptCode: a.conceptCode } },
                update: { value: a.value },
                create: { observationId: obsId, conceptCode: a.conceptCode, value: a.value },
              });
            }
          }
        }, { timeout: 60000 }); // 60 s per chunk of 500 rows

        // Persist any skipped-published warnings outside the transaction
        if (warningMsgs.length > 0) {
          await prisma.importValidationMessage.createMany({ data: warningMsgs });
        }

        importedObservationIds.push(...chunkIds);

        if ((chunkIdx + 1) % 10 === 0 || chunkIdx + 1 === totalChunks) {
          console.log(`    Chunk ${chunkIdx + 1}/${totalChunks} — ${importedObservationIds.length} rows committed so far`);
        }
      }

      // 7. Recalculate Harmonization in Service Layer
      if (importedObservationIds.length > 0) {
        await HarmonizationService.applyHarmonization(importedObservationIds);
      }

      // Update Import Batch status to IMPORTED
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportStatus.IMPORTED,
          completedAt: new Date(),
          totalRows: rows.length,
          validRows: validRowsCount,
          invalidRows: invalidRowsCount,
          warningRows: warningRowsCount,
        },
      });

      return await prisma.importBatch.findUnique({
        where: { id: batch.id },
        include: { validationMessages: true },
      });
    } catch (err: any) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportStatus.FAILED,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }
}
