import { PrismaClient, ConversionMethod } from '@prisma/client';

const prisma = new PrismaClient();

export class HarmonizationService {
  /**
   * Recalculates harmonized values for a list of observation IDs.
   */
  static async applyHarmonization(observationIds: string[]): Promise<void> {
    if (observationIds.length === 0) return;

    // Load observations
    const observations = await prisma.observation.findMany({
      where: { id: { in: observationIds } },
    });

    if (observations.length === 0) return;

    // Cache economies and multipliers to prevent query fatigue
    const economyCodes = Array.from(new Set(observations.map((o) => o.economyCode)));
    const economies = await prisma.economy.findMany({
      where: { code: { in: economyCodes } },
    });
    const economyMap = new Map(economies.map((e) => [e.code, e]));

    const multipliers = await prisma.commonMultiplier.findMany();
    const multiplierMap = new Map(multipliers.map((m) => [m.code, m.factor.toNumber()]));

    // Load active harmonization rules for the indicators in these observations
    const indicatorCodes = Array.from(new Set(observations.map((o) => o.indicatorCode)));
    const datasetCodes = Array.from(new Set(observations.map((o) => o.datasetCode)));
    const rules = await prisma.harmonizationRule.findMany({
      where: {
        datasetCode: { in: datasetCodes },
        indicatorCode: { in: indicatorCodes },
        isActive: true,
      },
    });

    // Helper to resolve the correct rule for an observation (dataflow specific or dataset fallback)
    const resolveRule = (datasetCode: string, mainDataflowCode: string, indicatorCode: string) => {
      // Look for a specific dataflow rule
      const specificRule = rules.find(
        (r) =>
          r.datasetCode === datasetCode &&
          r.indicatorCode === indicatorCode &&
          r.dataflowCode === mainDataflowCode
      );
      if (specificRule) return specificRule;

      // Fallback to dataset-level rule (where dataflowCode is null)
      return rules.find(
        (r) =>
          r.datasetCode === datasetCode &&
          r.indicatorCode === indicatorCode &&
          !r.dataflowCode
      );
    };

    // Process each observation
    for (const obs of observations) {
      if (obs.obsValue === null) {
        // Clear harmonized columns if reported value is null
        await prisma.observation.update({
          where: { id: obs.id },
          data: {
            harmonizedValue: null,
            harmonizedUnitCode: obs.unitCode,
            harmonizedMultiplierCode: obs.unitMultCode,
          },
        });
        continue;
      }

      const rule = resolveRule(obs.datasetCode, obs.mainDataflowCode, obs.indicatorCode);

      if (!rule) {
        // Default rule: copy reported values directly
        await prisma.observation.update({
          where: { id: obs.id },
          data: {
            harmonizedValue: obs.obsValue,
            harmonizedUnitCode: obs.unitCode,
            harmonizedMultiplierCode: obs.unitMultCode,
          },
        });
        continue;
      }

      const obsVal = obs.obsValue.toNumber();
      let harmonizedValue: number | null = obsVal;
      let harmonizedUnitCode = rule.targetUnitCode || obs.unitCode;
      let harmonizedMultiplierCode = rule.targetMultiplierCode || obs.unitMultCode;

      // 1. Resolve Multiplier Adjustments
      const srcFactor = obs.unitMultCode ? (multiplierMap.get(obs.unitMultCode) ?? 1) : 1;
      const trgFactor = harmonizedMultiplierCode ? (multiplierMap.get(harmonizedMultiplierCode) ?? 1) : 1;
      const multiplierScaling = srcFactor / trgFactor;

      if (rule.conversionMethod === ConversionMethod.MULTIPLIER_ONLY) {
        harmonizedValue = obsVal * multiplierScaling;
      } else if (rule.conversionMethod === ConversionMethod.CURRENCY_CONVERSION) {
        const economy = economyMap.get(obs.economyCode);
        const localCurrency = economy?.currencyCode;
        const targetCurrency = rule.targetUnitCode; // Target unit is conceptually the currency code

        if (!localCurrency || !targetCurrency) {
          // If currency config is missing, default to multiplier only and keep unitCode
          harmonizedValue = obsVal * multiplierScaling;
          harmonizedUnitCode = obs.unitCode;
        } else if (localCurrency === targetCurrency) {
          // Same currency, only apply multiplier scaling
          harmonizedValue = obsVal * multiplierScaling;
        } else {
          // Query exchange rate bidirectionally
          const rateRecord = await prisma.currencyExchangeRate.findFirst({
            where: {
              OR: [
                { sourceCurrencyCode: localCurrency, targetCurrencyCode: targetCurrency },
                { sourceCurrencyCode: targetCurrency, targetCurrencyCode: localCurrency },
              ],
              period: obs.period,
              freqCode: obs.freqCode,
            },
          });

          if (rateRecord) {
            const rate = rateRecord.exchangeRate.toNumber();
            if (rateRecord.sourceCurrencyCode === localCurrency) {
              // Convert to target currency: value * (target/source rate)
              harmonizedValue = obsVal * rate * multiplierScaling;
            } else {
              // Reverse rate: value / (source/target rate)
              harmonizedValue = (obsVal / rate) * multiplierScaling;
            }
          } else {
            // If exchange rate is missing, keep harmonized value null
            harmonizedValue = null;
          }
        }
      } else {
        // NONE or WARNING_ONLY
        harmonizedValue = obsVal;
        harmonizedUnitCode = obs.unitCode;
        harmonizedMultiplierCode = obs.unitMultCode;
      }

      // Save harmonized fields
      await prisma.observation.update({
        where: { id: obs.id },
        data: {
          harmonizedValue: harmonizedValue !== null ? harmonizedValue : null,
          harmonizedUnitCode: harmonizedUnitCode,
          harmonizedMultiplierCode: harmonizedMultiplierCode,
        },
      });
    }
  }

  /**
   * Recalculate all observations for a dataset.
   */
  static async recalculateAllForDataset(datasetCode: string): Promise<number> {
    const observations = await prisma.observation.findMany({
      where: { datasetCode },
      select: { id: true },
    });

    const ids = observations.map((o) => o.id);
    // Process in batches of 500 to keep transaction size healthy
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      await this.applyHarmonization(batchIds);
    }

    return ids.length;
  }
}
