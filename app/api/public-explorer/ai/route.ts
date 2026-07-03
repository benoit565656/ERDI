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
    const { messages, apiKey, apiProvider } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1].content.toLowerCase().trim();
    const activeKey = apiKey || (apiProvider === 'mistral' ? process.env.MISTRAL_API_KEY : process.env.GEMINI_API_KEY) || '';

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

    // Resolve Indicators
    let targetIndicators: string[] = [];
    if (resolvedIndicator) {
      targetIndicators = [resolvedIndicator];
    } else {
      // Default to GDP growth NY_GDP_MKTP_KD_ZG or total GDP NY_GDP_MKTP_CD
      targetIndicators = ['NY_GDP_MKTP_KD_ZG'];
    }

    // Resolve Periods
    let periods = resolvedPeriods;
    if (periods.length === 0) {
      // Default to last 10 periods
      periods = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
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
        obsValue: true,
        unitCode: true,
        unitMultCode: true
      }
    });

    // 3. Process Dynamic calculations (Custom regional aggregations and derived indicators)
    let processedData: any[] = [];
    const kb = indicatorKnowledge[targetIndicators[0]] || { name: 'Indicator', aggregation: 'SUM', unit: 'index' };

    if (isGroupAggregation) {
      // Aggregate Southeast Asia or custom region values
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
          // Sum up values
          let sum = 0;
          periodObs.forEach(o => {
            if (o.obsValue) sum += Number(o.obsValue);
          });
          aggregatedValue = sum;
        } else {
          // Weighted average (e.g. GDP growth weighted by Nominal GDP, or inflation weighted by Population)
          const weightInd = kb.weight || 'NY_GDP_MKTP_CD';
          
          // Fetch weights for all members for this year
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
            const w = weightMap.get(o.economyCode) || 1; // fallback weight is 1
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
      // Single Country mapping
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
    // If the user asked for "population growth" but we only processed "total population"
    let derivedMessage = '';
    const isGrowthRequest = lastUserMessage.includes('growth') || lastUserMessage.includes('increase') || lastUserMessage.includes('change');
    if (isGrowthRequest && targetIndicators[0] === 'SP_POP_TOTL') {
      // Calculate growth rate dynamically!
      const growthData: any[] = [];
      for (let i = 1; i < processedData.length; i++) {
        const prev = processedData[i - 1].obsValue;
        const curr = processedData[i].obsValue;
        if (prev && curr) {
          const rate = ((curr - prev) / prev) * 100;
          growthData.push({
            ...processedData[i],
            indicatorCode: 'SP_POP_GROW_DERIVED',
            indicatorName: 'Population Growth Rate (AI Calculated)',
            obsValue: Number(rate.toFixed(4)),
            unit: 'Percent (%)'
          });
        }
      }
      processedData = growthData;
      derivedMessage = 'Note: The database did not contain a pre-computed Population Growth indicator, so I dynamically calculated the annual population growth rate (%) from the total population series.';
    }

    // Call Gemini API if key is present to generate a narrative summary, otherwise synthesize locally
    let summaryText = `Here is the custom generated dashboard for **${kb.name}** in **${resolvedGroup ? groupName.toUpperCase() : resolvedEconomy ? resolvedEconomy.toUpperCase() : 'PHILIPPINES'}** from ${periods[0]} to ${periods[periods.length - 1]}.`;
    if (derivedMessage) {
      summaryText += `\n\n${derivedMessage}`;
    }

    if (activeKey) {
      try {
        const systemPrompt = `You are a professional economics analyst assistant. Summarize the following data points in a conversational, structured, and insightful manner (approx 120-150 words). Include highlights on trends, highest peak points, and potential structural breaks.
Data: ${JSON.stringify(processedData)}`;

        if (apiProvider === 'mistral') {
          // Call Mistral API
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
            if (parsedText) {
              summaryText = parsedText;
            }
          }
        } else {
          // Call Gemini API
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
            if (parsedText) {
              summaryText = parsedText;
            }
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

  // Search local indicator knowledge
  const matches: any[] = [];
  if (prompt.includes('gdp') || prompt.includes('gross domestic product')) {
    // Collect all GDP indicators
    for (const [code, info] of Object.entries(indicatorKnowledge)) {
      if (info.name.toLowerCase().includes('gdp') || info.name.toLowerCase().includes('gross domestic product')) {
        matches.push(info);
      }
    }
  } else if (prompt.includes('population') || prompt.includes('people')) {
    // Collect all population indicators
    for (const [code, info] of Object.entries(indicatorKnowledge)) {
      if (info.name.toLowerCase().includes('population')) {
        matches.push(info);
      }
    }
  } else if (prompt.includes('inflation') || prompt.includes('price')) {
    // Collect all inflation indicators
    for (const [code, info] of Object.entries(indicatorKnowledge)) {
      if (info.name.toLowerCase().includes('inflation') || info.name.toLowerCase().includes('cpi') || info.name.toLowerCase().includes('price')) {
        matches.push(info);
      }
    }
  }

  if (matches.length > 1) {
    // If the user already selected one specifically in their response (e.g. by code or exact name)
    const exactMatch = matches.find(m => prompt.includes(m.code.toLowerCase()) || prompt.includes(m.name.toLowerCase()));
    if (exactMatch) {
      resolvedIndicator = exactMatch.code;
    } else {
      requiresClarification = true;
      matchedIndicators = matches.slice(0, 5); // return top 5 options
    }
  } else if (matches.length === 1) {
    resolvedIndicator = matches[0].code;
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
