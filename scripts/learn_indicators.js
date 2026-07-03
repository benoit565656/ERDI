const { PrismaClient } = require('@prisma/client-cockroach');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// A fallback dictionary for common ADB/KIDB indicators if they are missing descriptions
const COMMON_FALLBACKS = {
  'NY_GDP_MKTP_KD_ZG': {
    definition: 'Annual percentage growth rate of GDP at market prices based on constant local currency.',
    description: 'GDP constant price growth rate. Measures economic acceleration.',
    aggregation: 'WEIGHTED_AVERAGE',
    weight: 'NY_GDP_MKTP_KN'
  },
  'NY_GDP_MKTP_CD': {
    definition: 'Gross domestic product at purchaser prices in current U.S. dollars.',
    description: 'Nominal GDP in current prices. Measures overall size of the economy.',
    aggregation: 'SUM'
  },
  'FP_CPI_TOTL_ZG': {
    definition: 'Inflation, consumer prices (annual %). Measures changes in the cost of living.',
    description: 'Consumer Price Index inflation rate. Measures pricing pressure.',
    aggregation: 'WEIGHTED_AVERAGE',
    weight: 'SP_POP_TOTL'
  },
  'SP_POP_TOTL': {
    definition: 'Total population is based on the de facto definition of population.',
    description: 'Total Population. Measures size of human capital.',
    aggregation: 'SUM'
  },
  'SP_POP_GROW': {
    definition: 'Annual population growth rate (%). Calculated as yearly difference.',
    description: 'Population growth rate. Measures demographic shifts.',
    aggregation: 'WEIGHTED_AVERAGE',
    weight: 'SP_POP_TOTL'
  }
};

function capitalizeWords(str) {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function learn() {
  try {
    const indicators = await prisma.indicator.findMany({
      where: { status: 'ACTIVE' },
      include: {
        indicatorDatasetMetadata: true
      }
    });

    console.log(`Found ${indicators.length} active indicators to process.`);

    const knowledge = {};

    for (const ind of indicators) {
      let definition = ind.definition || ind.description || '';
      let description = ind.description || ind.name || '';
      let aggregation = 'SUM';
      let weight = undefined;

      // Guess aggregation type based on code and name keywords
      const code = ind.code.toUpperCase();
      const name = ind.name.toLowerCase();

      if (
        code.endsWith('_ZG') || 
        code.endsWith('_RT') || 
        code.endsWith('_ZS') || 
        code.includes('GROW') || 
        code.includes('RATE') ||
        name.includes('growth') ||
        name.includes('rate') ||
        name.includes('percent') ||
        name.includes('ratio') ||
        name.includes('index') ||
        name.includes('inflation')
      ) {
        aggregation = 'WEIGHTED_AVERAGE';
        // Assign default weights
        if (name.includes('population') || name.includes('fertility') || name.includes('literacy')) {
          weight = 'SP_POP_TOTL'; // Weight by population
        } else {
          weight = 'NY_GDP_MKTP_CD'; // Weight by nominal GDP
        }
      }

      // Check fallback definitions if currently missing
      if (!definition || definition.length < 5) {
        const fallback = COMMON_FALLBACKS[ind.code];
        if (fallback) {
          definition = fallback.definition;
          description = fallback.description;
          aggregation = fallback.aggregation;
          weight = fallback.weight || weight;

          // Update database with fallback definition to enrich CockroachDB metadata
          await prisma.indicator.update({
            where: { code: ind.code },
            data: { definition, description }
          });
          console.log(`Enriched indicator ${ind.code} using standard fallbacks.`);
        } else {
          // If no fallback is defined, build a clean explanation based on name
          definition = `Official index tracking ${ind.name}. It is parsed from datasets and monitored for economic evaluations.`;
          await prisma.indicator.update({
            where: { code: ind.code },
            data: { definition, description }
          });
          console.log(`Enriched indicator ${ind.code} using synthesized name logic.`);
        }
      }

      knowledge[ind.code] = {
        code: ind.code,
        name: ind.name,
        definition,
        description,
        aggregation,
        weight,
        unit: ind.defaultUnitCode || 'index',
        dataset: ind.indicatorDatasetMetadata?.[0]?.datasetCode || 'KIDB'
      };
    }

    // Write compiled dictionary to file
    const targetDir = path.resolve(__dirname, '../app/data-explorer');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetFile = path.join(targetDir, 'indicator_knowledge.json');
    fs.writeFileSync(targetFile, JSON.stringify(knowledge, null, 2), 'utf-8');
    console.log(`Successfully compiled indicator knowledge graph into: ${targetFile}`);

  } catch (e) {
    console.error('Error compiling indicator knowledge:', e);
  } finally {
    await prisma.$disconnect();
  }
}

learn();
