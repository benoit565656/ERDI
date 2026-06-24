'use client';

import React, { useState, useEffect } from 'react';
import { Card, Empty, Tooltip, Button, Space, Select } from 'antd';
import { PlusOutlined, MinusOutlined, SyncOutlined } from '@ant-design/icons';
import { formatUnit, formatValueWithUnit } from '@/lib/country';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from '@vnedyalk0v/react19-simple-maps';

// ISO Numeric to 3-Letter ADB/ISO Code Mapping
const NUMERIC_TO_CODE: Record<string, string> = {
  "004": "AFG", "4": "AFG",
  "051": "ARM", "51": "ARM",
  "036": "AUS", "36": "AUS",
  "031": "AZE", "31": "AZE",
  "050": "BAN", "50": "BAN", "BGD": "BAN",
  "064": "BTN", "64": "BTN",
  "096": "BRN", "96": "BRN", "BRU": "BRN",
  "116": "CAM", "KHM": "CAM",
  "156": "PRC", "CHN": "PRC",
  "184": "COK",
  "242": "FJI",
  "268": "GEO",
  "344": "HKG",
  "356": "IND",
  "360": "INO", "IDN": "INO",
  "392": "JPN",
  "398": "KAZ",
  "296": "KIR",
  "410": "KOR",
  "417": "KGZ",
  "418": "LAO",
  "458": "MAL", "MYS": "MAL",
  "462": "MDV",
  "584": "MHL",
  "583": "FSM",
  "496": "MON", "MNG": "MON",
  "104": "MYA", "MMR": "MYA",
  "520": "NRU",
  "524": "NEP", "NPL": "NEP",
  "554": "NZL",
  "586": "PAK",
  "585": "PLW",
  "598": "PNG",
  "608": "PHI", "PHL": "PHI",
  "882": "WSM", "SAM": "WSM",
  "702": "SIN", "SGP": "SIN",
  "090": "SLB", "90": "SLB",
  "144": "SRI", "LKA": "SRI",
  "158": "TWN",
  "762": "TJK",
  "764": "THA",
  "626": "TLS",
  "776": "TON",
  "795": "TKM",
  "798": "TUV",
  "860": "UZB",
  "548": "VUT",
  "704": "VIE", "VNM": "VIE"
};

// Micro-countries coordinates mapping for display circles
const MICRO_COUNTRIES = [
  { code: 'SIN', name: 'Singapore', coordinates: [103.8519, 1.2902] },
  { code: 'HKG', name: 'Hong Kong, China', coordinates: [114.1694, 22.3193] },
  { code: 'COK', name: 'Cook Islands', coordinates: [-159.7777, -21.2367] },
  { code: 'FJI', name: 'Fiji', coordinates: [178.4419, -18.1248] },
  { code: 'FSM', name: 'Federated States of Micronesia', coordinates: [158.156, 6.917] },
  { code: 'MDV', name: 'Maldives', coordinates: [73.5089, 4.1755] },
  { code: 'MHL', name: 'Marshall Islands', coordinates: [171.38, 7.13] },
  { code: 'NRU', name: 'Nauru', coordinates: [166.93, -0.53] },
  { code: 'PLW', name: 'Palau', coordinates: [134.48, 7.51] },
  { code: 'WSM', name: 'Samoa', coordinates: [-172.1, -13.75] },
  { code: 'TON', name: 'Tonga', coordinates: [-175.2, -21.18] },
  { code: 'TUV', name: 'Tuvalu', coordinates: [179.08, -8.52] },
  { code: 'KIR', name: 'Kiribati', coordinates: [-157.36, 1.87] },
  { code: 'BRU', name: 'Brunei Darussalam', coordinates: [114.94, 4.53] }
];

interface MapCardProps {
  data: any[];
  indicatorName: string;
  unitName?: string;
  multiplierName?: string;
  periods: string[];
  extra?: React.ReactNode;
  activeEconomyCode?: string;
  isAric?: boolean;
}

