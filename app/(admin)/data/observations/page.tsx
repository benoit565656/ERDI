'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Form, Input, Tabs, Tag, message, Typography, Space, Row, Col, Select, Timeline, Spin } from 'antd';
import {
  InfoCircleOutlined,
  AlignLeftOutlined,
  HistoryOutlined,
  DeploymentUnitOutlined,
  AuditOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
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
  dataSource: z.string().optional().nullable(),
  footnote: z.string().optional().nullable(),
});


export default function ObservationsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filter States
  const [filters, setFilters] = useState<Record<string, any>>({});

  // Dependent Select States
  const [datasetCode, setDatasetCode] = useState<string>('');
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

  // Fetch unit options
  const { data: unitsOpt = [], isLoading: loadingUnits } = useQuery<any[]>({
    queryKey: ['filterUnits'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=units');
      if (!res.ok) throw new Error('Failed to load units options');
      return res.json();
    },
  });

  // Fetch multiplier options
  const { data: multipliersOpt = [], isLoading: loadingMultipliers } = useQuery<any[]>({
    queryKey: ['filterMultipliers'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=multipliers');
      if (!res.ok) throw new Error('Failed to load multipliers options');
      return res.json();
    },
  });

  // Fetch decimal options
  const { data: decimalsOpt = [], isLoading: loadingDecimals } = useQuery<any[]>({
    queryKey: ['filterDecimals'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=decimals');
      if (!res.ok) throw new Error('Failed to load decimals options');
      return res.json();
    },
  });

  // Fetch observation status options
  const { data: obsStatusesOpt = [], isLoading: loadingObsStatuses } = useQuery<any[]>({
    queryKey: ['filterObsStatuses'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=obs_status');
      if (!res.ok) throw new Error('Failed to load obs status options');
      return res.json();
    },
  });

  // Fetch History for the editing record
  const { data: observationHistory = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ['observationHistory', editingRecord?.id],
    queryFn: async () => {
      if (!editingRecord?.id) return [];
      const res = await fetch(`/api/observations?historyOfObsId=${editingRecord.id}`);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
    enabled: !!editingRecord?.id && drawerVisible,
  });

  const queryClient = useQueryClient();

  // Mutation to update observation
  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/observations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update observation');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Observation updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['observationsGrid'] });
      refetchHistory();
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error updating observation.');
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
      title: 'Agency',
      dataIndex: 'agencyCode',
      key: 'agencyCode',
      sorter: (a: any, b: any) => (a.agencyCode || '').localeCompare(b.agencyCode || ''),
    },
    {
      title: 'Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
      sorter: (a: any, b: any) => (a.datasetCode || '').localeCompare(b.datasetCode || ''),
    },
    {
      title: 'Indicator',
      dataIndex: 'indicatorCode',
      key: 'indicatorCode',
      sorter: (a: any, b: any) => (a.indicatorCode || '').localeCompare(b.indicatorCode || ''),
    },
    {
      title: 'Economy',
      dataIndex: 'economyCode',
      key: 'economyCode',
      sorter: (a: any, b: any) => (a.economyCode || '').localeCompare(b.economyCode || ''),
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
      sorter: (a: any, b: any) => (a.period || '').localeCompare(b.period || ''),
    },
    {
      title: 'Value',
      dataIndex: 'obsValue',
      key: 'obsValue',
      render: (val: any) => (val !== null && val !== undefined ? parseFloat(val).toLocaleString() : '-'),
    },
    {
      title: 'Unit',
      dataIndex: 'unitCode',
      key: 'unitCode',
      render: (val: any, record: any) => {
        if (!val) return '-';
        return record.unitMultCode && record.unitMultCode !== '0' ? `${val} (10^${record.unitMultCode})` : val;
      }
    },
    {
      title: 'Source',
      dataIndex: 'dataSource',
      key: 'dataSource',
      ellipsis: true,
    },
    {
      title: 'Footnote',
      dataIndex: 'footnote',
      key: 'footnote',
      ellipsis: true,
    },
    {
      title: 'Ref Year',
      dataIndex: 'refYear',
      key: 'refYear',
      width: 90,
      render: (val: any) => val || '-',
    },
    {
      title: 'Base Year',
      dataIndex: 'baseYear',
      key: 'baseYear',
      width: 100,
      render: (val: any) => val || '-',
    },
    {
      title: 'Methodology',
      dataIndex: 'methodology',
      key: 'methodology',
      ellipsis: true,
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
        initialValues={{}}
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
          obsValue: editingRecord.obsValue !== null && editingRecord.obsValue !== undefined ? parseFloat(editingRecord.obsValue.toString()) : '',
          obsStatusCode: editingRecord.obsStatusCode || '',
          unitCode: editingRecord.unitCode || '',
          unitMultCode: editingRecord.unitMultCode || '',
          decimalsCode: editingRecord.decimalsCode || '',
          dataSource: editingRecord.dataSource || '',
          footnote: editingRecord.footnote || '',
        } : { id: '', obsValue: '', obsStatusCode: '', unitCode: '', unitMultCode: '', decimalsCode: '', dataSource: '', footnote: '' }}
        onSubmit={async (data) => {
          await updateMutation.mutateAsync(data);
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

              <Form.Item
                label="Observation Value (Reported)"
                help={form.formState.errors.obsValue?.message}
                validateStatus={form.formState.errors.obsValue ? 'error' : ''}
              >
                <Controller
                  name="obsValue"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                      placeholder="e.g. 10.5"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Observation Status">
                <Controller
                  name="obsStatusCode"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={obsStatusesOpt}
                      loading={loadingObsStatuses}
                      placeholder="Select observation status"
                      allowClear
                    />
                  )}
                />
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
                      <Form.Item label="Unit of Measure">
                        <Controller
                          name="unitCode"
                          control={form.control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={unitsOpt}
                              loading={loadingUnits}
                              showSearch
                              optionFilterProp="label"
                              placeholder="Select unit of measure"
                              allowClear
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Unit Multiplier">
                        <Controller
                          name="unitMultCode"
                          control={form.control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={multipliersOpt}
                              loading={loadingMultipliers}
                              placeholder="Select unit multiplier"
                              allowClear
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Decimals">
                        <Controller
                          name="decimalsCode"
                          control={form.control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={decimalsOpt}
                              loading={loadingDecimals}
                              placeholder="Select decimals count"
                              allowClear
                            />
                          )}
                        />
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
                        <Controller
                          name="dataSource"
                          control={form.control}
                          render={({ field }) => (
                            <Input.TextArea
                              {...field}
                              value={field.value || ''}
                              rows={3}
                              placeholder="e.g. World Bank, IMF, etc."
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Footnote">
                        <Controller
                          name="footnote"
                          control={form.control}
                          render={({ field }) => (
                            <Input.TextArea
                              {...field}
                              value={field.value || ''}
                              rows={4}
                              placeholder="Any specific comments or methodology notes"
                            />
                          )}
                        />
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
                      {(() => {
                        const extraDims = [
                          { label: 'Sex', value: editingRecord.sexCode },
                          { label: 'Age', value: editingRecord.ageCode },
                          { label: 'Sector', value: editingRecord.sectorCode },
                          { label: 'Occupation', value: editingRecord.occupationCode },
                          { label: 'Region', value: editingRecord.regionCode },
                          { label: 'Size Class', value: editingRecord.sizeClassCode },
                          { label: 'Ownership', value: editingRecord.ownershipCode },
                          { label: 'Currency', value: editingRecord.currencyCode },
                          { label: 'Adjustment', value: editingRecord.adjustmentCode },
                          { label: 'Price Base', value: editingRecord.priceBaseCode },
                          { label: 'Counterpart Area', value: editingRecord.counterpartAreaCode },
                        ].filter(d => d.value);

                        if (extraDims.length === 0) {
                          return <Text type="secondary">No extra dimensions are attached to this series key.</Text>;
                        }

                        return (
                          <Row gutter={[16, 16]}>
                            {extraDims.map(d => (
                              <Col span={12} key={d.label}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <Text type="secondary" style={{ fontSize: '12px' }}>{d.label}</Text>
                                  <Text strong style={{ fontSize: '14px' }}>{d.value}</Text>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        );
                      })()}
                    </div>
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <span>
                      <HistoryOutlined /> History ({observationHistory.length})
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <Spin spinning={loadingHistory}>
                        {observationHistory.length === 0 ? (
                          <Text type="secondary">Original reported ingest. No modifications logged.</Text>
                        ) : (
                          <Timeline
                            mode="left"
                            items={observationHistory.map((h: any, idx: number) => ({
                              key: h.id || idx,
                              children: (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong style={{ color: '#4f46e5' }}>{h.fieldName}</Text>
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                      {new Date(h.changedAt).toLocaleString()}
                                    </Text>
                                  </div>
                                  <div>
                                    <Text delete type="secondary" style={{ marginRight: 8 }}>
                                      {h.oldValue !== null && h.oldValue !== '' ? String(h.oldValue) : '(empty)'}
                                    </Text>
                                    <Text>&rarr;</Text>
                                    <Text strong style={{ marginLeft: 8, color: '#16a34a' }}>
                                      {h.newValue !== null && h.newValue !== '' ? String(h.newValue) : '(empty)'}
                                    </Text>
                                  </div>
                                  {h.reason && (
                                    <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: 2 }}>
                                      Reason: {h.reason}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '11px', color: '#888' }}>
                                    Changed by: {h.changedBy || 'System'}
                                  </div>
                                </div>
                              ),
                            }))}
                          />
                        )}
                      </Spin>
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

