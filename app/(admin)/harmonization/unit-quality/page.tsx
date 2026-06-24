'use client';

import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Modal, Select, Typography, Tag, Tooltip,
  Space, message, Spin, Alert, Badge,
} from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ToolOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ── Types matching the API response ─────────────────────────────────────────
interface OtherUnit {
  unitCode:     string;
  unitName:     string;
  economyCount: number;
}

interface DiscrepancyRow {
  indicatorCode:      string;
  indicatorName:      string;
  commonUnitCode:     string;
  commonUnitName:     string;
  commonEconomyCount: number;
  otherUnits:         OtherUnit[];
  otherEconomyCount:  number;
  totalUnitCount:     number;
  hasCurrencyUnit:    boolean;
}

export default function UnitQualityPage() {
  const queryClient = useQueryClient();
  const [fixingRow, setFixingRow]       = useState<DiscrepancyRow | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | undefined>(undefined);
  const [searchText, setSearchText]     = useState('');

  // ── Fetch discrepancy report ──────────────────────────────────────────────
  const { data: report = [], isLoading, refetch } = useQuery<DiscrepancyRow[]>({
    queryKey: ['unitDiscrepancies'],
    queryFn: async () => {
      const res = await fetch('/api/harmonization/unit-discrepancies');
      if (!res.ok) throw new Error('Failed to load unit discrepancy report');
      return res.json();
    },
    staleTime: 0,
  });

  // ── Fetch units codelist ──────────────────────────────────────────────────
  const { data: unitsOpt = [], isLoading: loadingUnits } = useQuery<{ label: string; value: string }[]>({
    queryKey: ['unitOptions'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=units');
      if (!res.ok) throw new Error('Failed to load units');
      return res.json();
    },
  });

  // ── Fix mutation ──────────────────────────────────────────────────────────
  const fixMutation = useMutation({
    mutationFn: async (payload: { indicatorCode: string; newUnitCode: string }) => {
      const res = await fetch('/api/harmonization/unit-discrepancies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fix failed');
      }
      return res.json() as Promise<{ success: boolean; updatedCount: number }>;
    },
    onSuccess: (result) => {
      message.success(`Fixed ${result.updatedCount} observation(s) successfully.`);
      setFixingRow(null);
      setSelectedUnit(undefined);
      queryClient.invalidateQueries({ queryKey: ['unitDiscrepancies'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Error applying fix.');
    },
  });

  const handleOpenFix = (row: DiscrepancyRow) => {
    setFixingRow(row);
    setSelectedUnit(row.commonUnitCode);
  };

  const handleConfirmFix = () => {
    if (!fixingRow || !selectedUnit) return;
    fixMutation.mutate({
      indicatorCode: fixingRow.indicatorCode,
      newUnitCode:   selectedUnit,
    });
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalIssues           = report.length;
  const totalAffectedEconomies = report.reduce((s, r) => s + r.otherEconomyCount, 0);

  const filteredReport = useMemo(() => {
    if (!searchText) return report;
    const q = searchText.toLowerCase();
    return report.filter(
      (row) =>
        row.indicatorName.toLowerCase().includes(q) ||
        row.indicatorCode.toLowerCase().includes(q) ||
        row.otherUnits.some((u) => u.unitName.toLowerCase().includes(q))
    );
  }, [report, searchText]);

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Indicator',
      key: 'indicator',
      width: 280,
      sorter: (a: DiscrepancyRow, b: DiscrepancyRow) =>
        a.indicatorName.localeCompare(b.indicatorName),
      render: (_: unknown, row: DiscrepancyRow) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
            {row.indicatorName}
          </div>
          <Tag style={{ marginTop: 3, fontSize: '10px' }} color="geekblue">
            {row.indicatorCode}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Most Common Unit',
      key: 'commonUnit',
      width: 180,
      sorter: (a: DiscrepancyRow, b: DiscrepancyRow) =>
        a.commonUnitName.localeCompare(b.commonUnitName),
      render: (_: unknown, row: DiscrepancyRow) => (
        <div>
          <Tag color="green" style={{ fontSize: '12px' }}>
            <CheckCircleOutlined style={{ marginRight: 4 }} />
            {row.commonUnitName}
          </Tag>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2 }}>
            {row.commonUnitCode}
          </div>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Number of economies using the most common unit">
          # Economies (Common)
        </Tooltip>
      ),
      key: 'commonEconomyCount',
      width: 130,
      align: 'right' as const,
      sorter: (a: DiscrepancyRow, b: DiscrepancyRow) =>
        a.commonEconomyCount - b.commonEconomyCount,
      render: (_: unknown, row: DiscrepancyRow) => (
        <Badge
          count={row.commonEconomyCount}
          style={{ backgroundColor: '#22c55e', fontSize: '11px' }}
          overflowCount={9999}
        />
      ),
    },
    {
      title: 'Other Units Used',
      key: 'otherUnits',
      width: 220,
      render: (_: unknown, row: DiscrepancyRow) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {row.otherUnits.map((u) => (
            <Tooltip
              key={u.unitCode}
              title={`${u.economyCount} econom${u.economyCount === 1 ? 'y' : 'ies'} use "${u.unitName}" (${u.unitCode})`}
            >
              <Tag color="orange" style={{ fontSize: '11px', cursor: 'help' }}>
                <WarningOutlined style={{ marginRight: 3 }} />
                {u.unitName}
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  ×{u.economyCount}
                </span>
              </Tag>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Total economies using a non-standard unit">
          # Economies (Other)
        </Tooltip>
      ),
      key: 'otherEconomyCount',
      width: 130,
      align: 'right' as const,
      sorter: (a: DiscrepancyRow, b: DiscrepancyRow) =>
        a.otherEconomyCount - b.otherEconomyCount,
      render: (_: unknown, row: DiscrepancyRow) => (
        <Badge
          count={row.otherEconomyCount}
          style={{ backgroundColor: '#f59e0b', fontSize: '11px' }}
          overflowCount={9999}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Total distinct unit codes used for this indicator">
          # Unit Types
        </Tooltip>
      ),
      key: 'totalUnitCount',
      width: 100,
      align: 'right' as const,
      sorter: (a: DiscrepancyRow, b: DiscrepancyRow) =>
        a.totalUnitCount - b.totalUnitCount,
      render: (_: unknown, row: DiscrepancyRow) => (
        <Tag
          color={row.totalUnitCount > 2 ? 'red' : 'orange'}
          style={{ fontWeight: 700, fontSize: '13px' }}
        >
          {row.totalUnitCount}
        </Tag>
      ),
    },
    {
      title: (
        <Tooltip title="Indicates that this indicator involves local / national currency units. Long-term goal: migrate to NCU (National Currency Unit).">
          Currency
        </Tooltip>
      ),
      key: 'currency',
      width: 130,
      filters: [
        { text: 'Currency Related', value: true },
        { text: 'Not Currency', value: false },
      ],
      onFilter: (value: any, record: DiscrepancyRow) => record.hasCurrencyUnit === value,
      render: (_: unknown, row: DiscrepancyRow) =>
        row.hasCurrencyUnit ? (
          <Tooltip title="At least one unit used for this indicator is a local/national currency code. Future target: NCU.">
            <Tag
              color="purple"
              icon={<DollarOutlined />}
              style={{ fontSize: '11px', cursor: 'help' }}
            >
              Currency Related
            </Tag>
          </Tooltip>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
        ),
    },
    {
      title: 'Fix',
      key: 'actions',
      width: 110,
      render: (_: unknown, row: DiscrepancyRow) => (
        <Button
          type="primary"
          size="small"
          icon={<ToolOutlined />}
          onClick={() => handleOpenFix(row)}
          style={{ borderRadius: 6, background: '#6366f1', borderColor: '#6366f1' }}
        >
          Fix Units
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ExperimentOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            Unit Quality Check
          </Title>
          <Text type="secondary">
            Shows every indicator where different economies report data using different units of measure.
            Currency, energy, and index-type indicators are automatically excluded.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
          Refresh Scan
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[
          {
            label: 'Indicators with Unit Issues',
            value: totalIssues,
            color: '#f59e0b',
            icon: <WarningOutlined />,
          },
          {
            label: 'Economies Using Non-Standard Units',
            value: totalAffectedEconomies,
            color: '#ef4444',
            icon: <InfoCircleOutlined />,
          },
        ].map(({ label, value, color, icon }) => (
          <Card key={label} size="small" style={{ borderLeft: `4px solid ${color}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24, color }}>{icon}</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Auto-exclusion notice */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Auto-exclusions applied"
        description="Indicators whose unit contains currency (USD, EUR, GBP, LCU, local currency), energy (KWH, MWH, Joule, TOE, BTU, Watt), trade volume (barrel, metric ton), or index terms are excluded — unit variation is expected for these types."
        style={{ borderRadius: 8 }}
      />

      {/* Main table */}
      <Card
        bordered={false}
        style={{ borderRadius: 8 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600 }}>Unit Discrepancy Report</span>
            {!isLoading && (
              <Tag color={totalIssues === 0 ? 'green' : 'orange'}>
                {totalIssues === 0 ? 'All Clear' : `${totalIssues} indicator(s)`}
              </Tag>
            )}
          </div>
        }
        extra={
          <input
            id="unit-quality-search"
            placeholder="Search indicator or unit…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: '5px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 13,
              outline: 'none',
              width: 240,
            }}
          />
        }
      >
        <Spin spinning={isLoading}>
          {totalIssues === 0 && !isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#22c55e', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                No Unit Discrepancies Found
              </div>
              <div style={{ color: '#64748b', marginTop: 4 }}>
                All indicators use consistent units across economies.
              </div>
            </div>
          ) : (
            <Table
              dataSource={filteredReport}
              columns={columns}
              rowKey="indicatorCode"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (t) => `${t} indicator(s) with issues`,
              }}
              size="middle"
              scroll={{ x: 'max-content' }}
              rowClassName={(record: DiscrepancyRow) =>
                fixingRow?.indicatorCode === record.indicatorCode ? 'ant-table-row-selected' : ''
              }
            />
          )}
        </Spin>
      </Card>

      {/* ── Fix Units Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!fixingRow}
        onCancel={() => { setFixingRow(null); setSelectedUnit(undefined); }}
        title={
          <Space>
            <ToolOutlined style={{ color: '#6366f1' }} />
            <span>Fix Units — {fixingRow?.indicatorName}</span>
          </Space>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setFixingRow(null); setSelectedUnit(undefined); }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={fixMutation.isPending}
              disabled={!selectedUnit}
              onClick={handleConfirmFix}
              style={{ background: '#6366f1', borderColor: '#6366f1' }}
            >
              Apply Fix Across All Economies &amp; Periods
            </Button>
          </div>
        }
        width={640}
      >
        {fixingRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Indicator info */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Indicator
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                {fixingRow.indicatorName}
              </div>
              <Tag color="geekblue" style={{ marginTop: 4 }}>{fixingRow.indicatorCode}</Tag>
            </div>

            {/* Current unit distribution */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current Unit Distribution
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left',  fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Unit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left',  fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}># Economies</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left',  fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Majority row */}
                    <tr style={{ background: '#f0fdf4' }}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
                        {fixingRow.commonUnitName}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: 11 }}>
                        {fixingRow.commonUnitCode}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700 }}>
                        {fixingRow.commonEconomyCount}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <Tag color="green" style={{ fontSize: '11px' }}>
                          <CheckCircleOutlined style={{ marginRight: 3 }} />
                          Most Common
                        </Tag>
                      </td>
                    </tr>
                    {/* Other unit rows */}
                    {fixingRow.otherUnits.map((u, i) => (
                      <tr key={u.unitCode} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>
                          {u.unitName}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: 11 }}>
                          {u.unitCode}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                          {u.economyCount}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                          <Tag color="orange" style={{ fontSize: '11px' }}>
                            <WarningOutlined style={{ marginRight: 3 }} />
                            Non-Standard
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unit selector */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Replace ALL non-standard units with
              </div>
              <Select
                id="unit-fix-select"
                value={selectedUnit}
                onChange={setSelectedUnit}
                options={unitsOpt}
                loading={loadingUnits}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                size="large"
                placeholder="Select the correct unit from codelist…"
              />
              {selectedUnit && selectedUnit === fixingRow.commonUnitCode && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircleOutlined />
                  Pre-filled with the majority unit used by most economies
                </div>
              )}
            </div>

            {/* Warning */}
            <Alert
              type="warning"
              showIcon
              message={`This will update the unitCode for ALL observations of "${fixingRow.indicatorName}" where the unit is not "${unitsOpt.find(u => u.value === selectedUnit)?.label || selectedUnit}". Every change is logged in Observation History.`}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
