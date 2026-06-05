import { PrismaClient, WorkflowStatus, ValueType, ImportStatus, Severity, ComponentType, AttachmentLevel, ChangeType } from '@prisma/client';
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
      });

      if (!dataflow || !dataflow.dsdCode) {
        throw new Error(`Dataflow ${mainDataflowValue} does not exist or has no DSD associated.`);
      }

      const dsdComponents = await prisma.dsdComponent.findMany({
        where: { dsdCode: dataflow.dsdCode },
      });

      // Cache Code Lists and items in memory
      const clCodes = dsdComponents.map((c) => c.codeListCode).filter((c): c is string => !!c);
      // Pre-seed some standard ones if not referenced but used in shortcut fields
      if (!clCodes.includes('CL_ECONOMY_CODES')) clCodes.push('CL_ECONOMY_CODES');
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

      // Cache dataflow constraints
      const constraints = await prisma.dataflowConstraint.findMany({
        where: { datasetCode, dataflowCode: dataflow.code, isActive: true },
        include: { constraintItems: true },
      });
      const constraintMap = new Map<string, Set<string>>();
      for (const c of constraints) {
        for (const item of c.constraintItems) {
          if (!constraintMap.has(item.conceptCode)) {
            constraintMap.set(item.conceptCode, new Set());
          }
          constraintMap.get(item.conceptCode)!.add(item.allowedCodeValue);
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

      // Helpers to resolve value from CSV row
      const getRowValue = (row: any, key: string): string | null => {
        const header = resolvedHeaders.get(key);
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

      // 5. Validate row-by-row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1;
        let rowHasErrors = false;

        const logMsg = (severity: Severity, fieldName: string, message: string) => {
          validationMessages.push({
            importBatchId: batch.id,
            rowNumber,
            severity,
            fieldName,
            message,
            rawRow: row,
          });
          if (severity === Severity.ERROR) {
            rowHasErrors = true;
          }
        };

        // Validate Main Dataflow Code
        const rowMainDataflow = getRowValue(row, 'mainDataflowCode');
        if (!rowMainDataflow) {
          logMsg(Severity.ERROR, 'MAIN_DATAFLOW_CODE', 'Missing Main Dataflow Code.');
          continue;
        } else if (rowMainDataflow !== mainDataflowValue) {
          logMsg(Severity.ERROR, 'MAIN_DATAFLOW_CODE', `Dataflow mismatch. Expected ${mainDataflowValue}, got ${rowMainDataflow}.`);
          continue;
        }

        const rowSecondaryDataflow = getRowValue(row, 'secondaryDataflowCode');

        // Resolve core dimension values
        const freqVal = getCoreDimensionValue(row, 'FREQ', 'CL_FREQ');
        const indicatorVal = getCoreDimensionValue(row, 'INDICATOR', 'CL_KIDB_INDICATORS');
        const economyVal = getCoreDimensionValue(row, 'ECONOMY_CODE', 'CL_ECONOMY_CODES');
        const periodVal = getRowValue(row, 'period');
        const obsValueStr = getRowValue(row, 'obsValue');
        const divisionVal = getRowValue(row, 'divisionCode');

        // Check required core fields
        if (!freqVal) logMsg(Severity.ERROR, 'CL_FREQ', 'Missing Frequency code.');
        if (!indicatorVal) logMsg(Severity.ERROR, 'CL_KIDB_INDICATORS', 'Missing Indicator code.');
        if (!economyVal) logMsg(Severity.ERROR, 'CL_ECONOMY_CODES', 'Missing Economy code.');
        if (!periodVal) logMsg(Severity.ERROR, 'PERIOD', 'Missing Period.');

        // Validate values against code lists
        if (freqVal && !clMap.get('CL_FREQ')?.has(freqVal)) {
          logMsg(Severity.ERROR, 'CL_FREQ', `Invalid Frequency code: ${freqVal}`);
        }
        if (indicatorVal) {
          if (!clMap.get('CL_KIDB_INDICATORS')?.has(indicatorVal)) {
            logMsg(Severity.ERROR, 'CL_KIDB_INDICATORS', `Invalid Indicator code: ${indicatorVal}`);
          }
          if (!dbIndicatorSet.has(indicatorVal)) {
            logMsg(Severity.ERROR, 'CL_KIDB_INDICATORS', `Indicator ${indicatorVal} does not exist in indicators shortcut table.`);
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

        // Validate dataflow constraints
        if (economyVal && constraintMap.has('ECONOMY_CODE')) {
          if (!constraintMap.get('ECONOMY_CODE')!.has(economyVal)) {
            logMsg(Severity.ERROR, 'CL_ECONOMY_CODES', `Economy ${economyVal} violates active constraint restrictions for this dataflow.`);
          }
        }
        if (indicatorVal && constraintMap.has('INDICATOR')) {
          if (!constraintMap.get('INDICATOR')!.has(indicatorVal)) {
            logMsg(Severity.ERROR, 'CL_KIDB_INDICATORS', `Indicator ${indicatorVal} violates active constraint restrictions for this dataflow.`);
          }
        }

        // Parse obsValue
        let parsedObsValue: number | null = null;
        if (obsValueStr !== null) {
          parsedObsValue = parseFloat(obsValueStr);
          if (isNaN(parsedObsValue)) {
            logMsg(Severity.ERROR, 'OBS_VALUE', `Invalid numeric observation value: ${obsValueStr}`);
          }
        }

        // Process other DSD components (attributes and extra dimensions)
        const extraDimensions: { conceptCode: string; codeValue: string }[] = [];
        const attributesMap = new Map<string, string | null>();

        for (const comp of dsdComponents) {
          const cCode = comp.conceptCode;
          // Skip core dimensions that we handle explicitly
          if (['FREQ', 'INDICATOR', 'ECONOMY_CODE', 'TIME_PERIOD', 'OBS_VALUE'].includes(cCode)) {
            continue;
          }

          let val = getRowValue(row, cCode);
          if (val === null && comp.codeListCode) {
            val = getRowValue(row, comp.codeListCode);
          }

          if (comp.componentType === ComponentType.DIMENSION) {
            // Extra dimension
            if (!val) {
              logMsg(Severity.ERROR, cCode, `Missing value for extra dimension ${cCode}.`);
            } else {
              // Code list validation
              if (comp.codeListCode && !clMap.get(comp.codeListCode)?.has(val)) {
                logMsg(Severity.ERROR, cCode, `Invalid value ${val} for extra dimension ${cCode}.`);
              }
              extraDimensions.push({ conceptCode: cCode, codeValue: val });
            }
          } else if (comp.componentType === ComponentType.ATTRIBUTE) {
            // Attribute: Handle default resolution rules
            if (val === null) {
              // Check dataflow-level defaults
              const dfAttr = dataflowAttrMap.get(cCode);
              if (dfAttr && dfAttr.defaultValue) {
                val = dfAttr.defaultValue;
              } else {
                // Check dataset-level defaults
                const dsAttr = datasetAttrMap.get(cCode);
                if (dsAttr && dsAttr.defaultValue) {
                  val = dsAttr.defaultValue;
                }
              }
            }

            // Validate code list if present
            if (val !== null && comp.codeListCode && !clMap.get(comp.codeListCode)?.has(val)) {
              logMsg(Severity.ERROR, cCode, `Invalid value ${val} for attribute ${cCode}.`);
            }

            // If mandatory but still missing, write warning (only blocks publishing, not draft ingest)
            if (val === null && comp.isRequired) {
              logMsg(Severity.WARNING, cCode, `Mandatory attribute ${cCode} is missing and has no default value. This observation cannot be published.`);
            }

            attributesMap.set(cCode, val);
          }
        }

        // Only save row if there are no errors
        if (!rowHasErrors && freqVal && indicatorVal && economyVal && periodVal) {
          // Generate Hash
          const hash = generateObservationHash({
            datasetCode,
            mainDataflowCode: mainDataflowValue,
            secondaryDataflowCode: rowSecondaryDataflow,
            indicatorCode: indicatorVal,
            economyCode: economyVal,
            freqCode: freqVal,
            period: periodVal,
            extraDimensions,
          });

          validRowsData.push({
            rowNumber,
            hash,
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
              observationHash: hash,
              valueType: ValueType.REPORTED,
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

      // If any errors found, import fails
      const errorCount = validationMessages.filter((m) => m.severity === Severity.ERROR).length;
      if (errorCount > 0) {
        await prisma.importBatch.update({
          where: { id: batch.id },
          data: {
            status: ImportStatus.FAILED,
            completedAt: new Date(),
            totalRows: rows.length,
            invalidRows: errorCount,
            validRows: 0,
          },
        });
        return await prisma.importBatch.findUnique({
          where: { id: batch.id },
          include: { validationMessages: true },
        });
      }

      // 6. Database Upserts inside a Prisma transaction
      const importedObservationIds: string[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of validRowsData) {
          const obsData = item.obsRecord;

          // Check if observation already exists by hash
          const existing = await tx.observation.findFirst({
            where: {
              datasetCode: obsData.datasetCode,
              observationHash: obsData.observationHash,
            },
          });

          let obsId = '';

          if (existing) {
            obsId = existing.id;

            // Block updates if already published
            if (existing.workflowStatus === WorkflowStatus.PUBLISHED) {
              // Write a warning message and skip
              await tx.importValidationMessage.create({
                data: {
                  importBatchId: batch.id,
                  rowNumber: item.rowNumber,
                  severity: Severity.WARNING,
                  fieldName: 'isPublished',
                  message: `Cannot update published observation (hash: ${obsData.observationHash}). Update skipped.`,
                },
              });
              continue;
            }

            // Document changes in ObservationHistory
            const fieldsToCheck: (keyof typeof obsData)[] = [
              'obsValue', 'unitCode', 'unitMultCode', 'decimalsCode',
              'obsStatusCode', 'refYear', 'baseYear', 'dataSource',
              'methodology', 'footnote', 'divisionCode'
            ];

            for (const f of fieldsToCheck) {
              const oldVal = (existing as any)[f];
              const newVal = (obsData as any)[f];
              if (oldVal !== newVal) {
                await tx.observationHistory.create({
                  data: {
                    observationId: existing.id,
                    changeType: ChangeType.UPDATE,
                    fieldName: String(f),
                    oldValue: oldVal !== null ? String(oldVal) : 'null',
                    newValue: newVal !== null ? String(newVal) : 'null',
                    reason: 'Observation updated via CSV ingest',
                    sourceFileName: fileName,
                    importBatchId: batch.id,
                    changedBy: uploadedBy,
                  },
                });
              }
            }

            // Update Observation
            await tx.observation.update({
              where: { id: existing.id },
              data: {
                ...obsData,
                workflowStatus: WorkflowStatus.DRAFT, // Reset to draft
                isPublished: false,
                publishedAt: null,
                updatedBy: uploadedBy,
              },
            });
          } else {
            // Create New Observation
            const created = await tx.observation.create({
              data: {
                ...obsData,
                workflowStatus: WorkflowStatus.DRAFT,
                createdBy: uploadedBy,
              },
            });
            obsId = created.id;
          }

          importedObservationIds.push(obsId);

          // Save Observation Extra Dimensions
          for (const d of item.extraDimensions) {
            await tx.observationExtraDimension.upsert({
              where: {
                observationId_conceptCode: {
                  observationId: obsId,
                  conceptCode: d.conceptCode,
                },
              },
              update: { codeValue: d.codeValue },
              create: {
                observationId: obsId,
                conceptCode: d.conceptCode,
                codeValue: d.codeValue,
              },
            });
          }

          // Save Observation Attributes
          for (const a of item.attributes) {
            await tx.observationAttribute.upsert({
              where: {
                observationId_conceptCode: {
                  observationId: obsId,
                  conceptCode: a.conceptCode,
                },
              },
              update: { value: a.value },
              create: {
                observationId: obsId,
                conceptCode: a.conceptCode,
                value: a.value,
              },
            });
          }
        }
      });

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
          validRows: importedObservationIds.length,
          invalidRows: rows.length - importedObservationIds.length,
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
