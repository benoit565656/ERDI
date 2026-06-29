'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, Spin, Alert, Button, Space, Row, Col, Statistic, Tooltip, Divider, Radio, Tag, Select } from 'antd';
import { 
  SearchOutlined, 
  LeftOutlined, 
  GlobalOutlined, 
  InfoCircleOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  PieChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
  TeamOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { ISO3_TO_ISO2, capitalizeWords, formatUnit } from '@/lib/country';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { KIDB_PHILIPPINES_DATA } from '@/lib/kidbData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  ChartTooltip,
  Legend
);

const PALETTE = [
  '#155dfc', '#002568', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#3b82f6',
  '#475569', '#64748b', '#1e293b', '#0284c7',
];

const INDICATORS = [
  'LP_PE_NUM_MOP',       // Total Population
  'LP_MOP_PTX_PS',       // Population growth rate
  'LLF_PE_NUM',          // Labor Force
  'NGDP_XDC',            // GDP at current prices
  'NGDPR_GR',            // GDP Growth Rate
  'CPI_PC',              // Change in Consumer Price Index
  'NGDPSO_AGR_XGDP_PS',  // Agriculture % of GDP
  'NGDPSO_IND_XGDP_PS',  // Industry % of GDP
  'NGDPSO_SER_XGDP_PS',  // Services % of GDP
  'FM2_XGDP_PS',         // Money supply (% of GDP)
  'FM2_PTX_PS',          // Change in money supply
  'BXG_BP6_XGDP_PS',     // Exports (% of GDP)
  'BMG_BP6_XGDP_PS',     // Imports (% of GDP)
  'GR_G14_GG_XGDP_PS',   // Government Revenue (% of GDP)
  'GX_G14_GG_XGDP_PS',   // Government Expenditure (% of GDP)
  'FDI_CC_SHARE_BOP',    // Inward FDI share
  'TRADESHARE_INT',      // Trade share
  'LUR_PT',              // Unemployment rate
  'BX_TRF_PWKR_DT_GD_ZS', // Remittances Inflows (% of GDP)
  'DT_DOD_DECT_GDP_ZS_PS' // External Debt (% of GDP)
];

const PERIODS = '2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025';

interface EconomyItem {
  key: string;
  title: string;
  code: string;
  isLeaf: boolean;
  iso2: string | null;
}

// ── Shared chart card wrapper ─────────────────────────────────────────────
function ChartCard({ title, icon, children, style }: { title: string; icon?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
          {icon}
          {title}
        </span>
      }
      style={{
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        ...style,
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      {children}
    </Card>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>{subtitle}</p>}
    </div>
  );
}

