'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, Empty, Select, Button, Space } from 'antd';
import { formatUnit, formatValueWithUnit, capitalizeWords } from '@/lib/country';

const PALETTE = [
  '#155dfc', '#002568', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#3b82f6',
  '#475569', '#64748b', '#1e293b', '#0284c7',
];

interface DataPoint { period: string; [key: string]: any; }

interface BarChartCardProps {
  data: any[];
  economies: string[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  extra?: React.ReactNode;
}

export default function BarChartCard({
  data, economies, indicatorName, unitName = '', multiplierName = '', extra,
}: BarChartCardProps) {
  const hasCounterpart = React.useMemo(() => data.some(item => item.counterpartAreaCode), [data]);

  const allKeys = React.useMemo(() => {
    if (hasCounterpart) {
      return Array.from(new Set(data.map(item => item.counterpartAreaCode)));
    }
    return economies;
  }, [economies, data, hasCounterpart]);

  const [visibleEconomies, setVisibleEconomies] = useState<string[]>(allKeys);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Sync visible keys when data or economies change
  useEffect(() => {
    setVisibleEconomies(allKeys);
  }, [allKeys]);

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

  const pivotMap = new Map<string, DataPoint>();
  data.forEach(item => {
    if (!pivotMap.has(item.period)) pivotMap.set(item.period, { period: item.period });
    const key = hasCounterpart ? item.counterpartAreaCode : item.economyCode;
    pivotMap.get(item.period)![key] = item.obsValue;
  });
  const chartData = Array.from(pivotMap.values()).sort((a, b) => a.period.localeCompare(b.period));

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
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
            <span>{name}</span>
          </div>
        ),
        searchValue: name,
      };
    });
  }, [sortedKeys, ecoNameMap, allKeys]);

  if (chartData.length === 0) {
    return <Card title={indicatorName} style={{ borderRadius: 8 }}><Empty description="No comparison data available." /></Card>;
  }

  const formatYAxis = (tick: number) => {
    if (tick >= 1e9) return `${(tick / 1e9).toFixed(1)}B`;
    if (tick >= 1e6) return `${(tick / 1e6).toFixed(1)}M`;
    if (tick >= 1e3) return `${(tick / 1e3).toFixed(1)}K`;
    return tick.toString();
  };

  // Dynamic chart width so bars are always readable
  const BAR_WIDTH = 20;      // px per bar per period
  const PERIOD_GAP = 24;     // px gap between periods
  const minWidth = 800;
  const computedWidth = Math.max(
    minWidth,
    chartData.length * (visibleEconomies.length * (BAR_WIDTH + 2) + PERIOD_GAP) + 80,
  );

  // Custom tooltip: renders only the hovered bar's data in KIDB style
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload.find((p: any) => p.dataKey === hoveredKey) || payload[0];
    if (!entry) return null;

    const key = entry.dataKey as string;
    // Find the original raw data point to display original DB value and units
    const periodValue = entry.payload?.period || label;
    const originalPoint = data.find(d => {
      if (hasCounterpart) {
        return d.period === periodValue && d.counterpartAreaCode === key;
      }
      return d.period === periodValue && d.economyCode === key;
    });

    const showUSD = originalPoint && originalPoint._wasConvertedToUSD;
    const val = showUSD
      ? formatValueWithUnit(originalPoint.obsValue, originalPoint.multiplierName, originalPoint.unitName || unitName)
      : (originalPoint 
          ? formatValueWithUnit(originalPoint._originalValue !== undefined ? originalPoint._originalValue : originalPoint.obsValue, originalPoint._originalMultiplierName !== undefined ? originalPoint._originalMultiplierName : originalPoint.multiplierName, originalPoint.unitName || unitName)
          : formatValueWithUnit(entry.value, multiplierName, unitName));

    const name = ecoNameMap[key] || key;

    return (
      <div style={{
        background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px',
        padding: '8px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        fontSize: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: entry.fill, display: 'inline-block', flexShrink: 0 }} />
          <span>{periodValue}, {name}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
          {val}
        </div>
        {showUSD && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
            Original: {formatValueWithUnit(originalPoint._originalValue, originalPoint._originalMultiplierName, originalPoint._originalUnitName)}
            <br />
            Exchange Rate: {originalPoint._exchangeRateUsed ? Number(originalPoint._exchangeRateUsed).toFixed(4) : '1'}
          </div>
        )}
      </div>
    );
  };

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
        <span style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: color }} />
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
      {/* Horizontally scrollable chart container */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ width: `${computedWidth}px`, height: '680px', minWidth: '100%' }}>
          <BarChart
            width={computedWidth}
            height={680}
            data={chartData}
            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={{ stroke: '#cbd5e1' }} />
            <Tooltip shared={false} isAnimationActive={false} content={<CustomTooltip />} />
            {sortedKeys.filter(k => visibleEconomies.includes(k)).map((ecoCode, idx) => (
              <Bar
                key={ecoCode}
                dataKey={ecoCode}
                fill={PALETTE[allKeys.indexOf(ecoCode) % PALETTE.length]}
                radius={[3, 3, 0, 0]}
                animationDuration={600}
                onMouseEnter={() => setHoveredKey(ecoCode)}
                onMouseLeave={() => setHoveredKey(null)}
              />
            ))}
          </BarChart>
        </div>
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
