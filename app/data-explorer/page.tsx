'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { Card, Checkbox, Button, Space, Spin, Alert, Tree, Input, Tabs, Row, Col, Empty, Radio, Select, Drawer, Skeleton } from 'antd';
import { 
  DatabaseOutlined, 
  BookOutlined, 
  GlobalOutlined, 
  CalendarOutlined, 
  LineChartOutlined, 
  TableOutlined, 
  SearchOutlined, 
  DownloadOutlined, 
  InfoCircleOutlined,
  CompassOutlined,
  FolderOutlined,
  BarChartOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import LineChartCard from '@/components/Visualizations/LineChartCard';
import BarChartCard from '@/components/Visualizations/BarChartCard';
import SmallMultiplesCard from '@/components/Visualizations/SmallMultiplesCard';
import DataTableCard from '@/components/Visualizations/DataTableCard';
import RankingCard from '@/components/Visualizations/RankingCard';
import MapCard from '@/components/Visualizations/MapCard';
import HeatmapCard from '@/components/Visualizations/HeatmapCard';
import EemriotVisualizer from '@/components/Visualizations/EemriotVisualizer';
import { unifyMultipliers, capitalizeWords, ISO3_TO_ISO2 } from '@/lib/country';

const DEFAULT_OBS_RESPONSE = { data: [], periods: [] };

// 0. CUSTOM STABILIZED INLINE BUTTON COMPONENT TO BYPASS WEBFLOW STYLESHEET HOVER RESETS
interface CustomButtonProps {
  onClick: () => void;
  type?: 'primary' | 'default';
  children: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}
function CustomButton({ onClick, type = 'default', children, disabled, style }: CustomButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  
  const isPrimary = type === 'primary';
  const bg = disabled
    ? '#f1f5f9'
    : (isPrimary 
        ? (active ? '#0d48c9' : (hovered ? '#1c66ff' : '#155dfc'))
        : (active ? '#cbd5e1' : (hovered ? '#f8fafc' : '#ffffff')));
  const color = disabled 
    ? '#94a3b8' 
    : (isPrimary ? '#ffffff' : '#334155');
  const border = disabled
    ? '1px solid #e2e8f0'
    : (isPrimary ? '1px solid #155dfc' : '1px solid #cbd5e1');
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false); }}
      onMouseDown={() => !disabled && setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '36px',
        padding: '0 16px',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '6px',
        border: border,
        backgroundColor: bg,
        color: color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'all 0.15s ease-in-out',
        boxShadow: isPrimary ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
        ...style
      }}
    >
      {children}
    </button>
  );
}

function isUnitCurrency(unitName: string): boolean {
  if (!unitName) return false;
  const normalized = unitName.toLowerCase().trim();
  const currencyKeywords = [
    'currency', 'lcu', 'ncu', 'dollar', 'rupee', 'lira', 'dong', 'won', 'ringgit', 'afghani', 
    'pa\'anga', 'som', 'sum', 'rupiah', 'yen', 'baht', 'riel', 'kip', 'taka', 'kyat', 'tugrik', 
    'manat', 'tenge', 'somoni', 'dram', 'lari', 'vatu', 'tala', 'kina', 'euro', 'pound', 
    'franc', 'peso', 'kron', 'cron', 'rial', 'riyal', 'dinar', 'dirham', 'us$', '$'
  ];
  return currencyKeywords.some(keyword => normalized.includes(keyword));
}

