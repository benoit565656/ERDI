'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Form, Input, Tabs, Tag, message, Typography, Space, Row, Col } from 'antd';
import {
  InfoCircleOutlined,
  AlignLeftOutlined,
  HistoryOutlined,
  DeploymentUnitOutlined,
  AuditOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import FilterPanel, { FilterField } from '@/components/FilterPanel';

const { Title, Text } = Typography;

// Schema placeholder for Observation drawer (read-only fields mostly, status is editable)
const observationSchema = z.object({
  id: z.string(),
  obsValue: z.string().or(z.number()).optional().nullable(),
  obsStatusCode: z.string().optional().nullable(),
  unitCode: z.string().optional().nullable(),
  unitMultCode: z.string().optional().nullable(),
  decimalsCode: z.string().optional().nullable(),
});

export default function ObservationsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter States
  const [filters, setFilters] = useState<Record<string, any>>({
    datasetCode: 'KIDB', // Default dataset to load initial records
  });

  // Dependent Select States
  const [datasetCode, setDatasetCode] = useState<string>('KIDB');
  const [dataflowCode, setDataflowCode] = useState<string>('');

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Datasets dropdown options
  const { data: datasetsOpt = [] } = useQuery<any[]>({
    queryKey: ['filterDatasets'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=datasets');
      if (!res.ok) throw new Error('Failed to load datasets options');
      return res.json();
    },
  });

  // Fetch Dataflows dependent on selected Dataset
  const { data: dataflowsOpt = [], isLoading: loadingDataflows } = useQuery<any[]>({
    queryKey: ['filterDataflows', datasetCode],
    queryFn: async () => {
      if (!datasetCode) return [];
      const res = await fetch(`/api/available-options?type=dataflows&datasetCode=${datasetCode}`);
      if (!res.ok) throw new Error('Failed to load dataflows options');
      return res.json();
    },
    enabled: !!datasetCode,
  });

  // Fetch Indicators dependent on selected Dataflow
  const { data: indicatorsOpt = [], isLoading: loadingIndicators } = useQuery<any[]>({
    queryKey: ['filterIndicators', dataflowCode],
    queryFn: async () => {
      if (!dataflowCode) return [];
      const res = await fetch(`/api/available-options?type=indicators&dataflowCode=${dataflowCode}`);
      if (!res.ok) throw new Error('Failed to load indicators options');
      return res.json();
    },
    enabled: !!dataflowCode,
  });

  // Fetch Economies list
  const { data: economiesOpt = [] } = useQuery<any[]>({
    queryKey: ['filterEconomies'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=economies');
      if (!res.ok) throw new Error('Failed to load economies options');
      return res.json();
    },
  });

  // Fetch Observations Grid
  const queryParamsStr = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
    });
    Object.keys(filters).forEach((key) => {
      if (filters[key]) {
        params.append(key, filters[key]);
      }
    });
    return params.toString();
  }, [filters, currentPage, pageSize]);

  const { data: observationsData, isLoading: loadingObs, refetch } = useQuery<any>({
    queryKey: ['observationsGrid', queryParamsStr],
    queryFn: async () => {
      const res = await fetch(`/api/observations?${queryParamsStr}`);
      if (!res.ok) throw new Error('Failed to fetch observations');
      return res.json();
    },
  });

  // Build filter fields schema
  const filterFields: FilterField[] = useMemo(() => {
    return [
      {
        key: 'datasetCode',
        label: 'Dataset',
        type: 'select',
        options: datasetsOpt,
        onChange: (val) => {
          setDatasetCode(val);
          setDataflowCode(''); // reset child
        },
      },
      {
        key: 'mainDataflowCode',
        label: 'Dataflow category',
        type: 'select',
        options: dataflowsOpt,
        loading: loadingDataflows,
        onChange: (val) => {
          setDataflowCode(val);
        },
      },
      {
        key: 'indicatorCode',
        label: 'Indicator',
        type: 'select',
        options: indicatorsOpt,
        loading: loadingIndicators,
      },
      {
        key: 'economyCode',
        label: 'Economy',
        type: 'select',
        options: economiesOpt,
      },
      {
        key: 'freqCode',
        label: 'Frequency',
        type: 'select',
        options: [
          { label: 'Annual (A)', value: 'A' },
          { label: 'Quarterly (Q)', value: 'Q' },
          { label: 'Monthly (M)', value: 'M' },
        ],
      },
      {
        key: 'period',
        label: 'Period (Year)',
        type: 'text',
        placeholder: 'e.g. 2020',
      },
    ];
  }, [datasetsOpt, dataflowsOpt, indicatorsOpt, economiesOpt, loadingDataflows, loadingIndicators]);

  const handleSearch = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset page
  };

  const handleReset = () => {
    setFilters({});
    setDatasetCode('');
    setDataflowCode('');
    setCurrentPage(1);
  };

  const handleRowClick = (record: any) => {
    setEditingRecord(record);
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Indicator',
      dataIndex: 'indicatorCode',
      key: 'indicatorCode',
      sorter: (a: any, b: any) => a.indicatorCode.localeCompare(b.indicatorCode),
    },
    {
      title: 'Economy',
      dataIndex: 'economyCode',
      key: 'economyCode',
      sorter: (a: any, b: any) => a.economyCode.localeCompare(b.economyCode),
    },
    {
      title: 'Freq',
      dataIndex: 'freqCode',
      key: 'freqCode',
      width: 80,
    },
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      width: 100,
      sorter: (a: any, b: any) => a.period.localeCompare(b.period),
    },
    {
      title: 'Value',
      dataIndex: 'obsValue',
      key: 'obsValue',
      render: (val: any) => (val !== null && val !== undefined ? parseFloat(val).toLocaleString() : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'obsStatusCode',
      key: 'obsStatusCode',
      render: (code: string) => <Tag color={code === 'A' ? 'green' : 'orange'}>{code || 'Normal'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => handleRowClick(record)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Observations Database Grid</Title>
        <Text type="secondary">
          Browse and filter millions of statistical observation values directly from the database.
        </Text>
      </div>

      {/* Reusable Collapsible Filter panel */}
      <FilterPanel
        fields={filterFields}
        onSearch={handleSearch}
        onReset={handleReset}
        initialValues={{ datasetCode: 'KIDB' }}
      />

      {/* Main observations Table grid */}
      <Card bordered={false} style={{ borderRadius: 8 }}>
        <DataTable
          columns={columns}
          dataSource={observationsData?.observations || []}
          loading={loadingObs}
          rowKey="id"
          onRefresh={refetch}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: observationsData?.total || 0,
            onChange: (p: number, ps: number) => {
              setCurrentPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* Detailed view form drawer */}
      <FormDrawer
        title={editingRecord ? `Observation Details` : ''}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={observationSchema}
        defaultValues={editingRecord ? {
          id: editingRecord.id,
          obsValue: editingRecord.obsValue ? parseFloat(editingRecord.obsValue.toString()) : '',
          obsStatusCode: editingRecord.obsStatusCode || '',
          unitCode: editingRecord.unitCode || '',
          unitMultCode: editingRecord.unitMultCode || '',
          decimalsCode: editingRecord.decimalsCode || '',
        } : { id: '' }}
        onSubmit={async (data) => {
          message.info('Workflow/Edit operations simulated.');
          setDrawerVisible(false);
        }}
        width={650}
      >
        {(form) => {
          if (!editingRecord) return null;

          const generalTab = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item label="Observation ID">
                <Input value={editingRecord.id} disabled />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Indicator Code">
                    <Input value={editingRecord.indicatorCode} disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Economy Code">
                    <Input value={editingRecord.economyCode} disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Frequency Code">
                    <Input value={editingRecord.freqCode} disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Time Period">
                    <Input value={editingRecord.period} disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Observation Value (Reported)">
                <Input value={form.watch('obsValue') || ''} disabled />
              </Form.Item>
              <Form.Item label="Observation Status Code">
                <Input value={form.watch('obsStatusCode') || 'A'} disabled />
              </Form.Item>
            </Space>
          );

          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <InfoCircleOutlined /> General
                    </span>
                  ),
                  children: generalTab,
                },
                {
                  key: 'attributes',
                  label: (
                    <span>
                      <AlignLeftOutlined /> Attributes
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
                      <Form.Item label="Unit of Measure Code">
                        <Input value={form.watch('unitCode') || 'PCT_TTL_LND_AREA'} disabled />
                      </Form.Item>
                      <Form.Item label="Unit Multiplier Code">
                        <Input value={form.watch('unitMultCode') || '0'} disabled />
                      </Form.Item>
                      <Form.Item label="Decimals Code">
                        <Input value={form.watch('decimalsCode') || '1'} disabled />
                      </Form.Item>
                    </Space>
                  ),
                },
                {
                  key: 'metadata',
                  label: (
                    <span>
                      <GlobalOutlined /> Metadata
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
                      <Form.Item label="Data Source">
                        <Input.TextArea rows={3} value={editingRecord.dataSource || 'Food and Agriculture Organization'} disabled />
                      </Form.Item>
                      <Form.Item label="Footnote">
                        <Input.TextArea rows={3} value={editingRecord.footnote || 'No footnote recorded.'} disabled />
                      </Form.Item>
                    </Space>
                  ),
                },
                {
                  key: 'dimensions',
                  label: (
                    <span>
                      <DeploymentUnitOutlined /> Extra Dimensions
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary">No extra dimensions are attached to this series key.</Text>
                    </div>
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <span>
                      <HistoryOutlined /> History
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary">Original reported ingest. No modifications logged.</Text>
                    </div>
                  ),
                },
                {
                  key: 'workflow',
                  label: (
                    <span>
                      <AuditOutlined /> Workflow Status
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
                      <div>
                        <span style={{ marginRight: 12 }}>Status:</span>
                        <Tag color="green">{editingRecord.workflowStatus || 'PUBLISHED'}</Tag>
                      </div>
                      <div>
                        <span style={{ marginRight: 12 }}>Published:</span>
                        <span>{editingRecord.isPublished ? 'Yes' : 'No'}</span>
                      </div>
                    </Space>
                  ),
                },
              ]}
            />
          );
        }}
      </FormDrawer>
    </div>
  );
}
