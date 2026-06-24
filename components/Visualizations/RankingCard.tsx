'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Card, Empty } from 'antd';
import { formatUnit, formatValueWithUnit } from '@/lib/country';

const PRIMARY_COLOR = '#155dfc'; // Accent Blue
const HIGHLIGHT_COLOR = '#002568'; // Deep Navy

interface RankingCardProps {
  data: any[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  periods: string[];
  extra?: React.ReactNode;
}

export default function RankingCard({
  data,
  indicatorName,
  unitName = '',
  multiplierName = '',
  periods,
  extra,
}: RankingCardProps) {
  // 1. Identify latest period (e.g. max year)
  const latestPeriod = periods.length > 0 ? [...periods].sort().slice(-1)[0] : '';

  if (!latestPeriod) {
    return (
      <Card title={indicatorName} style={{ borderRadius: 8 }}>
        <Empty description="No period data available for ranking." />
      </Card>
    );
  }

  // 2. Filter data for latest period and sort by value descending
  const rankingData = data
    .filter(item => item.period === latestPeriod && item.obsValue !== null)
    .map(item => ({
      economyCode: item.economyCode,
      economyName: item.economyName,
      value: item.obsValue,
    }))
    .sort((a, b) => b.value - a.value);

  if (rankingData.length === 0) {
    return (
      <Card title={`${indicatorName} - Ranking (${latestPeriod})`} style={{ borderRadius: 8 }}>
        <Empty description={`No observations found for period ${latestPeriod} to perform ranking.`} />
      </Card>
    );
  }

  const formatXAxis = (tick: number) => {
    if (tick >= 1e9) return `${(tick / 1e9).toFixed(1)}B`;
    if (tick >= 1e6) return `${(tick / 1e6).toFixed(1)}M`;
    if (tick >= 1e3) return `${(tick / 1e3).toFixed(1)}K`;
    return tick.toString();
  };

  // Custom tooltip renderer to match Line/Bar styles and remove "Value:" label
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0];
    if (!entry) return null;

    const economyCode = entry.payload.economyCode;
    const originalPoint = data.find(
      d => d.economyCode === economyCode && d.period === latestPeriod
    );

    const showUSD = originalPoint && originalPoint._wasConvertedToUSD;
    const val = showUSD
      ? formatValueWithUnit(originalPoint.obsValue, originalPoint.multiplierName, originalPoint.unitName || unitName)
      : (originalPoint 
          ? formatValueWithUnit(originalPoint._originalValue !== undefined ? originalPoint._originalValue : originalPoint.obsValue, originalPoint._originalMultiplierName !== undefined ? originalPoint._originalMultiplierName : originalPoint.multiplierName, originalPoint.unitName || unitName)
          : formatValueWithUnit(entry.value, multiplierName, unitName));

    return (
      <div style={{
        background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px',
        padding: '8px 12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        fontSize: '12px',
      }}>
        <div style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
          {entry.payload.economyName} ({latestPeriod})
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

  return (
    <Card 
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Economy Ranking ({latestPeriod})
          </span>
          {formatUnit(multiplierName, unitName) && (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
              Indicator: {indicatorName} (Unit: {formatUnit(multiplierName, unitName)})
            </span>
          )}
        </div>
      }
      extra={extra}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
    >
      {/* Calculate dynamic height based on the number of items to make sure text is readable */}
      <div style={{ width: '100%', height: `${Math.max(250, rankingData.length * 40)}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={rankingData} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis 
              type="number" 
              tickFormatter={formatXAxis}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis 
              type="category" 
              dataKey="economyName" 
              tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
              width={100}
            />
            <Tooltip 
              content={<CustomTooltip />}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
              barSize={18}
              animationDuration={500}
            >
              {rankingData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === 0 ? HIGHLIGHT_COLOR : PRIMARY_COLOR} // Highlight the highest country in dark navy
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