export default function MapCard({
  data,
  indicatorName,
  unitName = '',
  multiplierName = '',
  periods,
  extra,
  activeEconomyCode,
  isAric,
}: MapCardProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [selectedMapPeriod, setSelectedMapPeriod] = useState<string>('');

  // Zoom and Pan state centered on Asia-Pacific [90, 20]
  const [position, setPosition] = useState({ coordinates: [90, 20] as [number, number], zoom: 1.8 });

  // Sync / initialize current period state
  useEffect(() => {
    if (periods.length > 0) {
      const latest = [...periods].sort().slice(-1)[0];
      setSelectedMapPeriod(latest);
    }
  }, [periods]);

  const activeMapPeriod = selectedMapPeriod || (periods.length > 0 ? [...periods].sort().slice(-1)[0] : '');

  const periodOptions = React.useMemo(() => {
    return periods.map(p => ({ value: p, label: p }));
  }, [periods]);

  if (!activeMapPeriod) {
    return (
      <Card title={indicatorName} style={{ borderRadius: 8 }}>
        <Empty description="No period data available for map visualization." />
      </Card>
    );
  }

  // Filter data for the active period
  const activePeriodData = data.filter(item => item.period === activeMapPeriod && item.obsValue !== null);

  const valueMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  const recordMap = new Map<string, any>();
  activePeriodData.forEach(item => {
    const key = item.counterpartAreaCode || item.economyCode;
    const name = item.counterpartAreaCode ? item.counterpartAreaName : item.economyName;
    valueMap.set(key, Number(item.obsValue));
    nameMap.set(key, name);
    recordMap.set(key, item);
  });

  // Find unique values for rank-based (quantile) color scale to handle outliers
  const sortedValues = Array.from(valueMap.values()).sort((a, b) => a - b);

  // Color choropleth resolver using percentile ranks
  const getFillColor = (code: string) => {
    if (isAric && activeEconomyCode && code === activeEconomyCode) {
      return '#f97316'; // Highlight selected reporter/active economy in premium orange
    }
    if (!valueMap.has(code)) {
      return '#f1f5f9'; // Muted slate gray for countries with no data
    }
    const val = valueMap.get(code)!;
    const index = sortedValues.indexOf(val);
    const scale = sortedValues.length > 1 ? index / (sortedValues.length - 1) : 0.5;

    // Shades of ADB Blue: Light Blue (#eff6ff) to Deep Navy (#002568)
    const r = Math.round(239 + (0 - 239) * scale);
    const g = Math.round(246 + (37 - 246) * scale);
    const b = Math.round(255 + (104 - 255) * scale);

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Zoom controls
  const handleZoomIn = () => {
    setPosition(pos => ({ ...pos, zoom: Math.min(pos.zoom + 0.5, 8) }));
  };

  const handleZoomOut = () => {
    setPosition(pos => ({ ...pos, zoom: Math.max(pos.zoom - 0.5, 1) }));
  };

  const handleReset = () => {
    setPosition({ coordinates: [90, 20], zoom: 1.8 });
  };

  const handleMoveEnd = (newPosition: { coordinates: [number, number]; zoom: number }) => {
    setPosition(newPosition);
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
              Regional Choropleth Map ({activeMapPeriod})
            </span>
            {formatUnit(multiplierName, unitName) && (
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                Indicator: {indicatorName} ({formatUnit(multiplierName, unitName)})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Select Period:</span>
            <Select
              style={{ width: '120px' }}
              value={activeMapPeriod}
              onChange={(val) => setSelectedMapPeriod(val)}
              options={periodOptions}
            />
          </div>
        </div>
      }
      extra={extra}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
    >
      <div 
        style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: '100%', 
          margin: '0 auto', 
          background: '#f8fafc', 
          borderRadius: '8px', 
          overflow: 'hidden', 
          padding: '10px',
          userSelect: 'none',
        }}
      >
        {/* Floating Zoom Controls */}
        <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
          <Space orientation="vertical" size="small">
            <Button icon={<PlusOutlined />} onClick={handleZoomIn} title="Zoom In" />
            <Button icon={<MinusOutlined />} onClick={handleZoomOut} disabled={position.zoom <= 1} title="Zoom Out" />
            <Button icon={<SyncOutlined />} onClick={handleReset} title="Reset View" />
          </Space>
        </div>
        
        {/* Geographic Map Canvas */}
        <div style={{ width: '100%', height: '650px' }}>
          <ComposableMap 
            projection="geoMercator"
            width={960}
            height={600}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates as any}
              onMoveEnd={handleMoveEnd}
            >
              <Geographies geography="https://unpkg.com/world-atlas@2.0.2/countries-110m.json">
                {({ geographies }) => {
                  let activeHoveredGeo: any = null;

                  const mapElements = geographies.map((geo) => {
                    const numericId = geo.id || geo.properties?.iso_n3;
                    const paddedId = numericId ? String(numericId).padStart(3, '0') : '';
                    const countryCode = NUMERIC_TO_CODE[paddedId];
                    
                    const hasData = countryCode ? valueMap.has(countryCode) : false;
                    const color = countryCode ? getFillColor(countryCode) : '#f1f5f9';
                    const isHovered = countryCode && hoveredCountry === countryCode;

                    if (isHovered) {
                      activeHoveredGeo = geo;
                    }

                    const record = countryCode ? recordMap.get(countryCode) : null;
                    const showUSD = record && record._wasConvertedToUSD;
                    const formattedValWithUnit = record
                      ? (showUSD
                          ? formatValueWithUnit(record.obsValue, record.multiplierName, record.unitName || unitName)
                          : formatValueWithUnit(
                              record._originalValue !== undefined ? record._originalValue : record.obsValue,
                              record._originalMultiplierName !== undefined ? record._originalMultiplierName : record.multiplierName,
                              record.unitName || unitName
                            ))
                      : 'No Data';

                    const countryName = (countryCode && nameMap.get(countryCode)) || geo.properties?.name || 'Unknown';

                    const tooltipContent = (
                      <div style={{ padding: '2px' }}>
                        <strong>{countryName}</strong>
                        {hasData && (
                          <div style={{ marginTop: '2px', fontWeight: 600 }}>
                            {formattedValWithUnit}
                          </div>
                        )}
                        {showUSD && (
                          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                            Original: {formatValueWithUnit(record._originalValue, record._originalMultiplierName, record._originalUnitName)}
                            <br />
                            Exchange Rate: {record._exchangeRateUsed ? Number(record._exchangeRateUsed).toFixed(4) : '1'}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <Tooltip key={geo.rsmKey} title={tooltipContent} color="#1e293b" mouseEnterDelay={0.02}>
                        <Geography
                          geography={geo}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={0.5}
                          style={{
                            default: { fill: color, outline: 'none' },
                            hover: { fill: color, stroke: '#ef4444', strokeWidth: 1.2, outline: 'none', cursor: hasData ? 'pointer' : 'default' },
                            pressed: { fill: color, outline: 'none' }
                          }}
                          onMouseEnter={() => countryCode && setHoveredCountry(countryCode)}
                          onMouseLeave={() => setHoveredCountry(null)}
                        />
                      </Tooltip>
                    );
                  });

                  return (
                    <>
                      {mapElements}
                      {/* Render hovered country last so its bright red stroke paints on top of all adjacent white borders */}
                      {activeHoveredGeo && hoveredCountry && (
                        <Geography
                          geography={activeHoveredGeo}
                          fill={getFillColor(hoveredCountry)}
                          stroke="#ef4444"
                          strokeWidth={1.2}
                          style={{
                            default: { outline: 'none', pointerEvents: 'none' },
                            hover: { outline: 'none', pointerEvents: 'none' },
                            pressed: { outline: 'none', pointerEvents: 'none' }
                          }}
                        />
                      )}
                    </>
                  );
                }}
              </Geographies>

              {/* Render Markers (Circles) for Micro-Countries with Data */}
              {MICRO_COUNTRIES.map(c => {
                const hasData = valueMap.has(c.code);
                if (!hasData) return null;
                const color = getFillColor(c.code);
                const isHovered = hoveredCountry === c.code;

                const record = recordMap.get(c.code);
                const showUSD = record && record._wasConvertedToUSD;
                const formattedValWithUnit = record
                  ? (showUSD
                      ? formatValueWithUnit(record.obsValue, record.multiplierName, record.unitName || unitName)
                      : formatValueWithUnit(
                          record._originalValue !== undefined ? record._originalValue : record.obsValue,
                          record._originalMultiplierName !== undefined ? record._originalMultiplierName : record.multiplierName,
                          record.unitName || unitName
                        ))
                  : 'No Data';

                const tooltipContent = (
                  <div style={{ padding: '2px' }}>
                    <strong>{nameMap.get(c.code) || c.name}</strong>
                    <div style={{ marginTop: '2px', fontWeight: 600 }}>
                      {formattedValWithUnit}
                    </div>
                    {showUSD && (
                      <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                        Original: {formatValueWithUnit(record._originalValue, record._originalMultiplierName, record._originalUnitName)}
                        <br />
                        Exchange Rate: {record._exchangeRateUsed ? Number(record._exchangeRateUsed).toFixed(4) : '1'}
                      </div>
                    )}
                  </div>
                );

                const radius = Math.max(3, 7 / position.zoom);
                const strokeWidth = Math.max(1, 2 / position.zoom);

                return (
                  <Tooltip key={c.code} title={tooltipContent} color="#1e293b" mouseEnterDelay={0.02}>
                    <Marker coordinates={c.coordinates as any}>
                      <circle
                        r={radius}
                        fill={color}
                        stroke={isHovered ? '#ef4444' : '#fff'}
                        strokeWidth={isHovered ? strokeWidth * 1.2 : strokeWidth}
                        style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }}
                        onMouseEnter={() => setHoveredCountry(c.code)}
                        onMouseLeave={() => setHoveredCountry(null)}
                      />
                    </Marker>
                  </Tooltip>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '15px', left: '15px', background: 'rgba(255,255,255,0.9)', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b', pointerEvents: 'none' }}>
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '8px', height: '12px', background: '#eff6ff', borderRadius: '2px 0 0 2px' }} />
              <span style={{ width: '8px', height: '12px', background: '#60a5fa' }} />
              <span style={{ width: '8px', height: '12px', background: '#002568', borderRadius: '0 2px 2px 0' }} />
            </div>
            <span>Min Value → Max Value</span>
          </div>
        </div>

      </div>
    </Card>
  );
}
