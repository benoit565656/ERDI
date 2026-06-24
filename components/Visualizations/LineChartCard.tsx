'use client';

import React, { useState, useEffect } from 'react';
import { Card, Empty, Select, Button, Space } from 'antd';
import { formatUnit, formatValueWithUnit, capitalizeWords } from '@/lib/country';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const PALETTE = [
  '#155dfc', '#002568', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#3b82f6',
  '#475569', '#64748b', '#1e293b', '#0284c7',
];

interface DataPoint { period: string; [key: string]: any; }

interface LineChartCardProps {
  data: any[];
  economies: string[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  extra?: React.ReactNode;
}

export default function LineChartCard({
  data, economies, indicatorName, unitName = '', multiplierName = '', extra,
}: LineChartCardProps) {
  const hasCounterpart = React.useMemo(() => data.some(item => item.counterpartAreaCode), [data]);

  const allKeys = React.useMemo(() => {
    if (hasCounterpart) {
      return Array.from(new Set(data.map(item => item.counterpartAreaCode)));
    }
    return economies;
  }, [economies, data, hasCounterpart]);

  // Build name + color lookup
  const ecoNameMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    data.forEach(d => {
      if (hasCounterpart) {
        m[d.counterpartAreaCode] = d.counterpartAreaName || d.counterpartAreaCode;
      } else {
        m[d.economyCode] = d.economyName;
      }
    });
    return m;
  }, [data, hasCounterpart]);

  const sortedKeys = React.useMemo(() => {
    const sumMap: Record<string, number> = {};
    allKeys.forEach(k => { sumMap[k] = 0; });
    data.forEach(item => {
      const key = hasCounterpart ? item.counterpartAreaCode : item.economyCode;
      if (sumMap[key] !== undefined && item.obsValue !== null && !isNaN(item.obsValue))
        sumMap[key] += Number(item.obsValue);
    });
    return [...allKeys].sort((a, b) => (sumMap[b] ?? 0) - (sumMap[a] ?? 0));
  }, [allKeys, data, hasCounterpart]);

  const chartData = React.useMemo(() => {
    const pivotMap = new Map<string, DataPoint>();
    data.forEach(item => {
      if (!pivotMap.has(item.period)) pivotMap.set(item.period, { period: item.period });
      const key = hasCounterpart ? item.counterpartAreaCode : item.economyCode;
      pivotMap.get(item.period)![key] = item.obsValue;
    });
    return Array.from(pivotMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [data, hasCounterpart]);

  const [visibleEconomies, setVisibleEconomies] = useState<string[]>(allKeys);

  // Sync visible keys when data or economies change
  useEffect(() => {
    setVisibleEconomies(allKeys);
  }, [allKeys]);

  const datasets = React.useMemo(() => {
    return sortedKeys
      .filter(k => visibleEconomies.includes(k))
      .map((ecoCode, idx) => {
        const name = ecoNameMap[ecoCode] || ecoCode;
        const color = PALETTE[allKeys.indexOf(ecoCode) % PALETTE.length];
        
        const dataValues = chartData.map(d => {
          const val = d[ecoCode];
          return val !== undefined && val !== null ? Number(val) : null;
        });

        return {
          label: name,
          data: dataValues,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2.5,
          tension: 0.1,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderColor: color,
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 1.5,
          spanGaps: true,
        };
      });
  }, [sortedKeys, visibleEconomies, ecoNameMap, allKeys, chartData]);

  const labels = React.useMemo(() => chartData.map(d => d.period), [chartData]);

  const options = React.useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest' as const,
        intersect: false,
        axis: 'xy' as const,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#fff',
          titleColor: '#475569',
          titleFont: {
            size: 11,
            weight: 'bold' as const,
          },
          bodyColor: '#0f172a',
          bodyFont: {
            size: 13,
            weight: 'bold' as const,
          },
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 8,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: (context: any) => {
              const label = context[0].label;
              const datasetLabel = context[0].dataset.label;
              return `${label}, ${datasetLabel}`;
            },
            label: (context: any) => {
              const val = context.raw;
              const period = context.label;
              const economyName = context.dataset.label;
              
              const originalPoint = data.find(d => {
                if (hasCounterpart) {
                  return d.period === period && d.counterpartAreaName === economyName;
                }
                return d.period === period && d.economyName === economyName;
              });

              if (originalPoint && originalPoint._wasConvertedToUSD) {
                const usdVal = formatValueWithUnit(originalPoint.obsValue, originalPoint.multiplierName, originalPoint.unitName || unitName);
                const origVal = formatValueWithUnit(originalPoint._originalValue, originalPoint._originalMultiplierName, originalPoint._originalUnitName);
                const rateStr = originalPoint._exchangeRateUsed ? Number(originalPoint._exchangeRateUsed).toFixed(4) : '1';
                return [
                  `Value: ${usdVal}`,
                  `Original: ${origVal}`,
                  `Exchange Rate: ${rateStr}`
                ];
              }

              const formattedVal = originalPoint 
                ? formatValueWithUnit(originalPoint._originalValue !== undefined ? originalPoint._originalValue : originalPoint.obsValue, originalPoint._originalMultiplierName !== undefined ? originalPoint._originalMultiplierName : originalPoint.multiplierName, originalPoint.unitName || unitName)
                : formatValueWithUnit(val, multiplierName, unitName);

              return `Value: ${formattedVal}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 12,
            }
          },
          border: {
            color: '#cbd5e1',
          }
        },
        y: {
          grid: {
            color: '#f1f5f9',
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 12,
            },
            callback: (value: any) => {
              const tick = Number(value);
              if (tick >= 1e9) return `${(tick / 1e9).toFixed(1)}B`;
              if (tick >= 1e6) return `${(tick / 1e6).toFixed(1)}M`;
              if (tick >= 1e3) return `${(tick / 1e3).toFixed(1)}K`;
              return tick.toString();
            }
          },
          border: {
            color: '#cbd5e1',
          }
        }
      }
    };
  }, [ecoNameMap, data, hasCounterpart, multiplierName, unitName]);

  // Options for multiselect dropdown keeping colors
  const selectOptions = React.useMemo(() => {
    return sortedKeys.map(key => {
      const name = ecoNameMap[key] || key;
      const idx = allKeys.indexOf(key);
      const color = PALETTE[idx % PALETTE.length];
      return {
        value: key,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            <span>{name}</span>
          </div>
        ),
        searchValue: name,
      };
    });
  }, [sortedKeys, ecoNameMap, allKeys]);

  if (chartData.length === 0) {
    return <Card title={indicatorName} style={{ borderRadius: 8 }}><Empty description="No trend data available." /></Card>;
  }

  const handleSelectAll = () => {
    setVisibleEconomies(allKeys);
  };

  const handleUnselectAll = () => {
    if (sortedKeys.length > 0) {
      setVisibleEconomies([sortedKeys[0]]);
    }
  };

  const handleSelectChange = (newVal: string[]) => {
    if (newVal.length === 0) {
      if (sortedKeys.length > 0) {
        setVisibleEconomies([sortedKeys[0]]);
      }
    } else {
      setVisibleEconomies(newVal);
    }
  };

  const tagRender = (props: any) => {
    const { label, value, closable, onClose } = props;
    const idx = allKeys.indexOf(value);
    const color = PALETTE[idx % PALETTE.length];
    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '2px 8px',
          margin: '2px',
          fontSize: '12px',
          fontWeight: 500,
        }}
        onMouseDown={onPreventMouseDown}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color }} />
        <span>{ecoNameMap[value] || value}</span>
        {closable && (
          <span 
            onClick={onClose} 
            style={{ marginLeft: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#94a3b8' }}
          >
            ×
          </span>
        )}
      </span>
    );
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{capitalizeWords(indicatorName)}</span>
          {formatUnit(multiplierName, unitName) && (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>{formatUnit(multiplierName, unitName)}</span>
          )}
        </div>
      }
      extra={extra}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}
    >
      <div style={{ width: '100%', height: '680px' }}>
        <Line data={{ labels, datasets }} options={options} />
      </div>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        padding: '16px 16px 4px', 
        borderTop: '1px solid #f1f5f9', 
        marginTop: '12px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            Filter Economies on Chart
          </span>
          <Space>
            <Button size="small" onClick={handleSelectAll}>Select All</Button>
            <Button size="small" onClick={handleUnselectAll}>Unselect All</Button>
          </Space>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Select economies to show"
          value={visibleEconomies}
          onChange={handleSelectChange}
          options={selectOptions}
          optionFilterProp="searchValue"
          tagRender={tagRender}
          maxTagCount="responsive"
        />
      </div>
    </Card>
  );
}
