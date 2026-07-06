import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Load compiled indicator knowledge
let indicatorKnowledge: Record<string, any> = {};
try {
  const jsonPath = path.resolve(process.cwd(), 'app/data-explorer/indicator_knowledge.json');
  if (fs.existsSync(jsonPath)) {
    indicatorKnowledge = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load indicator knowledge JSON:', e);
}

// Load compiled machine-learned data profiles
let dataProfiles: any = { indicatorProfiles: {}, correlationMatrix: {} };
try {
  const jsonPath = path.resolve(process.cwd(), 'app/data-explorer/data_profiles.json');
  if (fs.existsSync(jsonPath)) {
    dataProfiles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load data profiles JSON:', e);
}

// Fallback regional definitions if database definitions are incomplete
const REGIONAL_FALLBACKS: Record<string, string[]> = {
  'southeast asia': ['ARM', 'AZE', 'BGD', 'BRU', 'CAM', 'GEO', 'IND', 'INA', 'LAO', 'MAL', 'MYA', 'PHI', 'SIN', 'THA', 'VIE'], // standard ASEAN + some available economies in database
  'south asia': ['BGD', 'BHU', 'IND', 'NEP', 'PAK', 'SRI'],
  'east asia': ['CHN', 'HKG', 'JPN', 'KOR', 'MON', 'TAI'],
  'pacific': ['FIJ', 'PNG', 'SAM', 'SOL', 'TON', 'VAN', 'FSM']
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1].content.toLowerCase().trim();
    
    // API keys are securely resolved on the backend (Vercel env)
    const apiProvider = process.env.MISTRAL_API_KEY ? 'mistral' : 'gemini';
    const activeKey = (apiProvider === 'mistral' ? process.env.MISTRAL_API_KEY : process.env.GEMINI_API_KEY) || '';

    // 1. Check if user prompt is asking to select indicators/countries (conversational dashboard intent)
    // We parse target economies, indicators, and periods from prompt
    const { resolvedIndicator, resolvedEconomy, resolvedGroup, resolvedPeriods, matchedIndicators, requiresClarification } = await resolveQueryParameters(lastUserMessage);

    // If clarification is required, return a clarification block
    if (requiresClarification && matchedIndicators.length > 1) {
      return NextResponse.json({
        type: 'clarification',
        message: `I found multiple indicators relating to your request. Which of these would you like to build your dashboard for?`,
        options: matchedIndicators.map(ind => ({
          code: ind.code,
          name: ind.name,
          description: ind.description
        }))
      });
    }

    // Resolve target economies (include group member expansion if group name present)
    let targetEconomies: string[] = [];
    let isGroupAggregation = false;
    let groupName = '';

    if (resolvedGroup) {
      isGroupAggregation = true;
      groupName = resolvedGroup;
      // Resolve member economies
      const groupEco = await prisma.economy.findFirst({
        where: {
          OR: [
            { code: resolvedGroup.toUpperCase() },
            { name: { contains: resolvedGroup, mode: 'insensitive' } }
          ]
        }
      });

      if (groupEco) {
        const members = await prisma.regionalDefinition.findMany({
          where: { groupEconomyCode: groupEco.code },
          select: { memberEconomyCode: true }
        });
        targetEconomies = members.map(m => m.memberEconomyCode);
      }
      
      if (targetEconomies.length === 0) {
        // Fallback standard mappings
        const fallbackKey = resolvedGroup.toLowerCase();
        for (const [key, list] of Object.entries(REGIONAL_FALLBACKS)) {
          if (fallbackKey.includes(key) || key.includes(fallbackKey)) {
            targetEconomies = list;
            break;
          }
        }
      }
    } else if (resolvedEconomy) {
      const eco = await prisma.economy.findFirst({
        where: {
          OR: [
            { code: resolvedEconomy.toUpperCase() },
            { name: { contains: resolvedEconomy, mode: 'insensitive' } }
          ]
        },
        select: { code: true }
      });
      if (eco) targetEconomies = [eco.code];
    }

    if (targetEconomies.length === 0) {
      // Default to PHI if nothing matches
      targetEconomies = ['PHI'];
    }

    let economyName = 'Philippines';
    const ecoDb = await prisma.economy.findFirst({
      where: { code: targetEconomies[0] },
      select: { name: true }
    });
    if (ecoDb) economyName = ecoDb.name;

    // Resolve Periods
    let periods = resolvedPeriods;
    if (periods.length === 0) {
      // Default to last 10 periods
      periods = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
    }

    const isReportRequest = lastUserMessage.includes('report') || lastUserMessage.includes('dashboard') || lastUserMessage.includes('economy') || lastUserMessage.includes('outlook') || (!resolvedIndicator && resolvedEconomy);

    if (isReportRequest) {
      // 1. Determine relevant indicators dynamically based on prompt intent
      const includeDemographics = lastUserMessage.includes('population') || lastUserMessage.includes('demographic') || lastUserMessage.includes('labor') || lastUserMessage.includes('people') || lastUserMessage.includes('unemployment') || (!lastUserMessage.includes('economy') && !lastUserMessage.includes('gdp') && !lastUserMessage.includes('inflation'));
      const includeEconomy = lastUserMessage.includes('economy') || lastUserMessage.includes('gdp') || lastUserMessage.includes('growth') || lastUserMessage.includes('inflation') || lastUserMessage.includes('cpi') || lastUserMessage.includes('trade') || (!lastUserMessage.includes('population') && !lastUserMessage.includes('demographic'));

      const reportIndicators = [];
      if (includeEconomy) {
        reportIndicators.push(
          { code: 'NGDPR_GR', name: 'GDP Growth Rate', category: 'Economy & Growth', isPercent: true },
          { code: 'NGDP_XDC', name: 'GDP at current prices', category: 'Economy & Growth' },
          { code: 'CPI_PC', name: 'CPI Inflation', category: 'Economy & Growth', isPercent: true },
          // Sectoral GDP Structure
          { code: 'NGDPSO_AGR_XGDP_PS', name: 'Agriculture value-added (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'NGDPSO_IND_XGDP_PS', name: 'Industry value-added (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'NGDPSO_SER_XGDP_PS', name: 'Services value-added (% of GDP)', category: 'Economy & Growth', isPercent: true },
          // Additional key indicators by relevance
          { code: 'TRADESHARE_INT', name: 'Trade Share (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'BXG_BP6_XGDP_PS', name: 'Exports of Goods and Services (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'BMG_BP6_XGDP_PS', name: 'Imports of Goods and Services (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'DT_DOD_DECT_GDP_ZS_PS', name: 'External Debt (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'BX_TRF_PWKR_DT_GD_ZS', name: 'Remittances Inflows (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'FDI_CC_SHARE_BOP', name: 'Inward FDI Share (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'GX_G14_GG_XGDP_PS', name: 'Government Expenditure (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'GR_G14_GG_XGDP_PS', name: 'Government Revenue (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'FM2_XGDP_PS', name: 'Money Supply (% of GDP)', category: 'Economy & Growth', isPercent: true },
          { code: 'FM2_PTX_PS', name: 'Money Supply Growth Rate (% annual)', category: 'Economy & Growth', isPercent: true }
        );
      }
      if (includeDemographics) {
        reportIndicators.push(
          { code: 'LP_PE_NUM_MOP', name: 'Total Population', category: 'Demographics' },
          { code: 'LP_MOP_PTX_PS', name: 'Population growth rate', category: 'Demographics', isPercent: true },
          { code: 'LLF_PE_NUM', name: 'Labor Force', category: 'Demographics' },
          { code: 'LUR_PT', name: 'Unemployment Rate', category: 'Demographics', isPercent: true }
        );
      }

      const multipliers = await prisma.commonMultiplier.findMany();
      const multMap = new Map(multipliers.map(m => [m.code, m]));

      const units = await prisma.commonUnit.findMany();
      const unitMap = new Map(units.map(u => [u.code, u.name]));

      const indicatorsDb = await prisma.indicator.findMany({
        where: { code: { in: reportIndicators.map(r => r.code) } },
        select: { code: true, source: true, methodology: true }
      });
      const indicatorDbMap = new Map(indicatorsDb.map(i => [i.code, i]));

      const observations = await prisma.observation.findMany({
        where: {
          indicatorCode: { in: reportIndicators.map(r => r.code) },
          economyCode: { in: targetEconomies },
          period: { in: periods },
          isPublished: true,
          deletedAt: null
        },
        select: {
          indicatorCode: true,
          economyCode: true,
          period: true,
          obsValue: true,
          unitCode: true,
          unitMultCode: true
        }
      });

      const formatDynamicValue = (val: number, multiplierFactor: number, unitName: string, isPercent?: boolean) => {
        if (isPercent) {
          return {
            valueStr: val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
            unitStr: '%'
          };
        }

        const absoluteValue = val * multiplierFactor;
        let scale = 1;
        let suffix = '';

        if (absoluteValue >= 1e12) {
          scale = 1e12;
          suffix = 'Trillion';
        } else if (absoluteValue >= 1e9) {
          scale = 1e9;
          suffix = 'Billion';
        } else if (absoluteValue >= 1e6) {
          scale = 1e6;
          suffix = 'Million';
        } else if (absoluteValue >= 1e3) {
          scale = 1e3;
          suffix = 'Thousand';
        } else {
          scale = 1;
          suffix = '';
        }

        const scaledVal = absoluteValue / scale;
        const valueStr = scaledVal.toLocaleString(undefined, { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 2 
        });

        let cleanUnit = unitName || '';
        if (cleanUnit.toLowerCase() === 'percent' || cleanUnit.toLowerCase() === 'percentage' || cleanUnit === '%') {
          return { valueStr, unitStr: '%' };
        }

        let unitStr = '';
        if (suffix) {
          if (cleanUnit && cleanUnit.toLowerCase() !== 'persons' && cleanUnit.toLowerCase() !== 'units') {
            unitStr = `${suffix} ${cleanUnit}`;
          } else {
            unitStr = suffix;
          }
        } else {
          if (cleanUnit && cleanUnit.toLowerCase() !== 'persons' && cleanUnit.toLowerCase() !== 'units') {
            unitStr = cleanUnit;
          } else {
            unitStr = '';
          }
        }

        return { valueStr, unitStr };
      };

      const reportData: Record<string, any> = {};
      for (const repInd of reportIndicators) {
        const indObs = observations.filter(o => o.indicatorCode === repInd.code);
        if (indObs.length === 0) continue;
        
        const firstObs = indObs[0];
        const mult = firstObs.unitMultCode ? multMap.get(firstObs.unitMultCode) : undefined;
        const multiplierFactor = mult?.factor ? Number(mult.factor) : 1;
        const unitName = firstObs.unitCode ? (unitMap.get(firstObs.unitCode) || firstObs.unitCode) : '';

        let aggregatedPeriodObs = [];

        if (isGroupAggregation) {
          const periodGroups: Record<string, any[]> = {};
          indObs.forEach(obs => {
            if (!periodGroups[obs.period]) periodGroups[obs.period] = [];
            periodGroups[obs.period].push(obs);
          });

          const isSum = repInd.code === 'LP_PE_NUM_MOP' || repInd.code === 'LLF_PE_NUM';

          for (const period of periods.sort()) {
            const periodObs = periodGroups[period] || [];
            if (periodObs.length === 0) continue;

            let aggregatedValue = null;
            if (isSum) {
              let sum = 0;
              periodObs.forEach(o => {
                if (o.obsValue) sum += Number(o.obsValue);
              });
              aggregatedValue = sum;
            } else {
              const weightInd = 'LP_PE_NUM_MOP';
              const weightObs = await prisma.observation.findMany({
                where: {
                  indicatorCode: weightInd,
                  economyCode: { in: targetEconomies },
                  period: period
                },
                select: { economyCode: true, obsValue: true }
              });

              const weightMap = new Map(weightObs.map(w => [w.economyCode, Number(w.obsValue || 0)]));
              let totalWeight = 0;
              let weightedSum = 0;

              periodObs.forEach(o => {
                const w = weightMap.get(o.economyCode) || 1;
                if (o.obsValue) {
                  weightedSum += Number(o.obsValue) * w;
                  totalWeight += w;
                }
              });

              aggregatedValue = totalWeight > 0 ? (weightedSum / totalWeight) : null;
            }

            if (aggregatedValue !== null) {
              const absoluteValue = aggregatedValue * multiplierFactor;
              let scale = 1;
              if (repInd.isPercent) {
                scale = 1;
              } else if (absoluteValue >= 1e12) {
                scale = 1e12;
              } else if (absoluteValue >= 1e9) {
                scale = 1e9;
              } else if (absoluteValue >= 1e6) {
                scale = 1e6;
              } else if (absoluteValue >= 1e3) {
                scale = 1e3;
              }

              const scaledVal = absoluteValue / scale;

              aggregatedPeriodObs.push({
                period,
                obsValue: Number(scaledVal.toFixed(4)),
                economyCode: 'REGION',
                economyName: groupName.toUpperCase(),
                indicatorCode: repInd.code,
                indicatorName: repInd.name
              });
            }
          }
        } else {
          aggregatedPeriodObs = indObs.map(obs => {
            const rawVal = Number(obs.obsValue || 0);
            const absoluteValue = rawVal * multiplierFactor;
            
            let scale = 1;
            if (repInd.isPercent) {
              scale = 1;
            } else if (absoluteValue >= 1e12) {
              scale = 1e12;
            } else if (absoluteValue >= 1e9) {
              scale = 1e9;
            } else if (absoluteValue >= 1e6) {
              scale = 1e6;
            } else if (absoluteValue >= 1e3) {
              scale = 1e3;
            }

            const scaledVal = absoluteValue / scale;

            return {
              period: obs.period,
              obsValue: Number(scaledVal.toFixed(4)),
              economyCode: obs.economyCode,
              economyName: economyName,
              indicatorCode: obs.indicatorCode,
              indicatorName: repInd.name
            };
          }).sort((a, b) => Number(a.period) - Number(b.period));
        }

        if (aggregatedPeriodObs.length === 0) continue;

        const latest = aggregatedPeriodObs[aggregatedPeriodObs.length - 1];
        const latestValRaw = Number(latest.obsValue);
        const { valueStr, unitStr } = formatDynamicValue(latestValRaw, 1, unitName, repInd.isPercent);
        
        const dbInfo = indicatorDbMap.get(repInd.code);
        reportData[repInd.code] = {
          code: repInd.code,
          name: repInd.name,
          category: repInd.category,
          unit: unitStr,
          data: aggregatedPeriodObs,
          latestValue: valueStr,
          latestYear: latest ? latest.period : null,
          source: dbInfo?.source || 'Key Indicators Database (KIDB)',
          methodology: dbInfo?.methodology || ''
        };
      }

      let summaryText = `Here is the comprehensive multi-indicator economic and demographic dashboard report for **${economyName.toUpperCase()}** from ${periods[0]} to ${periods[periods.length - 1]}.`;
      if (activeKey) {
        try {
          const systemPrompt = `You are a professional economics analyst assistant. Summarize the following multi-indicator economic and demographic report for ${economyName} in a conversational, structured, and insightful manner (approx 120-150 words). Highlight structural trends, population patterns, inflation rates, and GDP performance.
Report Data: ${JSON.stringify(reportData)}`;

          if (apiProvider === 'mistral') {
            const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeKey}`
              },
              body: JSON.stringify({
                model: 'open-mistral-7b',
                messages: [{ role: 'user', content: systemPrompt }]
              })
            });

            if (mistralRes.ok) {
              const resJson = await mistralRes.json();
              const parsedText = resJson.choices?.[0]?.message?.content;
              if (parsedText) summaryText = parsedText;
            }
          } else {
            const geminiRes = await fetch(`${GEMINI_API_URL}?key=${activeKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
              })
            });

            if (geminiRes.ok) {
              const resJson = await geminiRes.json();
              const parsedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (parsedText) summaryText = parsedText;
            }
          }
        } catch (err) {
          console.error('Narrative summary generation failed:', err);
        }
      }

      return NextResponse.json({
        type: 'report',
        summary: summaryText,
        report: {
          economyCode: targetEconomies[0],
          economyName: economyName,
          periods: periods,
          reportData: reportData
        }
      });
    }

    // Single Indicator Flow
    let targetIndicators: string[] = [];
    if (resolvedIndicator) {
      targetIndicators = [resolvedIndicator];
    } else {
      // Default to GDP Growth Rate
      targetIndicators = ['NGDPR_GR'];
    }

    // 2. Fetch observations
    const observations = await prisma.observation.findMany({
      where: {
        indicatorCode: { in: targetIndicators },
        economyCode: { in: targetEconomies },
        period: { in: periods },
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

    // 3. Process Dynamic calculations
    let processedData: any[] = [];
    const kb = indicatorKnowledge[targetIndicators[0]] || { name: 'Indicator', aggregation: 'SUM', unit: 'index' };

    if (isGroupAggregation) {
      const periodGroups: Record<string, any[]> = {};
      observations.forEach(obs => {
        if (!periodGroups[obs.period]) periodGroups[obs.period] = [];
        periodGroups[obs.period].push(obs);
      });

      for (const period of periods.sort()) {
        const periodObs = periodGroups[period] || [];
        if (periodObs.length === 0) continue;

        let aggregatedValue = null;
        if (kb.aggregation === 'SUM') {
          let sum = 0;
          periodObs.forEach(o => {
            if (o.obsValue) sum += Number(o.obsValue);
          });
          aggregatedValue = sum;
        } else {
          const weightInd = kb.weight || 'LP_PE_NUM_MOP';
          const weightObs = await prisma.observation.findMany({
            where: {
              indicatorCode: weightInd,
              economyCode: { in: targetEconomies },
              period: period
            },
            select: { economyCode: true, obsValue: true }
          });

          const weightMap = new Map(weightObs.map(w => [w.economyCode, Number(w.obsValue || 0)]));
          let totalWeight = 0;
          let weightedSum = 0;

          periodObs.forEach(o => {
            const w = weightMap.get(o.economyCode) || 1;
            if (o.obsValue) {
              weightedSum += Number(o.obsValue) * w;
              totalWeight += w;
            }
          });

          aggregatedValue = totalWeight > 0 ? (weightedSum / totalWeight) : null;
        }

        processedData.push({
          period,
          economyCode: 'REGION',
          economyName: groupName.toUpperCase(),
          indicatorCode: targetIndicators[0],
          indicatorName: kb.name,
          obsValue: aggregatedValue !== null ? Number(aggregatedValue.toFixed(4)) : null,
          unit: kb.unit
        });
      }
    } else {
      const economyNames = await prisma.economy.findMany({
        where: { code: { in: targetEconomies } },
        select: { code: true, name: true }
      });
      const ecoMap = new Map(economyNames.map(e => [e.code, e.name]));

      processedData = observations.map(obs => ({
        period: obs.period,
        economyCode: obs.economyCode,
        economyName: ecoMap.get(obs.economyCode) || obs.economyCode,
        indicatorCode: obs.indicatorCode,
        indicatorName: kb.name,
        obsValue: obs.obsValue ? Number(Number(obs.obsValue).toFixed(4)) : null,
        unit: kb.unit
      })).sort((a, b) => Number(a.period) - Number(b.period));
    }

    // 4. Check if Derived Indicator logic applies
    let derivedMessage = '';
    const isGrowthRequest = lastUserMessage.includes('growth') || lastUserMessage.includes('increase') || lastUserMessage.includes('change');
    if (isGrowthRequest && targetIndicators[0] === 'LP_PE_NUM_MOP') {
      const growthData: any[] = [];
      for (let i = 1; i < processedData.length; i++) {
        const prev = processedData[i - 1].obsValue;
        const curr = processedData[i].obsValue;
        if (prev && curr) {
          const rate = ((curr - prev) / prev) * 100;
          growthData.push({
            ...processedData[i],
            indicatorCode: 'LP_MOP_PTX_PS',
            indicatorName: 'Population Growth Rate (AI Calculated)',
            obsValue: Number(rate.toFixed(4)),
            unit: 'Percent (%)'
          });
        }
      }
      processedData = growthData;
      derivedMessage = 'Note: The database did not contain a pre-computed Population Growth indicator, so I dynamically calculated the annual population growth rate (%) from the total population series.';
    }

    // Call Gemini/Mistral API
    let summaryText = `Here is the custom generated dashboard for **${kb.name}** in **${resolvedGroup ? groupName.toUpperCase() : resolvedEconomy ? resolvedEconomy.toUpperCase() : 'PHILIPPINES'}** from ${periods[0]} to ${periods[periods.length - 1]}.`;
    if (derivedMessage) {
      summaryText += `\n\n${derivedMessage}`;
    }

    if (activeKey) {
      try {
        const profile = dataProfiles.indicatorProfiles[targetIndicators[0]] || null;
        let profileContext = '';
        if (profile) {
          profileContext = `Learned Historical Profile & Outliers for ${targetIndicators[0]}:
- Overall historical average across countries: ${profile.average}
- Overall minimum: ${profile.min.value} in ${profile.min.economy} (${profile.min.year})
- Overall maximum: ${profile.max.value} in ${profile.max.economy} (${profile.max.year})
- Historical outlier events identified: ${JSON.stringify(profile.outliers || [])}
`;
        }

        const systemPrompt = `You are a professional economics analyst assistant. Summarize the following data points in a conversational, structured, and insightful manner (approx 120-150 words). Include highlights on trends, highest peak points, and potential structural breaks.
${profileContext}
Data: ${JSON.stringify(processedData)}`;

        if (apiProvider === 'mistral') {
          const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
            },
            body: JSON.stringify({
              model: 'open-mistral-7b',
              messages: [{ role: 'user', content: systemPrompt }]
            })
          });

          if (mistralRes.ok) {
            const resJson = await mistralRes.json();
            const parsedText = resJson.choices?.[0]?.message?.content;
            if (parsedText) summaryText = parsedText;
          }
        } else {
          const geminiRes = await fetch(`${GEMINI_API_URL}?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }]
            })
          });

          if (geminiRes.ok) {
            const resJson = await geminiRes.json();
            const parsedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
            if (parsedText) summaryText = parsedText;
          }
        }
      } catch (apiError) {
        console.error('AI API call failed:', apiError);
      }
    }

    return NextResponse.json({
      type: 'dashboard',
      summary: summaryText,
      dashboard: {
        indicatorCode: targetIndicators[0],
        indicatorName: kb.name,
        economies: targetEconomies,
        periods: periods,
        isGroup: isGroupAggregation,
        groupName: groupName,
        data: processedData
      }
    });

  } catch (err: any) {
    console.error('AI API Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Local semantic helper to parse prompts into structured parameters
async function resolveQueryParameters(prompt: string) {
  const words = prompt.split(' ');
  
  // 1. Resolve Periods (look for 4-digit numbers)
  const resolvedPeriods: string[] = [];
  const yearRegex = /\b(19|20)\d{2}\b/g;
  let match;
  while ((match = yearRegex.exec(prompt)) !== null) {
    resolvedPeriods.push(match[0]);
  }
  
  // 2. Resolve Country / Economy
  let resolvedEconomy = '';
  let resolvedGroup = '';

  const groups = ['southeast asia', 'south asia', 'east asia', 'pacific', 'asean'];
  for (const g of groups) {
    if (prompt.includes(g)) {
      resolvedGroup = g;
      break;
    }
  }

  // If no group matched, look for standard countries
  if (!resolvedGroup) {
    const countries = ['philippines', 'indonesia', 'vietnam', 'thailand', 'malaysia', 'singapore', 'armenia', 'bangladesh', 'georgia', 'bhutan', 'india', 'korea', 'nepal', 'sri lanka'];
    for (const c of countries) {
      if (prompt.includes(c)) {
        resolvedEconomy = c;
        break;
      }
    }
  }

  // 3. Resolve Indicator
  let resolvedIndicator = '';
  let requiresClarification = false;
  let matchedIndicators: any[] = [];

  // Map to core KIDB indicator codes
  if (prompt.includes('gdp growth') || prompt.includes('economic growth')) {
    resolvedIndicator = 'NGDPR_GR';
  } else if (prompt.includes('gdp') || prompt.includes('gross domestic product')) {
    if (prompt.includes('constant')) {
      resolvedIndicator = 'NGDP_R_XDC';
    } else if (prompt.includes('current')) {
      resolvedIndicator = 'NGDP_XDC';
    } else {
      requiresClarification = true;
      matchedIndicators = [
        { code: 'NGDP_XDC', name: 'GDP at current prices (Nominal GDP)', description: 'Gross domestic product in current values.' },
        { code: 'NGDP_R_XDC', name: 'GDP at constant prices (Real GDP)', description: 'Gross domestic product in constant base-year values.' },
        { code: 'NGDPR_GR', name: 'GDP Growth Rate (% annual change)', description: 'Annual percentage growth rate of Gross domestic product.' }
      ];
    }
  } else if (prompt.includes('population growth')) {
    resolvedIndicator = 'LP_MOP_PTX_PS';
  } else if (prompt.includes('population')) {
    if (prompt.includes('growth')) {
      resolvedIndicator = 'LP_MOP_PTX_PS';
    } else {
      requiresClarification = true;
      matchedIndicators = [
        { code: 'LP_PE_NUM_MOP', name: 'Total Population', description: 'Total midyear population.' },
        { code: 'LP_MOP_PTX_PS', name: 'Population growth rate (% annual change)', description: 'Annual population growth rate.' }
      ];
    }
  } else if (prompt.includes('inflation') || prompt.includes('cpi')) {
    resolvedIndicator = 'CPI_PC';
  } else if (prompt.includes('labor force') || prompt.includes('employment')) {
    resolvedIndicator = 'LLF_PE_NUM';
  } else {
    // Fallback search in indicator knowledge
    const matches: any[] = [];
    for (const [code, info] of Object.entries(indicatorKnowledge)) {
      if (prompt.includes(info.name.toLowerCase()) || prompt.includes(code.toLowerCase())) {
        matches.push(info);
      }
    }
    if (matches.length > 1) {
      requiresClarification = true;
      matchedIndicators = matches.slice(0, 5);
    } else if (matches.length === 1) {
      resolvedIndicator = matches[0].code;
    }
  }

  return {
    resolvedIndicator,
    resolvedEconomy,
    resolvedGroup,
    resolvedPeriods: resolvedPeriods.sort(),
    matchedIndicators,
    requiresClarification
  };
}
