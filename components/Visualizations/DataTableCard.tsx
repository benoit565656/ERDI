import React, { useRef, useEffect, useState } from 'react';
import { Table, Tooltip, Tag, Button } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';


import { ISO3_TO_ISO2, formatUnit, capitalizeWords } from '@/lib/country';

interface DataTableCardProps {
  data: any[];
  periods: string[];
  extra?: React.ReactNode;
  onInfoClick?: (params: { indicatorCode?: string; economyCode?: string; counterpartAreaCode?: string; datasetCode?: string }) => void;
  orderedIndicatorCodes?: string[];
  /** Additional top offset in px (e.g. for a sticky tab bar above this component). Default: 60 */
  stickyTopOffset?: number;
}

export default function DataTableCard({ data, periods, extra, onInfoClick, orderedIndicatorCodes, stickyTopOffset = 60 }: DataTableCardProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const navbarHeight = 104;
  const totalStickyTop = navbarHeight + stickyTopOffset;
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState<number>(90);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  // Synchronize top and bottom scrollbars
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableBody = tableContainerRef.current?.querySelector('.ant-table-content, .ant-table-body') as HTMLDivElement;
    
    if (!topScroll || !tableBody) return;
    
    let isSyncingTop = false;
    let isSyncingTable = false;
    
    const onTopScroll = () => {
      if (isSyncingTable) {
        isSyncingTable = false;
        return;
      }
      isSyncingTop = true;
      tableBody.scrollLeft = topScroll.scrollLeft;
    };
    
    const onTableScroll = () => {
      if (isSyncingTop) {
        isSyncingTop = false;
        return;
      }
      isSyncingTable = true;
      topScroll.scrollLeft = tableBody.scrollLeft;
    };
    
    // Resize observer to update top scroll dummy width when table size changes
    const resizeObserver = new ResizeObserver(() => {
      const dummy = topScroll.querySelector('.dummy-scroll') as HTMLDivElement;
      if (dummy) {
        dummy.style.width = `${tableBody.scrollWidth}px`;
      }
    });
    resizeObserver.observe(tableBody);
    
    topScroll.addEventListener('scroll', onTopScroll);
    tableBody.addEventListener('scroll', onTableScroll);
    
    return () => {
      topScroll.removeEventListener('scroll', onTopScroll);
      tableBody.removeEventListener('scroll', onTableScroll);
      resizeObserver.disconnect();
    };
  }, [data, periods]);

  // Measure sticky header height dynamically to ensure perfect alignment
  useEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => {
      setStickyHeaderHeight(el.getBoundingClientRect().height);
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [data, periods]);
  
  // Pivot observations
  const rowMap = new Map<string, any>();
  const hasCounterpart = data.some(item => item.counterpartAreaCode);

  data.forEach(item => {
    // If counterpart is present, group by reporter, counterpart and indicator
    const key = hasCounterpart 
      ? `${item.economyCode}:${item.counterpartAreaCode}:${item.indicatorCode}`
      : `${item.economyCode}:${item.indicatorCode}`;
      
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        key,
        economyCode: item.economyCode,
        economyName: item.economyName,
        counterpartAreaCode: item.counterpartAreaCode || '',
        counterpartAreaName: item.counterpartAreaName || '',
        indicatorCode: item.indicatorCode,
        indicatorName: item.indicatorName,
        unitName: item.unitName,
        multiplierName: item.multiplierName,
        _unitDiscrepancy: item._unitDiscrepancy,
        _expectedUnit: item._expectedUnit,
        _convertedPeriods: {},
      });
    }
    const row = rowMap.get(key)!;
    row[item.period] = item.obsValue;
    if (item._wasConverted) {
      row._convertedPeriods[item.period] = {
        wasConvertedToUSD: item._wasConvertedToUSD,
        originalValue: item._originalValue,
        originalUnitName: item._originalUnitName,
        originalMultiplierName: item._originalMultiplierName,
        exchangeRateUsed: item._exchangeRateUsed
      };
    }
  });

  // Compute unique indicators, economies, and units from the source data
  const uniqueIndicators = Array.from(new Set(data.map(item => item.indicatorCode)));
  const uniqueEconomies = Array.from(new Set(data.map(item => item.economyCode)));
  const uniqueUnits = Array.from(new Set(data.map(item => formatUnit(item.multiplierName, item.unitName))));

  const isSingleIndicator = uniqueIndicators.length === 1;
  const isSingleEconomy = uniqueEconomies.length === 1;
  const isSingleUnit = uniqueUnits.length === 1;

  const getRowAverage = (row: any) => {
    let sum = 0;
    let count = 0;
    periods.forEach(p => {
      const val = row[p];
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
    });
    return count > 0 ? sum / count : -Infinity;
  };

  let dataSource = Array.from(rowMap.values()).sort((a, b) => {
    if (isSingleEconomy && !isSingleIndicator) {
      if (orderedIndicatorCodes && orderedIndicatorCodes.length > 0) {
        const idxA = orderedIndicatorCodes.indexOf(a.indicatorCode);
        const idxB = orderedIndicatorCodes.indexOf(b.indicatorCode);
        if (idxA !== -1 && idxB !== -1) {
          return idxA - idxB;
        }
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      return a.indicatorName.localeCompare(b.indicatorName);
    }
    const avgA = getRowAverage(a);
    const avgB = getRowAverage(b);
    if (avgA !== avgB) {
      return avgB - avgA;
    }
    const nameCompare = a.economyName.localeCompare(b.economyName);
    if (nameCompare !== 0) return nameCompare;
    if (hasCounterpart) {
      return a.counterpartAreaName.localeCompare(b.counterpartAreaName);
    }
    return a.indicatorName.localeCompare(b.indicatorName);
  });

  // For ARIC counterpart tables: hide rows where all DISPLAYED period values are 0 or null
  if (hasCounterpart && periods.length > 0) {
    dataSource = dataSource.filter(row => {
      return periods.some(period => {
        const val = row[period];
        if (val === null || val === undefined || val === '') return false;
        const num = Number(val);
        // Keep row only if at least one displayed period has a value that rounds to something non-zero (>= 0.005)
        return !isNaN(num) && Math.abs(num) >= 0.005;
      });
    });
  }

  // Calculate row spans for vertical cell merging of standard Economy column
  const rowSpanMap = new Map<string, number>();
  if (hasCounterpart) {
    dataSource.forEach((item, index) => {
      const econ = item.economyCode;
      const firstIndex = dataSource.findIndex(x => x.economyCode === econ);
      if (firstIndex === index) {
        const count = dataSource.filter(x => x.economyCode === econ).length;
        rowSpanMap.set(item.key, count);
      } else {
        rowSpanMap.set(item.key, 0);
      }
    });
  }

  const activeIndicatorName = dataSource[0]?.indicatorName || '';
  const activeIndicatorCode = dataSource[0]?.indicatorCode || '';
  const activeEconomyName = dataSource[0]?.economyName || '';
  const activeEconomyCode = dataSource[0]?.economyCode || '';
  const activeUnit = isSingleUnit ? uniqueUnits[0] : '';

  // Check if any row has a converted value
  const hasAnyConversion = dataSource.some(row => Object.keys(row._convertedPeriods || {}).length > 0);

  // Set up table columns
  const columns: any[] = [];

  // 1. Add Economy column if not a single economy or if counterpart is present
  if (!isSingleEconomy || hasCounterpart) {
    columns.push({
      title: 'Economy',
      dataIndex: 'economyName',
      key: 'economyName',
      fixed: 'left',
      width: 180,
      sorter: (a: any, b: any) => a.economyName.localeCompare(b.economyName),
      render: (text: string, record: any) => {
        const iso2 = ISO3_TO_ISO2[record.economyCode];
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
            <span style={{ fontWeight: 500 }}>{text}</span>
            {onInfoClick && (
              <Button
                type="text"
                icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '13px' }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onInfoClick({
                    indicatorCode: record.indicatorCode,
                    economyCode: record.economyCode,
                    datasetCode: record.datasetCode
                  });
                }}
                size="small"
                style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '6px' }}
              />
            )}
          </div>
        );
      },
      onCell: (record: any) => {
        const span = hasCounterpart ? (rowSpanMap.get(record.key) ?? 1) : 1;
        return {
          rowSpan: span,
          style: { verticalAlign: 'top', paddingTop: '16px' }
        };
      }
    });
  }

  // 2. Add Counterpart Area column if counterpart is present
  if (hasCounterpart) {
    columns.push({
      title: 'Counterpart Area',
      dataIndex: 'counterpartAreaName',
      key: 'counterpartAreaName',
      fixed: 'left',
      width: 180,
      sorter: (a: any, b: any) => a.counterpartAreaName.localeCompare(b.counterpartAreaName),
      render: (text: string, record: any) => {
        if (!record.counterpartAreaCode) {
          return <span style={{ color: '#94a3b8', fontWeight: 500 }}>NA</span>;
        }
        const iso2 = ISO3_TO_ISO2[record.counterpartAreaCode];
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
            <span style={{ fontWeight: 500 }}>{text || record.counterpartAreaCode}</span>
            {onInfoClick && (
              <Button
                type="text"
                icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '13px' }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onInfoClick({
                    indicatorCode: record.indicatorCode,
                    economyCode: record.economyCode,
                    counterpartAreaCode: record.counterpartAreaCode,
                    datasetCode: record.datasetCode
                  });
                }}
                size="small"
                style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '6px' }}
              />
            )}
          </div>
        );
      }
    });
  }

  // 3. Add Indicator column if not a single indicator
  if (!isSingleIndicator) {
    columns.push({
      title: 'Indicator',
      dataIndex: 'indicatorName',
      key: 'indicatorName',
      fixed: 'left',
      width: 250,
      sorter: (a: any, b: any) => a.indicatorName.localeCompare(b.indicatorName),
      render: (text: string, record: any) => (
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 500 }}>{text}</span>
            {onInfoClick && (
              <Button
                type="text"
                icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '13px' }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onInfoClick({
                    indicatorCode: record.indicatorCode,
                    economyCode: record.economyCode,
                    datasetCode: record.datasetCode
                  });
                }}
                size="small"
                style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              />
            )}
          </div>
          {record.unitName && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {formatUnit(record.multiplierName, record.unitName)}
            </div>
          )}
        </div>
      )
    });
  }

  // 4. Add dedicated Unit column if Indicator is hidden but units vary across rows (or for counterpart lists)
  if ((isSingleIndicator && !isSingleUnit) || hasCounterpart) {
    columns.push({
      title: 'Unit',
      key: 'unit_column',
      fixed: 'left',
      width: 160,
      render: (_: any, record: any) => {
        const unitDisplay = formatUnit(record.multiplierName, record.unitName);
        return (
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {unitDisplay}
          </span>
        );
      }
    });
  }

  // Dynamic columns for each period/year
  const sortedPeriods = [...periods].sort();
  sortedPeriods.forEach(period => {
    columns.push({
      title: period,
      dataIndex: period,
      key: period,
      align: 'right',
      width: 100,
      sorter: (a: any, b: any) => (a[period] ?? -Infinity) - (b[period] ?? -Infinity),
      render: (val: any, record: any) => {
        if (val === undefined || val === null) return <span style={{ color: '#94a3b8' }}>—</span>;
        const convInfo = record._convertedPeriods?.[period];
        const formatted = Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (convInfo) {
          const tooltipTitle = convInfo.wasConvertedToUSD
            ? `Original: ${Number(convInfo.originalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${formatUnit(convInfo.originalMultiplierName, convInfo.originalUnitName)} (Exchange Rate: ${convInfo.exchangeRateUsed ? Number(convInfo.exchangeRateUsed).toFixed(4) : '1'})`
            : "* Value was converted from a different scale to match the majority multiplier";
          return (
            <Tooltip title={tooltipTitle}>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', color: '#2563eb', cursor: 'help' }}>
                {formatted}
                <sup style={{ color: '#f59e0b', fontSize: '9px', marginLeft: '1px' }}>*</sup>
              </span>
            </Tooltip>
          );
        }
        return (
          <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
            {formatted}
          </span>
        );
      }
    });
  });

  // Header content (used both in static and sticky positions)
  const renderHeaderContent = () => {
    if (dataSource.length === 0) {
      if (extra) {
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
            <div style={{ flexShrink: 0 }}>{extra}</div>
          </div>
        );
      }
      return null;
    }
    if (!(isSingleIndicator || isSingleEconomy)) {
      if (extra) {
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
            <div style={{ flexShrink: 0 }}>{extra}</div>
          </div>
        );
      }
      return null;
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {isSingleIndicator && isSingleEconomy ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {ISO3_TO_ISO2[activeEconomyCode] && (
                  <img 
                    src={`https://flagcdn.com/20x15/${ISO3_TO_ISO2[activeEconomyCode].toLowerCase()}.png`} 
                    alt="" 
                    style={{ width: '20px', height: '15px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                  />
                )}
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {capitalizeWords(activeIndicatorName)} — {activeEconomyName}
                </span>
                {onInfoClick && (
                  <Button
                    type="text"
                    icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '14px' }} />}
                    onClick={() => onInfoClick({
                      indicatorCode: activeIndicatorCode,
                      economyCode: activeEconomyCode,
                      datasetCode: dataSource[0]?.datasetCode
                    })}
                    size="small"
                    style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                )}
              </div>
              {activeUnit && (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {activeUnit}
                </div>
              )}
            </>
          ) : isSingleIndicator ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {capitalizeWords(activeIndicatorName)}
                </span>
                {onInfoClick && (
                  <Button
                    type="text"
                    icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '14px' }} />}
                    onClick={() => onInfoClick({
                      indicatorCode: activeIndicatorCode,
                      economyCode: activeEconomyCode,
                      datasetCode: dataSource[0]?.datasetCode
                    })}
                    size="small"
                    style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                )}
              </div>
              {activeUnit && (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {activeUnit}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {ISO3_TO_ISO2[activeEconomyCode] && (
                  <img 
                    src={`https://flagcdn.com/20x15/${ISO3_TO_ISO2[activeEconomyCode].toLowerCase()}.png`} 
                    alt="" 
                    style={{ width: '20px', height: '15px', borderRadius: '2px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                  />
                )}
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {activeEconomyName}
                </span>
                {onInfoClick && (
                  <Button
                    type="text"
                    icon={<InfoCircleOutlined style={{ color: '#94a3b8', fontSize: '14px' }} />}
                    onClick={() => onInfoClick({
                      indicatorCode: activeIndicatorCode,
                      economyCode: activeEconomyCode,
                      datasetCode: dataSource[0]?.datasetCode
                    })}
                    size="small"
                    style={{ padding: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Economy Profile Data
              </div>
            </>
          )}
          {hasAnyConversion && (
            <div style={{ marginTop: '4px' }}>
              <Tag color="blue" style={{ fontSize: '11px' }}>
                <span style={{ color: '#f59e0b', marginRight: '3px' }}>*</span>
                Values marked with * were scaled to match the majority multiplier
              </Tag>
            </div>
          )}
        </div>
        {extra && <div style={{ flexShrink: 0, marginLeft: '16px' }}>{extra}</div>}
      </div>
    );
  };

  const showBanner = ((isSingleIndicator || isSingleEconomy) && dataSource.length > 0) || !!extra;
  const showScrollbar = periods.length > 5;

  return (
    <div ref={tableContainerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
      {/* Sticky Mask to cover the gap between the navbar and the sticky header container */}
      <div 
        style={{
          position: 'sticky',
          top: '0px',
          height: `${totalStickyTop}px`,
          zIndex: 100,
          background: '#f8fafc',
          pointerEvents: 'none',
          marginTop: `-${totalStickyTop}px`,
        }}
      />
      
      {/* Unified Sticky Header Block (Banner and Scrollbar) */}
      {(showBanner || showScrollbar) && (
        <div 
          ref={stickyHeaderRef}
          className="no-radius explorer-sticky-header"
          style={{
            position: 'sticky',
            top: `${totalStickyTop}px`,
            zIndex: 101,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Premium Header Banner above Table */}
          {showBanner && (
            <div 
              style={{ 
                background: '#fff', 
                padding: '16px 20px', 
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              {renderHeaderContent()}
            </div>
          )}

          {/* Top synchronized scrollbar */}
          {showScrollbar && (
            <div 
              ref={topScrollRef} 
              style={{ 
                width: '100%', 
                overflowX: 'auto', 
                overflowY: 'hidden', 
                height: '12px', 
                background: '#fff',
                scrollbarWidth: 'thin',
                borderTop: showBanner ? '1px solid #f1f5f9' : 'none',
                boxSizing: 'border-box',
              }}
              className="top-scrollbar-sync"
            >
              <div className="dummy-scroll" style={{ height: '1px' }} />
            </div>
          )}
        </div>
      )}

      {/* Main Table Content */}
      <div style={{ 
        border: '1px solid #e2e8f0', 
        borderTop: 'none',
        borderTopLeftRadius: '0px', 
        borderTopRightRadius: '0px', 
        borderBottomLeftRadius: '0px', 
        borderBottomRightRadius: '0px',
        background: '#fff',
        position: 'relative',
        zIndex: 1,
      }}>
        <Table 
          dataSource={dataSource} 
          columns={columns} 
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="middle"
          sticky={{ offsetHeader: totalStickyTop + Math.round(stickyHeaderHeight) - 1 }}
        />
      </div>

      <style>{`
        .ant-table-wrapper,
        .ant-table,
        .ant-table-container,
        .ant-table-content,
        .ant-table-thead > tr > th,
        .ant-card,
        .ant-card-body,
        .ant-table-thead,
        .ant-table-tbody {
          border-radius: 0 !important;
        }
        .ant-table,
        .ant-table-container,
        .ant-table-sticky-holder {
          border-top: none !important;
        }
        .top-scrollbar-sync::-webkit-scrollbar {
          height: 6px;
        }
        .top-scrollbar-sync::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .top-scrollbar-sync::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .top-scrollbar-sync::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
