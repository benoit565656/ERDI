'use client';

import React, { useState } from 'react';
import { Button, Form, Input, Card, Space, Select, Tabs, Switch, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined, PartitionOutlined, AlignLeftOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const datasetSchema = z.object({
  code: z.string().min(1, 'Dataset code is required.'),
  name: z.string().min(1, 'Dataset name is required.'),
  description: z.string().optional(),
  divisionCode: z.string().min(1, 'Division code is required.'),
  agencyCode: z.string().min(1, 'Agency code is required.'),
  isActive: z.boolean().default(true),
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
    setEditingRecord(record);
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
      title: 'Dataflows',
      dataIndex: '_count',
      key: 'dataflowsCount',
      render: (count: any) => <Tag color="blue">{count?.dataflows || 0} categories</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
      ),
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
        defaultValues={editingRecord ? {
          code: editingRecord.code,
          name: editingRecord.name,
          description: editingRecord.description || '',
          divisionCode: editingRecord.divisionCode,
          agencyCode: editingRecord.agencyCode,
          isActive: editingRecord.isActive,
        } : {
          code: '',
          name: '',
          description: '',
          divisionCode: 'ERDI',
          agencyCode: 'ERDI',
          isActive: true,
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
                <Input
                  {...form.register('code')}
                  disabled={!!editingRecord}
                  placeholder="e.g. KIDB"
                />
              </Form.Item>

              <Form.Item
                label="Dataset Name"
                required
                help={form.formState.errors.name?.message as React.ReactNode}
                validateStatus={form.formState.errors.name ? 'error' : ''}
              >
                <Input {...form.register('name')} placeholder="e.g. Key Indicators Database" />
              </Form.Item>

              <Form.Item
                label="Agency"
                required
                validateStatus={form.formState.errors.agencyCode ? 'error' : ''}
              >
                <Select
                  placeholder="Select reporting agency"
                  options={agencyOptions}
                  value={form.watch('agencyCode')}
                  onChange={(val) => form.setValue('agencyCode', val)}
                />
              </Form.Item>

              <Form.Item
                label="Division Code"
                required
                help={form.formState.errors.divisionCode?.message as React.ReactNode}
                validateStatus={form.formState.errors.divisionCode ? 'error' : ''}
              >
                <Input {...form.register('divisionCode')} placeholder="e.g. ERDI" />
              </Form.Item>

              <Form.Item label="Description">
                <Input.TextArea
                  rows={4}
                  value={form.watch('description')}
                  onChange={(e) => form.setValue('description', e.target.value)}
                  placeholder="Enter dataset details..."
                />
              </Form.Item>

              <Form.Item label="Active Status">
                <Switch
                  checked={form.watch('isActive')}
                  onChange={(checked) => form.setValue('isActive', checked)}
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
                    <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #f0f0f0' }}>
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
                    <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #f0f0f0' }}>
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
