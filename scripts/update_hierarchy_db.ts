import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const newPaths: Record<string, { name: string; path: string; parentCode: string | null; depthLevel: number; sortOrder: number }> = {
  // KIDB & ADO (Prefix 1.x shifted to root level)
  PPL: { name: 'People', path: '1', parentCode: null, depthLevel: 1, sortOrder: 1 },
  PPL_POP: { name: 'People, Population', path: '1.1', parentCode: 'PPL', depthLevel: 2, sortOrder: 1 },
  PPL_LE: { name: 'People, Labor Force and Employment', path: '1.2', parentCode: 'PPL', depthLevel: 2, sortOrder: 2 },
  PPL_POV: { name: 'People, Poverty Indicators', path: '1.3', parentCode: 'PPL', depthLevel: 2, sortOrder: 3 },
  PPL_SI: { name: 'People, Social Indicators', path: '1.4', parentCode: 'PPL', depthLevel: 2, sortOrder: 4 },
  
  EO: { name: 'Economy and Output', path: '2', parentCode: null, depthLevel: 1, sortOrder: 2 },
  EO_NA: { name: 'Economy and Output, National Accounts', path: '2.1', parentCode: 'EO', depthLevel: 2, sortOrder: 1 },
  EO_NA_CURR: { name: 'Economy and Output, National Accounts, At Current Prices', path: '2.1.1', parentCode: 'EO_NA', depthLevel: 3, sortOrder: 1 },
  EO_NA_CURR_GDP_EXP: { name: 'Gross domestic product by expenditure at current prices', path: '2.1.1.1', parentCode: 'EO_NA_CURR', depthLevel: 4, sortOrder: 1 },
  EO_NA_CURR_GDP_SOD: { name: 'Structure of Demand (% of GDP at current market prices)', path: '2.1.1.2', parentCode: 'EO_NA_CURR', depthLevel: 4, sortOrder: 2 },
  EO_NA_CURR_GDP_SOO: { name: 'Structure of Output (% of GDP at current market prices)', path: '2.1.1.3', parentCode: 'EO_NA_CURR', depthLevel: 4, sortOrder: 3 },
  EO_NA_CURR_GVA: { name: 'Gross value added by industry at current prices', path: '2.1.1.4', parentCode: 'EO_NA_CURR', depthLevel: 4, sortOrder: 4 },
  EO_NA_CONST: { name: 'Economy and Output, National Accounts, At Constant Prices', path: '2.1.2', parentCode: 'EO_NA', depthLevel: 3, sortOrder: 2 },
  EO_NA_CONST_GDP_EXP: { name: 'Gross domestic product by expenditure at constant prices', path: '2.1.2.1', parentCode: 'EO_NA_CONST', depthLevel: 4, sortOrder: 1 },
  EO_NA_CONST_GOD: { name: 'Growth of Demand (% annual change)', path: '2.1.2.2', parentCode: 'EO_NA_CONST', depthLevel: 4, sortOrder: 2 },
  EO_NA_CONST_GOO: { name: 'Growth of Output (% annual change)', path: '2.1.2.3', parentCode: 'EO_NA_CONST', depthLevel: 4, sortOrder: 3 },
  EO_NA_CONST_GVA: { name: 'Gross value added by industry at constant prices', path: '2.1.2.4', parentCode: 'EO_NA_CONST', depthLevel: 4, sortOrder: 4 },
  EO_NA_INV_FIN: { name: 'Economy and Output, National Accounts, Investment Financing at Current Prices', path: '2.1.3', parentCode: 'EO_NA', depthLevel: 3, sortOrder: 3 },
  EO_PRIX: { name: 'Economy and Output, Production Index', path: '2.2', parentCode: 'EO', depthLevel: 2, sortOrder: 2 },
  
  MFP: { name: 'Money, Finance, and Prices', path: '3', parentCode: null, depthLevel: 1, sortOrder: 3 },
  MFP_PR: { name: 'Money, Finance, and Prices, Prices', path: '3.1', parentCode: 'MFP', depthLevel: 2, sortOrder: 1 },
  MFP_MF: { name: 'Money, Finance, and Prices, Money and Finance', path: '3.2', parentCode: 'MFP', depthLevel: 2, sortOrder: 2 },
  MFP_XR: { name: 'Money, Finance, and Prices, Exchange Rates', path: '3.3', parentCode: 'MFP', depthLevel: 2, sortOrder: 3 },
  
  GLB: { name: 'Globalization', path: '4', parentCode: null, depthLevel: 1, sortOrder: 4 },
  GLB_ET: { name: 'Globalization, External Trade', path: '4.1', parentCode: 'GLB', depthLevel: 2, sortOrder: 1 },
  GLB_BP: { name: 'Globalization, Balance of Payments', path: '4.2', parentCode: 'GLB', depthLevel: 2, sortOrder: 2 },
  GLB_IR: { name: 'Globalization, International Reserves', path: '4.3', parentCode: 'GLB', depthLevel: 2, sortOrder: 3 },
  GLB_EI: { name: 'Globalization, External Indebtedness', path: '4.4', parentCode: 'GLB', depthLevel: 2, sortOrder: 4 },
  GLB_CF: { name: 'Globalization, Capital Flows', path: '4.5', parentCode: 'GLB', depthLevel: 2, sortOrder: 5 },
  GLB_TM: { name: 'Globalization, Tourism', path: '4.6', parentCode: 'GLB', depthLevel: 2, sortOrder: 6 },
  
  TC: { name: 'Transport and Communication', path: '5', parentCode: null, depthLevel: 1, sortOrder: 5 },
  TC_TR: { name: 'Transport and Communication, Transport', path: '5.1', parentCode: 'TC', depthLevel: 2, sortOrder: 1 },
  TC_COM: { name: 'Transport and Communication, Communications', path: '5.2', parentCode: 'TC', depthLevel: 2, sortOrder: 2 },
  
  EGELC: { name: 'Energy and Electricity', path: '6', parentCode: null, depthLevel: 1, sortOrder: 6 },
  EGELC_EG: { name: 'Energy and Electricity, Energy', path: '6.1', parentCode: 'EGELC', depthLevel: 2, sortOrder: 1 },
  EGELC_ELC: { name: 'Energy and Electricity, Electricity', path: '6.2', parentCode: 'EGELC', depthLevel: 2, sortOrder: 2 },
  
  ENV: { name: 'Environment And Climate Change', path: '7', parentCode: null, depthLevel: 1, sortOrder: 7 },
  ENV_LD: { name: 'Land', path: '7.1', parentCode: 'ENV', depthLevel: 2, sortOrder: 1 },
  ENV_PN: { name: 'Air Pollution', path: '7.2', parentCode: 'ENV', depthLevel: 2, sortOrder: 2 },
  ENV_FW: { name: 'Fresh Water', path: '7.3', parentCode: 'ENV', depthLevel: 2, sortOrder: 3 },
  ENV_CC: { name: 'Climate And Climate-related Disaster', path: '7.4', parentCode: 'ENV', depthLevel: 2, sortOrder: 4 },
  ENV_GGE: { name: 'Greenhouse Gas Emissions', path: '7.5', parentCode: 'ENV', depthLevel: 2, sortOrder: 5 },
  
  GG: { name: 'Government and Governance', path: '8', parentCode: null, depthLevel: 1, sortOrder: 8 },
  GG_GF: { name: 'Government and Governance, Government Finance', path: '8.1', parentCode: 'GG', depthLevel: 2, sortOrder: 1 },
  GG_GV: { name: 'Government and Governance, Governance', path: '8.2', parentCode: 'GG', depthLevel: 2, sortOrder: 2 },
  
  SDG: { name: 'Sustainable Development Goals (SDGs)', path: '9', parentCode: null, depthLevel: 1, sortOrder: 9 },
  SDG_01: { name: 'Goal 1 - No Poverty', path: '9.1', parentCode: 'SDG', depthLevel: 2, sortOrder: 1 },
  SDG_02: { name: 'Goal 2 - Zero Hunger', path: '9.2', parentCode: 'SDG', depthLevel: 2, sortOrder: 2 },
  SDG_03: { name: 'Goal 3 - Good health and well-being', path: '9.3', parentCode: 'SDG', depthLevel: 2, sortOrder: 3 },
  SDG_04: { name: 'Goal 4 - Quality Education', path: '9.4', parentCode: 'SDG', depthLevel: 2, sortOrder: 4 },
  SDG_05: { name: 'Goal 5 - Gender equality', path: '9.5', parentCode: 'SDG', depthLevel: 2, sortOrder: 5 },
  SDG_06: { name: 'Goal 6 - Clean water and sanitation', path: '9.6', parentCode: 'SDG', depthLevel: 2, sortOrder: 6 },
  SDG_07: { name: 'Goal 7 - Affordable and clean energy', path: '9.7', parentCode: 'SDG', depthLevel: 2, sortOrder: 7 },
  SDG_08: { name: 'Goal 8 - Decent work and economic growth', path: '9.8', parentCode: 'SDG', depthLevel: 2, sortOrder: 8 },
  SDG_09: { name: 'Goal 9 - Industry, Innovation, and Infrastructure', path: '9.9', parentCode: 'SDG', depthLevel: 2, sortOrder: 9 },
  SDG_10: { name: 'Goal 10 - Reduced inequality', path: '9.10', parentCode: 'SDG', depthLevel: 2, sortOrder: 10 },
  SDG_11: { name: 'Goal 11 - Sustainable cities and communities', path: '9.11', parentCode: 'SDG', depthLevel: 2, sortOrder: 11 },
  SDG_12: { name: 'Goal 12 - Responsible consumption and production', path: '9.12', parentCode: 'SDG', depthLevel: 2, sortOrder: 12 },
  SDG_13: { name: 'Goal 13 - Climate action', path: '9.13', parentCode: 'SDG', depthLevel: 2, sortOrder: 13 },
  SDG_14: { name: 'Goal 14 - Life below water', path: '9.14', parentCode: 'SDG', depthLevel: 2, sortOrder: 14 },
  SDG_15: { name: 'Goal 15 - Life on land', path: '9.15', parentCode: 'SDG', depthLevel: 2, sortOrder: 15 },
  SDG_16: { name: 'Goal 16 - Peace, justice and strong institutions', path: '9.16', parentCode: 'SDG', depthLevel: 2, sortOrder: 16 },
  SDG_17: { name: 'Goal 17 - Partnership for the goals', path: '9.17', parentCode: 'SDG', depthLevel: 2, sortOrder: 17 },
 
  // ARIC (Prefix 10.x - placed just below SDGs at root level)
  ARIC: { name: 'Regional Cooperation and Integration', path: '10', parentCode: null, depthLevel: 1, sortOrder: 10 },
  ARIC_DAF_TRADE: { name: 'Trade by Partner Economies', path: '10.1', parentCode: 'ARIC', depthLevel: 2, sortOrder: 1 },
  ARIC_DAF_FDI: { name: 'Foreign Direct Investment by Partner Economies', path: '10.2', parentCode: 'ARIC', depthLevel: 2, sortOrder: 2 },
  ARIC_DAF_FIN: { name: 'Finance by Partner Economies', path: '10.3', parentCode: 'ARIC', depthLevel: 2, sortOrder: 3 },
  ARIC_DAF_PPL: { name: 'Movement of People by Partner Economies', path: '10.4', parentCode: 'ARIC', depthLevel: 2, sortOrder: 4 }
};

