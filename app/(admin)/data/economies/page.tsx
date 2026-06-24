'use client';

import React, { useState } from 'react';
import { Card, Space, Button, Form, Input, Select, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod validation schema
const economySchema = z.object({
  code: z.string().min(1, 'Economy code is required.').max(10, 'Code is too long.'),
  name: z.string().min(1, 'Economy name is required.'),
  economyType: z.enum(['COUNTRY', 'REGION', 'SUBREGION', 'GROUP']),
  iso2Code: z.string().length(2, 'ISO2 code must be exactly 2 characters.').optional().or(z.literal('')),
  iso3Code: z.string().length(3, 'ISO3 code must be exactly 3 characters.').optional().or(z.literal('')),
  currencyCode: z.string().optional().nullable(),
  parentCode: z.string().optional().nullable(),
});

type EconomyFormValues = z.infer<typeof economySchema>;

export default function EconomiesPage() {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Economies list with search
  const { data: economies = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['economiesList', searchText],
    queryFn: async () => {
      const res = await fetch(`/api/economies?search=${encodeURIComponent(searchText)}`);
      if (!res.ok) throw new Error('Failed to fetch economies');
      return res.json();
    },
  });

  // Save Mutator
  const saveMutation = useMutation({
    mutationFn: async (values: EconomyFormValues) => {
      const res = await fetch('/api/economies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save economy');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Economy saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['economiesList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving economy.');
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
      title: 'Type',
      dataIndex: 'economyType',
      key: 'economyType',
      render: (type: string) => <Tag color="orange">{type}</Tag>,
    },
    {
      title: 'ISO3',
      dataIndex: 'iso3Code',
      key: 'iso3',
      render: (code: string) => code || '-',
    },
    {
      title: 'Currency',
      dataIndex: 'currencyCode',
      key: 'currencyCode',
      render: (code: string) => code || '-',
    },
    {
      title: 'Parent',
      dataIndex: ['parent', 'name'],
      key: 'parentCode',
      render: (_: any, record: any) => record.parentCode || '-',
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

  // Options for Parent Economy selection
  const parentEconomyOptions = economies.map((e: any) => ({
    label: `[${e.code}] ${e.name}`,
    value: e.code,
  }));

  return (
    <div>
      <Card
        title="Economies Registry"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Economy
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={economies}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search economies by code or name..."
          onSearch={setSearchText}
          onRefresh={refetch}
        />
      </Card>

      {/* Economy Edit Drawer */}
      <FormDrawer
        title={editingRecord ? `Edit Economy: ${editingRecord.code}` : 'Create Economy'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={economySchema}
        defaultValues={editingRecord ? {
          code: editingRecord.code,
          name: editingRecord.name,
          economyType: editingRecord.economyType,
          iso2Code: editingRecord.iso2Code || '',
          iso3Code: editingRecord.iso3Code || '',
          currencyCode: editingRecord.currencyCode || '',
          parentCode: editingRecord.parentCode || '',
        } : {
          code: '',
          name: '',
          economyType: 'COUNTRY',
          iso2Code: '',
          iso3Code: '',
          currencyCode: 'USD',
          parentCode: '',
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
      >
        {(form) => (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Economy Code"
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
                    placeholder="e.g. PHI or REG_ASIA"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Economy Name"
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
                    placeholder="e.g. Philippines"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Economy Type" required>
              <Controller
                name="economyType"
                control={form.control}
                render={({ field }) => (
                  <Select
                    {...field}
                    placeholder="Select Type"
                    options={[
                      { label: 'COUNTRY', value: 'COUNTRY' },
                      { label: 'REGION', value: 'REGION' },
                      { label: 'SUBREGION', value: 'SUBREGION' },
                      { label: 'GROUP', value: 'GROUP' },
                    ]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="ISO2 Code"
              help={form.formState.errors.iso2Code?.message as React.ReactNode}
              validateStatus={form.formState.errors.iso2Code ? 'error' : ''}
            >
              <Controller
                name="iso2Code"
                control={form.control}
                render={({ field: { value, ...fieldWithoutValue } }) => (
                  <Input
                    {...fieldWithoutValue}
                    value={value || ''}
                    maxLength={2}
                    placeholder="e.g. PH"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="ISO3 Code"
              help={form.formState.errors.iso3Code?.message as React.ReactNode}
              validateStatus={form.formState.errors.iso3Code ? 'error' : ''}
            >
              <Controller
                name="iso3Code"
                control={form.control}
                render={({ field: { value, ...fieldWithoutValue } }) => (
                  <Input
                    {...fieldWithoutValue}
                    value={value || ''}
                    maxLength={3}
                    placeholder="e.g. PHL"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Currency Code">
              <Controller
                name="currencyCode"
                control={form.control}
                render={({ field: { value, ...fieldWithoutValue } }) => (
                  <Input
                    {...fieldWithoutValue}
                    value={value || ''}
                    placeholder="e.g. PHP"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Parent Economy (Hierarchy)">
              <Controller
                name="parentCode"
                control={form.control}
                render={({ field }) => (
                  <Select
                    {...field}
                    placeholder="Select parent region/subregion"
                    options={parentEconomyOptions}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                )}
              />
            </Form.Item>
          </Space>
        )}
      </FormDrawer>
    </div>
  );
}
