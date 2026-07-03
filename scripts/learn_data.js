const { PrismaClient } = require('@prisma/client-cockroach');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function calculateStats(values) {
  if (values.length === 0) return null;
  const numVals = values.map(Number);
  const n = numVals.length;
  const sum = numVals.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  const variance = numVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

async function runLearning() {
  console.log('=== Starting Machine Learning Data Profiling (Optimized Batch Mode) ===');
  try {
    // Get economy name mappings
    const economies = await prisma.economy.findMany({ select: { code: true, name: true } });
    const ecoMap = new Map(economies.map(e => [e.code, e.name]));

    // Fetch all observations in one batch to avoid database roundtrip latency
    console.log('Fetching database observations...');
    const allObs = await prisma.observation.findMany({
      where: {
        isPublished: true,
        deletedAt: null
      },
      select: {
        indicatorCode: true,
        economyCode: true,
        period: true,
        obsValue: true
      }
    });

    console.log(`Fetched ${allObs.length} observations. Profiling data in memory...`);

    // Group observations by indicator in memory
    const obsByIndicator = {};
    allObs.forEach(o => {
      if (o.obsValue === null || o.obsValue === undefined || isNaN(Number(o.obsValue))) return;
      if (!obsByIndicator[o.indicatorCode]) {
        obsByIndicator[o.indicatorCode] = [];
      }
      obsByIndicator[o.indicatorCode].push(o);
    });

    const profiles = {};

    for (const [indicatorCode, obsList] of Object.entries(obsByIndicator)) {
      const numericValues = obsList.map(o => Number(o.obsValue));
      const stats = calculateStats(numericValues);
      if (!stats) continue;

      const sorted = [...obsList].sort((a, b) => Number(a.obsValue) - Number(b.obsValue));
      const minObs = sorted[0];
      const maxObs = sorted[sorted.length - 1];

      // Outlier analysis
      const outliers = [];
      obsList.forEach(o => {
        const val = Number(o.obsValue);
        const zScore = stats.stdDev > 0 ? (val - stats.mean) / stats.stdDev : 0;
        if (Math.abs(zScore) > 2.5) {
          outliers.push({
            economy: ecoMap.get(o.economyCode) || o.economyCode,
            year: o.period,
            value: val,
            deviation: Number(zScore.toFixed(2))
          });
        }
      });

      profiles[indicatorCode] = {
        code: indicatorCode,
        totalObservations: obsList.length,
        min: {
          value: Number(minObs.obsValue),
          year: minObs.period,
          economy: ecoMap.get(minObs.economyCode) || minObs.economyCode
        },
        max: {
          value: Number(maxObs.obsValue),
          year: maxObs.period,
          economy: ecoMap.get(maxObs.economyCode) || maxObs.economyCode
        },
        average: Number(stats.mean.toFixed(4)),
        stdDeviation: Number(stats.stdDev.toFixed(4)),
        outliers: outliers.slice(0, 5)
      };
    }

    // Compute correlations
    console.log('Computing indicator correlation matrices...');
    const targetCodes = ['NY_GDP_MKTP_KD_ZG', 'NY_GDP_MKTP_CD', 'FP_CPI_TOTL_ZG', 'SP_POP_TOTL', 'SP_POP_GROW'];
    const activeTargets = targetCodes.filter(c => obsByIndicator[c]);
    
    const phiObs = {};
    for (const code of activeTargets) {
      const list = obsByIndicator[code].filter(o => o.economyCode === 'PHI');
      phiObs[code] = new Map(list.map(o => [o.period, Number(o.obsValue)]));
    }

    // Overlapping years
    const years = [];
    if (activeTargets.length > 0) {
      const firstMap = phiObs[activeTargets[0]];
      for (const year of firstMap.keys()) {
        let overlap = true;
        for (let i = 1; i < activeTargets.length; i++) {
          if (!phiObs[activeTargets[i]].has(year)) {
            overlap = false;
            break;
          }
        }
        if (overlap) years.push(year);
      }
    }

    const correlationMatrix = {};
    for (let i = 0; i < activeTargets.length; i++) {
      const codeA = activeTargets[i];
      correlationMatrix[codeA] = {};
      for (let j = 0; j < activeTargets.length; j++) {
        const codeB = activeTargets[j];
        if (codeA === codeB) {
          correlationMatrix[codeA][codeB] = 1;
          continue;
        }

        const x = years.map(y => phiObs[codeA].get(y));
        const y = years.map(y => phiObs[codeB].get(y));
        const r = calculateCorrelation(x, y);
        correlationMatrix[codeA][codeB] = Number(r.toFixed(4));
      }
    }

    const payload = {
      indicatorProfiles: profiles,
      correlationMatrix: correlationMatrix,
      lastCalculated: new Date().toISOString()
    };

    const targetDir = path.resolve(__dirname, '../app/data-explorer');
    const targetFile = path.join(targetDir, 'data_profiles.json');
    fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Successfully compiled dynamic data profiles and correlations into: ${targetFile}`);

  } catch (err) {
    console.error('Error during data learning process:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runLearning();
