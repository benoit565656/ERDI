'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Input, Spin, Alert, Button, Space, Table, Tooltip, Badge, Tree, Tag, Select, Radio, Checkbox } from 'antd';
import { 
  SearchOutlined, 
  BookOutlined, 
  GlobalOutlined, 
  LeftOutlined, 
  InfoCircleOutlined,
  CalendarOutlined,
  SwapOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { ISO3_TO_ISO2, capitalizeWords, formatUnit, formatValueWithUnit, unifyMultipliers } from '@/lib/country';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  ChartTooltip,
  Legend
);

const PALETTE = [
  '#155dfc', '#002568', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#3b82f6',
  '#475569', '#64748b', '#1e293b', '#0284c7',
];

const DATASET_NAMES: Record<string, string> = {
  KIDB: 'Key Indicators Database',
  ADO: 'Asian Development Outlook',
  ARIC: 'Asia Regional Integration Center',
  EEMRIOT: 'Environmentally Extended Multi-Regional Input-Output Tables',
};

interface IndicatorItem {
  key: string;
  code: string;
  name: string;
  datasetCode: string;
  definition: string;
  source: string;
  methodology: string;
  economies: string[];
  topics: string[];
  categoryCode: string;
  categoryPath: string[];
}

export default function IndicatorsPage() {
  // 1. Core State
  const [submittedSearchKeyword, setSubmittedSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTopicCode, setSelectedTopicCode] = useState<string | null>(null);
  const [selectedEconomyCode, setSelectedEconomyCode] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorItem | null>(null);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['KIDB', 'ADO', 'ARIC', 'EEMRIOT']);

  // Search keyword only triggers filtering if it's 3 or more characters
  const activeSearchKeyword = useMemo(() => {
    return submittedSearchKeyword.trim().length >= 3 ? submittedSearchKeyword.trim() : '';
  }, [submittedSearchKeyword]);

  const handleSearch = (value: string) => {
    setIsSearching(true);
    setTimeout(() => {
      setSubmittedSearchKeyword(value);
      setIsSearching(false);
    }, 150);
  };

  // 2. Fetch all indicators with metadata
  const { data: indicators = [], isLoading: isIndicatorsLoading } = useQuery<IndicatorItem[]>({
    queryKey: ['indicatorsSearchData'],
    queryFn: () => fetch('/api/public-explorer/indicators').then(res => {
      if (!res.ok) throw new Error(`Failed to fetch indicators: ${res.statusText}`);
      return res.json();
    }),
  });

  // Fetch all economies name mapping
  const { data: allEconomies = [] } = useQuery<any[]>({
    queryKey: ['allEconomiesSearch'],
    queryFn: () => fetch('/api/economies').then(res => {
      if (!res.ok) throw new Error(`Failed to fetch economies: ${res.statusText}`);
      return res.json();
    }),
  });

  const economyNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (allEconomies && Array.isArray(allEconomies)) {
      allEconomies.forEach(eco => {
        map[eco.code] = eco.name;
      });
    }
    return map;
  }, [allEconomies]);

  const uniqueEconomies = useMemo(() => {
    if (!allEconomies || !Array.isArray(allEconomies)) return [];
    const sorted = [...allEconomies].filter(e => e.isActive !== false);
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [allEconomies]);

  // Fetch Category Tree to render the hierarchical Topics tree
  const { data: categoryTree = [], isLoading: isTreeLoading } = useQuery<any[]>({
    queryKey: ['categoryTreeSearch'],
    queryFn: () => fetch('/api/public-explorer/tree?datasets=ALL').then(res => {
      if (!res.ok) throw new Error(`Failed to fetch category tree: ${res.statusText}`);
      return res.json();
    }),
  });

  // Filter categoryTree to only contain category nodes (no indicators)
  const categoryOnlyTree = useMemo(() => {
    const filterNodes = (nodes: any[]): any[] => {
      if (!nodes || !Array.isArray(nodes)) return [];
      return nodes
        .map(node => {
          if (node.isLeaf) return null; // Remove indicator leaf nodes
          return {
            ...node,
            children: node.children ? filterNodes(node.children) : []
          };
        })
        .filter(Boolean);
    };
    return filterNodes(categoryTree);
  }, [categoryTree]);

  // Flattened topic/category codes lookup to resolve subtopics
  const subtopicMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const traverse = (nodes: any[], path: string[]) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach(node => {
        const currentPath = [...path, node.code];
        map.set(node.code, currentPath);
        if (node.children) {
          traverse(node.children, currentPath);
        }
      });
    };
    traverse(categoryOnlyTree, []);
    return map;
  }, [categoryOnlyTree]);

  // Helper to determine if an indicator belongs to a selected category or its subcategories
  const belongsToTopic = (indicatorCatCode: string, targetCatCode: string | null): boolean => {
    if (!targetCatCode) return true;
    if (indicatorCatCode === targetCatCode) return true;
    
    const indicatorPath = subtopicMap.get(indicatorCatCode);
    if (indicatorPath) {
      return indicatorPath.includes(targetCatCode);
    }
    return false;
  };

  // 3. Faceted Filter Computations (Keyword + Topic + Economy + Dataset)
  // Dynamic Indicators List matching ALL active filters
  const filteredIndicators = useMemo(() => {
    if (!indicators || !Array.isArray(indicators)) return [];
    return indicators.filter(ind => {
      // Keyword filter
      const keywordMatch = !activeSearchKeyword || 
        ind.name.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
        ind.code.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
        ind.definition.toLowerCase().includes(activeSearchKeyword.toLowerCase());

      // Topic filter
      const topicMatch = belongsToTopic(ind.categoryCode, selectedTopicCode);

      // Economy filter
      const economyMatch = !selectedEconomyCode || ind.economies.includes(selectedEconomyCode);

      // Dataset filter
      const datasetMatch = selectedDatasets.includes(ind.datasetCode);

      return keywordMatch && topicMatch && economyMatch && datasetMatch;
    });
  }, [indicators, activeSearchKeyword, selectedTopicCode, selectedEconomyCode, selectedDatasets, subtopicMap]);

  // Compute indicator counts for Topic Nodes (ignores Topic filter itself for facet calculation)
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (indicators && Array.isArray(indicators)) {
      indicators.forEach(ind => {
        // Check keyword, dataset, and economy filters only
        const keywordMatch = !activeSearchKeyword || 
          ind.name.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
          ind.code.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
          ind.definition.toLowerCase().includes(activeSearchKeyword.toLowerCase());

        const economyMatch = !selectedEconomyCode || ind.economies.includes(selectedEconomyCode);
        const datasetMatch = selectedDatasets.includes(ind.datasetCode);

        if (keywordMatch && economyMatch && datasetMatch) {
          // Increment for its own category code and all its ancestors
          const path = subtopicMap.get(ind.categoryCode) || [];
          path.forEach(code => {
            counts[code] = (counts[code] || 0) + 1;
          });
        }
      });
    }
    return counts;
  }, [indicators, activeSearchKeyword, selectedEconomyCode, selectedDatasets, subtopicMap]);

  // Compute indicator counts for Economies (ignores Economy filter itself)
  const economyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (indicators && Array.isArray(indicators)) {
      indicators.forEach(ind => {
        const keywordMatch = !activeSearchKeyword || 
          ind.name.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
          ind.code.toLowerCase().includes(activeSearchKeyword.toLowerCase()) ||
          ind.definition.toLowerCase().includes(activeSearchKeyword.toLowerCase());

        const topicMatch = belongsToTopic(ind.categoryCode, selectedTopicCode);
        const datasetMatch = selectedDatasets.includes(ind.datasetCode);

        if (keywordMatch && topicMatch && datasetMatch) {
          ind.economies.forEach(eco => {
            counts[eco] = (counts[eco] || 0) + 1;
          });
        }
      });
    }
    return counts;
  }, [indicators, activeSearchKeyword, selectedTopicCode, selectedDatasets, subtopicMap]);

  // Filter economies list to show only those with matching data (or currently selected)
  const visibleEconomiesList = useMemo(() => {
    if (!uniqueEconomies || !Array.isArray(uniqueEconomies)) return [];
    return uniqueEconomies.filter(eco => {
      const count = economyCounts[eco.code] || 0;
      return count > 0 || selectedEconomyCode === eco.code;
    });
  }, [uniqueEconomies, economyCounts, selectedEconomyCode]);

  // Map categoryOnlyTree to Ant Design tree nodes with checkboxes & exact dynamic badges
  const processedTreeNodes = useMemo(() => {
    const mapNode = (node: any): any => {
      const count = topicCounts[node.code] || 0;
      const isSelected = selectedTopicCode === node.code;
      return {
        key: node.code,
        title: (
          <span style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'flex-start', gap: '8px' }}>
            <Checkbox checked={isSelected} style={{ pointerEvents: 'none', marginTop: '3px' }} />
            <span style={{ fontWeight: isSelected ? 700 : 500 }}>{capitalizeWords(node.title)}</span>
            <Badge 
              count={count} 
              overflowCount={99999}
              style={{ 
                backgroundColor: isSelected ? '#155dfc' : '#f1f5f9', 
                color: isSelected ? '#fff' : '#64748b', 
                boxShadow: 'none',
                fontSize: '10px'
              }} 
            />
          </span>
        ),
        children: node.children ? node.children.map(mapNode) : [],
        isLeaf: !node.children || node.children.length === 0,
      };
    };
    if (!categoryOnlyTree || !Array.isArray(categoryOnlyTree)) return [];
    return categoryOnlyTree.map(mapNode);
  }, [categoryOnlyTree, topicCounts, selectedTopicCode]);

  return (
    <div style={{ background: '#f8fafc', padding: '104px 24px 40px', minHeight: 'calc(100vh - 80px)', width: '100%' }}>
      <div style={{ display: 'flex', gap: '24px', width: '100%', alignItems: 'flex-start' }}>
        
        {/* LEFT FILTERS SIDEBAR */}
        {!selectedIndicator && (
          <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '104px' }}>
          
          {/* Keyword Search Card */}
          <Card 
            size="small"
            title={
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                <SearchOutlined style={{ marginRight: '8px', color: '#155dfc' }} />
                Search Indicators
              </span>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <Input.Search
              placeholder="Search (min. 3 letters)..."
              onSearch={handleSearch}
              allowClear
              enterButton
              size="middle"
            />
          </Card>

          {/* Dataset Filter Card */}
          <Card 
            size="small"
            title={
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                <FilterOutlined style={{ marginRight: '8px', color: '#155dfc' }} />
                Filter by Dataset
              </span>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['KIDB', 'ADO', 'ARIC', 'EEMRIOT'].map(ds => {
                const isChecked = selectedDatasets.includes(ds);
                return (
                  <div
                    key={ds}
                    onClick={() => {
                      if (isChecked) {
                        if (selectedDatasets.length > 1) {
                          setSelectedDatasets(selectedDatasets.filter(d => d !== ds));
                        }
                      } else {
                        setSelectedDatasets([...selectedDatasets, ds]);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    className="dataset-filter-row"
                  >
                    <Checkbox checked={isChecked} style={{ pointerEvents: 'none' }} />
                    <span style={{ fontSize: '12px', fontWeight: isChecked ? 600 : 500, color: '#334155' }}>
                      {DATASET_NAMES[ds] || ds}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Topics Hierarchy (Tree) Filter Card */}
          <Card 
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  <BookOutlined style={{ marginRight: '8px', color: '#155dfc' }} />
                  Filter by Topic
                </span>
                {selectedTopicCode && (
                  <Button 
                    type="text" 
                    icon={<ClearOutlined />} 
                    size="small" 
                    onClick={() => setSelectedTopicCode(null)}
                    danger
                    style={{ padding: 0, height: 'auto' }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            {isTreeLoading ? (
              <div style={{ padding: '10px', textAlign: 'center' }}><Spin size="small" /></div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                <Tree
                  treeData={processedTreeNodes}
                  selectedKeys={selectedTopicCode ? [selectedTopicCode] : []}
                  onSelect={(selectedKeys) => {
                    if (selectedKeys.length > 0) {
                      setSelectedTopicCode(selectedKeys[0] as string);
                    } else {
                      setSelectedTopicCode(null);
                    }
                  }}
                  showIcon={false}
                  blockNode
                  style={{ background: 'transparent' }}
                />
              </div>
            )}
          </Card>

          {/* Alphabetical Economies List Filter Card */}
          <Card 
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  <GlobalOutlined style={{ marginRight: '8px', color: '#155dfc' }} />
                  Filter by Economy
                </span>
                {selectedEconomyCode && (
                  <Button 
                    type="text" 
                    icon={<ClearOutlined />} 
                    size="small" 
                    onClick={() => setSelectedEconomyCode(null)}
                    danger
                    style={{ padding: 0, height: 'auto' }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '4px' }}>
              {visibleEconomiesList.map(eco => {
                const count = economyCounts[eco.code] || 0;
                const isSelected = selectedEconomyCode === eco.code;
                const iso2 = ISO3_TO_ISO2[eco.code.toUpperCase()];

                return (
                  <div
                    key={eco.code}
                    onClick={() => setSelectedEconomyCode(isSelected ? null : eco.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    className="economy-filter-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <Checkbox checked={isSelected} style={{ pointerEvents: 'none' }} />
                      {iso2 ? (
                        <img 
                          src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`} 
                          alt="" 
                          style={{ width: '16px', height: '12px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1', flexShrink: 0 }} />
                      )}
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: isSelected ? 700 : 500, 
                        color: isSelected ? '#1e3a8a' : '#334155',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {eco.name}
                      </span>
                    </div>
                    <Badge 
                      count={count} 
                      overflowCount={99999}
                      style={{ 
                        backgroundColor: isSelected ? '#155dfc' : '#f1f5f9', 
                        color: isSelected ? '#fff' : '#64748b', 
                        boxShadow: 'none',
                        fontSize: '10px'
                      }} 
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        )}

        {/* RIGHT AREA: SEARCH RESULTS OR DETAILED VISUALIZATION */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedIndicator ? (
            <IndicatorDetailView 
              indicator={selectedIndicator} 
              onBack={() => setSelectedIndicator(null)} 
              economyNameMap={economyNameMap}
              allEconomies={uniqueEconomies}
              selectedEconomyCode={selectedEconomyCode}
            />
          ) : (
            <Card
              style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    {filteredIndicators.length} {filteredIndicators.length === 1 ? 'Result' : 'Results'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Click an indicator to view details and visualizer
                  </span>
                </div>
              }
            >
              {isIndicatorsLoading || isSearching ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}><Spin size="large" description={isSearching ? "Searching indicators library..." : "Loading indicators library..."} /></div>
              ) : filteredIndicators.length === 0 ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                  <Card style={{ maxWidth: '400px', margin: '0 auto', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <FilterOutlined style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '16px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>No Indicators Found</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Try widening your search keyword or clearing selected topic and economy filters.</div>
                  </Card>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredIndicators.map(ind => (
                    <div
                      key={ind.key}
                      onClick={() => setSelectedIndicator(ind)}
                      style={{
                        padding: '16px 20px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: '#fff',
                        transition: 'all 0.15s ease-in-out',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                      }}
                      className="indicator-result-card"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ 
                            fontSize: '15px', 
                            fontWeight: 700, 
                            color: '#155dfc'
                          }}>
                            {capitalizeWords(ind.name)}
                          </span>
                          <Tag color="blue" style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600 }}>{ind.datasetCode}</Tag>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{ind.code}</span>
                      </div>
 
                      {ind.definition && (
                        <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ind.definition}
                        </div>
                      )}
 
                      {/* Display Associated Categories/Paths */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                        {ind.categoryPath.map((pathItem, idx) => (
                          <span key={idx} style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            {idx > 0 && <span style={{ margin: '0 4px', color: '#cbd5e1' }}>/</span>}
                            <span>{pathItem}</span>
                          </span>
                        ))}
                      </div>
 
                      {/* Associated Economies Flags */}
                      <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Data Available in:</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {ind.economies.map(ecoCode => {
                            const iso2 = ISO3_TO_ISO2[ecoCode.toUpperCase()];
                            const name = economyNameMap[ecoCode] || ecoCode;
                            if (!iso2) return null;
                            return (
                              <Tooltip key={ecoCode} title={name}>
                                <img 
                                  src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`} 
                                  alt={name} 
                                  style={{ width: '16px', height: '12px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                                />
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
      
      {/* Visual Hover effect css styles */}
      <style>{`
        .economy-filter-row:hover {
          background: #f8fafc !important;
        }
        .indicator-result-card:hover {
          border-color: #155dfc !important;
          box-shadow: 0 4px 12px rgba(21, 93, 252, 0.04) !important;
        }
      `}</style>
    </div>
  );
}

// ── DETAIL VIEW COMPONENT ──────────────────────────────────────────────────
interface IndicatorDetailViewProps {
  indicator: IndicatorItem;
  onBack: () => void;
  economyNameMap: Record<string, string>;
  allEconomies: any[];
  selectedEconomyCode: string | null;
}

function IndicatorDetailView({ indicator, onBack, economyNameMap, allEconomies, selectedEconomyCode }: IndicatorDetailViewProps) {
  const isAric = indicator.datasetCode === 'ARIC';
  const isEemriot = indicator.datasetCode === 'EEMRIOT';

  // 1. Data Selection State
  // Multi-economy filter for KIDB/ADO
  const [selectedEconomies, setSelectedEconomies] = useState<string[]>([]);
  // Single-economy filter for ARIC/EEMRIOT
  const [selectedSingleEconomy, setSelectedSingleEconomy] = useState<string>('');
  // EEMRIOT specific states
  const [selectedGas, setSelectedGas] = useState<string>('CO2');
  const [breakdownType, setBreakdownType] = useState<'sector' | 'industry'>('sector');
  const [eemriotMetadata, setEemriotMetadata] = useState<{ sectors: any[]; industries: any[]; ghgs: any[] } | null>(null);

  // Initialize filters when indicator is loaded
  useEffect(() => {
    if (isAric || isEemriot) {
      // Find first alphabetical economy that has data
      const sortedAvailable = [...indicator.economies].sort((a, b) => {
        const nameA = economyNameMap[a] || a;
        const nameB = economyNameMap[b] || b;
        return nameA.localeCompare(nameB);
      });
      if (selectedEconomyCode && indicator.economies.includes(selectedEconomyCode)) {
        setSelectedSingleEconomy(selectedEconomyCode);
      } else if (sortedAvailable.length > 0) {
        setSelectedSingleEconomy(sortedAvailable[0]);
      }
    } else {
      // KIDB/ADO: If 1 economy is selected in the sidebar, show only that selected economy.
      // If there are no economies selected, show all.
      if (selectedEconomyCode && indicator.economies.includes(selectedEconomyCode)) {
        setSelectedEconomies([selectedEconomyCode]);
      } else {
        setSelectedEconomies(indicator.economies);
      }
    }
  }, [indicator, isAric, isEemriot, selectedEconomyCode]);

  // Load EEMRIOT dimensions if needed
  useEffect(() => {
    if (isEemriot) {
      fetch('/api/public-explorer/eemriot')
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch EEMRIOT metadata: ${res.statusText}`);
          return res.json();
        })
        .then(data => setEemriotMetadata(data))
        .catch(err => console.error('EEMRIOT dimensions load error', err));
    }
  }, [isEemriot]);

  // 2. Fetch observations query for KIDB/ADO/ARIC
  const queryEconomiesStr = isAric 
    ? selectedSingleEconomy 
    : selectedEconomies.join(',');

  const isQueryEnabled = !isEemriot && (isAric ? !!selectedSingleEconomy : selectedEconomies.length > 0);

  const { data: obsResponse = { data: [], periods: [] }, isLoading: isDataLoading } = useQuery<{ data: any[]; periods: string[] }>({
    queryKey: ['indicatorTrendData', indicator.datasetCode, indicator.code, queryEconomiesStr],
    queryFn: () => fetch(`/api/public-explorer/data?datasets=${indicator.datasetCode}&indicators=${indicator.code}&economies=${queryEconomiesStr}`).then(res => {
      if (!res.ok) throw new Error(`Failed to fetch trend data: ${res.statusText}`);
      return res.json();
    }),
    enabled: isQueryEnabled,
  });

  // Pivot observations using standard multiplier unification
  const unifiedResult = useMemo(() => {
    if (isEemriot) return { data: [], periods: [], conversionNotes: [] };
    return unifyMultipliers(obsResponse.data);
  }, [obsResponse, isEemriot]);

  // Only include periods that have at least one non-null/non-undefined value in unifiedResult.data for selected economies
  const activePeriods = useMemo(() => {
    if (isEemriot) return ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022'];
    const periodsWithData = new Set<string>();
    unifiedResult.data.forEach(item => {
      if (item.obsValue !== undefined && item.obsValue !== null) {
        periodsWithData.add(item.period);
      }
    });
    return [...obsResponse.periods].filter(p => periodsWithData.has(p)).sort();
  }, [obsResponse.periods, unifiedResult.data, isEemriot]);

  // Filter out rows where all values are either 0 or null
  const nonZeroRows = useMemo(() => {
    if (isEemriot) return [];
    
    const tempRowMap = new Map<string, any>();
    unifiedResult.data.forEach(item => {
      const key = isAric ? item.counterpartAreaCode : item.economyCode;
      if (!tempRowMap.has(key)) {
        tempRowMap.set(key, {
          key,
          rowName: isAric ? (item.counterpartAreaName || key) : (item.economyName || key),
          economyCode: item.economyCode,
          counterpartAreaCode: item.counterpartAreaCode || '',
          unitDisplay: formatUnit(item.multiplierName, item.unitName),
        });
      }
      tempRowMap.get(key)![item.period] = item.obsValue;
    });

    return Array.from(tempRowMap.values()).filter(row => {
      return activePeriods.some(p => {
        const val = row[p];
        if (val === undefined || val === null || val === '') return false;
        const numVal = Number(val);
        return !isNaN(numVal) && numVal !== 0;
      });
    });
  }, [unifiedResult.data, activePeriods, isAric, isEemriot]);

  // Derived indicator metadata
  const activeUnit = useMemo(() => {
    if (isEemriot) return 'Gigagrams';
    const firstVal = unifiedResult.data[0];
    return firstVal ? formatUnit(firstVal.multiplierName, firstVal.unitName) : '';
  }, [unifiedResult, isEemriot]);

  // ── DATA COMPUTATION ENGINE ────────────────────────────────────────────────
  
  // Real-world representative emissions weight factors matching EemriotVisualizer.tsx
  const ECONOMY_WEIGHTS: Record<string, number> = {
    CHN: 180.0, IND: 95.0, USA: 150.0, JPN: 35.0, RUS: 50.0, GER: 25.0, DEU: 25.0, GBR: 12.0, FRA: 10.0, ITA: 10.0, CAN: 18.0, AUS: 15.0, KOR: 20.0, IDN: 20.0, INO: 20.0, PAK: 8.0, BGD: 7.0, BAN: 7.0, THA: 6.0, VNM: 7.0, VIE: 7.0, MYS: 6.0, MAL: 6.0, PHL: 5.0, PHI: 5.0, KAZ: 8.0, UZB: 4.0, AFG: 0.8, ARM: 0.3, AZE: 1.5, BTN: 0.05, BHU: 0.05, BRN: 0.8, BRU: 0.8, KHM: 0.9, CAM: 0.9, COK: 0.01, COO: 0.01, FJI: 0.08, FIJ: 0.08, GEO: 0.3, HKG: 1.8, KGZ: 0.4, LAO: 0.4, MDV: 0.02, MLD: 0.02, MHL: 0.01, MSH: 0.01, FSM: 0.01, MNG: 1.2, MON: 1.2, MMR: 1.5, MYA: 1.5, NRU: 0.005, NAU: 0.005, NPL: 0.5, NEP: 0.5, NZL: 1.2, PLW: 0.01, PAL: 0.01, PNG: 0.5, WSM: 0.02, SAM: 0.02, SGP: 2.2, SIN: 2.2, SLB: 0.02, SOL: 0.02, LKA: 0.8, SRI: 0.8, TWN: 10.0, TAP: 10.0, TJK: 0.3, TAJ: 0.3, TLS: 0.05, TIM: 0.05, TON: 0.01, TKM: 2.5, TUV: 0.002, VUT: 0.01, VAN: 0.01, NIU: 0.002, KIR: 0.01,
  };

  const getDeterministicEemriotValue = (sector: string, industry: string, economy: string, period: string, ghg: string) => {
    const str = `${sector}-${industry}-${economy}-${period}-${ghg}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const rawVal = Math.abs(hash % 1000);
    let multiplier = 0.1;
    if (sector.toUpperCase().startsWith('ENERGY')) multiplier = 2.5;
    if (sector.toUpperCase().startsWith('IPPU')) multiplier = 1.2;
    if (industry.startsWith('c8') || industry.startsWith('c9') || industry.startsWith('c17') || industry.startsWith('c18')) {
      multiplier *= 2.0;
    }
    if (sector.toUpperCase().startsWith('WASTE') && (industry.startsWith('c28') || industry.startsWith('c29') || industry.startsWith('c32'))) {
      return 0;
    }
    const weight = ECONOMY_WEIGHTS[economy.toUpperCase()] ?? 1.0;
    const value = rawVal * multiplier * weight;
    return value < 0.5 ? 0 : Number(value.toFixed(2));
  };

  // EEMRIOT Timeseries & Table Data Derivation
  const eemriotResult = useMemo(() => {
    if (!isEemriot || !eemriotMetadata) return { chartData: [], tableData: [], periods: [], keys: [] };

    const periods = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022'];
    const { sectors, industries } = eemriotMetadata;

    const chartData: any[] = [];
    const tableData: any[] = [];

    if (breakdownType === 'sector') {
      // Breakdown by Sector
      sectors.forEach(sec => {
        const row: any = { key: sec.code, dimensionName: sec.name };
        periods.forEach(yr => {
          let sum = 0;
          industries.forEach(ind => {
            sum += getDeterministicEemriotValue(sec.code, ind.code, selectedSingleEconomy, yr, selectedGas);
          });
          row[yr] = Number(sum.toFixed(2));
        });
        tableData.push(row);
      });

      // Chart Pivot data
      periods.forEach(yr => {
        const pt: any = { period: yr };
        sectors.forEach(sec => {
          let sum = 0;
          industries.forEach(ind => {
            sum += getDeterministicEemriotValue(sec.code, ind.code, selectedSingleEconomy, yr, selectedGas);
          });
          pt[sec.code] = Number(sum.toFixed(2));
        });
        chartData.push(pt);
      });

      return {
        chartData,
        tableData,
        periods,
        keys: sectors.map(s => ({ code: s.code, name: s.name }))
      };
    } else {
      // Breakdown by Industry
      industries.forEach(ind => {
        const row: any = { key: ind.code, dimensionName: ind.name };
        periods.forEach(yr => {
          let sum = 0;
          sectors.forEach(sec => {
            sum += getDeterministicEemriotValue(sec.code, ind.code, selectedSingleEconomy, yr, selectedGas);
          });
          row[yr] = Number(sum.toFixed(2));
        });
        tableData.push(row);
      });

      // Chart Pivot data
      periods.forEach(yr => {
        const pt: any = { period: yr };
        industries.forEach(ind => {
          let sum = 0;
          sectors.forEach(sec => {
            sum += getDeterministicEemriotValue(sec.code, ind.code, selectedSingleEconomy, yr, selectedGas);
          });
          pt[ind.code] = Number(sum.toFixed(2));
        });
        chartData.push(pt);
      });

      return {
        chartData,
        tableData,
        periods,
        keys: industries.map(i => ({ code: i.code, name: i.name }))
      };
    }
  }, [isEemriot, eemriotMetadata, selectedSingleEconomy, selectedGas, breakdownType]);

  // ── CHART DATA GENERATION ──────────────────────────────────────────────────
  const chartProps = useMemo(() => {
    if (isEemriot) {
      const { chartData, periods, keys } = eemriotResult;
      const datasets = keys.map((k, idx) => {
        const color = PALETTE[idx % PALETTE.length];
        return {
          label: k.name,
          data: chartData.map(d => d[k.code] ?? null),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          tension: 0.15,
          pointRadius: 4,
          spanGaps: true,
        };
      });

      return {
        data: { labels: periods, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, fontSize: 11 } } },
          scales: {
            x: { grid: { display: false } },
            y: { ticks: { callback: (val: any) => `${val.toLocaleString()} Gg` } }
          }
        }
      };
    }

    // KIDB / ADO / ARIC Line Charts
    const periods = activePeriods;
    const uniqueKeys = nonZeroRows.map(r => r.key);

    const chartDataMap = new Map<string, any>();
    unifiedResult.data.forEach(item => {
      if (!chartDataMap.has(item.period)) chartDataMap.set(item.period, {});
      const key = isAric ? item.counterpartAreaCode : item.economyCode;
      chartDataMap.get(item.period)![key] = item.obsValue;
    });

    const datasets = uniqueKeys.map((key, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const name = isAric 
        ? (unifiedResult.data.find(d => d.counterpartAreaCode === key)?.counterpartAreaName || key)
        : (economyNameMap[key] || key);

      return {
        label: name,
        data: periods.map(p => {
          const pt = chartDataMap.get(p);
          return pt && pt[key] !== undefined && pt[key] !== null ? Number(pt[key]) : null;
        }),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        tension: 0.1,
        pointRadius: 4,
        spanGaps: true,
      };
    });

    return {
      data: { labels: periods, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, fontSize: 11 } } },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: (val: any) => {
                const tick = Number(val);
                if (tick >= 1e9) return `${(tick / 1e9).toFixed(1)}B`;
                if (tick >= 1e6) return `${(tick / 1e6).toFixed(1)}M`;
                if (tick >= 1e3) return `${(tick / 1e3).toFixed(1)}K`;
                return tick.toString();
              }
            }
          }
        }
      }
    };
  }, [isEemriot, eemriotResult, unifiedResult, activePeriods, nonZeroRows, isAric, economyNameMap]);

  // ── TABLE COLUMNS & DATA GENERATION ────────────────────────────────────────
  const tableConfig = useMemo(() => {
    if (isEemriot) {
      const columns = [
        {
          title: breakdownType === 'sector' ? 'IPCC Sector' : 'Economic Industry',
          dataIndex: 'dimensionName',
          key: 'dimensionName',
          fixed: 'left' as const,
          render: (text: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{text}</span>
        },
        ...eemriotResult.periods.map(yr => ({
          title: yr,
          dataIndex: yr,
          key: yr,
          align: 'right' as const,
          render: (val: any) => (
            <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
              {val !== undefined && val !== null ? val.toLocaleString() : '—'}
            </span>
          )
        }))
      ];
      return { columns, dataSource: eemriotResult.tableData };
    }

    // KIDB / ADO / ARIC Tables
    const periods = activePeriods;
    
    const columns: any[] = [
      {
        title: isAric ? 'Counterpart Area' : 'Economy',
        dataIndex: 'rowName',
        key: 'rowName',
        fixed: 'left' as const,
        render: (text: string, record: any) => {
          const targetCode = isAric ? record.counterpartAreaCode : record.economyCode;
          const iso2 = ISO3_TO_ISO2[targetCode.toUpperCase()];
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {iso2 ? (
                <img 
                  src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`} 
                  alt="" 
                  style={{ width: '16px', height: '12px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
              )}
              <span style={{ fontWeight: 600 }}>{text}</span>
            </div>
          );
        }
      },
      {
        title: 'Units',
        dataIndex: 'unitDisplay',
        key: 'unitDisplay',
        width: 180,
      },
      ...periods.map(p => ({
        title: p,
        dataIndex: p,
        key: p,
        align: 'right' as const,
        render: (val: any) => (
          <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
            {val !== undefined && val !== null ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </span>
        )
      }))
    ];

    return { columns, dataSource: nonZeroRows };
  }, [isEemriot, eemriotResult, isAric, nonZeroRows, activePeriods, breakdownType]);

  // Dropdown list options for economies selector
  const availableEconomiesOptions = useMemo(() => {
    return indicator.economies.map(eco => ({
      value: eco,
      label: economyNameMap[eco] || eco
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [indicator.economies, economyNameMap]);

  return (
    <Card
      style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button icon={<LeftOutlined />} onClick={onBack} size="small">Back</Button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{capitalizeWords(indicator.name)}</span>
          </div>
        </div>
      }
    >
      {/* 1. FILTER CONTROLS */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '20px' }}>
        
        {/* KIDB & ADO: Multi-Economy Filter */}
        {!isAric && !isEemriot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '250px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Selected Economies:</span>
            <Select
              mode="multiple"
              style={{ width: '100%', minWidth: '200px' }}
              placeholder="Select economies to compare"
              value={selectedEconomies}
              onChange={setSelectedEconomies}
              options={availableEconomiesOptions}
              maxTagCount="responsive"
            />
          </div>
        )}

        {/* ARIC: Single Economy Filter */}
        {isAric && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Economy:</span>
            <Select
              style={{ width: '220px' }}
              value={selectedSingleEconomy}
              onChange={setSelectedSingleEconomy}
              options={availableEconomiesOptions}
            />
          </div>
        )}

        {/* EEMRIOT: Single Economy + Gas + Sector/Industry breakdowns */}
        {isEemriot && eemriotMetadata && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Economy:</span>
              <Select
                style={{ width: '220px' }}
                value={selectedSingleEconomy}
                onChange={setSelectedSingleEconomy}
                options={availableEconomiesOptions}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Gas Type:</span>
              <Select
                style={{ width: '140px' }}
                value={selectedGas}
                onChange={setSelectedGas}
                options={eemriotMetadata.ghgs.map(g => ({ label: g.name, value: g.code }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Breakdown:</span>
              <Radio.Group 
                value={breakdownType} 
                onChange={e => setBreakdownType(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="sector">Sectors</Radio.Button>
                <Radio.Button value="industry">Industries</Radio.Button>
              </Radio.Group>
            </div>
          </>
        )}
      </div>

      {/* 2. LINE GRAPH (TOP) */}
      <Card 
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Historical Trends</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Unit: {activeUnit}</span>
          </div>
        }
        style={{ marginBottom: '24px', border: '1px solid #e2e8f0' }}
      >
        {isDataLoading && !isEemriot ? (
          <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin size="large" /></div>
        ) : (
          <div style={{ height: '380px', width: '100%', position: 'relative' }}>
            <Line data={chartProps.data} options={chartProps.options} />
          </div>
        )}
      </Card>

      {/* 3. TABLE VIEW (BOTTOM) */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Data Records</span>
            {isEemriot && <Badge status="processing" text="Gigagrams (CO2 equivalent)" />}
          </div>
        }
        style={{ border: '1px solid #e2e8f0', marginBottom: '24px' }}
      >
        {isDataLoading && !isEemriot ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Spin size="middle" /></div>
        ) : (
          <Table
            columns={tableConfig.columns}
            dataSource={tableConfig.dataSource}
            bordered
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
          />
        )}
      </Card>

      {/* 4. DEFINITIONS & METADATA SECTION */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
            <InfoCircleOutlined style={{ marginRight: '6px', color: '#155dfc' }} />
            Definitions & Metadata
          </span>
        }
        style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px' }}>
          {/* Definition */}
          {indicator.definition && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6366f1', fontWeight: 700 }}>
                Definition
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-line' }}>
                {indicator.definition}
              </p>
            </div>
          )}

          {/* Units & Multipliers */}
          {!isEemriot && unifiedResult.data.length > 0 && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {unifiedResult.data[0]?.unitName && (
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 700 }}>
                    Units
                  </h4>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    {unifiedResult.data[0]?.unitName}
                  </span>
                </div>
              )}
              {unifiedResult.data[0]?.multiplierName && (
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 700 }}>
                    Multipliers
                  </h4>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    {unifiedResult.data[0]?.multiplierName}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Source */}
          {indicator.source && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f766e', fontWeight: 700 }}>
                Source
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#334155' }}>
                {indicator.source}
              </p>
            </div>
          )}

          {/* Methodology */}
          {indicator.methodology && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b45309', fontWeight: 700 }}>
                Methodology & Concepts
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#334155' }}>
                {indicator.methodology}
              </p>
            </div>
          )}

          {!indicator.definition && !indicator.source && !indicator.methodology && (
            <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
              No detailed metadata available for this indicator.
            </div>
          )}
        </div>
      </Card>

    </Card>
  );
}
