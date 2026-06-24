'use client';

import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, Switch, Space, Table, Tag, Typography, Row, Col, InputNumber, Alert, Divider, message } from 'antd';
import { PlusOutlined, EditOutlined, ExperimentOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import { z } from 'zod';

const { Title, Paragraph, Text } = Typography;

// Zod Validation Schema
const ruleItemSchema = z.object({
  economyCode: z.string().nullable().optional(),
  sourceUnitCode: z.string().nullable().optional(),
  sourceMultiplierCode: z.string().nullable().optional(),
  targetUnitCode: z.string().nullable().optional(),
  targetMultiplierCode: z.string().nullable().optional(),
});

const harmonizationRuleSchema = z.object({
  id: z.string().optional(),
  ruleName: z.string().min(1, 'Rule name is required.'),
  datasetCode: z.string().min(1, 'Dataset is required.'),
  dataflowCode: z.string().nullable().optional(),
  indicatorCode: z.string().min(1, 'Indicator is required.'),
  conversionMethod: z.enum(['MULTIPLIER_ONLY', 'CURRENCY_CONVERSION', 'WARNING_ONLY', 'NONE']),
  exchangeRateSource: z.string().nullable().optional(),
  targetUnitCode: z.string().nullable().optional(),
  targetMultiplierCode: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  ruleItems: z.array(ruleItemSchema).default([]),
});

type RuleFormValues = z.infer<typeof harmonizationRuleSchema>;

export default function HarmonizationPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleFormValues | null>(null);

  // States for Live Simulator
  const [simValue, setSimValue] = useState<number>(1000);
  const [simSourceMult, setSimSourceMult] = useState<string>('3'); // Thousands (10^3)
  const [simTargetMult, setSimTargetMult] = useState<string>('6'); // Millions (10^6)

  // Fetch Options
  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ['optionsDatasets'],
    queryFn: () => fetch('/api/available-options?type=datasets').then((res) => res.json()),
  });

  const { data: economies = [] } = useQuery<any[]>({
    queryKey: ['optionsEconomies'],
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

  // Watch selected dataset in form to load indicators cascadingly
  const [formDataset, setFormDataset] = useState<string>('');
  const { data: indicators = [] } = useQuery<any[]>({
    queryKey: ['optionsIndicators', formDataset],
    queryFn: () => {
      if (!formDataset) return [];
      return fetch(`/api/available-options?type=indicators&datasetCode=${formDataset}`).then((res) => res.json());
    },
    enabled: !!formDataset,
  });

  // Fetch Harmonization Rules
  const { data: rules = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['harmonizationRules'],
    queryFn: async () => {
      const res = await fetch('/api/harmonization');
      if (!res.ok) throw new Error('Failed to fetch rules');
      return res.json();
    },
  });

  // Mutator for CRUD
  const mutation = useMutation({
    mutationFn: async (values: RuleFormValues) => {
      const res = await fetch('/api/harmonization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save rule');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Harmonization rule saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['harmonizationRules'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving rule.');
    },
  });

  const handleCreate = () => {
    setFormDataset('');
    setEditingRule(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setFormDataset(record.datasetCode);
    setEditingRule({
      id: record.id,
      ruleName: record.ruleName,
      datasetCode: record.datasetCode,
      dataflowCode: record.dataflowCode,
      indicatorCode: record.indicatorCode,
      conversionMethod: record.conversionMethod,
      exchangeRateSource: record.exchangeRateSource,
      targetUnitCode: record.targetUnitCode,
      targetMultiplierCode: record.targetMultiplierCode,
      isActive: record.isActive,
      ruleItems: record.ruleItems.map((item: any) => ({
        economyCode: item.economyCode,
        sourceUnitCode: item.sourceUnitCode,
        sourceMultiplierCode: item.sourceMultiplierCode,
        targetUnitCode: item.targetUnitCode,
        targetMultiplierCode: item.targetMultiplierCode,
      })),
    });
    setDrawerVisible(true);
  };

  // Run conversion simulation math
  const getMultiplierFactor = (code: string) => {
    if (code === '0' || !code) return 1;
    if (code === '3') return 1000;
    if (code === '6') return 1000000;
    if (code === '-3') return 0.001;
    // Fallback logic
    return 1;
  };

  const simulatedResult = React.useMemo(() => {
    const srcFactor = getMultiplierFactor(simSourceMult);
    const trgFactor = getMultiplierFactor(simTargetMult);
    const baseVal = simValue * srcFactor;
    return baseVal / trgFactor;
  }, [simValue, simSourceMult, simTargetMult]);

  const columns = [
    {
      title: 'Rule Name',
      dataIndex: 'ruleName',
      key: 'ruleName',
      sorter: (a: any, b: any) => a.ruleName.localeCompare(b.ruleName),
    },
    {
      title: 'Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
      sorter: (a: any, b: any) => a.datasetCode.localeCompare(b.datasetCode),
    },
    {
      title: 'Indicator',
      dataIndex: 'indicatorCode',
      key: 'indicatorCode',
      render: (code: string, record: any) => `[${code}] ${record.indicator?.name || ''}`,
    },
    {
      title: 'Method',
      dataIndex: 'conversionMethod',
      key: 'conversionMethod',
      render: (method: string) => {
        const colors: Record<string, string> = {
          MULTIPLIER_ONLY: 'blue',
          CURRENCY_CONVERSION: 'purple',
          WARNING_ONLY: 'orange',
          NONE: 'default',
        };
        return <Tag color={colors[method] || 'default'}>{method}</Tag>;
      },
    },
    {
      title: 'Target Unit',
      dataIndex: 'targetUnitCode',
      key: 'targetUnitCode',
      render: (code: string, record: any) => code ? `[${code}] ${record.targetUnit?.name || ''}` : '-',
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ),
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
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '0px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Harmonization Engine</Title>
        <Paragraph style={{ color: '#666' }}>
          Define automated math rules to normalize units, multipliers, and currencies for observations across datasets.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left: Rules List */}
        <Col xs={24} lg={16}>
          <Card
            title="Harmonization Rules Registry"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Create Rule
              </Button>
            }
            style={{ borderRadius: 8 }}
          >
            <DataTable
              columns={columns}
              dataSource={rules}
              loading={isLoading}
              rowKey="id"
              searchPlaceholder="Search rules..."
              onRefresh={refetch}
            />
          </Card>
        </Col>

        {/* Right: Live Simulator */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <ExperimentOutlined style={{ color: '#6366f1', marginRight: 8 }} />
                Conversion Simulator
              </span>
            }
            style={{ borderRadius: 8 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text type="secondary">Source Value</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  value={simValue}
                  onChange={(val) => setSimValue(val || 0)}
                  placeholder="Enter value"
                />
              </div>

              <div>
                <Text type="secondary">Source Multiplier</Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  value={simSourceMult}
                  onChange={setSimSourceMult}
                >
                  <Select.Option value="0">Units (1)</Select.Option>
                  <Select.Option value="3">Thousands (1,000)</Select.Option>
                  <Select.Option value="6">Millions (1,000,000)</Select.Option>
                  <Select.Option value="-3">Thousands-th (0.001)</Select.Option>
                </Select>
              </div>

              <div>
                <Text type="secondary">Target Multiplier</Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  value={simTargetMult}
                  onChange={setSimTargetMult}
                >
                  <Select.Option value="0">Units (1)</Select.Option>
                  <Select.Option value="3">Thousands (1,000)</Select.Option>
                  <Select.Option value="6">Millions (1,000,000)</Select.Option>
                  <Select.Option value="-3">Thousands-th (0.001)</Select.Option>
                </Select>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Alert
                message="Simulated Conversion Output"
                description={
                  <div style={{ marginTop: 8 }}>
                    <Title level={4} style={{ margin: 0, color: '#6366f1' }}>
                      {simulatedResult.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </Title>
                    <Text type="secondary" style={{ marginTop: 4, display: 'block', fontSize: 12 }}>
                      Formula: (Value * Source Factor) / Target Factor
                    </Text>
                  </div>
                }
                type="info"
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Drawer Editor */}
      <FormDrawer
        title={editingRule ? 'Edit Harmonization Rule' : 'Create Harmonization Rule'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={harmonizationRuleSchema}
        defaultValues={
          editingRule || {
            ruleName: '',
            datasetCode: '',
            dataflowCode: null,
            indicatorCode: '',
            conversionMethod: 'MULTIPLIER_ONLY' as const,
            exchangeRateSource: null,
            targetUnitCode: null,
            targetMultiplierCode: null,
            isActive: true,
            ruleItems: [],
          }
        }
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
        }}
      >
        {(form) => {
          // Listen to dataset change to trigger cascading dropdown
          const selectedDs = form.watch('datasetCode');
          if (selectedDs !== formDataset) {
            setFormDataset(selectedDs || '');
          }

          const currentItems = form.watch('ruleItems') || [];

          return (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="Rule Name"
                required
                help={form.formState.errors.ruleName?.message}
                validateStatus={form.formState.errors.ruleName ? 'error' : ''}
              >
                <Input
                  value={form.watch('ruleName') || ''}
                  onChange={(e) => form.setValue('ruleName', e.target.value)}
                  placeholder="e.g. GDP Millions conversion"
                />
              </Form.Item>

              <Form.Item
                label="Dataset"
                required
                help={form.formState.errors.datasetCode?.message}
                validateStatus={form.formState.errors.datasetCode ? 'error' : ''}
              >
                <Select
                  value={form.watch('datasetCode')}
                  onChange={(val) => {
                    form.setValue('datasetCode', val);
                    form.setValue('indicatorCode', ''); // reset indicator
                    setFormDataset(val);
                  }}
                  placeholder="Select Dataset"
                >
                  {datasets.map((d: any) => (
                    <Select.Option key={d.value} value={d.value}>
                      {d.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Indicator"
                required
                help={form.formState.errors.indicatorCode?.message}
                validateStatus={form.formState.errors.indicatorCode ? 'error' : ''}
              >
                <Select
                  value={form.watch('indicatorCode')}
                  onChange={(val) => form.setValue('indicatorCode', val)}
                  placeholder="Select Indicator (Select dataset first)"
                  disabled={!formDataset}
                >
                  {indicators.map((i: any) => (
                    <Select.Option key={i.value} value={i.value}>
                      {i.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Conversion Method" required>
                <Select
                  value={form.watch('conversionMethod')}
                  onChange={(val) => form.setValue('conversionMethod', val)}
                >
                  <Select.Option value="MULTIPLIER_ONLY">Multiplier Only (e.g. Thousands to Millions)</Select.Option>
                  <Select.Option value="CURRENCY_CONVERSION">Full Currency Exchange Rate Conversion</Select.Option>
                  <Select.Option value="WARNING_ONLY">Validate Units / Warning Only</Select.Option>
                  <Select.Option value="NONE">No Conversion</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="Exchange Rate Source">
                <Input
                  value={form.watch('exchangeRateSource') || ''}
                  onChange={(e) => form.setValue('exchangeRateSource', e.target.value || null)}
                  placeholder="e.g. ADB Treasury, IMF IFS (Optional)"
                />
              </Form.Item>

              <Form.Item label="Target Common Unit">
                <Select
                  value={form.watch('targetUnitCode') || undefined}
                  onChange={(val) => form.setValue('targetUnitCode', val || null)}
                  placeholder="e.g. USD, Local Currency"
                  allowClear
                >
                  {units.map((u: any) => (
                    <Select.Option key={u.value} value={u.value}>
                      {u.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Target Multiplier">
                <Select
                  value={form.watch('targetMultiplierCode') || undefined}
                  onChange={(val) => form.setValue('targetMultiplierCode', val || null)}
                  placeholder="Select target scaling factor"
                  allowClear
                >
                  {multipliers.map((m: any) => (
                    <Select.Option key={m.value} value={m.value}>
                      {m.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Rule Is Active" valuePropName="checked">
                <Switch
                  checked={form.watch('isActive')}
                  onChange={(checked) => form.setValue('isActive', checked)}
                />
              </Form.Item>

              <Divider>Specific Economy Exceptions</Divider>
              <Paragraph style={{ fontSize: 12, color: '#777' }}>
                Add overrides for specific economies that require distinct source/target unit maps.
              </Paragraph>

              {currentItems.map((item: any, idx: number) => (
                <Card
                  key={idx}
                  size="small"
                  style={{ marginBottom: 12, background: '#fafafa' }}
                  extra={
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => {
                        const items = [...currentItems];
                        items.splice(idx, 1);
                        form.setValue('ruleItems', items);
                      }}
                    >
                      Remove
                    </Button>
                  }
                  title={`Exception #${idx + 1}`}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <Form.Item label="Target Economy" style={{ marginBottom: 8 }}>
                      <Select
                        value={item.economyCode || undefined}
                        onChange={(val) => {
                          const items = [...currentItems];
                          items[idx].economyCode = val || null;
                          form.setValue('ruleItems', items);
                        }}
                        placeholder="Select Economy"
                        allowClear
                      >
                        {economies.map((e: any) => (
                          <Select.Option key={e.value} value={e.value}>
                            {e.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item label="Source Unit" style={{ marginBottom: 8 }}>
                          <Select
                            value={item.sourceUnitCode || undefined}
                            onChange={(val) => {
                              const items = [...currentItems];
                              items[idx].sourceUnitCode = val || null;
                              form.setValue('ruleItems', items);
                            }}
                            placeholder="Unit"
                            allowClear
                          >
                            {units.map((u: any) => (
                              <Select.Option key={u.value} value={u.value}>
                                {u.label}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Source Mult" style={{ marginBottom: 8 }}>
                          <Select
                            value={item.sourceMultiplierCode || undefined}
                            onChange={(val) => {
                              const items = [...currentItems];
                              items[idx].sourceMultiplierCode = val || null;
                              form.setValue('ruleItems', items);
                            }}
                            placeholder="Mult"
                            allowClear
                          >
                            {multipliers.map((m: any) => (
                              <Select.Option key={m.value} value={m.value}>
                                {m.label}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                  </Space>
                </Card>
              ))}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => {
                  form.setValue('ruleItems', [
                    ...currentItems,
                    {
                      economyCode: null,
                      sourceUnitCode: null,
                      sourceMultiplierCode: null,
                      targetUnitCode: null,
                      targetMultiplierCode: null,
                    },
                  ]);
                }}
              >
                Add Exception Item
              </Button>
            </Space>
          );
        }}
      </FormDrawer>
    </div>
  );
}
