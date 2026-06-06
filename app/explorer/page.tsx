'use client';

import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, Switch, Space, Tag, Typography, Row, Col, Divider, message } from 'antd';
import { PlusOutlined, EditOutlined, LayoutOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import { z } from 'zod';

const { Title, Paragraph } = Typography;

// Zod Validation Schema
const pageConfigSchema = z.object({
  id: z.string().optional(),
  pageType: z.enum(['INDICATOR', 'ECONOMY', 'DATAFLOW']),
  slug: z.string().min(1, 'Slug is required.').regex(/^[a-z0-9-_]+$/, 'Slug must be alphanumeric, dash or underscore only.'),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().nullable().optional(),
  datasetCode: z.string().min(1, 'Dataset code is required.'),
  defaultView: z.string().nullable().optional(),
  useHarmonizedValues: z.boolean().default(false),
  targetUnitCode: z.string().nullable().optional(),
  targetMultiplierCode: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
  dataflows: z.array(z.string()).default([]),
  indicators: z.array(z.string()).default([]),
  economies: z.array(z.string()).default([]),
  visualizations: z.array(z.object({
    visualizationType: z.enum(['TABLE', 'LINE_CHART', 'BAR_CHART', 'MAP']),
    title: z.string().optional(),
    configJson: z.any().optional(),
    isActive: z.boolean().default(true),
  })).default([]),
});

type PageConfigValues = z.infer<typeof pageConfigSchema>;

export default function ExplorerPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PageConfigValues | null>(null);

  // Fetch Options
  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ['optionsDatasets'],
    queryFn: () => fetch('/api/available-options?type=datasets').then((res) => res.json()),
  });

  const { data: allDataflows = [] } = useQuery<any[]>({
    queryKey: ['optionsAllDataflows'],
    queryFn: () => fetch('/api/available-options?type=dataflows').then((res) => res.json()),
  });

  const { data: allIndicators = [] } = useQuery<any[]>({
    queryKey: ['optionsAllIndicators'],
    queryFn: () => fetch('/api/available-options?type=indicators').then((res) => res.json()),
  });

  const { data: allEconomies = [] } = useQuery<any[]>({
    queryKey: ['optionsAllEconomies'],
    queryFn: () => fetch('/api/available-options?type=economies').then((res) => res.json()),
  });

  const { data: units = [] } = useQuery<any[]>({
    queryKey: ['optionsUnits'],
    queryFn: () => fetch('/api/available-options?type=units').then((res) => res.json()),
  });

  const { data: multipliers = [] } = useQuery<any[]>({
    queryKey: ['optionsMultipliers'],
    queryFn: () => fetch('/api/available-options?type=multipliers').then((res) => res.json()),
  });

  // Fetch Page Configurations
  const { data: configs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['pageConfigs'],
    queryFn: async () => {
      const res = await fetch('/api/explorer');
      if (!res.ok) throw new Error('Failed to fetch page configurations');
      return res.json();
    },
  });

  // Mutator for CRUD
  const mutation = useMutation({
    mutationFn: async (values: PageConfigValues) => {
      const res = await fetch('/api/explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save page configuration');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Page layout configuration saved.');
      queryClient.invalidateQueries({ queryKey: ['pageConfigs'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving page layout.');
    },
  });

  const handleCreate = () => {
    setEditingConfig(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingConfig({
      id: record.id,
      pageType: record.pageType,
      slug: record.slug,
      title: record.title,
      description: record.description || '',
      datasetCode: record.datasetCode,
      defaultView: record.defaultView || 'TABLE',
      useHarmonizedValues: record.useHarmonizedValues,
      targetUnitCode: record.targetUnitCode,
      targetMultiplierCode: record.targetMultiplierCode,
      isPublished: record.isPublished,
      dataflows: record.pageConfigDataflows?.map((df: any) => df.dataflowCode) || [],
      indicators: record.pageConfigIndicators?.map((ind: any) => ind.indicatorCode) || [],
      economies: record.pageConfigEconomies?.map((ec: any) => ec.economyCode) || [],
      visualizations: record.pageConfigVisualizations?.map((vis: any) => ({
        visualizationType: vis.visualizationType,
        title: vis.title || '',
        configJson: vis.configJson || {},
        isActive: vis.isActive !== false,
      })) || [],
    });
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: any, b: any) => a.title.localeCompare(b.title),
    },
    {
      title: 'Page Type',
      dataIndex: 'pageType',
      key: 'pageType',
      render: (type: string) => <Tag color="orange">{type}</Tag>,
    },
    {
      title: 'URL Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug: string) => <code style={{ color: '#eb2f96' }}>/{slug}</code>,
    },
    {
      title: 'Associated Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
    },
    {
      title: 'Status',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (pub: boolean) => (
        <Tag color={pub ? 'green' : 'default'}>{pub ? 'PUBLISHED' : 'DRAFT'}</Tag>
      ),
    },
    {
      title: 'Last Modified',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="text"
          icon={<EditOutlined style={{ color: '#6366f1' }} />}
          onClick={() => handleEdit(record)}
        >
          Build Layout
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Page Builder (Layout Customizer)</Title>
        <Paragraph style={{ color: '#666' }}>
          Configure custom charts, tables, and visualization layouts for public indicators and economy pages.
        </Paragraph>
      </div>

      <Card
        title={
          <span>
            <LayoutOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            Active Portals & Pages Config
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Page Config
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={configs}
          loading={isLoading}
          rowKey="id"
          searchPlaceholder="Search configurations..."
          onRefresh={refetch}
        />
      </Card>

      {/* Slide Builder Drawer */}
      <FormDrawer
        title={editingConfig ? 'Edit Layout Configuration' : 'Create Layout Configuration'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={pageConfigSchema}
        defaultValues={
          editingConfig || {
            pageType: 'INDICATOR' as const,
            slug: '',
            title: '',
            description: '',
            datasetCode: '',
            defaultView: 'TABLE',
            useHarmonizedValues: false,
            targetUnitCode: null,
            targetMultiplierCode: null,
            isPublished: false,
            dataflows: [],
            indicators: [],
            economies: [],
            visualizations: [
              { visualizationType: 'TABLE' as const, title: 'Data Table Grid', isActive: true },
              { visualizationType: 'LINE_CHART' as const, title: 'Historical Trend Line Chart', isActive: true },
            ],
          }
        }
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
        }}
      >
        {(form) => {
          const currentVisuals = form.watch('visualizations') || [];

          return (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="Page Title"
                required
                help={form.formState.errors.title?.message}
                validateStatus={form.formState.errors.title ? 'error' : ''}
              >
                <Input {...form.register('title')} placeholder="e.g. GDP and National Accounts" />
              </Form.Item>

              <Form.Item
                label="Page Type"
                required
                help={form.formState.errors.pageType?.message}
                validateStatus={form.formState.errors.pageType ? 'error' : ''}
              >
                <Select
                  value={form.watch('pageType')}
                  onChange={(val) => form.setValue('pageType', val)}
                >
                  <Select.Option value="INDICATOR">Indicator Page</Select.Option>
                  <Select.Option value="ECONOMY">Economy Summary Page</Select.Option>
                  <Select.Option value="DATAFLOW">Dataflow Portal</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="URL Slug path"
                required
                help={form.formState.errors.slug?.message}
                validateStatus={form.formState.errors.slug ? 'error' : ''}
              >
                <Input {...form.register('slug')} placeholder="e.g. national-gdp-accounts" />
              </Form.Item>

              <Form.Item label="Description">
                <Input.TextArea
                  rows={3}
                  value={form.watch('description') || ''}
                  onChange={(e) => form.setValue('description', e.target.value)}
                  placeholder="Enter details about this report page..."
                />
              </Form.Item>

              <Form.Item
                label="Primary Dataset"
                required
                help={form.formState.errors.datasetCode?.message}
                validateStatus={form.formState.errors.datasetCode ? 'error' : ''}
              >
                <Select
                  value={form.watch('datasetCode')}
                  onChange={(val) => form.setValue('datasetCode', val)}
                  placeholder="Select Dataset"
                >
                  {datasets.map((d: any) => (
                    <Select.Option key={d.value} value={d.value}>
                      {d.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="Default View">
                    <Select
                      value={form.watch('defaultView') || 'TABLE'}
                      onChange={(val) => form.setValue('defaultView', val)}
                    >
                      <Select.Option value="TABLE">Table Grid</Select.Option>
                      <Select.Option value="LINE_CHART">Line Chart</Select.Option>
                      <Select.Option value="BAR_CHART">Bar Chart</Select.Option>
                      <Select.Option value="MAP">Regional Map</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Use Harmonized Value" valuePropName="checked">
                    <Switch
                      checked={form.watch('useHarmonizedValues')}
                      onChange={(checked) => form.setValue('useHarmonizedValues', checked)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Normalize Common Unit">
                <Select
                  value={form.watch('targetUnitCode') || undefined}
                  onChange={(val) => form.setValue('targetUnitCode', val || null)}
                  placeholder="Convert all data to USD / Local currency"
                  allowClear
                >
                  {units.map((u: any) => (
                    <Select.Option key={u.value} value={u.value}>
                      {u.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Normalize Multiplier">
                <Select
                  value={form.watch('targetMultiplierCode') || undefined}
                  onChange={(val) => form.setValue('targetMultiplierCode', val || null)}
                  placeholder="Select multiplier override"
                  allowClear
                >
                  {multipliers.map((m: any) => (
                    <Select.Option key={m.value} value={m.value}>
                      {m.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Page Configuration Status">
                <Space>
                  <Switch
                    checked={form.watch('isPublished')}
                    onChange={(checked) => form.setValue('isPublished', checked)}
                  />
                  <span>{form.watch('isPublished') ? 'Published (Live)' : 'Draft'}</span>
                </Space>
              </Form.Item>

              <Divider>Layout Context Filters</Divider>

              <Form.Item label="Limit to Dataflows">
                <Select
                  mode="multiple"
                  value={form.watch('dataflows')}
                  onChange={(val) => form.setValue('dataflows', val)}
                  placeholder="Select multiple dataflows"
                  allowClear
                >
                  {allDataflows.map((df: any) => (
                    <Select.Option key={df.value} value={df.value}>
                      {df.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Limit to Indicators">
                <Select
                  mode="multiple"
                  value={form.watch('indicators')}
                  onChange={(val) => form.setValue('indicators', val)}
                  placeholder="Select multiple indicators"
                  allowClear
                >
                  {allIndicators.map((i: any) => (
                    <Select.Option key={i.value} value={i.value}>
                      {i.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Limit to Economies">
                <Select
                  mode="multiple"
                  value={form.watch('economies')}
                  onChange={(val) => form.setValue('economies', val)}
                  placeholder="Select multiple economies"
                  allowClear
                >
                  {allEconomies.map((e: any) => (
                    <Select.Option key={e.value} value={e.value}>
                      {e.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider>Visualizations (Active Cards)</Divider>
              <Space direction="vertical" style={{ width: '100%' }}>
                {(['TABLE', 'LINE_CHART', 'BAR_CHART', 'MAP'] as const).map((type) => {
                  const itemIndex = currentVisuals.findIndex((v: any) => v.visualizationType === type);
                  const isChecked = itemIndex !== -1 && currentVisuals[itemIndex].isActive !== false;

                  return (
                    <Card size="small" key={type} style={{ background: '#fafafa' }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <strong>{type} Card</strong>
                        </Col>
                        <Col>
                          <Switch
                            checked={isChecked}
                            onChange={(checked) => {
                              let updated = [...currentVisuals];
                              if (checked) {
                                if (itemIndex === -1) {
                                  updated.push({ visualizationType: type as any, title: `${type} View`, isActive: true });
                                } else {
                                  updated[itemIndex].isActive = true;
                                }
                              } else {
                                if (itemIndex !== -1) {
                                  updated[itemIndex].isActive = false;
                                }
                              }
                              form.setValue('visualizations', updated as any);
                            }}
                          />
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Space>
            </Space>
          );
        }}
      </FormDrawer>
    </div>
  );
}