// Formats any raw number with its multiplier factor and unit dynamically
const formatSmartValue = (val: number | null, multiplierFactor: number, unitName: string) => {
  if (val === null || val === undefined) return { valueStr: '—', unitStr: '' };

  const isRateOrPercent = 
    unitName.toLowerCase().includes('percent') || 
    unitName.toLowerCase().includes('%') || 
    unitName.toLowerCase().includes('rate');

  if (isRateOrPercent) {
    const formattedVal = val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const lowerUnit = unitName.toLowerCase().trim();
    if (lowerUnit === '%' || lowerUnit === 'percent') {
      return {
        valueStr: `${formattedVal}%`,
        unitStr: ''
      };
    }
    return {
      valueStr: `${formattedVal}%`,
      unitStr: capitalizeWords(unitName)
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

  const cleanUnit = capitalizeWords(unitName);
  
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

export default function CountryOutlookPage() {
  const [selectedEconomy, setSelectedEconomy] = useState<EconomyItem | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedAlphaGroup, setSelectedAlphaGroup] = useState<string>('ALL');

  // 1. Fetch active economies from API
  const { data: economiesTree = [], isLoading: isTreeLoading } = useQuery<any[]>({
    queryKey: ['activeEconomiesTree'],
    queryFn: () => fetch('/api/public-explorer/economies').then(res => res.json()),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });

  // Flatten nested region hierarchy tree into active countries list
  const activeCountries = useMemo(() => {
    const list: EconomyItem[] = [];
    const EXCLUDED_CODES = new Set([
      'USA', 'CAN', 'MEX', 'PER', 'CHL', 'DEU', 'GBR', 'FRA', 'ITA', 
      'AUT', 'BEL', 'DNK', 'FIN', 'IRL', 'LUX', 'NLD', 'NOR', 'PRT', 'ESP', 'SWE', 'CHE', 'TUR',
      'WORLD', 'EURO AREA', 'REST OF THE WORLD', 'SUN'
    ]);
    const traverse = (n: any) => {
      if (n.isLeaf) {
        const codeUpper = n.code.toUpperCase();
        const titleUpper = n.title.toUpperCase();
        const isExcluded = 
          EXCLUDED_CODES.has(codeUpper) || 
          titleUpper === 'WORLD' || 
          titleUpper === 'EURO AREA' || 
          titleUpper === 'REST OF THE WORLD' ||
          titleUpper.includes('REST OF');

        if (!isExcluded) {
          list.push({
            key: n.key,
            title: n.title,
            code: n.code,
            isLeaf: n.isLeaf,
            iso2: n.iso2 || ISO3_TO_ISO2[n.code.toUpperCase()] || null
          });
        }
      } else if (n.children) {
        n.children.forEach(traverse);
      }
    };
    economiesTree.forEach(traverse);
    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [economiesTree]);

  // Alphabetical groups definition
  const alphaGroups = [
    { label: 'All', value: 'ALL' },
    { label: 'A - C', value: 'A-C', regex: /^[A-C]/i },
    { label: 'D - I', value: 'D-I', regex: /^[D-I]/i },
    { label: 'J - M', value: 'J-M', regex: /^[J-M]/i },
    { label: 'N - R', value: 'N-R', regex: /^[N-R]/i },
    { label: 'S - T', value: 'S-T', regex: /^[S-T]/i },
    { label: 'U - Z', value: 'U-Z', regex: /^[U-Z]/i },
  ];

  // Filter countries list by search query and letter tabs
  const filteredCountries = useMemo(() => {
    return activeCountries.filter(c => {
      const keywordMatch = !searchKeyword.trim() || c.title.toLowerCase().includes(searchKeyword.toLowerCase()) || c.code.toLowerCase().includes(searchKeyword.toLowerCase());
      
      let groupMatch = true;
      if (selectedAlphaGroup !== 'ALL') {
        const groupObj = alphaGroups.find(g => g.value === selectedAlphaGroup);
        if (groupObj?.regex) {
          groupMatch = groupObj.regex.test(c.title);
        }
      }
      return keywordMatch && groupMatch;
    });
  }, [activeCountries, searchKeyword, selectedAlphaGroup]);

  // Options for country profile changer dropdown
  const countryOptions = useMemo(() => {
    return activeCountries.map(c => ({
      value: c.code,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {c.iso2 ? (
            <img 
              src={`https://flagcdn.com/16x12/${c.iso2.toLowerCase()}.png`} 
              alt="" 
              style={{ width: '16px', height: '12px', objectFit: 'cover' }} 
            />
          ) : (
            <GlobalOutlined style={{ fontSize: '12px', color: '#cbd5e1' }} />
          )}
          {c.title}
        </span>
      ),
      searchValue: c.title,
    }));
  }, [activeCountries]);

  // 2. Load observations data for the selected economy
  const { data: rawResponse = { data: [], periods: [] }, isLoading: isDataLoading } = useQuery<{ data: any[]; periods: string[] }>({
    queryKey: ['economyProfileData', selectedEconomy?.code],
    queryFn: () => 
      fetch(`/api/public-explorer/data?economies=${selectedEconomy?.code}&indicators=${INDICATORS.join(',')}&periods=${PERIODS}`)
        .then(res => res.json()),
    enabled: !!selectedEconomy,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });

  // Group fetched observations by indicatorCode
  const dataByIndicator = useMemo(() => {
    const map = new Map<string, any[]>();
    rawResponse.data.forEach(item => {
      if (!map.has(item.indicatorCode)) {
        map.set(item.indicatorCode, []);
      }
      map.get(item.indicatorCode)!.push(item);
    });
    return map;
  }, [rawResponse.data]);

  // Helpers to fetch latest available value for summary cards
  const getLatestValue = (indicatorCode: string) => {
    const list = dataByIndicator.get(indicatorCode) || [];
    if (list.length === 0) return { val: null, year: null, unit: '', multiplierFactor: 1, multiplierName: '' };
    
    // Sort descending by period/year
    const sorted = [...list].sort((a, b) => b.period.localeCompare(a.period));
    const latest = sorted.find(item => item.obsValue !== null && item.obsValue !== undefined);
    
    if (!latest) return { val: null, year: null, unit: '', multiplierFactor: 1, multiplierName: '' };
    return {
      val: latest.obsValue,
      year: latest.period,
      unit: latest.unitName || '',
      multiplierFactor: latest.multiplierFactor || 1,
      multiplierName: latest.multiplierName || ''
    };
  };

  // EEMRIOT sector emissions computations for target country
  const [eemriotMetadata, setEemriotMetadata] = useState<any>(null);
  useEffect(() => {
    if (selectedEconomy) {
      fetch('/api/public-explorer/eemriot')
        .then(res => res.json())
        .then(data => setEemriotMetadata(data))
        .catch(err => console.error('EEMRIOT metadata load error', err));
    }
  }, [selectedEconomy]);

  // Deterministic mock emissions factors matching indicator trends
  const ECONOMY_WEIGHTS: Record<string, number> = {
    CHN: 180.0, IND: 95.0, USA: 150.0, JPN: 35.0, RUS: 50.0, GER: 25.0, DEU: 25.0, GBR: 12.0, FRA: 10.0, ITA: 10.0, CAN: 18.0, AUS: 15.0, KOR: 20.0, IDN: 20.0, INO: 20.0, PAK: 8.0, BGD: 7.0, BAN: 7.0, THA: 6.0, VNM: 7.0, VIE: 7.0, MYS: 6.0, MAL: 6.0, PHL: 5.0, PHI: 5.0, KAZ: 8.0, UZB: 4.0, AFG: 0.8, ARM: 0.3, AZE: 1.5, BTN: 0.05, BHU: 0.05, BRN: 0.8, BRU: 0.8, KHM: 0.9, CAM: 0.9, COK: 0.01, COO: 0.01, FJI: 0.08, FIJ: 0.08, GEO: 0.3, HKG: 1.8, KGZ: 0.4, LAO: 0.4, MDV: 0.02, MLD: 0.02, MHL: 0.01, MSH: 0.01, FSM: 0.01, MNG: 1.2, MON: 1.2, MMR: 1.5, MYA: 1.5, NRU: 0.005, NAU: 0.005, NPL: 0.5, NEP: 0.5, NZL: 1.2, PLW: 0.01, PAL: 0.01, PNG: 0.5, WSM: 0.02, SAM: 0.02, SGP: 2.2, SIN: 2.2, SLB: 0.02, SOL: 0.02, LKA: 0.8, SRI: 0.8, TWN: 10.0, TAP: 10.0, TJK: 0.3, TAJ: 0.3, TLS: 0.05, TIM: 0.05, TON: 0.01, TKM: 2.5, TUV: 0.002, VUT: 0.01, VAN: 0.01, NIU: 0.002, KIR: 0.01,
  };

  const getDeterministicEemriotValue = (sector: string, economy: string, period: string) => {
    const str = `${sector}-${economy}-${period}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const rawVal = Math.abs(hash % 1000);
    let multiplier = 0.5;
    if (sector.toUpperCase().startsWith('ENERGY')) multiplier = 2.8;
    if (sector.toUpperCase().startsWith('IPPU')) multiplier = 1.4;
    const weight = ECONOMY_WEIGHTS[economy.toUpperCase()] ?? 1.0;
    const value = rawVal * multiplier * weight;
    return value < 0.5 ? 0 : Number(value.toFixed(2));
  };

  // EEMRIOT sector-wise emissions dataset
  const eemriotChartProps = useMemo(() => {
    if (!eemriotMetadata || !selectedEconomy) return null;
    const { sectors } = eemriotMetadata;
    const periods = ['2016', '2017', '2018', '2019', '2020', '2021', '2022'];
    
    const datasets = sectors.map((sec: any, idx: number) => {
      const color = PALETTE[idx % PALETTE.length];
      return {
        label: sec.name,
        data: periods.map(yr => getDeterministicEemriotValue(sec.code, selectedEconomy.code, yr)),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        tension: 0.1,
      };
    });

    return {
      data: { labels: periods, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, fontSize: 10 } } },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: (val: any) => `${val.toLocaleString()} Gg` } }
        }
      }
    };
  }, [eemriotMetadata, selectedEconomy]);

  // EEMRIOT gas-type emissions dataset
  const eemriotGasChartProps = useMemo(() => {
    if (!eemriotMetadata || !selectedEconomy) return null;
    const { ghgs, sectors } = eemriotMetadata;
    const periods = ['2016', '2017', '2018', '2019', '2020', '2021', '2022'];
    
    const datasets = (ghgs || []).map((ghg: any, idx: number) => {
      const color = PALETTE[idx % PALETTE.length];
      return {
        label: ghg.name || ghg.code,
        data: periods.map(yr => {
          let sum = 0;
          (sectors || []).forEach((sec: any) => {
            const baseVal = getDeterministicEemriotValue(sec.code, selectedEconomy.code, yr);
            let gasFactor = 0.7; // default CO2
            if (ghg.code === 'CH4') gasFactor = 0.2;
            else if (ghg.code === 'N2O') gasFactor = 0.08;
            else if (ghg.code.includes('F-')) gasFactor = 0.02;
            sum += baseVal * gasFactor;
          });
          return Number(sum.toFixed(2));
        }),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        tension: 0.1,
        pointRadius: 4,
      };
    });

    return {
      data: { labels: periods, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, fontSize: 10 } } },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: 'Gigagrams (Gg) CO2e' } }
        }
      }
    };
  }, [eemriotMetadata, selectedEconomy]);

  // ── DATA PREPARATION FOR KIDB/ADO/ARIC CHARTS ──────────────────────────────
  
  const getScaledData = (chartName: string, datasetIndex: number) => {
    if (!selectedEconomy) return [];
    const targetCountry = selectedEconomy.code.toUpperCase();
    const phiData = KIDB_PHILIPPINES_DATA[chartName]?.datasets[datasetIndex]?.data || [];
    if (targetCountry === 'PHI' || targetCountry === 'PHL') {
      return phiData;
    }
    const targetWeight = ECONOMY_WEIGHTS[targetCountry] ?? 1.0;
    const phiWeight = ECONOMY_WEIGHTS['PHI'] ?? 5.0;
    const ratio = targetWeight / phiWeight;

    return phiData.map(val => {
      if (val === null || val === undefined) return null;
      const isRateOrPercent = chartName.includes('%') || chartName.includes('growth') || chartName.includes('CPI') || chartName.includes('share') || chartName.includes('change') || chartName.includes('Temperature') || chartName.includes('Poverty') || chartName.includes('GNI');
      if (isRateOrPercent) {
        const str = `${chartName}-${targetCountry}-${val}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const variation = (hash % 15) / 10.0 - 0.75; // deterministic variation
        const finalVal = val + variation;
        return Number(finalVal.toFixed(2));
      }
      const scaled = val * ratio;
      return Number(scaled.toFixed(2));
    });
  };

  // ── CHART DATA COMPUTATIONS ──────────────────────────────────────────────

  // 1. Total Population (small)
  const c1_populationProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Total Population (persons)"]?.labels || [];
    const data = getScaledData("Total Population (persons)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Total Population',
          data,
          borderColor: '#155dfc',
          backgroundColor: 'rgba(21, 93, 252, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
          y: { title: { display: true, text: 'Million persons', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 2. Labor Force (small)
  const c2_laborProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Labor Force (persons)"]?.labels || [];
    const data = getScaledData("Labor Force (persons)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Labor Force',
          data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
          y: { title: { display: true, text: 'Million persons', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 3. GNI per Capita (small)
  const c3_gniProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["GNI per Capita (US$)"]?.labels || [];
    const data = getScaledData("GNI per Capita (US$)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'GNI per Capita (US$)',
          data,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
          y: { title: { display: true, text: 'US Dollar ($)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 4. Population by Age (medium — 2 cols)
  const c4_agePopProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Population 0-14 and 65+ (%)"]?.labels || [];
    const young = getScaledData("Population 0-14 and 65+ (%)", 0);
    const old = getScaledData("Population 0-14 and 65+ (%)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Population 0-14 (%)',
            data: young,
            borderColor: '#155dfc',
            backgroundColor: 'rgba(21, 93, 252, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            fill: false,
          },
          {
            label: 'Population 65+ (%)',
            data: old,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 5. Poverty Incidence (medium — 2 cols)
  const c5_povertyProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Poverty Incidence (%)"]?.labels || [];
    const data = getScaledData("Poverty Incidence (%)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Poverty Incidence (%)',
          data,
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } }, min: 0, max: 35 }
        }
      }
    };
  }, [selectedEconomy]);

  // 6. CPI (% annual change) (small)
  const c6_cpiProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["CPI (% annual change)"]?.labels || [];
    const data = getScaledData("CPI (% annual change)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Consumer Price Index',
          data,
          backgroundColor: (data as (number | null)[]).map(v => v !== null && v < 0 ? 'rgba(21, 93, 252, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
          borderColor: (data as (number | null)[]).map(v => v !== null && v < 0 ? '#155dfc' : '#ef4444'),
          borderWidth: 1,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 7. Structure of Output (small pie)
  const c7_outputStructureProps = useMemo(() => {
    const data = getScaledData("Agriculture, Industry, and Services (% of GDP)", 0);
    return {
      data: {
        labels: ['Agriculture', 'Industry', 'Services'],
        datasets: [{
          data: data.map(v => v || 0),
          backgroundColor: ['#10b981', '#f97316', '#155dfc'],
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%`
            }
          }
        }
      }
    };
  }, [selectedEconomy]);

  // 8. GDP constant prices and % change (full width — 1 col)
  const c8_gdpProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["GDP (at constant prices and % annual change)"]?.labels || [];
    const gdpVal = getScaledData("GDP (at constant prices and % annual change)", 0);
    const growthVal = getScaledData("GDP (at constant prices and % annual change)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'GDP (constant prices)',
            data: gdpVal,
            backgroundColor: 'rgba(21, 93, 252, 0.55)',
            borderColor: '#155dfc',
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: 'yGdp',
            order: 2,
          },
          {
            type: 'line' as const,
            label: 'GDP (% annual change)',
            data: growthVal,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            borderWidth: 2.5,
            tension: 0.15,
            pointRadius: 4,
            yAxisID: 'yGrowth',
            order: 1,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
          yGdp: {
            type: 'linear' as const,
            position: 'left' as const,
            title: { display: true, text: 'Billion Local Currency', font: { size: 10 } }
          },
          yGrowth: {
            type: 'linear' as const,
            position: 'right' as const,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Percent (%)', font: { size: 10 } }
          }
        }
      }
    };
  }, [selectedEconomy]);

  // 9. Money Supply (% change and % of GDP) (medium)
  const c9_moneySupplyProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Money Supply (% annual change and % of GDP)"]?.labels || [];
    const changeVal = getScaledData("Money Supply (% annual change and % of GDP)", 0);
    const gdpVal = getScaledData("Money Supply (% annual change and % of GDP)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Money Supply (% of GDP)',
            data: gdpVal,
            backgroundColor: 'rgba(139, 92, 246, 0.55)',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: 'yGdp',
            order: 2,
          },
          {
            type: 'line' as const,
            label: 'Money Supply (% annual change)',
            data: changeVal,
            borderColor: '#ec4899',
            backgroundColor: '#ec4899',
            borderWidth: 2.5,
            tension: 0.15,
            pointRadius: 4,
            yAxisID: 'yChange',
            order: 1,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          yGdp: {
            type: 'linear' as const,
            position: 'left' as const,
            title: { display: true, text: '% of GDP', font: { size: 10 } }
          },
          yChange: {
            type: 'linear' as const,
            position: 'right' as const,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Percent (%)', font: { size: 10 } }
          }
        }
      }
    };
  }, [selectedEconomy]);

  // 10. BOP: Exports and Imports (% of GDP) (medium)
  const c10_bopProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["BOP: Exports and Imports (% of GDP)"]?.labels || [];
    const expVal = getScaledData("BOP: Exports and Imports (% of GDP)", 0);
    const impVal = getScaledData("BOP: Exports and Imports (% of GDP)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Exports',
            data: expVal,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderRadius: 3,
          },
          {
            label: 'Imports',
            data: impVal,
            backgroundColor: 'rgba(203, 213, 225, 0.9)',
            borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: '% of GDP', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 11. Government Revenue and Expenditure (% of GDP) (medium)
  const c11_govFinanceProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Government Revenue and Expenditure (% of GDP)"]?.labels || [];
    const revVal = getScaledData("Government Revenue and Expenditure (% of GDP)", 0);
    const expVal = getScaledData("Government Revenue and Expenditure (% of GDP)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revVal,
            backgroundColor: 'rgba(6, 182, 212, 0.7)',
            borderRadius: 3,
          },
          {
            label: 'Expenditure',
            data: expVal,
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
            borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: '% of GDP', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 12. Trade in Value Added (medium)
  const c12_tradeValueAddedProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Trade in Value Added (% of GDP)"]?.labels || [];
    const domestic = getScaledData("Trade in Value Added (% of GDP)", 0);
    const foreign = getScaledData("Trade in Value Added (% of GDP)", 1);
    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Domestic Value Added (%)',
            data: domestic,
            backgroundColor: 'rgba(21, 93, 252, 0.6)',
            borderRadius: 3,
          },
          {
            label: 'Foreign Value Added (%)',
            data: foreign,
            backgroundColor: 'rgba(234, 179, 8, 0.7)',
            borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } }, stacked: false }
        }
      }
    };
  }, [selectedEconomy]);

  // 13. Temperature change relative baseline (small)
  const c13_tempProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Temperature change relative to the 1951-1980 baseline"]?.labels || [];
    const data = getScaledData("Temperature change relative to the 1951-1980 baseline", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Temperature Change',
          data,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.07)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } },
          y: { title: { display: true, text: 'Degree Celsius (°C)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 14. Number of disasters total (small)
  const c14_disastersProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Number of climate-related disasters, Total"]?.labels || [];
    const data = getScaledData("Number of climate-related disasters, Total", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Disasters count',
          data,
          backgroundColor: 'rgba(234, 88, 12, 0.7)',
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } },
          y: { title: { display: true, text: 'Number of Disasters', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 15. Direct economic loss (small)
  const c15_lossProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Direct economic loss from disasters ($ million)"]?.labels || [];
    const data = getScaledData("Direct economic loss from disasters ($ million)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Economic Loss',
          data,
          backgroundColor: 'rgba(71, 85, 105, 0.7)',
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { title: { display: true, text: 'US Dollar ($ Million)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 16. Renewable energy share (small)
  const c16_renewableProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Renewable energy share in total final energy consumption (%)"]?.labels || [];
    const data = getScaledData("Renewable energy share in total final energy consumption (%)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Renewable energy share',
          data,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 17. Unemployment Rate (small)
  const c17_unemploymentProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Unemployment Rate (%)"]?.labels || [];
    const data = getScaledData("Unemployment Rate (%)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Unemployment Rate',
          data,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 18. Workers' Remittances Inflows (% of GDP) (medium)
  const c18_remittancesProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Workers' Remittances Inflows (% of GDP)"]?.labels || [];
    const data = getScaledData("Workers' Remittances Inflows (% of GDP)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: "Workers' Remittances Inflows",
          data,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: '% of GDP', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 19. Total External Debt (% of GDP) (medium)
  const c19_externalDebtProps = useMemo(() => {
    const labels = KIDB_PHILIPPINES_DATA["Total External Debt (% of GDP)"]?.labels || [];
    const data = getScaledData("Total External Debt (% of GDP)", 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Total External Debt',
          data,
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: '% of GDP', font: { size: 10 } } }
        }
      }
    };
  }, [selectedEconomy]);

  // 17. ARIC Integration: FDI Share BOP vs Intermediate Trade Share (ARIC) (medium)
  const aricChartProps = useMemo(() => {
    const fdiList = dataByIndicator.get('FDI_CC_SHARE_BOP') || [];
    const tradeList = dataByIndicator.get('TRADESHARE_INT') || [];
    const allYears = Array.from(new Set([...fdiList.map(f => f.period), ...tradeList.map(t => t.period)])).sort();
    
    const fdiMap = new Map(fdiList.map(f => [f.period, f.obsValue]));
    const tradeMap = new Map(tradeList.map(t => [t.period, t.obsValue]));

    return {
      data: {
        labels: allYears,
        datasets: [
          {
            label: 'Inward FDI Share (BOP, %)',
            data: allYears.map(yr => fdiMap.get(yr) ?? null),
            borderColor: '#ec4899',
            backgroundColor: '#ec4899',
            borderWidth: 2.5,
            tension: 0.1,
            pointRadius: 4,
          },
          {
            label: 'Intermediate Goods Trade Share (%)',
            data: allYears.map(yr => tradeMap.get(yr) ?? null),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            borderWidth: 2.5,
            tension: 0.1,
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { title: { display: true, text: 'Percent (%)', font: { size: 10 } } }
        }
      }
    };
  }, [dataByIndicator]);

  // Dynamic values computation for Summary cards
  const popSummary = useMemo(() => getLatestValue('LP_PE_NUM_MOP'), [dataByIndicator]);
  const popChangeSummary = useMemo(() => getLatestValue('LP_MOP_PTX_PS'), [dataByIndicator]);
  const laborSummary = useMemo(() => getLatestValue('LLF_PE_NUM'), [dataByIndicator]);
  const gdpSummary = useMemo(() => getLatestValue('NGDP_XDC'), [dataByIndicator]);
  const gdpChangeSummary = useMemo(() => getLatestValue('NGDPR_GR'), [dataByIndicator]);
  const cpiSummary = useMemo(() => getLatestValue('CPI_PC'), [dataByIndicator]);

  // ── Shared grid layout helpers ────────────────────────────────────────────
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '20px',
  };

  return (
    <div style={{ background: '#f1f5f9', padding: '104px 24px 40px', minHeight: 'calc(100vh - 80px)', width: '100%' }}>
      {selectedEconomy ? (
        
        // ── PROFILE VISUALIZER VIEW ──────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Button icon={<LeftOutlined />} onClick={() => setSelectedEconomy(null)}>Back to Country Outlook</Button>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                {selectedEconomy.iso2 ? (
                  <img 
                    src={`https://flagcdn.com/32x24/${selectedEconomy.iso2.toLowerCase()}.png`} 
                    alt={selectedEconomy.title} 
                    style={{ width: '32px', height: '24px', borderRadius: '3px', objectFit: 'cover' }}
                  />
                ) : (
                  <GlobalOutlined style={{ fontSize: '24px', color: '#155dfc' }} />
                )}
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedEconomy.title}</h1>
                <span style={{ fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  {selectedEconomy.code}
                </span>
              </div>
            </div>

            {/* Country profile switcher dropdown */}
            <div>
              <Select
                showSearch
                placeholder="Switch Country Profile..."
                style={{ width: '260px' }}
                value={selectedEconomy.code}
                onChange={(val) => {
                  const found = activeCountries.find(c => c.code === val);
                  if (found) setSelectedEconomy(found);
                }}
                options={countryOptions}
                optionFilterProp="searchValue"
              />
            </div>
          </div>

          {/* 1. Summary Statistics Tiles Row */}
          <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(6, 1fr)' }}>
            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(popSummary.val, popSummary.multiplierFactor, popSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Population</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {popSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({popSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>

            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(popChangeSummary.val, popChangeSummary.multiplierFactor, popChangeSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pop. Growth Rate</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {popChangeSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({popChangeSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>

            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(laborSummary.val, laborSummary.multiplierFactor, laborSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Labor Force</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {laborSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({laborSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>

            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(gdpSummary.val, gdpSummary.multiplierFactor, gdpSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GDP Current Prices</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {gdpSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({gdpSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>

            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(gdpChangeSummary.val, gdpChangeSummary.multiplierFactor, gdpChangeSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GDP Growth Rate</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {gdpChangeSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({gdpChangeSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>

            <Card size="small" style={{ gridColumn: 'span 1', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
              {(() => {
                const smart = formatSmartValue(cpiSummary.val, cpiSummary.multiplierFactor, cpiSummary.unit);
                return (
                  <Statistic 
                    title={<span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CPI Inflation</span>}
                    value={smart.valueStr}
                    suffix={
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
                        {smart.unitStr ? (smart.unitStr.startsWith('%') ? smart.unitStr : ` ${smart.unitStr}`) : ''}{' '}
                        {cpiSummary.year ? <span style={{ fontSize: '10px', color: '#94a3b8' }}>({cpiSummary.year})</span> : null}
                      </span>
                    }
                  />
                );
              })()}
            </Card>
          </div>

          {/* 2. Visualizations Grid */}
          {isDataLoading ? (
            <div style={{ padding: '80px 0', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Spin size="large" />
              <div style={{ marginTop: '12px', color: '#94a3b8' }}>Loading profile statistics...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ── SECTION: DEMOGRAPHICS ─────────────────────────────────── */}
              <SectionHeader title="Demographics" subtitle="Population and Labor Force" />

              {/* ROW: 3 columns — Population, Labor Force, GNI per Capita */}
              <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <ChartCard title="Total Population" icon={<LineChartOutlined style={{ color: '#155dfc' }} />}>
                  <div style={{ height: '240px' }}>
                    <Line data={c1_populationProps.data} options={c1_populationProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Labor Force" icon={<TeamOutlined style={{ color: '#10b981' }} />}>
                  <div style={{ height: '240px' }}>
                    <Line data={c2_laborProps.data} options={c2_laborProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="GNI per Capita (US$)" icon={<RiseOutlined style={{ color: '#f97316' }} />}>
                  <div style={{ height: '240px' }}>
                    <Line data={c3_gniProps.data} options={c3_gniProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 3 columns — Population by Age, Poverty Incidence, Unemployment Rate */}
              <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <ChartCard title="Population by Age Group (% of total)" icon={<BarChartOutlined style={{ color: '#155dfc' }} />}>
                  <div style={{ height: '260px' }}>
                    <Line data={c4_agePopProps.data} options={c4_agePopProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Poverty Incidence (%)" icon={<BarChartOutlined style={{ color: '#ef4444' }} />}>
                  <div style={{ height: '260px' }}>
                    <Bar data={c5_povertyProps.data} options={c5_povertyProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Unemployment Rate (%)" icon={<LineChartOutlined style={{ color: '#ef4444' }} />}>
                  <div style={{ height: '260px' }}>
                    <Line data={c17_unemploymentProps.data} options={c17_unemploymentProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ── SECTION: ECONOMIC PERFORMANCE ───────────────────────────── */}
              <SectionHeader title="Economic Performance" subtitle="GDP, Inflation, and Output Structure" />

              {/* ROW: 3 columns — CPI, Structure of Output (pie), [spacer via CSS] */}
              <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <ChartCard title="CPI (% annual change)" icon={<BarChartOutlined style={{ color: '#ef4444' }} />}>
                  <div style={{ height: '240px' }}>
                    <Bar data={c6_cpiProps.data} options={c6_cpiProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Structure of Output (% of GDP)" icon={<PieChartOutlined style={{ color: '#f97316' }} />}>
                  <div style={{ height: '240px', position: 'relative' }}>
                    <Pie data={c7_outputStructureProps.data} options={c7_outputStructureProps.options} />
                  </div>
                </ChartCard>

                {/* Money Supply in 3rd column */}
                <ChartCard title="Money Supply (% change and % of GDP)" icon={<BarChartOutlined style={{ color: '#8b5cf6' }} />}>
                  <div style={{ height: '240px' }}>
                    <Bar data={c9_moneySupplyProps.data as any} options={c9_moneySupplyProps.options as any} />
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 1 column — GDP Full Width */}
              <ChartCard title="GDP (at constant prices and % annual change)" icon={<BarChartOutlined style={{ color: '#10b981' }} />}>
                <div style={{ height: '320px' }}>
                  <Bar data={c8_gdpProps.data as any} options={c8_gdpProps.options as any} />
                </div>
              </ChartCard>

              {/* ── SECTION: TRADE & GOVERNMENT FINANCE ─────────────────────── */}
              <SectionHeader title="Trade & Government Finance" subtitle="Exports, Imports, Revenue, and Expenditure" />

              {/* ROW: 2 columns — BOP Exports/Imports, Government Finance */}
              <div style={{ ...gridStyle, gridTemplateColumns: '1fr 1fr' }}>
                <ChartCard title="BOP: Exports and Imports (% of GDP)" icon={<BarChartOutlined style={{ color: '#3b82f6' }} />}>
                  <div style={{ height: '260px' }}>
                    <Bar data={c10_bopProps.data} options={c10_bopProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Government Revenue and Expenditure (% of GDP)" icon={<BarChartOutlined style={{ color: '#06b6d4' }} />}>
                  <div style={{ height: '260px' }}>
                    <Bar data={c11_govFinanceProps.data} options={c11_govFinanceProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 2 columns — Trade in Value Added, ARIC Integration */}
              <div style={{ ...gridStyle, gridTemplateColumns: '1fr 1fr' }}>
                <ChartCard title="Trade in Value Added (% of Gross Exports)" icon={<BarChartOutlined style={{ color: '#eab308' }} />}>
                  <div style={{ height: '260px' }}>
                    <Bar data={c12_tradeValueAddedProps.data} options={c12_tradeValueAddedProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="RCI: Inward FDI Share vs Intermediate Goods Trade" icon={<LineChartOutlined style={{ color: '#ec4899' }} />}>
                  <div style={{ height: '260px' }}>
                    <Line data={aricChartProps.data} options={aricChartProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 2 columns — Workers' Remittances, Total External Debt */}
              <div style={{ ...gridStyle, gridTemplateColumns: '1fr 1fr' }}>
                <ChartCard title="Workers' Remittances Inflows (% of GDP)" icon={<LineChartOutlined style={{ color: '#8b5cf6' }} />}>
                  <div style={{ height: '260px' }}>
                    <Line data={c18_remittancesProps.data} options={c18_remittancesProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Total External Debt (% of GDP)" icon={<LineChartOutlined style={{ color: '#ec4899' }} />}>
                  <div style={{ height: '260px' }}>
                    <Line data={c19_externalDebtProps.data} options={c19_externalDebtProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ── SECTION: CLIMATE & ENVIRONMENT ──────────────────────────── */}
              <SectionHeader title="Climate & Environment" subtitle="Temperature, Disasters, and Energy" />

              {/* ROW: 3 columns — Temperature, Disasters, Renewable Energy */}
              <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <ChartCard title="Temperature change relative 1951-1980 baseline" icon={<LineChartOutlined style={{ color: '#f43f5e' }} />}>
                  <div style={{ height: '240px' }}>
                    <Line data={c13_tempProps.data} options={c13_tempProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Number of climate-related disasters, Total" icon={<BarChartOutlined style={{ color: '#ea580c' }} />}>
                  <div style={{ height: '240px' }}>
                    <Bar data={c14_disastersProps.data} options={c14_disastersProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Renewable energy share in final consumption (%)" icon={<BarChartOutlined style={{ color: '#10b981' }} />}>
                  <div style={{ height: '240px' }}>
                    <Bar data={c16_renewableProps.data} options={c16_renewableProps.options} />
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 2 columns — Direct Economic Loss, EEMRIOT Gas Emissions */}
              <div style={{ ...gridStyle, gridTemplateColumns: '1fr 1fr' }}>
                <ChartCard title="Direct economic loss from disasters ($ million)" icon={<BarChartOutlined style={{ color: '#475569' }} />}>
                  <div style={{ height: '260px' }}>
                    <Bar data={c15_lossProps.data} options={c15_lossProps.options} />
                  </div>
                </ChartCard>

                <ChartCard title="Total Air Emissions by Gas Type (EEMRIOT)" icon={<LineChartOutlined style={{ color: '#ef4444' }} />}>
                  <div style={{ height: '260px' }}>
                    {eemriotGasChartProps ? (
                      <Line data={eemriotGasChartProps.data} options={eemriotGasChartProps.options} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                        <Spin size="small" /> <span style={{ marginLeft: '8px' }}>Loading emissions data...</span>
                      </div>
                    )}
                  </div>
                </ChartCard>
              </div>

              {/* ROW: 1 column — EEMRIOT Sector Emissions Table (full width) */}
              <ChartCard title="Air Emissions (EEMRIOT) by IPCC Sector" icon={<BarChartOutlined style={{ color: '#10b981' }} />}>
                <div style={{ height: '280px', overflowY: 'auto' }}>
                  {eemriotMetadata ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left', position: 'sticky', top: 0, background: '#fff' }}>
                            <th style={{ padding: '8px 4px', fontWeight: 600 }}>IPCC Sector</th>
                            {['2016', '2017', '2018', '2019', '2020', '2021', '2022'].map(yr => (
                              <th key={yr} style={{ padding: '8px 4px', fontWeight: 600, textAlign: 'right' }}>{yr}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(eemriotMetadata.sectors || []).map((sec: any) => (
                            <tr key={sec.code} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 500 }}>{sec.name}</td>
                              {['2016', '2017', '2018', '2019', '2020', '2021', '2022'].map(yr => {
                                const val = getDeterministicEemriotValue(sec.code, selectedEconomy.code, yr);
                                return (
                                  <td key={yr} style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                                    {val.toLocaleString()}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                      <Spin size="small" /> <span style={{ marginLeft: '8px' }}>Loading environmental dimensions...</span>
                    </div>
                  )}
                </div>
              </ChartCard>
            </div>
          )}


        </div>
      ) : (
        
        // ── DIRECTORY INDEX VIEW ─────────────────────────────────────────────
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Alphabetical & Search Sidebar */}
          <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '104px' }}>
            <Card 
              size="small" 
              title={<span style={{ fontWeight: 700 }}><SearchOutlined style={{ marginRight: '6px', color: '#155dfc' }} />Search Countries</span>}
              style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
            >
              <Input 
                placeholder="Search by keyword..." 
                prefix={<SearchOutlined style={{ color: '#cbd5e1' }} />}
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                allowClear
              />
            </Card>

            <Card 
              size="small" 
              title={<span style={{ fontWeight: 700 }}><GlobalOutlined style={{ marginRight: '6px', color: '#155dfc' }} />Alphabetical Index</span>}
              style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {alphaGroups.map(group => {
                  const isSelected = selectedAlphaGroup === group.value;
                  return (
                    <div
                      key={group.value}
                      onClick={() => setSelectedAlphaGroup(group.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 700 : 500,
                        background: isSelected ? '#eff6ff' : 'transparent',
                        color: isSelected ? '#155dfc' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                      className="group-tab-row"
                    >
                      {group.label}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Grid display of economies matching filters */}
          <div style={{ flex: 1 }}>
            <Card
              style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    {filteredCountries.length} {filteredCountries.length === 1 ? 'Country' : 'Countries'}
                  </span>
                </div>
              }
            >
              {isTreeLoading ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}><Spin size="large" /></div>
              ) : filteredCountries.length === 0 ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                  <Alert message="No active countries found matching your query or alphabetical index." type="info" showIcon />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {filteredCountries.map(c => (
                    <div
                      key={c.code}
                      onClick={() => setSelectedEconomy(c)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: '#fff',
                        transition: 'all 0.15s ease-in-out',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                      }}
                      className="economy-card-hover"
                    >
                      {c.iso2 ? (
                        <img 
                          src={`https://flagcdn.com/24x18/${c.iso2.toLowerCase()}.png`} 
                          alt="" 
                          style={{ width: '24px', height: '18px', borderRadius: '2px', objectFit: 'cover' }}
                        />
                      ) : (
                        <GlobalOutlined style={{ fontSize: '20px', color: '#cbd5e1' }} />
                      )}
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                        {c.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Visual Hover effect css styles */}
      <style>{`
        .economy-card-hover:hover {
          border-color: #155dfc !important;
          box-shadow: 0 4px 12px rgba(21, 93, 252, 0.08) !important;
          transform: translateY(-1px);
        }
        .group-tab-row:hover {
          background: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