async function main() {
  console.log('--- Starting Categories Hierarchy Migration ---');

  // 0. Update all existing categories to a temporary hierarchyPath to avoid unique constraint collisions
  console.log('Temporarily clearing hierarchyPath unique values...');
  const categories = await prisma.frontEndCategory.findMany({
    where: { categorySetCode: 'DATA_EXPLORER' }
  });
  for (const cat of categories) {
    await prisma.frontEndCategory.update({
      where: { id: cat.id },
      data: { hierarchyPath: `temp-${cat.code}-${cat.id}` }
    });
  }
  console.log('Temporary hierarchyPaths set.');

  // Clean up any old ARIC_TITLE category if it exists
  try {
    await prisma.frontEndCategory.delete({
      where: {
        categorySetCode_code: {
          categorySetCode: 'DATA_EXPLORER',
          code: 'ARIC_TITLE'
        }
      }
    });
    console.log('Deleted old ARIC_TITLE category');
  } catch (e) {}

  // 1. Clean up old grouping title categories - this will be handled at the end of the script after children are updated and unlinked.

  // 2. Clean up old EEMRIOT title and sub-categories
  try {
    // Delete old mappings under ENV_GGE_EEMRIOT to prevent duplicate mappings or foreign key errors
    await prisma.frontEndCategoryIndicator.deleteMany({
      where: {
        categorySetCode: 'DATA_EXPLORER',
        categoryCode: { in: ['ENV_GGE_EEMRIOT', 'EEMRIOT_TITLE'] }
      }
    });

    await prisma.frontEndCategory.delete({
      where: {
        categorySetCode_code: {
          categorySetCode: 'DATA_EXPLORER',
          code: 'ENV_GGE_EEMRIOT'
        }
      }
    });

    await prisma.frontEndCategory.delete({
      where: {
        categorySetCode_code: {
          categorySetCode: 'DATA_EXPLORER',
          code: 'EEMRIOT_TITLE'
        }
      }
    });
    console.log('Cleaned up old EEMRIOT specific categories');
  } catch (e) {
    console.log('EEMRIOT category cleanup note:', (e as Error).message);
  }

  // 3. Update paths for all other categories
  for (const [code, info] of Object.entries(newPaths)) {
    const parentCode = info.parentCode;

    await prisma.frontEndCategory.upsert({
      where: {
        categorySetCode_code: {
          categorySetCode: 'DATA_EXPLORER',
          code: code
        }
      },
      update: {
        parentCode: parentCode,
        hierarchyPath: info.path,
        depthLevel: info.depthLevel,
        sortOrder: info.sortOrder
      },
      create: {
        categorySetCode: 'DATA_EXPLORER',
        code: code,
        name: info.name,
        slug: info.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        parentCode: parentCode,
        hierarchyPath: info.path,
        depthLevel: info.depthLevel,
        sortOrder: info.sortOrder,
        isVisible: true
      }
    });
    console.log(`Migrated Category path: ${code} -> ${info.path} (Parent: ${parentCode})`);
  }

  // Map EEMRIOT indicator directly under the main Greenhouse Gas Emissions category (ENV_GGE)
  await prisma.frontEndCategoryIndicator.upsert({
    where: {
      categorySetCode_categoryCode_datasetCode_sourceCodeListCode_indicatorCode: {
        categorySetCode: 'DATA_EXPLORER',
        categoryCode: 'ENV_GGE',
        datasetCode: 'EEMRIOT',
        sourceCodeListCode: 'CL_EEMRIOT_INDICATORS',
        indicatorCode: 'EN_ATM_GHGT_KT_CE'
      }
    },
    update: { agencyCode: 'ADB', sortOrder: 1 },
    create: {
      categorySetCode: 'DATA_EXPLORER',
      categoryCode: 'ENV_GGE',
      agencyCode: 'ADB',
      datasetCode: 'EEMRIOT',
      sourceCodeListCode: 'CL_EEMRIOT_INDICATORS',
      indicatorCode: 'EN_ATM_GHGT_KT_CE',
      sortOrder: 1
    }
  });


  // 4. Clean up any obsolete categories that are still temp- (which means they are not in our newPaths map and have been unlinked)
  const remainingTemp = await prisma.frontEndCategory.findMany({
    where: {
      categorySetCode: 'DATA_EXPLORER',
      hierarchyPath: { startsWith: 'temp-' }
    }
  });
  if (remainingTemp.length > 0) {
    for (const r of remainingTemp) {
      try {
        await prisma.frontEndCategoryIndicator.deleteMany({
          where: {
            categorySetCode: 'DATA_EXPLORER',
            categoryCode: r.code
          }
        });
        await prisma.frontEndCategory.delete({
          where: { id: r.id }
        });
        console.log(`Deleted obsolete category: ${r.code}`);
      } catch (err) {
        console.error(`Failed to delete obsolete category ${r.code}:`, (err as Error).message);
      }
    }
  }

  console.log('--- Categories Hierarchy Migration Completed Successfully ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
