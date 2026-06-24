'use client';

import React from 'react';
import { Card, Empty, Tooltip } from 'antd';
import { formatUnit, formatValueWithUnit } from '@/lib/country';

interface HeatmapCardProps {
  data: any[];
  economies: string[];
  periods: string[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  extra?: React.ReactNode;
}

export default function HeatmapCard({
  data,
  economies,
  periods,
  indicatorName,
  unitName = '',
  multiplierName = '',
  extra,
}: HeatmapCardProps) {
  // Sort periods chronologically
  const sortedPeriods = [...periods].sort();

  // Find all distinct economies that have data in the query
  const economyMap = new Map<string, string>();
  data.forEach(item => {
    economyMap.set(item.economyCode, item.economyName);
  });
  const activeEconomies = Array.from(economyMap.keys()).sort((a, b) => 
    economyMap.get(a)!.localeCompare(economyMap.get(b)!)
  );

  if (activeEconomies.length === 0 || sortedPeriods.length === 0) {
    return (
      <Card title={indicatorName} style={{ borderRadius: 8 }}>
        <Empty description="No data available for heatmap view." />
      </Card>
    );
  }

  // 1. Gather all values to calculate min/max bounds for color scaling
  const values = data.map(item => item.obsValue).filter(v => v !== null && !isNaN(v)) as number[];
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;
  const valRange = maxVal - minVal || 1;

  // 2. Map data into pivot dictionary
  const pivotData = new Map<string, number | null>();
  data.forEach(item => {
    pivotData.set(`${item.economyCode}:${item.period}`, item.obsValue);
  });

  // Color generator: maps a value scale (0 to 1) to a shade of ADB blue
  // Light blue (#eff6ff) to Deep Navy (#002568)
  const getCellColor = (val: number | null | undefined) => {
    if (val === undefined || val === null || isNaN(val)) {
      return '#f1f5f9'; // Light gray for empty/null cells
    }
    // Calculate normalized value (0 to 1)
    const scale = (val - minVal) / valRange;
    
    // We interpolate colors between:
    // Light blue RGB: [239, 246, 255] (eff6ff)
    // Deep navy RGB: [0, 37, 104] (002568)
    const r = Math.round(239 + (0 - 239) * scale);
    const g = Math.round(246 + (37 - 246) * scale);
    const b = Math.round(255 + (104 - 255) * scale);

    return `rgb(${r}, ${g}, ${b})`;
  };

  const getTextColor = (val: number | null | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return '#94a3b8';
    const scale = (val - minVal) / valRange;
    return scale > 0.5 ? '#fff' : '#0f172a'; // White text on dark background, dark text on light background
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Data Intensity Grid (Heatmap)
          </span>
          {formatUnit(multiplierName, unitName) && (
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
              Indicator: {indicatorName} ({formatUnit(multiplierName, unitName)})
            </span>
          )}
        </div>
      }
      extra={extra}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
    >
      <div style={{ overflowX: 'auto', padding: '10px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '600px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 600, width: '150px' }}>
                Economy
              </th>
              {sortedPeriods.map(period => (
                <th key={period} style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontSize: '12px', color: '#64748b', background: '#f8fafc', fontWeight: 600 }}>
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEconomies.map(ecoCode => {
              const economyName = economyMap.get(ecoCode) || ecoCode;
              return (
                <tr key={ecoCode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 600, color: '#334155', background: '#fff' }}>
                    {economyName}
                  </td>
                  {sortedPeriods.map(period => {
                    const val = pivotData.get(`${ecoCode}:${period}`);
                    const cellColor = getCellColor(val);
                    const textColor = getTextColor(val);

                    const originalPoint = data.find(d => d.economyCode === ecoCode && d.period === period);
                    const showUSD = originalPoint && originalPoint._wasConvertedToUSD;
                    const formattedValWithUnit = val !== undefined && val !== null
                      ? formatValueWithUnit(val, multiplierName, unitName)
                      : 'N/A';

                    const tooltipTitle = (
                      <div style={{ padding: '4px' }}>
                        <strong>{economyName} ({period})</strong>
                        <div style={{ marginTop: '2px' }}>
                          Value: {formattedValWithUnit}
                        </div>
                        {showUSD && (
                          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                            Original: {formatValueWithUnit(originalPoint._originalValue, originalPoint._originalMultiplierName, originalPoint._originalUnitName)}
                            <br />
                            Exchange Rate: {originalPoint._exchangeRateUsed ? Number(originalPoint._exchangeRateUsed).toFixed(4) : '1'}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <td key={period} style={{ padding: 0 }}>
                        <Tooltip title={tooltipTitle} color="#1e293b" mouseEnterDelay={0.05}>
                          <div 
                            style={{
                              background: cellColor,
                              color: textColor,
                              padding: '14px 10px',
                              textAlign: 'center',
                              fontSize: '13px',
                              fontWeight: 500,
                              fontFamily: 'monospace',
                              cursor: 'default',
                              transition: 'transform 0.1s ease',
                              border: '1px solid #fff'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.05)';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {val !== undefined && val !== null ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                          </div>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
