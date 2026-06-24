'use client';

import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, Row, Col, Empty } from 'antd';
import { formatUnit, formatValueWithUnit } from '@/lib/country';

const STROKE_COLOR = '#002568'; // Standard theme navy

interface SmallMultiplesCardProps {
  data: any[];
  economies: string[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  extra?: React.ReactNode;
}

export default function SmallMultiplesCard({
  data,
  economies,
  indicatorName,
  unitName = '',
  multiplierName = '',
  extra,
}: SmallMultiplesCardProps) {
  const hasCounterpart = React.useMemo(() => data.some(item => item.counterpartAreaCode), [data]);

  // Group data dynamically by group key (economyCode or counterpartAreaCode) from all items in data
  const dataByGroup = React.useMemo(() => {
    const map = new Map<string, any[]>();
    data.forEach(item => {
      const key = hasCounterpart ? item.counterpartAreaCode : item.economyCode;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });
    return map;
  }, [data, hasCounterpart]);

  // Sort groups by their highest value across all periods descending
  const sortedKeys = React.useMemo(() => {
    const maxMap: Record<string, number> = {};
    dataByGroup.forEach((items, key) => {
      const vals = items.map(item => item.obsValue).filter(v => v !== null && !isNaN(v));
      maxMap[key] = vals.length > 0 ? Math.max(...vals) : -Infinity;
    });
    return Array.from(dataByGroup.keys()).sort((a, b) => (maxMap[b] ?? -Infinity) - (maxMap[a] ?? -Infinity));
  }, [dataByGroup]);

  // Check if we have any data
  const hasData = Array.from(dataByGroup.values()).some(arr => arr.length > 0);

  if (!hasData) {
    return (
      <Card title={indicatorName} style={{ borderRadius: 8 }}>
        <Empty description="No comparison data available for selected filters." />
      </Card>
    );
  }

  const formatYAxis = (tick: number) => {
    if (tick >= 1e9) return `${(tick / 1e9).toFixed(1)}B`;
    if (tick >= 1e6) return `${(tick / 1e6).toFixed(1)}M`;
    if (tick >= 1e3) return `${(tick / 1e3).toFixed(1)}K`;
    return tick.toString();
  };

  // Custom tooltip for small multiples: matches Line/Bar styles and displays original DB values
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const rawItem = payload[0].payload;
    const showUSD = rawItem._wasConvertedToUSD;
    const val = showUSD
      ? formatValueWithUnit(rawItem.obsValue, rawItem.multiplierName, rawItem.unitName || unitName)
      : formatValueWithUnit(
          rawItem._originalValue !== undefined ? rawItem._originalValue : rawItem.obsValue,
          rawItem._originalMultiplierName !== undefined ? rawItem._originalMultiplierName : rawItem.multiplierName,
          rawItem.unitName || unitName
        );
    return (
      <div style={{
        background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px',
        padding: '8px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        fontSize: '12px',
      }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{val}</div>
        {showUSD && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
            Original: {formatValueWithUnit(rawItem._originalValue, rawItem._originalMultiplierName, rawItem._originalUnitName)}
            <br />
            Exchange Rate: {rawItem._exchangeRateUsed ? Number(rawItem._exchangeRateUsed).toFixed(4) : '1'}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Small Multiples Comparison</span>
          {formatUnit(multiplierName, unitName) && (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
              Indicator: {indicatorName} ({formatUnit(multiplierName, unitName)})
            </span>
          )}
        </div>
      }
      extra={extra}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}
    >
      <Row gutter={[16, 16]}>
        {sortedKeys.map(ecoCode => {
          const ecoData = dataByGroup.get(ecoCode) || [];
          if (ecoData.length === 0) return null;

          const cardTitle = hasCounterpart
            ? (ecoData[0]?.counterpartAreaName || ecoCode)
            : (ecoData[0]?.economyName || ecoCode);
          const sortedEcoData = [...ecoData].sort((a, b) => a.period.localeCompare(b.period));

          return (
            <Col xs={24} sm={12} md={8} key={ecoCode}>
              <Card 
                size="small" 
                title={<span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{cardTitle}</span>}
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}
              >
                <div style={{ width: '100%', height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sortedEcoData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        tickFormatter={formatYAxis}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip shared={true} isAnimationActive={false} content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="obsValue"
                        stroke={STROKE_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#fff' }}
                        activeDot={{ r: 5 }}
                        animationDuration={400}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