export default function DataExplorerPage() {
  const [isPending, startTransition] = useTransition();

  // Convert to USD feature state
  const [isConvertToUSDActive, setIsConvertToUSDActive] = useState(false);

  // 1. FILTER SELECTION STATE
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['KIDB', 'ADO', 'ARIC', 'EEMRIOT']);
  const [checkedIndicatorKeys, setCheckedIndicatorKeys] = useState<React.Key[]>([]);
  const [checkedEconomyKeys, setCheckedEconomyKeys] = useState<React.Key[]>([]);
  const [checkedCounterpartKeys, setCheckedCounterpartKeys] = useState<React.Key[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state: 'welcome' | 'indicators' | 'economies' | 'periods' | 'data' | 'counterparts'
  const [activePanel, setActivePanel] = useState<'welcome' | 'indicators' | 'economies' | 'periods' | 'data' | 'counterparts'>('welcome');
  const [activeTab, setActiveTab] = useState<string>('table');
  // Expand/collapse state for indicator tree
  const [expandedIndicatorKeys, setExpandedIndicatorKeys] = useState<React.Key[]>([]);
  // Expand/collapse state for economy tree
  const [expandedEconomyKeys, setExpandedEconomyKeys] = useState<React.Key[]>([]);

  // Visualization View mode selections
  const [viewMode, setViewMode] = useState<'indicator' | 'economy'>('indicator');
  const [activeIndicatorCode, setActiveIndicatorCode] = useState<string | null>(null);
  const [activeEconomyCode, setActiveEconomyCode] = useState<string | null>(null);
  const lastLoadedKeyRef = React.useRef<string>('');
  // Ref + state to measure the sticky tab bar height so DataTableCard offsets correctly
  const tabBarRef = React.useRef<HTMLDivElement>(null);
  const [tabBarHeight, setTabBarHeight] = React.useState<number>(60);

  // Measure tab bar height dynamically
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setTabBarHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activePanel]);

  const [metadataDrawerVisible, setMetadataDrawerVisible] = useState(false);
  const [metadataParams, setMetadataParams] = useState<{ indicatorCode?: string; economyCode?: string; counterpartAreaCode?: string; datasetCode?: string } | null>(null);

  // Scroll to top when switching selector panels to ensure they are visible
  useEffect(() => {
    if (activePanel === 'indicators' || activePanel === 'economies' || activePanel === 'periods' || activePanel === 'counterparts') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activePanel]);

  // 2. DATA QUERIES
  // Fetch indicator tree dynamically based on selected datasets
  const { data: treeData = [], isLoading: isTreeLoading } = useQuery<any[]>({
    queryKey: ['explorerTree', selectedDatasets],
    queryFn: () => 
      fetch(`/api/public-explorer/tree?datasets=${selectedDatasets.join(',')}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch tree: ${res.statusText}`);
          return res.json();
        }),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });

  // Flatten tree leaf keys to get the correct hierarchy order of all indicators
  const orderedIndicatorKeys = React.useMemo(() => {
    const keys: string[] = [];
    const traverse = (nodes: any[]) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach(node => {
        if (node.isLeaf) {
          keys.push(node.key);
        } else if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return keys;
  }, [treeData]);

  // Parse checked keys into list of codes sorted by tree hierarchy order
  const selectedIndicators = React.useMemo(() => {
    const parsed = checkedIndicatorKeys
      .filter(key => typeof key === 'string' && key.startsWith('ind:'))
      .map(key => {
        const parts = (key as string).split(':');
        return { key: key as string, datasetCode: parts[1], code: parts[2] };
      });
    
    // Sort based on their order in treeData
    parsed.sort((a, b) => {
      const idxA = orderedIndicatorKeys.indexOf(a.key);
      const idxB = orderedIndicatorKeys.indexOf(b.key);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    return parsed;
  }, [checkedIndicatorKeys, orderedIndicatorKeys]);

  const selectedIndicatorCodes = React.useMemo(() => {
    return Array.from(new Set(selectedIndicators.map(i => i.code)));
  }, [selectedIndicators]);

  const selectedEconomies = React.useMemo(() => {
    return checkedEconomyKeys
      .filter(key => typeof key === 'string' && key.startsWith('eco:'))
      .map(key => (key as string).split(':')[1]);
  }, [checkedEconomyKeys]);

  const activeIndicatorDataset = activeIndicatorCode
    ? selectedIndicators.find(ind => ind.code === activeIndicatorCode)?.datasetCode
    : (selectedIndicators[0]?.datasetCode || (selectedIndicatorCodes.length > 0 ? (checkedIndicatorKeys[0] as string)?.split(':')?.[1] : undefined));
  const isAricActive = activeIndicatorDataset === 'ARIC';
  const isEemriotActive = activeIndicatorDataset === 'EEMRIOT';

  const selectedCounterparts = React.useMemo(() => {
    return checkedCounterpartKeys
      .filter(key => typeof key === 'string' && key.startsWith('eco:'))
      .map(key => (key as string).split(':')[1]);
  }, [checkedCounterpartKeys]);

  const handleInfoClick = useCallback((params: { indicatorCode?: string; economyCode?: string; counterpartAreaCode?: string; datasetCode?: string }) => {
    const finalDatasetCode = params.datasetCode || activeIndicatorDataset || selectedDatasets[0] || 'KIDB';
    setMetadataParams({ ...params, datasetCode: finalDatasetCode });
    setMetadataDrawerVisible(true);
  }, [activeIndicatorDataset, selectedDatasets]);

  // Sync active selections when checked keys change
  useEffect(() => {
    if (selectedIndicatorCodes.length > 0) {
      if (!activeIndicatorCode || !selectedIndicatorCodes.includes(activeIndicatorCode)) {
        setActiveIndicatorCode(selectedIndicatorCodes[0]);
      }
    } else {
      setActiveIndicatorCode(null);
    }
    // Reset period selection so it re-evaluates to last 5 with actual data
    setSelectedPeriods([]);
  }, [checkedIndicatorKeys]);

  useEffect(() => {
    if (selectedEconomies.length > 0) {
      const isAricNow = selectedIndicators[0]?.datasetCode === 'ARIC' || (checkedIndicatorKeys[0] as string)?.startsWith('ind:ARIC:');
      if (isAricNow && selectedEconomies.includes('AFG')) {
        // ARIC has no data for AFG. Default to Armenia (ARM) or the first non-AFG selected economy if possible.
        const nonAfg = selectedEconomies.find(e => e !== 'AFG');
        if (nonAfg) {
          setActiveEconomyCode(nonAfg);
          // Reset periods so they re-evaluate for the new economy
          setSelectedPeriods([]);
          return;
        }
      }
      if (!activeEconomyCode || !selectedEconomies.includes(activeEconomyCode)) {
        setActiveEconomyCode(selectedEconomies[0]);
      }
    } else {
      setActiveEconomyCode(null);
    }
    // Reset period selection so it re-evaluates to last 5 with actual data
    setSelectedPeriods([]);
  }, [checkedEconomyKeys, checkedIndicatorKeys]);




  // Fetch all economies for fallback name / flag mapping
  const { data: allEconomies = [] } = useQuery<any[]>({
    queryKey: ['allEconomiesLookup'],
    queryFn: () => fetch('/api/economies').then(res => {
      if (!res.ok) throw new Error(`Failed to fetch economies lookup: ${res.statusText}`);
      return res.json();
    }),
  });

  // Fetch economy tree dynamically based on selected datasets and indicators
  const { data: economyData = [], isLoading: isEconomyLoading } = useQuery<any[]>({
    queryKey: ['explorerEconomies', selectedDatasets, selectedIndicatorCodes],
    queryFn: () => {
      const indStr = selectedIndicatorCodes.join(',');
      return fetch(`/api/public-explorer/economies?datasets=${selectedDatasets.join(',')}&indicators=${indStr}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch economies: ${res.statusText}`);
          return res.json();
        });
    },
    enabled: selectedDatasets.length > 0,
  });

  // Fetch counterparts dynamically based on active indicator
  const { data: counterpartsData = [], isLoading: isCounterpartsLoading } = useQuery<any[]>({
    queryKey: ['explorerCounterparts', selectedIndicatorCodes],
    queryFn: () => {
      const indStr = selectedIndicatorCodes.join(',');
      return fetch(`/api/public-explorer/counterparts?indicators=${indStr}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch counterparts: ${res.statusText}`);
          return res.json();
        });
    },
    enabled: isAricActive && selectedIndicatorCodes.length > 0
  });

  const counterpartNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (counterpartsData && Array.isArray(counterpartsData)) {
      counterpartsData.forEach(item => {
        map[`eco:${item.code}`] = item.name;
      });
    }
    return map;
  }, [counterpartsData]);

  // Lookup maps for user-friendly names (defined after queries to prevent use-before-declaration compiler errors)
  const indicatorNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    const traverse = (nodeList: any[]) => {
      if (!nodeList || !Array.isArray(nodeList)) return;
      nodeList.forEach(node => {
        if (node.isLeaf) {
          map[node.key] = node.title;
        } else if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return map;
  }, [treeData]);

  const economyNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (allEconomies && Array.isArray(allEconomies)) {
      allEconomies.forEach(eco => {
        map[`eco:${eco.code}`] = eco.name;
      });
    }
    const traverse = (nodeList: any[]) => {
      if (!nodeList || !Array.isArray(nodeList)) return;
      nodeList.forEach(node => {
        if (node.isLeaf) {
          map[node.key] = node.title;
        } else if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(economyData);
    return map;
  }, [economyData, allEconomies]);

  const economyIso2Map = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (allEconomies && Array.isArray(allEconomies)) {
      allEconomies.forEach(eco => {
        const iso2 = eco.iso2Code || ISO3_TO_ISO2[eco.code.toUpperCase()] || null;
        if (iso2) {
          map[`eco:${eco.code}`] = iso2;
        }
      });
    }
    const traverse = (nodeList: any[]) => {
      if (!nodeList || !Array.isArray(nodeList)) return;
      nodeList.forEach(node => {
        if (node.isLeaf) {
          if (node.iso2) {
            map[node.key] = node.iso2;
          }
        } else if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(economyData);
    return map;
  }, [economyData, allEconomies]);

  // Fetch observations dynamically for the currently active indicator
  const targetIndicatorCode = activeIndicatorCode || selectedIndicatorCodes[0];
  const isDataQueryEnabled = !!targetIndicatorCode && selectedEconomies.length > 0;
  const { data: obsResponse = DEFAULT_OBS_RESPONSE, isLoading: isObsLoading, isFetching: isObsFetching } = useQuery<{ data: any[], periods: string[] }>({
    queryKey: ['explorerData', targetIndicatorCode, activeIndicatorDataset, selectedEconomies, selectedCounterparts],
    queryFn: () => {
      const ecoStr = selectedEconomies.join(',');
      const countStr = selectedCounterparts ? selectedCounterparts.join(',') : '';
      const dsStr = activeIndicatorDataset || selectedDatasets.join(',');
      return fetch(`/api/public-explorer/data?datasets=${dsStr}&indicators=${targetIndicatorCode}&economies=${ecoStr}&counterparts=${countStr}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch observations: ${res.statusText}`);
          return res.json();
        });
    },
    enabled: isDataQueryEnabled,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });

  const isCurrencyIndicator = React.useMemo(() => {
    if (!obsResponse || !obsResponse.data || obsResponse.data.length === 0) return false;
    const targetInd = activeIndicatorCode || selectedIndicatorCodes[0];
    if (!targetInd) return false;
    const indData = obsResponse.data.filter((d: any) => d.indicatorCode === targetInd);
    return indData.some((d: any) => isUnitCurrency(d.unitName));
  }, [obsResponse, activeIndicatorCode, selectedIndicatorCodes]);

  useEffect(() => {
    if (!isCurrencyIndicator) {
      setIsConvertToUSDActive(false);
    }
  }, [isCurrencyIndicator]);

  const shouldFetchExchangeRates = isConvertToUSDActive && isCurrencyIndicator && selectedEconomies.length > 0;
  
  const economiesForExchangeRates = React.useMemo(() => {
    const list = new Set<string>();
    selectedEconomies.forEach(eco => list.add(eco));
    if (isAricActive) {
      selectedCounterparts.forEach(eco => list.add(eco));
    }
    return Array.from(list);
  }, [selectedEconomies, selectedCounterparts, isAricActive]);

  const { data: exchangeRatesResponse, isLoading: isExchangeRatesLoading } = useQuery<any>({
    queryKey: ['exchangeRates', economiesForExchangeRates],
    queryFn: () => {
      const ecoStr = economiesForExchangeRates.join(',');
      return fetch(`/api/public-explorer/data?datasets=KIDB&indicators=ENDA_XDC_USD_RATE&economies=${ecoStr}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch exchange rates: ${res.statusText}`);
          return res.json();
        });
    },
    enabled: shouldFetchExchangeRates,
  });

  // Smart default activeEconomyCode when obsResponse data becomes available
  useEffect(() => {
    if (selectedEconomies.length > 0) {
      if (isAricActive && obsResponse?.data && obsResponse.data.length > 0) {
        const activeEcoCodesWithData = new Set(
          obsResponse.data
            .filter(d => d.obsValue !== null && d.obsValue !== undefined && d.obsValue !== '')
            .map(d => d.economyCode)
        );
        const preferredEco = selectedEconomies.find(eco => activeEcoCodesWithData.has(eco));
        const currentActiveEcoIsValid = activeEconomyCode && selectedEconomies.includes(activeEconomyCode);
        if (!currentActiveEcoIsValid && preferredEco && preferredEco !== activeEconomyCode) {
          setActiveEconomyCode(preferredEco);
        }
      }
    }
  }, [obsResponse, selectedEconomies, isAricActive, activeEconomyCode]);

  // Calculate limits: maxCounterparts = Math.floor(300 / selectedEconomies.length)
  const maxCounterparts = selectedEconomies.length > 0 
    ? Math.floor(300 / selectedEconomies.length) 
    : 300;

  // Sync / slice counterparts if limit is breached due to changing economies
  useEffect(() => {
    if (isAricActive && selectedCounterparts.length > maxCounterparts) {
      setCheckedCounterpartKeys(prev => {
        const parsed = prev.filter(key => typeof key === 'string' && key.startsWith('eco:'));
        return parsed.slice(0, maxCounterparts);
      });
    }
  }, [selectedEconomies, maxCounterparts, isAricActive]);

  // Default selection based on average observation value ranking across selected reporter economies/periods
  useEffect(() => {
    if (isAricActive && counterpartsData.length > 0) {
      if (isObsLoading || isObsFetching) return;

      const currentKey = `${activeIndicatorCode}:${activeEconomyCode}:${counterpartsData.length}`;
      if (lastLoadedKeyRef.current === currentKey) {
        return; // Already loaded defaults for this configuration
      }

      // Group observations by counterpart area and compute average value
      const averageMap = new Map<string, { sum: number, count: number }>();
      if (obsResponse?.data) {
        obsResponse.data.forEach(item => {
          if (item.counterpartAreaCode && item.obsValue !== null && !isNaN(item.obsValue)) {
            const val = Number(item.obsValue);
            const current = averageMap.get(item.counterpartAreaCode) || { sum: 0, count: 0 };
            averageMap.set(item.counterpartAreaCode, { sum: current.sum + val, count: current.count + 1 });
          }
        });
      }

      // Rank counterparts by average value descending
      const ranked = counterpartsData.map(c => {
        const avgData = averageMap.get(c.code);
        const avgVal = avgData ? avgData.sum / avgData.count : -Infinity;
        return { code: c.code, avgVal };
      }).sort((a, b) => b.avgVal - a.avgVal);

      // Select top N counterparts
      const defaultSelectionKeys = ranked.slice(0, maxCounterparts).map(r => `eco:${r.code}`);
      setCheckedCounterpartKeys(prev => {
        const isSame = prev.length === defaultSelectionKeys.length && prev.every((val, index) => val === defaultSelectionKeys[index]);
        if (!isSame) {
          return defaultSelectionKeys;
        }
        return prev;
      });
      lastLoadedKeyRef.current = currentKey;
    } else {
      if (lastLoadedKeyRef.current !== '') {
        setCheckedCounterpartKeys(prev => (prev.length === 0 ? prev : []));
        lastLoadedKeyRef.current = '';
      }
    }
  }, [obsResponse, isObsLoading, isObsFetching, isAricActive, counterpartsData, maxCounterparts, activeIndicatorCode, activeEconomyCode]);



  // Unify different multipliers for the same unit base (e.g. convert Thousands to Millions)
  const unifiedResult = React.useMemo(() => {
    if (!obsResponse || !obsResponse.data) return { data: [], periods: [], conversionNotes: [], unitDiscrepancies: [] };
    const { data: unifiedData, conversionNotes, unitDiscrepancies } = unifyMultipliers(obsResponse.data);
    
    if (isConvertToUSDActive && isCurrencyIndicator && exchangeRatesResponse && exchangeRatesResponse.data) {
      const rateMap = new Map();
      exchangeRatesResponse.data.forEach((rateObs: any) => {
        if (rateObs.obsValue !== null && rateObs.obsValue !== undefined && !isNaN(rateObs.obsValue)) {
          rateMap.set(`${rateObs.economyCode}_${rateObs.period}`, Number(rateObs.obsValue));
        }
      });

      const scales: Record<string, number> = {
        'units': 1,
        '0': 1,
        '': 1,
        'single': 1,
        'thousands': 1000,
        'millions': 1000000,
        'billions': 1000000000
      };

      const indicatorGroups: Record<string, any[]> = {};
      unifiedData.forEach((d: any) => {
        if (!indicatorGroups[d.indicatorCode]) {
          indicatorGroups[d.indicatorCode] = [];
        }
        indicatorGroups[d.indicatorCode].push(d);
      });

      const convertedData: any[] = [];
      const updatedNotesSet = new Set(conversionNotes);

      Object.keys(indicatorGroups).forEach(indCode => {
        const group = indicatorGroups[indCode];
        
        const hasCurrency = group.some(d => isUnitCurrency(d.unitName));
        if (!hasCurrency) {
          convertedData.push(...group);
          return;
        }

        const rawUSDValues = group.map((d: any) => {
          if (d.obsValue === null || d.obsValue === undefined || isNaN(Number(d.obsValue))) {
            return { d, rawUSD: null, exchangeRate: 1.0 };
          }
          const isUsd = d.unitName && (d.unitName.toLowerCase().includes('usd') || d.unitName.toLowerCase().includes('us$') || d.unitName.toLowerCase().includes('united states dollar'));
          const exchangeRate = isUsd ? 1.0 : (rateMap.get(`${d.economyCode}_${d.period}`) || 1.0);
          const mKey = (d.multiplierName || '').trim().toLowerCase();
          const factor = scales[mKey] || 1;
          const rawLCU = Number(d.obsValue) * factor;
          const rawUSD = rawLCU / exchangeRate;
          return { d, rawUSD, exchangeRate };
        });

        let maxAbsUSD = 0;
        rawUSDValues.forEach(item => {
          if (item.rawUSD !== null) {
            const absVal = Math.abs(item.rawUSD);
            if (absVal > maxAbsUSD) {
              maxAbsUSD = absVal;
            }
          }
        });

        const targetScale = maxAbsUSD >= 1e9 ? 1e9 : 1e6;
        const targetMultiplier = maxAbsUSD >= 1e9 ? 'Billions' : 'Millions';
        const targetUnit = 'US$';

        rawUSDValues.forEach(item => {
          const { d, rawUSD, exchangeRate } = item;
          if (rawUSD === null) {
            convertedData.push({ ...d });
            return;
          }

          const convertedValue = rawUSD / targetScale;

          const convertedObs = {
            ...d,
            obsValue: convertedValue,
            unitName: targetUnit,
            multiplierName: targetMultiplier,
            _wasConverted: true,
            _wasConvertedToUSD: true,
            _originalValue: d._originalValue !== undefined ? d._originalValue : d.obsValue,
            _originalUnitName: d._originalUnitName !== undefined ? d._originalUnitName : d.unitName,
            _originalMultiplierName: d._originalMultiplierName !== undefined ? d._originalMultiplierName : d.multiplierName,
            _exchangeRateUsed: exchangeRate,
          };
          convertedData.push(convertedObs);
        });

        updatedNotesSet.add(`* Note: Values have been converted to ${targetMultiplier.toLowerCase()} US$ using period average exchange rates.`);
      });

      return {
        data: convertedData,
        periods: obsResponse.periods,
        conversionNotes: Array.from(updatedNotesSet),
        unitDiscrepancies,
      };
    }

    return {
      data: unifiedData,
      periods: obsResponse.periods,
      conversionNotes,
      unitDiscrepancies,
    };
  }, [obsResponse, isConvertToUSDActive, isCurrencyIndicator, exchangeRatesResponse]);

  // Calculate active periods: filter the complete list of periods to only those
  // that have at least one observation with actual data for the CURRENT VIEW.
  //
  // KEY RULE: In economy view (e.g. Armenia profile), periods are determined only from
  // Armenia's data — not from all 50 selected economies. This prevents 2025 appearing
  // for Armenia just because Australia has 2025 data.
  // In indicator view, periods are determined from the active indicator across all economies.
  const activePeriods = React.useMemo(() => {
    if (!unifiedResult.periods || unifiedResult.periods.length === 0) {
      return [];
    }

    // Re-derive effective mode inline (effectiveMode is declared below this memo)
    const _showModeToggle = selectedIndicatorCodes.length > 1 && selectedEconomies.length > 1 && !isAricActive;
    const _effectiveMode: 'indicator' | 'economy' = isAricActive
      ? 'indicator'
      : (_showModeToggle ? viewMode : (selectedIndicatorCodes.length > 1 ? 'economy' : 'indicator'));

    // Determine the relevant data subset:
    // - ARIC: filter to the active reporter economy + active indicator only.
    //   This prevents AFG or AUS from adding period columns to Armenia's ARIC table.
    // - Economy profile view: filter to the active economy only
    // - Indicator view: filter to the active indicator only
    let relevantData: any[] = unifiedResult.data;
    if (isAricActive) {
      const targetEco = activeEconomyCode || selectedEconomies.find(e => e !== 'AFG') || selectedEconomies[0];
      const targetInd = activeIndicatorCode || selectedIndicatorCodes[0];
      relevantData = unifiedResult.data.filter((d: any) =>
        (!targetEco || d.economyCode === targetEco) &&
        (!targetInd || d.indicatorCode === targetInd)
      );
    } else if (_effectiveMode === 'economy') {
      const targetEco = _showModeToggle ? activeEconomyCode : selectedEconomies[0];
      if (targetEco) {
        relevantData = unifiedResult.data.filter((d: any) => d.economyCode === targetEco);
      }
    } else {
      // indicator mode: check which periods the active indicator has data across all economies
      const targetInd = _showModeToggle ? activeIndicatorCode : selectedIndicatorCodes[0];
      if (targetInd) {
        relevantData = unifiedResult.data.filter((d: any) => d.indicatorCode === targetInd);
      }
    }

    // Build the set of periods that have at least one non-null value in the relevant subset
    const periodsWithData = new Set<string>();
    if (relevantData && relevantData.length > 0) {
      relevantData.forEach((item: any) => {
        if (item.obsValue !== null && item.obsValue !== undefined && item.obsValue !== '') {
          periodsWithData.add(item.period);
        }
      });
    }

    // All periods in the fetched window that have at least one real value (sorted ascending)
    const availablePeriodsWithData = unifiedResult.periods.filter((p: string) => periodsWithData.has(p));

    // User-defined custom period selection: narrow to only those that have data
    if (selectedPeriods.length > 0) {
      return selectedPeriods.filter((p: string) => periodsWithData.has(p));
    }

    // Default: last 5 periods that actually have data for the current view
    return availablePeriodsWithData.slice(-5);
  }, [
    selectedPeriods, unifiedResult, isAricActive,
    activeEconomyCode, activeIndicatorCode, viewMode,
    selectedEconomies, selectedIndicatorCodes,
  ]);

  // Fetch metadata details dynamically when Drawer opens
  const { data: metadataDetails, isLoading: isMetadataLoading } = useQuery<any>({
    queryKey: ['metadata', metadataParams],
    queryFn: () => {
      const { indicatorCode, economyCode, counterpartAreaCode, datasetCode } = metadataParams!;
      const parts = [];
      if (indicatorCode) parts.push(`indicatorCode=${indicatorCode}`);
      if (economyCode) parts.push(`economyCode=${economyCode}`);
      if (counterpartAreaCode) parts.push(`counterpartAreaCode=${counterpartAreaCode}`);
      if (datasetCode) parts.push(`datasetCode=${datasetCode}`);
      parts.push(`periods=${activePeriods.join(',')}`);
      return fetch(`/api/public-explorer/metadata?${parts.join('&')}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch metadata details: ${res.statusText}`);
          return res.json();
        });
    },
    enabled: !!metadataParams && metadataDrawerVisible,
  });

  // Determine effective visualization view mode
  const showModeToggle = selectedIndicatorCodes.length > 1 && selectedEconomies.length > 1 && !isAricActive;
  const effectiveMode = isAricActive 
    ? 'indicator' 
    : (showModeToggle ? viewMode : (selectedIndicatorCodes.length > 1 ? 'economy' : 'indicator'));

  // Compute tabs based on view mode (hide maps & rankings when viewing a single country/economy)
  const availableTabs = [
    { id: 'table', label: 'Table', icon: <TableOutlined /> },
    { id: 'line', label: 'Line Chart', icon: <LineChartOutlined /> },
    { id: 'bar', label: 'Bar Chart', icon: <LineChartOutlined /> },
    { id: 'small_multiples', label: 'Small Multiples', icon: <LineChartOutlined /> },
    { id: 'map', label: 'Map', icon: <GlobalOutlined />, hideInEconomyMode: true },
    { id: 'heatmap', label: 'Heatmap', icon: <TableOutlined /> },
    { id: 'ranking', label: 'Ranking', icon: <LineChartOutlined />, hideInEconomyMode: true },
  ].filter(tab => !(effectiveMode === 'economy' && tab.hideInEconomyMode));

  // Reset activeTab if it is hidden in the current view mode
  useEffect(() => {
    const isAvailable = availableTabs.some(t => t.id === activeTab);
    if (!isAvailable) {
      setActiveTab('line');
    }
  }, [effectiveMode, activeTab]);

  // Filter observations and map keys dynamically for visualizations
  const activeInd = effectiveMode === 'indicator'
    ? (isAricActive 
        ? (activeIndicatorCode || selectedIndicatorCodes[0] || null) 
        : (showModeToggle ? activeIndicatorCode : (selectedIndicatorCodes[0] || null)))
    : null;

  const activeEco = effectiveMode === 'economy'
    ? (showModeToggle ? activeEconomyCode : (selectedEconomies[0] || null))
    : null;

  const visualizationData = React.useMemo(() => {
    if (!unifiedResult.data || unifiedResult.data.length === 0) return [];

    if (isAricActive) {
      const targetInd = activeInd || selectedIndicatorCodes[0];
      const targetEco = activeEco || activeEconomyCode || selectedEconomies[0];
      return unifiedResult.data.filter(d => d.indicatorCode === targetInd && d.economyCode === targetEco);
    }

    if (effectiveMode === 'indicator') {
      const targetInd = activeInd || selectedIndicatorCodes[0];
      return unifiedResult.data.filter(d => d.indicatorCode === targetInd);
    } else {
      const targetEco = activeEco || selectedEconomies[0];
      const filtered = unifiedResult.data.filter(d => d.economyCode === targetEco);
      // Map indicators to look like economies to trick Recharts drawing
      return filtered.map(d => ({
        ...d,
        economyCode: d.indicatorCode,
        economyName: d.indicatorName,
      }));
    }
  }, [unifiedResult.data, effectiveMode, activeInd, activeEco, selectedIndicatorCodes, selectedEconomies, isAricActive, activeEconomyCode]);

  const displayedData = React.useMemo(() => {
    if (activeTab === 'table') {
      return isAricActive
        ? unifiedResult.data.filter(d => 
            d.indicatorCode === (activeIndicatorCode || selectedIndicatorCodes[0]) &&
            (!selectedEconomies.length || d.economyCode === (activeEconomyCode || selectedEconomies[0]))
          )
        : (effectiveMode === 'indicator'
            ? visualizationData
            : unifiedResult.data.filter(d => d.economyCode === (activeEconomyCode || selectedEconomies[0]))
          );
    }
    return visualizationData;
  }, [activeTab, isAricActive, unifiedResult.data, activeIndicatorCode, selectedIndicatorCodes, selectedEconomies, activeEconomyCode, effectiveMode, visualizationData]);

  const hasConversionInDisplay = React.useMemo(() => {
    return displayedData.some(d => d._wasConverted);
  }, [displayedData]);

  const visualizationKeys = React.useMemo(() => {
    if (isAricActive) {
      return selectedCounterparts;
    }
    if (effectiveMode === 'indicator') {
      return selectedEconomies;
    } else {
      return selectedIndicatorCodes;
    }
  }, [effectiveMode, selectedEconomies, selectedIndicatorCodes, selectedCounterparts, isAricActive]);

  const visualizationTitle = React.useMemo(() => {
    if (isAricActive) {
      const targetInd = activeInd || selectedIndicatorCodes[0];
      const lookupKey = selectedIndicators.find(ind => ind.code === targetInd)
        ? `ind:${selectedIndicators.find(ind => ind.code === targetInd)?.datasetCode}:${targetInd}`
        : '';
      const indName = indicatorNameMap[lookupKey] || targetInd || '';
      const targetEco = activeEco || activeEconomyCode || selectedEconomies[0];
      const ecoName = economyNameMap[`eco:${targetEco}`] || targetEco || '';
      return `${indName} — ${ecoName}`;
    }
    if (effectiveMode === 'indicator') {
      const targetInd = activeInd || selectedIndicatorCodes[0];
      const lookupKey = selectedIndicators.find(ind => ind.code === targetInd)
        ? `ind:${selectedIndicators.find(ind => ind.code === targetInd)?.datasetCode}:${targetInd}`
        : '';
      return indicatorNameMap[lookupKey] || targetInd || '';
    } else {
      const targetEco = activeEco || selectedEconomies[0];
      return economyNameMap[`eco:${targetEco}`] || targetEco || '';
    }
  }, [effectiveMode, activeInd, activeEco, selectedIndicators, selectedEconomies, indicatorNameMap, economyNameMap, isAricActive, activeEconomyCode]);

  const activeIndicatorOptions = React.useMemo(() => {
    const seen = new Set();
    return selectedIndicators
      .filter(ind => {
        if (seen.has(ind.code)) return false;
        seen.add(ind.code);
        return true;
      })
      .map(ind => ({
        value: ind.code,
        label: `${capitalizeWords(indicatorNameMap[`ind:${ind.datasetCode}:${ind.code}`] || ind.code)} (${ind.datasetCode})`
      }));
  }, [selectedIndicators, indicatorNameMap]);

  const activeEconomyOptions = React.useMemo(() => {
    const seen = new Set();
    return selectedEconomies
      .filter(eco => {
        if (seen.has(eco)) return false;
        seen.add(eco);
        return true;
      })
      .map(eco => ({
        value: eco,
        label: economyNameMap[`eco:${eco}`] || eco
      }));
  }, [selectedEconomies, economyNameMap]);

  // 3. TREE SEARCH SEARCH FILTER (Preserving structure - titleMatch only to resolve GDP code ambiguity)
  const filterTreeData = (nodes: any[], query: string): any[] => {
    if (!nodes || !Array.isArray(nodes)) return [];
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();
    
    return nodes
      .map(node => {
        if (node.isLeaf) {
          const titleMatch = node.title?.toLowerCase().includes(lowerQuery);
          return titleMatch ? node : null;
        }

        const filteredChildren = filterTreeData(node.children || [], query);
        if (filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }

        return null;
      })
      .filter(Boolean);
  };

  // Custom tree node rendering helpers to differentiate folders vs charts
  const renderIndicatorTreeTitle = (nodeData: any) => {
    if (nodeData.isLeaf) {
      return (
        <span style={{ color: '#155dfc', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <BarChartOutlined style={{ color: '#155dfc', fontSize: '14px' }} />
          <span>{capitalizeWords(nodeData.title)}</span>
        </span>
      );
    } else {
      return (
        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FolderOutlined style={{ color: '#64748b', fontSize: '14px' }} />
          <span>{capitalizeWords(nodeData.title)}</span>
        </span>
      );
    }
  };

  const renderEconomyTreeTitle = (nodeData: any) => {
    if (nodeData.isLeaf) {
      return (
        <span style={{ color: '#334155', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {nodeData.iso2 ? (
            <img 
              src={`https://flagcdn.com/16x12/${nodeData.iso2.toLowerCase()}.png`} 
              alt="" 
              style={{ width: '16px', height: '12px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
          )}
          <span>{nodeData.title}</span>
        </span>
      );
    } else {
      return (
        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <GlobalOutlined style={{ color: '#64748b', fontSize: '14px' }} />
          <span>{nodeData.title}</span>
        </span>
      );
    }
  };

  const filteredTreeData = filterTreeData(treeData, searchQuery);

  // EEMRIOT, ARIC, and KIDB/ADO selection mutual exclusion logic
  const hasAricSelected = checkedIndicatorKeys.some(key => typeof key === 'string' && key.startsWith('ind:ARIC:'));
  const hasEemriotSelected = checkedIndicatorKeys.some(key => typeof key === 'string' && key.startsWith('ind:EEMRIOT:'));
  const hasKidbAdoSelected = checkedIndicatorKeys.some(key => typeof key === 'string' && key.startsWith('ind:') && !key.startsWith('ind:ARIC:') && !key.startsWith('ind:EEMRIOT:'));

  const processedTreeData = React.useMemo(() => {
    const disableGroup = hasAricSelected ? 'ARIC' : hasEemriotSelected ? 'EEMRIOT' : hasKidbAdoSelected ? 'KIDB_ADO' : null;

    const traverseAndDisable = (nodes: any[]): any[] => {
      if (!nodes || !Array.isArray(nodes)) return [];
      return nodes.map(node => {
        if (node.isLeaf) {
          let isNodeDisabled = false;
          if (disableGroup === 'ARIC' && node.datasetCode !== 'ARIC') {
            isNodeDisabled = true;
          } else if (disableGroup === 'EEMRIOT' && node.datasetCode !== 'EEMRIOT') {
            isNodeDisabled = true;
          } else if (disableGroup === 'KIDB_ADO' && (node.datasetCode === 'ARIC' || node.datasetCode === 'EEMRIOT')) {
            isNodeDisabled = true;
          }
          return {
            ...node,
            disabled: isNodeDisabled
          };
        }

        // It's a category/parent node
        const children = traverseAndDisable(node.children || []);
        // Disable parent if all its children are disabled
        const allChildrenDisabled = children.length > 0 && children.every(c => c.disabled);
        return {
          ...node,
          children,
          disabled: allChildrenDisabled
        };
      });
    };

    return traverseAndDisable(filteredTreeData);
  }, [filteredTreeData, hasAricSelected, hasEemriotSelected, hasKidbAdoSelected]);

  // 4. ACTION HANDLERS
  const handleDatasetChange = (checkedValues: any[]) => {
    setSelectedDatasets(checkedValues as string[]);
    // Reset indicator/economy selections that may no longer be valid
    setCheckedIndicatorKeys([]);
    setCheckedEconomyKeys([]);
    setSelectedPeriods([]);
    // Navigate to indicators panel so user sees the refreshed tree immediately
    setActivePanel('indicators');
  };

  // Collect all non-leaf keys from tree for expand all
  const getAllParentKeys = useCallback((nodes: any[]): React.Key[] => {
    const keys: React.Key[] = [];
    const traverse = (list: any[]) => {
      if (!list || !Array.isArray(list)) return;
      list.forEach(node => {
        if (!node.isLeaf) {
          keys.push(node.key);
          if (node.children) traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return keys;
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedIndicatorKeys(getAllParentKeys(filteredTreeData));
  }, [filteredTreeData, getAllParentKeys]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIndicatorKeys([]);
  }, []);

  const handleExpandAllEconomies = useCallback(() => {
    setExpandedEconomyKeys(getAllParentKeys(economyData));
  }, [economyData, getAllParentKeys]);

  const handleCollapseAllEconomies = useCallback(() => {
    setExpandedEconomyKeys([]);
  }, []);

  const handleDownloadCSV = () => {
    if (unifiedResult.data.length === 0) return;

    // Headers
    const headers = ['Dataset', 'Indicator Code', 'Indicator Name', 'Economy Code', 'Economy Name', 'Period', 'Freq', 'Value', 'Unit', 'Multiplier'];
    
    // Rows
    const rows = unifiedResult.data.map(item => [
      item.datasetCode,
      item.indicatorCode,
      `"${item.indicatorName.replace(/"/g, '""')}"`,
      item.economyCode,
      `"${item.economyName.replace(/"/g, '""')}"`,
      item.period,
      item.freqCode,
      item.obsValue ?? '',
      item.unitName,
      item.multiplierName
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `data_explorer_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const controlsPill = (
    <div className="no-radius controls-pill" style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 0,
      overflow: 'hidden',
    }}>
      {/* Active Indicator */}
      {selectedIndicatorCodes.length > 1 &&
       (isAricActive || effectiveMode === 'indicator') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRight: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Indicator:</span>
          <Select
            variant="borderless"
            style={{ width: '480px' }}
            value={activeIndicatorCode}
            onChange={(val) => setActiveIndicatorCode(val)}
            options={activeIndicatorOptions}
            size="small"
            popupMatchSelectWidth={false}
          />
        </div>
      )}

      {/* Active Economy */}
      {selectedEconomies.length > 1 &&
       (isAricActive || effectiveMode === 'economy') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRight: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Economy:</span>
          <Select
            variant="borderless"
            style={{ width: '160px' }}
            value={activeEconomyCode || selectedEconomies[0]}
            onChange={(val) => setActiveEconomyCode(val)}
            options={activeEconomyOptions}
            size="small"
          />
        </div>
      )}

      {/* Convert to USD Toggle */}
      {isCurrencyIndicator && (
        <div style={{ padding: '4px 8px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
          <Button
            type={isConvertToUSDActive ? 'primary' : 'default'}
            onClick={() => setIsConvertToUSDActive(!isConvertToUSDActive)}
            size="small"
            loading={isConvertToUSDActive && isExchangeRatesLoading}
            style={{
              fontWeight: 600,
              fontSize: '12px',
              borderRadius: '4px',
              backgroundColor: isConvertToUSDActive ? '#155dfc' : '#ffffff',
              color: isConvertToUSDActive ? '#ffffff' : '#334155',
              borderColor: isConvertToUSDActive ? '#155dfc' : '#cbd5e1',
              boxShadow: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Convert to US$
          </Button>
        </div>
      )}

      {/* Export CSV */}
      <div style={{ padding: '4px 8px' }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadCSV}
          size="small"
          style={{ border: 'none', background: 'transparent', boxShadow: 'none', fontWeight: 600, color: '#334155' }}
        >
          Export CSV
        </Button>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#f8fafc', padding: '104px 24px 40px', minHeight: 'calc(100vh - 80px)', width: '100%' }}>
      <div style={{ display: 'flex', gap: '24px', width: '100%', alignItems: 'flex-start' }}>
        
        {/* LEFT SIDEBAR FILTERS PANEL - Fixed width, moved left */}
        <div style={{ width: '350px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '104px' }}>
              
              {/* Your Selection Panel */}
              <Card 
                size="small"
                title={
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                    <CompassOutlined style={{ marginRight: '8px', color: '#155dfc' }} />
                    Your Selection
                  </span>
                }
                style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Indicators selection status */}
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        <BookOutlined style={{ marginRight: '6px' }} />
                        Indicators ({selectedIndicators.length})
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedIndicators.length > 0 && (
                          <span 
                            onClick={() => setCheckedIndicatorKeys([])}
                            style={{ color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            className="hover-link"
                          >
                            Clear
                          </span>
                        )}
                        {selectedIndicators.length > 0 && activePanel !== 'indicators' && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>}
                        {activePanel !== 'indicators' && (
                          <span 
                            onClick={() => setActivePanel('indicators')}
                            style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            className="hover-link"
                          >
                            Select →
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedIndicators.length > 0 ? (
                      <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', paddingRight: '4px' }}>
                        {selectedIndicators.map(ind => {
                          const lookupKey = `ind:${ind.datasetCode}:${ind.code}`;
                          const displayName = indicatorNameMap[lookupKey] || ind.code;
                          return (
                            <div key={`${ind.datasetCode}:${ind.code}`} style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#1e3a8a', lineHeight: '14px' }}>
                              <span style={{ wordBreak: 'break-word' }}>{capitalizeWords(displayName)} ({ind.datasetCode})</span>
                              <span 
                                style={{ marginLeft: '6px', color: '#93c5fd', cursor: 'pointer', fontWeight: 700, display: 'inline-block', lineHeight: '1' }}
                                onClick={() => {
                                  setCheckedIndicatorKeys(prev => prev.filter(k => k !== lookupKey));
                                }}
                              >
                                ×
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>None selected</span>
                    )}
                  </div>

                  {/* Economies selection status */}
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        <GlobalOutlined style={{ marginRight: '6px' }} />
                        Economies ({selectedEconomies.length})
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedEconomies.length > 0 && (
                          <span 
                            onClick={() => setCheckedEconomyKeys([])}
                            style={{ color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            className="hover-link"
                          >
                            Clear
                          </span>
                        )}
                        {selectedEconomies.length > 0 && activePanel !== 'economies' && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>}
                        {activePanel !== 'economies' && (
                          <span 
                            onClick={() => {
                              if (selectedIndicators.length > 0) {
                                setActivePanel('economies');
                              }
                            }}
                            style={{ 
                              color: selectedIndicators.length > 0 ? '#155dfc' : '#94a3b8', 
                              cursor: selectedIndicators.length > 0 ? 'pointer' : 'not-allowed', 
                              fontSize: '13px', 
                              fontWeight: 500 
                            }}
                            className={selectedIndicators.length > 0 ? 'hover-link' : ''}
                          >
                            Select →
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedEconomies.length > 0 ? (
                      <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', paddingRight: '4px' }}>
                        {selectedEconomies.map(eco => {
                          const lookupKey = `eco:${eco}`;
                          const displayName = economyNameMap[lookupKey] || eco;
                          const iso2 = economyIso2Map[lookupKey];
                          return (
                            <div key={eco} style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#1e3a8a', lineHeight: '14px' }}>
                              {iso2 && (
                                <img 
                                  src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`}
                                  alt=""
                                  style={{ width: '14px', height: '10px', marginRight: '6px', borderRadius: '1px', border: '1px solid #bfdbfe', objectFit: 'cover' }}
                                />
                              )}
                              <span>{displayName}</span>
                              <span 
                                style={{ marginLeft: '6px', color: '#93c5fd', cursor: 'pointer', fontWeight: 700, display: 'inline-block', lineHeight: '1' }}
                                onClick={() => {
                                  setCheckedEconomyKeys(prev => prev.filter(k => k !== lookupKey));
                                }}
                              >
                                ×
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>None selected</span>
                    )}
                  </div>



                  {/* Years range selection */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        <CalendarOutlined style={{ marginRight: '6px' }} />
                        Periods {selectedPeriods.length > 0 ? `(${activePeriods.length})` : '(Auto)'}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selectedPeriods.length > 0 && (
                          <span 
                            onClick={() => setSelectedPeriods([])}
                            style={{ color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            className="hover-link"
                          >
                            Clear
                          </span>
                        )}
                        {selectedPeriods.length > 0 && activePanel !== 'periods' && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>}
                        {activePanel !== 'periods' && (
                          <span 
                            onClick={() => {
                              if (obsResponse.periods.length > 0) {
                                if (selectedPeriods.length === 0) {
                                  // Pre-fill with the last 5 periods from the auto-computed activePeriods
                                  setSelectedPeriods(activePeriods.length > 0 ? activePeriods : obsResponse.periods.slice(-5));
                                }
                                setActivePanel('periods');
                              }
                            }}
                            style={{ 
                              color: obsResponse.periods.length > 0 ? '#155dfc' : '#94a3b8', 
                              cursor: obsResponse.periods.length > 0 ? 'pointer' : 'not-allowed', 
                              fontSize: '13px', 
                              fontWeight: 500 
                            }}
                            className={obsResponse.periods.length > 0 ? 'hover-link' : ''}
                          >
                            Select →
                          </span>
                        )}
                      </div>
                    </div>
                    {activePeriods.length > 0 && selectedPeriods.length > 0 ? (
                      <div style={{ fontSize: '12px', color: '#334155', fontWeight: 500 }}>
                        {activePeriods.length === 1
                          ? activePeriods[0]
                          : `${activePeriods[0]} – ${activePeriods[activePeriods.length - 1]}`
                        }
                        {activePeriods.length < selectedPeriods.length && (
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                            {' '}({activePeriods.length} of {selectedPeriods.length} with data)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Auto (Last 5 with data)</span>
                    )}
                  </div>

                </div>
              </Card>

              {/* Data points benchmark load details */}
              {isDataQueryEnabled && unifiedResult.data.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '10px 15px', borderRadius: '6px' }}>
                  <span>● {unifiedResult.data.length} data points</span>
                  <span>Loaded dynamically</span>
                </div>
              )}

            </div>

          {/* MAIN CONTENT AREA - Fills all remaining space */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ minHeight: '550px' }}>
              
              {/* WELCOME / EMPTY STATE USER GUIDE */}
              {activePanel === 'welcome' && (
                <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '20px', overflow: 'hidden' }}>
                  <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>ERDI Data Explorer</h1>
                    <p style={{ color: '#64748b', fontSize: '15px', maxWidth: '600px', margin: '0 auto' }}>
                      Browse, visualize, and compare official economic development statistics. Follow the quick guide below to get started.
                    </p>
                  </div>

                  <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} md={8}>
                      <Card 
                        hoverable 
                        size="small" 
                        onClick={() => setActivePanel('indicators')}
                        style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '10px' }}>
                          <div style={{ background: '#eff6ff', color: '#155dfc', padding: '12px', borderRadius: '8px', fontSize: '18px' }}>
                            <BookOutlined />
                          </div>
                          <div>
                            <h4 style={{ margin: '0 0 5px', fontSize: '15px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>1. Choose Indicators</span>
                              <span style={{ fontSize: '12px', color: '#155dfc', fontWeight: 500 }}>Select →</span>
                            </h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '18px' }}>
                              Click here to search and choose indicators from the visual hierarchy tree.
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Card 
                        hoverable 
                        size="small" 
                        onClick={() => setActivePanel('economies')}
                        style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '10px' }}>
                          <div style={{ background: '#eff6ff', color: '#155dfc', padding: '12px', borderRadius: '8px', fontSize: '18px' }}>
                            <GlobalOutlined />
                          </div>
                          <div>
                            <h4 style={{ margin: '0 0 5px', fontSize: '15px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>2. Select Economies</span>
                              <span style={{ fontSize: '12px', color: '#155dfc', fontWeight: 500 }}>Select →</span>
                            </h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '18px' }}>
                              Click here to choose regions and economies to compare. Only active countries appear.
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={24} md={8}>
                      <Card size="small" style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '10px' }}>
                          <div style={{ background: '#eff6ff', color: '#155dfc', padding: '12px', borderRadius: '8px', fontSize: '18px' }}>
                            <LineChartOutlined />
                          </div>
                          <div>
                            <h4 style={{ margin: '0 0 5px', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>3. Analyze & Compare</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '18px' }}>
                              Swap between Line, Bar, Map, Heatmap, and unified pivot tables. Download data in CSV instantly.
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  <div style={{ marginTop: '40px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '15px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <InfoCircleOutlined style={{ color: '#16a34a', fontSize: '16px' }} />
                    <span style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>
                      <strong>Time-Saving Defaults:</strong> You don't need to select years. The system will dynamically find and load the last 5 available periods for whatever data is selected.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                    <Button 
                      type="primary" 
                      size="large"
                      onClick={() => setActivePanel('indicators')}
                      style={{ background: '#155dfc', height: '48px', padding: '0 30px', borderRadius: '6px', fontSize: '15px', fontWeight: 600 }}
                    >
                      Start Selecting Indicators
                    </Button>
                  </div>

                </Card>
              )}

              {/* INDICATOR SELECTOR TREE */}
              {activePanel === 'indicators' && (
                <Card 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Select Indicators</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Expand / Collapse All buttons */}
                        <button
                          onClick={handleExpandAll}
                          title="Expand all categories"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', color: '#475569', cursor: 'pointer' }}
                        >
                          <PlusSquareOutlined style={{ fontSize: '12px' }} /> Expand All
                        </button>
                        <button
                          onClick={handleCollapseAll}
                          title="Collapse all categories"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', color: '#475569', cursor: 'pointer' }}
                        >
                          <MinusSquareOutlined style={{ fontSize: '12px' }} /> Collapse All
                        </button>
                        <Input
                          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                          placeholder="Search indicator by keyword or code..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{ width: '260px', borderRadius: '6px' }}
                          allowClear
                        />
                      </div>
                    </div>
                  }
                  actions={[
                    <div key="actions" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px', gap: '12px' }}>
                      <CustomButton onClick={() => {
                        setCheckedIndicatorKeys([]);
                        setActivePanel('welcome');
                      }}>
                        Cancel
                      </CustomButton>
                      <CustomButton 
                        type="primary"
                        onClick={() => {
                          if (selectedIndicators.length > 0) {
                            setActivePanel(selectedEconomies.length > 0 ? 'data' : 'economies');
                          } else {
                            setActivePanel('welcome');
                          }
                        }}
                      >
                        Done ({selectedIndicators.length} Selected)
                      </CustomButton>
                    </div>
                  ]}
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                >
                  {isTreeLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                      <Spin description="Generating dynamic indicator hierarchy..." size="large" />
                    </div>
                  ) : processedTreeData.length > 0 ? (
                    <div style={{ padding: '10px' }}>
                      {/* Dataset Compatibility Warning Banner */}
                      <div style={{ background: '#fef3c7', border: '1px solid #fde047', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <InfoCircleOutlined style={{ color: '#d97706', fontSize: '16px', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500, lineHeight: '18px' }}>
                          <strong>Indicator Compatibility:</strong> Indicators from different datasets cannot be viewed on the same table. KIDB or ADO, ARIC, and EEMRIOT cannot be viewed at the same time in the same table or graph because of their data structure.
                        </span>
                      </div>
                      
                      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        <Tree
                          checkable
                          expandedKeys={expandedIndicatorKeys}
                          onExpand={(keys) => setExpandedIndicatorKeys(keys as React.Key[])}
                          checkedKeys={checkedIndicatorKeys}
                          onCheck={(keys) => setCheckedIndicatorKeys(keys as React.Key[])}
                          treeData={processedTreeData}
                          titleRender={renderIndicatorTreeTitle}
                        />
                      </div>
                    </div>
                  ) : (
                    <Empty description="No indicators match the search or selected dataset criteria." style={{ padding: '40px 0' }} />
                  )}
                </Card>
              )}

               {/* ECONOMIES SELECTOR TREE */}
              {activePanel === 'economies' && (
                <Card 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Select Economies</span>
                      {economyData.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={handleExpandAllEconomies}
                            title="Expand all regions"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', color: '#475569', cursor: 'pointer' }}
                          >
                            <PlusSquareOutlined style={{ fontSize: '12px' }} /> Expand All
                          </button>
                          <button
                            onClick={handleCollapseAllEconomies}
                            title="Collapse all regions"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', color: '#475569', cursor: 'pointer' }}
                          >
                            <MinusSquareOutlined style={{ fontSize: '12px' }} /> Collapse All
                          </button>
                        </div>
                      )}
                    </div>
                  }
                  actions={[
                    <div key="actions" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px', gap: '12px' }}>
                      <CustomButton onClick={() => setActivePanel('welcome')}>
                        Cancel
                      </CustomButton>
                      <CustomButton 
                        type="primary"
                        onClick={() => {
                          if (selectedEconomies.length > 0) {
                            setActivePanel('data');
                          } else {
                            setActivePanel('welcome');
                          }
                        }}
                      >
                        Done ({selectedEconomies.length} Selected)
                      </CustomButton>
                    </div>
                  ]}
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                >
                  {isEconomyLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                      <Spin description="Filtering active economies..." size="large" />
                    </div>
                  ) : economyData.length > 0 ? (
                    <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px' }}>
                      <Tree
                        checkable
                        expandedKeys={expandedEconomyKeys}
                        onExpand={(keys) => setExpandedEconomyKeys(keys as React.Key[])}
                        checkedKeys={checkedEconomyKeys}
                        onCheck={(keys) => setCheckedEconomyKeys(keys as React.Key[])}
                        treeData={economyData}
                        titleRender={renderEconomyTreeTitle}
                      />
                    </div>
                  ) : (
                    <Empty description="No active economies found for the selected indicator/dataset." style={{ padding: '40px 0' }} />
                  )}
                </Card>
              )}



              {/* PERIODS SELECTOR PANEL */}
              {activePanel === 'periods' && (
                <Card 
                  title={<span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Select Time Periods</span>}
                  actions={[
                    <div key="actions" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px', gap: '12px' }}>
                      <CustomButton onClick={() => setActivePanel('data')}>Cancel</CustomButton>
                      <CustomButton 
                        type="primary"
                        onClick={() => setActivePanel('data')}
                      >
                        Apply Periods
                      </CustomButton>
                    </div>
                  ]}
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                >
                  {isObsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                      <Spin description="Loading available time periods..." size="large" />
                    </div>
                  ) : obsResponse?.periods?.length > 0 ? (
                    <div style={{ padding: '10px' }}>
                      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Select which years or periods to display in the visualizations.</p>
                      
                      {/* Quick selection toolbar */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span onClick={() => setSelectedPeriods(obsResponse.periods.slice(-5))} style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Last 5 Years</span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span onClick={() => setSelectedPeriods(obsResponse.periods.slice(-10))} style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Last 10 Years</span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span onClick={() => setSelectedPeriods(obsResponse.periods.slice(-15))} style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Last 15 Years</span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span onClick={() => setSelectedPeriods(obsResponse.periods.slice(-20))} style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Last 20 Years</span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span onClick={() => setSelectedPeriods(obsResponse.periods)} style={{ color: '#155dfc', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Select All</span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span onClick={() => setSelectedPeriods([])} style={{ color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }} className="hover-link">Deselect All</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                        {obsResponse.periods.map(period => (
                          <Checkbox 
                            key={period} 
                            checked={selectedPeriods.includes(period)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPeriods([...selectedPeriods, period]);
                              } else {
                                setSelectedPeriods(selectedPeriods.filter(p => p !== period));
                              }
                            }}
                          >
                            {period}
                          </Checkbox>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty description="No period limits available." />
                  )}
                </Card>
              )}

              {/* DATA VISUALIZATIONS SECTION */}
              {activePanel === 'data' && (
                <div>
                  {isObsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <Spin size="large" description="Loading active observations data..." />
                    </div>
) : isEemriotActive ? (
                    <EemriotVisualizer 
                      selectedEconomies={selectedEconomies}
                      selectedPeriods={selectedPeriods}
                      economyNameMap={economyNameMap}
                    />
                  ) : unifiedResult.data.length > 0 ? (
                    <>
                      {/* Sticky mask: sits in block flow (outside flex), covers the 104px navbar gap
                          so chart/table content doesn't bleed through while scrolling */}
                      <div style={{
                        position: 'sticky',
                        top: 0,
                        height: '104px',
                        marginTop: '-104px',
                        background: '#f8fafc',
                        zIndex: 101,
                        pointerEvents: 'none',
                      }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', position: 'relative' }}>
                       
                      {/* Control bar — sticky so it stays visible while scrolling the table */}
                      <div ref={tabBarRef} className="no-radius explorer-tab-bar" style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 0,
                        padding: '12px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        position: 'sticky',
                        top: '104px',
                        zIndex: 102,
                        marginBottom: activeTab === 'table' ? '5px' : '16px',
                      }}>
                        {/* Single row: Tabs left, Controls right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>

                          {/* Left: Tab buttons */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {availableTabs.map(tab => (
                              <CustomButton
                                key={tab.id}
                                type={activeTab === tab.id ? 'primary' : 'default'}
                                onClick={() => setActiveTab(tab.id)}
                                style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  {tab.icon}
                                  {tab.label}
                                </span>
                              </CustomButton>
                            ))}
                          </div>

                          {/* Right: Mode toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {/* Mode Toggle */}
                            {!isAricActive && !isEemriotActive && showModeToggle && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>View Mode:</span>
                                <Radio.Group
                                  value={viewMode}
                                  onChange={(e) => setViewMode(e.target.value)}
                                  optionType="button"
                                  buttonStyle="solid"
                                  size="small"
                                >
                                  <Radio.Button value="indicator">Indicator</Radio.Button>
                                  <Radio.Button value="economy">Economy</Radio.Button>
                                </Radio.Group>
                              </div>
                            )}
                          </div>

                        </div>

                      </div>

                      {/* Display content based on activeTab */}
                      <div>
                        {activeTab === 'line' && (
                          <LineChartCard 
                            data={visualizationData}
                            economies={visualizationKeys}
                            indicatorName={visualizationTitle}
                            unitName={effectiveMode === 'indicator' ? visualizationData[0]?.unitName : undefined}
                            multiplierName={effectiveMode === 'indicator' ? visualizationData[0]?.multiplierName : undefined}
                            extra={controlsPill}
                          />
                        )}
                        {activeTab === 'bar' && (
                          <BarChartCard 
                            data={visualizationData}
                            economies={visualizationKeys}
                            indicatorName={visualizationTitle}
                            unitName={effectiveMode === 'indicator' ? visualizationData[0]?.unitName : undefined}
                            multiplierName={effectiveMode === 'indicator' ? visualizationData[0]?.multiplierName : undefined}
                            extra={controlsPill}
                          />
                        )}
                        {activeTab === 'small_multiples' && (
                          <SmallMultiplesCard 
                            data={visualizationData}
                            economies={visualizationKeys}
                            indicatorName={visualizationTitle}
                            unitName={effectiveMode === 'indicator' ? visualizationData[0]?.unitName : undefined}
                            multiplierName={effectiveMode === 'indicator' ? visualizationData[0]?.multiplierName : undefined}
                            extra={controlsPill}
                          />
                        )}
                        {activeTab === 'table' && (
                          <DataTableCard 
                            data={
                              isAricActive
                                ? unifiedResult.data.filter(d => 
                                    d.indicatorCode === (activeIndicatorCode || selectedIndicatorCodes[0]) &&
                                    (!selectedEconomies.length || d.economyCode === (activeEconomyCode || selectedEconomies[0]))
                                  )
                                : (effectiveMode === 'indicator'
                                    ? visualizationData
                                    : unifiedResult.data.filter(d => d.economyCode === (activeEconomyCode || selectedEconomies[0]))
                                  )
                            }
                            periods={activePeriods}
                            extra={controlsPill}
                            onInfoClick={handleInfoClick}
                            orderedIndicatorCodes={selectedIndicatorCodes}
                            stickyTopOffset={tabBarHeight + 5}
                          />
                        )}
                        {activeTab === 'map' && (
                          <MapCard 
                            data={visualizationData}
                            indicatorName={visualizationTitle}
                            unitName={visualizationData[0]?.unitName}
                            multiplierName={visualizationData[0]?.multiplierName}
                            periods={activePeriods}
                            extra={controlsPill}
                            activeEconomyCode={activeEconomyCode || selectedEconomies[0]}
                            isAric={isAricActive}
                          />
                        )}
                        {activeTab === 'heatmap' && (
                          <HeatmapCard 
                            data={visualizationData}
                            economies={visualizationKeys}
                            periods={activePeriods}
                            indicatorName={visualizationTitle}
                            unitName={effectiveMode === 'indicator' ? visualizationData[0]?.unitName : undefined}
                            multiplierName={effectiveMode === 'indicator' ? visualizationData[0]?.multiplierName : undefined}
                            extra={controlsPill}
                          />
                        )}
                        {activeTab === 'ranking' && (
                          <RankingCard 
                            data={visualizationData}
                            indicatorName={visualizationTitle}
                            unitName={visualizationData[0]?.unitName}
                            multiplierName={visualizationData[0]?.multiplierName}
                            periods={activePeriods}
                            extra={controlsPill}
                          />
                        )}
                      </div>



                    </div>
                    </>
                  ) : (
                    <Card style={{ borderRadius: 12, padding: '40px 0', textAlign: 'center' }}>
                      <Empty description="No observations match the selection. Try selecting other indicators or economies." />
                      <CustomButton 
                        type="primary" 
                        onClick={() => setActivePanel('indicators')}
                        style={{ marginTop: '20px' }}
                      >
                        Adjust Selections
                      </CustomButton>
                    </Card>
                  )}
                </div>
              )}

            </div>
          </div>
        
      </div>

      <Drawer
        title={
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              {metadataDetails?.name || 'Metadata Details'}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Indicator Code: {metadataDetails?.indicatorCode || metadataParams?.indicatorCode}
            </span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => setMetadataDrawerVisible(false)}
        open={metadataDrawerVisible}
        styles={{
          header: { borderBottom: '1px solid #f1f5f9', padding: '16px 24px' },
          body: { padding: '24px', background: '#f8fafc' }
        }}
      >
        {isMetadataLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : metadataDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Definition */}
            {metadataDetails.definition && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6366f1', fontWeight: 700 }}>
                  Definition
                </h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-line' }}>
                  {metadataDetails.definition}
                </p>
              </div>
            )}

            {/* Unit of Measure & Magnitude */}
            {(metadataDetails.defaultUnitName || metadataDetails.defaultMultiplierName) && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {metadataDetails.defaultUnitName && (
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 700 }}>
                      Unit of Measure
                    </h4>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {metadataDetails.defaultUnitName}
                    </span>
                  </div>
                )}
                {metadataDetails.defaultMultiplierName && (
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 700 }}>
                      Magnitude
                    </h4>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {metadataDetails.defaultMultiplierName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Sources */}
            {metadataDetails.sources && metadataDetails.sources.length > 0 && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f766e', fontWeight: 700 }}>
                  Source
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {metadataDetails.sources.map((s: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '13px', lineHeight: '1.5' }}>
                      {s.periods ? (
                        <>
                          <strong style={{ color: '#0f766e' }}>For {s.periods}:</strong>{' '}
                          <span style={{ color: '#334155' }}>{s.text}</span>
                        </>
                      ) : (
                        <span style={{ color: '#334155' }}>{s.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Methodology */}
            {metadataDetails.methodologies && metadataDetails.methodologies.length > 0 && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b45309', fontWeight: 700 }}>
                  Methodology
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {metadataDetails.methodologies.map((m: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '13px', lineHeight: '1.5' }}>
                      {m.periods ? (
                        <>
                          <strong style={{ color: '#b45309' }}>For {m.periods}:</strong>{' '}
                          <span style={{ color: '#334155' }}>{m.text}</span>
                        </>
                      ) : (
                        <span style={{ color: '#334155' }}>{m.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {metadataDetails.notes && metadataDetails.notes.length > 0 && (
              <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#be123c', fontWeight: 700 }}>
                  Notes
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {metadataDetails.notes.map((n: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '13px', lineHeight: '1.5' }}>
                      {n.periods ? (
                        <>
                          <strong style={{ color: '#be123c' }}>For {n.periods}:</strong>{' '}
                          <span style={{ color: '#334155' }}>{n.text}</span>
                        </>
                      ) : (
                        <span style={{ color: '#334155' }}>{n.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Empty description="No metadata available for this selection." />
        )}
      </Drawer>
    </div>
  );
}
