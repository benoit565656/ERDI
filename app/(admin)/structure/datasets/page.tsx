'use client';

import React, { useState } from 'react';
import { Button, Form, Input, Card, Space, message, Tag, Select, Tabs, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined, PartitionOutlined, AlignLeftOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const datasetSchema = z.object({
  code: z.string().min(1, 'Dataset code is required.'),
  name: z.string().min(1, 'Dataset name is required.'),
  description: z.string().optional().nullable(),
  divisionCode: z.string().min(1, 'Division code is required.'),
  agencyCode: z.string().min(1, 'Agency code is required.'),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
  defaultFrequency: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
});

type DatasetFormValues = z.infer<typeof datasetSchema>;

export default function DatasetsPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Datasets
  const { data: datasets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['datasetsList'],
    queryFn: async () => {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets');
      return res.json();
    },
  });

  // Fetch Agencies for selector options
  const { data: agencies = [] } = useQuery<any[]>({
    queryKey: ['agenciesSelect'],
    queryFn: async () => {
      const res = await fetch('/api/agencies');
      if (!res.ok) throw new Error('Failed to fetch agencies');
      return res.json();
    },
  });

  const agencyOptions = agencies.map(a => ({ label: `[${a.code}] ${a.name}`, value: a.code }));

  // Save Mutator
  const saveMutation = useMutation({
    mutationFn: async (values: DatasetFormValues) => {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save dataset');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Dataset saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['datasetsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving dataset.');
    },
  });

  const handleCreate = () => {
    setEditingRecord(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord({
      code: record.code,
      name: record.name,
      description: record.description || '',
      divisionCode: record.divisionCode,
      agencyCode: record.agencyCode,
      status: record.status || 'ACTIVE',
      defaultFrequency: record.defaultFrequency || [],
      sortOrder: record.sortOrder ?? 0,
    });
    setDrawerVisible(true);
  };

  const columns = [
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
      title: 'Agency',
      dataIndex: ['agency', 'name'],
      key: 'agency',
      render: (_: any, record: any) => record.agency?.code || 'ERDI',
    },
    {
      title: 'Division',
      dataIndex: 'divisionCode',
      key: 'divisionCode',
    },
    {
      title: 'Freqs',
      dataIndex: 'defaultFrequency',
      key: 'defaultFrequency',
      render: (freqs: string[]) => (freqs && freqs.length > 0) ? freqs.join(', ') : '-',
    },
    {
      title: 'Sort Order',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      sorter: (a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0),
    },
    {
      title: 'Dataflows',
      dataIndex: '_count',
      key: 'dataflowsCount',
      render: (count: any) => <Tag color="blue">{count?.dataflows || 0} categories</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'ACTIVE') color = 'green';
        if (status === 'DRAFT') color = 'gold';
        if (status === 'ARCHIVED') color = 'gray';
        return <Tag color={color}>{status || 'ACTIVE'}</Tag>;
      },
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
        title="Datasets Manager"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Dataset
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={datasets}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search datasets..."
          onRefresh={refetch}
        />
      </Card>

      {/* Dataset edit drawer */}
      <FormDrawer
        title={editingRecord ? `Edit Dataset: ${editingRecord.code}` : 'Create Dataset'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={datasetSchema}
        defaultValues={editingRecord || {
          code: '',
          name: '',
          description: '',
          divisionCode: 'ERDI',
          agencyCode: 'ERDI',
          status: 'ACTIVE',
          defaultFrequency: [],
          sortOrder: 0,
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        width={600}
      >
        {(form) => {
          const generalForm = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="Dataset Code"
                required
                help={form.formState.errors.code?.message as React.ReactNode}
                validateStatus={form.formState.errors.code ? 'error' : ''}
              >
                <Controller
                  name="code"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      disabled={!!editingRecord}
                      placeholder="e.g. KIDB"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Dataset Name"
                required
                help={form.formState.errors.name?.message as React.ReactNode}
                validateStatus={form.formState.errors.name ? 'error' : ''}
              >
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g. Key Indicators Database"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Agency"
                required
                validateStatus={form.formState.errors.agencyCode ? 'error' : ''}
              >
                <Controller
                  name="agencyCode"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      placeholder="Select reporting agency"
                      options={agencyOptions}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Division Code"
                required
                help={form.formState.errors.divisionCode?.message as React.ReactNode}
                validateStatus={form.formState.errors.divisionCode ? 'error' : ''}
              >
                <Controller
                  name="divisionCode"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g. ERDI"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Default Frequencies">
                <Controller
                  name="defaultFrequency"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      mode="tags"
                      style={{ width: '100%' }}
                      placeholder="e.g. A, Q, M"
                      options={[
                        { label: 'A - Annual', value: 'A' },
                        { label: 'Q - Quarterly', value: 'Q' },
                        { label: 'M - Monthly', value: 'M' },
                      ]}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Sort Order">
                <Controller
                  name="sortOrder"
                  control={form.control}
                  render={({ field }) => (
                    <InputNumber
                      {...field}
                      style={{ width: '100%' }}
                      min={0}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Lifecycle Status" required>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={[
                        { label: 'ACTIVE', value: 'ACTIVE' },
                        { label: 'DRAFT', value: 'DRAFT' },
                        { label: 'ARCHIVED', value: 'ARCHIVED' },
                      ]}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Description">
                <Controller
                  name="description"
                  control={form.control}
                  render={({ field: { value, ...fieldWithoutValue } }) => (
                    <Input.TextArea
                      {...fieldWithoutValue}
                      value={value || ''}
                      rows={4}
                      placeholder="Enter dataset details..."
                    />
                  )}
                />
              </Form.Item>
            </Space>
          );

          if (!editingRecord) {
            return generalForm;
          }

          // Return Tabs in Edit mode
          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <InfoCircleOutlined /> General Info
                    </span>
                  ),
                  children: generalForm,
                },
                {
                  key: 'dimensions',
                  label: (
                    <span>
                      <PartitionOutlined /> Dimensions
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                      <p>Dimensions configured under DSD:</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li><strong>FREQ:</strong> Frequency dimension (code list: CL_FREQ)</li>
                        <li><strong>INDICATOR:</strong> Indicator dimension (code list: CL_KIDB_INDICATORS)</li>
                        <li><strong>ECONOMY_CODE:</strong> Economy dimension (code list: CL_ECONOMY_CODES)</li>
                        <li><strong>TIME_PERIOD:</strong> Time dimension</li>
                      </ul>
                    </Card>
                  ),
                },
                {
                  key: 'attributes',
                  label: (
                    <span>
                      <AlignLeftOutlined /> Attributes
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                      <p>Attributes configured under DSD:</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li><strong>UNIT:</strong> Unit of measure</li>
                        <li><strong>UNIT_MULT:</strong> Multiplier scale</li>
                        <li><strong>DECIMALS:</strong> Decimals display</li>
                        <li><strong>OBS_STATUS:</strong> Status flags</li>
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
