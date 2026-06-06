'use client';

import React, { useState } from 'react';
import { Button, Form, Input, Card, Space, Select, Tabs, Tag, Transfer, message } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined, TableOutlined, BlockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const dataflowSchema = z.object({
  code: z.string().min(1, 'Dataflow code is required.'),
  datasetCode: z.string().min(1, 'Dataset code is required.'),
  name: z.string().min(1, 'Dataflow name is required.'),
  description: z.string().optional(),
  dataflowLevel: z.enum(['MAIN', 'SECONDARY']),
  parentCode: z.string().optional().nullable(),
  dsdCode: z.string().optional().nullable(),
  sortOrder: z.string().optional().or(z.number().optional()),
  indicators: z.array(z.string()).optional(),
});

type DataflowFormValues = z.infer<typeof dataflowSchema>;

export default function DataflowsPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Dataflows
  const { data: dataflows = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['dataflowsList'],
    queryFn: async () => {
      const res = await fetch('/api/dataflows');
      if (!res.ok) throw new Error('Failed to fetch dataflows');
      return res.json();
    },
  });

  // Fetch Dataset dropdown options
  const { data: datasetOptions = [] } = useQuery<any[]>({
    queryKey: ['availableDatasets'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets options');
      return res.json();
    },
  });

  // Fetch all Indicators for the Transfer list (pageSize=1000 to fetch all 732 shortcut codes)
  const { data: indicatorsData } = useQuery<any>({
    queryKey: ['transferIndicators'],
    queryFn: async () => {
      const res = await fetch('/api/indicators?page=1&pageSize=1000');
      if (!res.ok) throw new Error('Failed to fetch indicators');
      return res.json();
    },
  });

  const allIndicators = indicatorsData?.indicators || [];
  const transferDataSource = allIndicators.map((ind: any) => ({
    key: ind.code,
    title: `[${ind.code}] ${ind.name}`,
    description: ind.name,
  }));

  // Save Mutator
  const saveMutation = useMutation({
    mutationFn: async (values: DataflowFormValues) => {
      const res = await fetch('/api/dataflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save dataflow');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Dataflow saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['dataflowsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving dataflow.');
    },
  });

  const handleCreate = () => {
    setEditingRecord(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    // Fetch currently mapped indicators for this dataflow
    const mappedIndicators = record.dataflowIndicators || [];
    const assignedKeys = mappedIndicators.map((mi: any) => mi.indicatorCode) || [];

    setEditingRecord({
      ...record,
      indicators: assignedKeys,
    });
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
      sorter: (a: any, b: any) => a.datasetCode.localeCompare(b.datasetCode),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: (a: any, b: any) => a.code.localeCompare(b.code),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
    },
    {
      title: 'Level',
      dataIndex: 'dataflowLevel',
      key: 'dataflowLevel',
      render: (level: string) => (
        <Tag color={level === 'MAIN' ? 'purple' : 'cyan'}>{level}</Tag>
      ),
    },
    {
      title: 'Parent Dataflow',
      dataIndex: ['parent', 'name'],
      key: 'parentCode',
      render: (_: any, record: any) => record.parentCode || '-',
    },
    {
      title: 'Indicators Count',
      dataIndex: '_count',
      key: 'indicatorsCount',
      render: (count: any) => <Tag color="blue">{count?.dataflowIndicators || 0} indicators</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#6366f1' }} />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Dataflows Manager"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Dataflow
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={dataflows}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search dataflows..."
          onRefresh={refetch}
        />
      </Card>

      {/* Slide Edit Drawer */}
      <FormDrawer
        title={editingRecord ? `Edit Dataflow: ${editingRecord.code}` : 'Create Dataflow'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={dataflowSchema}
        defaultValues={editingRecord ? {
          code: editingRecord.code,
          datasetCode: editingRecord.datasetCode,
          name: editingRecord.name,
          description: editingRecord.description || '',
          dataflowLevel: editingRecord.dataflowLevel,
          parentCode: editingRecord.parentCode || '',
          dsdCode: editingRecord.dsdCode || '',
          sortOrder: editingRecord.sortOrder || 0,
          indicators: editingRecord.indicators || [],
        } : {
          code: '',
          datasetCode: 'KIDB',
          name: '',
          description: '',
          dataflowLevel: 'MAIN',
          parentCode: '',
          dsdCode: '',
          sortOrder: 0,
          indicators: [],
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        width={750}
      >
        {(form) => {
          // List of other dataflows to select as parent
          const parentOptions = dataflows
            .filter(df => df.datasetCode === form.watch('datasetCode') && df.code !== form.watch('code'))
            .map(df => ({ label: `[${df.code}] ${df.name}`, value: df.code }));

          const generalForm = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="Dataset"
                required
                validateStatus={form.formState.errors.datasetCode ? 'error' : ''}
              >
                <Select
                  placeholder="Select Dataset"
                  options={datasetOptions}
                  value={form.watch('datasetCode')}
                  onChange={(val) => form.setValue('datasetCode', val)}
                />
              </Form.Item>

              <Form.Item
                label="Dataflow Code"
                required
                help={form.formState.errors.code?.message as React.ReactNode}
                validateStatus={form.formState.errors.code ? 'error' : ''}
              >
                <Input {...form.register('code')} disabled={!!editingRecord} placeholder="e.g. ENV_LD" />
              </Form.Item>

              <Form.Item
                label="Dataflow Name"
                required
                help={form.formState.errors.name?.message as React.ReactNode}
                validateStatus={form.formState.errors.name ? 'error' : ''}
              >
                <Input {...form.register('name')} placeholder="e.g. Land and Agriculture" />
              </Form.Item>

              <Form.Item label="Dataflow Level" required>
                <Select
                  placeholder="Select Level"
                  options={[
                    { label: 'MAIN (Top-level Navigation)', value: 'MAIN' },
                    { label: 'SECONDARY (Sub-category)', value: 'SECONDARY' },
                  ]}
                  value={form.watch('dataflowLevel')}
                  onChange={(val) => form.setValue('dataflowLevel', val)}
                />
              </Form.Item>

              {form.watch('dataflowLevel') === 'SECONDARY' && (
                <Form.Item label="Parent Dataflow">
                  <Select
                    placeholder="Select parent category"
                    options={parentOptions}
                    value={form.watch('parentCode')}
                    onChange={(val) => form.setValue('parentCode', val)}
                    allowClear
                  />
                </Form.Item>
              )}

              <Form.Item label="Sort Order">
                <Input
                  type="number"
                  value={form.watch('sortOrder')}
                  onChange={(e) => form.setValue('sortOrder', e.target.value)}
                />
              </Form.Item>

              <Form.Item label="Description">
                <Input.TextArea
                  rows={3}
                  value={form.watch('description')}
                  onChange={(e) => form.setValue('description', e.target.value)}
                  placeholder="Enter details..."
                />
              </Form.Item>
            </Space>
          );

          if (!editingRecord) {
            return generalForm;
          }

          // Tabs in Edit mode
          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <InfoCircleOutlined /> General Settings
                    </span>
                  ),
                  children: generalForm,
                },
                {
                  key: 'indicators',
                  label: (
                    <span>
                      <TableOutlined /> Indicators Assignment
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ marginBottom: 16, fontSize: 13, color: '#8c8c8c' }}>
                        Assign indicators to this category. They will show up under this dataflow path in explorer views.
                      </p>
                      <Transfer
                        dataSource={transferDataSource}
                        titles={['All Indicators', 'Assigned Indicators']}
                        targetKeys={form.watch('indicators') || []}
                        onChange={(nextTargetKeys) => form.setValue('indicators', nextTargetKeys.map(k => k.toString()))}
                        render={(item) => item.title || ''}
                        listStyle={{
                          width: '45%',
                          height: 350,
                        }}
                        showSearch
                      />
                    </div>
                  ),
                },
                {
                  key: 'constraints',
                  label: (
                    <span>
                      <BlockOutlined /> DSD Constraints
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #f0f0f0', marginTop: 12 }}>
                      <p>DSD constraints block validation errors for specific dimensions under this dataflow.</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li>Dimensions constrained: <strong>ECONOMY</strong></li>
                        <li>No constraints configured. All economy codes are allowed.</li>
                      </ul>
                    </Card>
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
