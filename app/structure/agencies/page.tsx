'use client';

import React, { useState } from 'react';
import { Button, Form, Input, Card, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const agencySchema = z.object({
  code: z.string().min(1, 'Agency code is required.').max(10, 'Code must be 10 characters or less.'),
  name: z.string().min(1, 'Agency name is required.'),
  description: z.string().optional(),
});

type AgencyFormValues = z.infer<typeof agencySchema>;

export default function AgenciesPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingAgency, setEditingAgency] = useState<AgencyFormValues | null>(null);

  // Fetch Agencies
  const { data: agencies = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['agenciesList'],
    queryFn: async () => {
      const res = await fetch('/api/agencies');
      if (!res.ok) throw new Error('Failed to fetch agencies');
      return res.json();
    },
  });

  // Mutator for creating/updating
  const mutation = useMutation({
    mutationFn: async (values: AgencyFormValues) => {
      const res = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save agency');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Agency saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['agenciesList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving agency.');
    },
  });

  const handleCreate = () => {
    setEditingAgency(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingAgency({
      code: record.code,
      name: record.name,
      description: record.description || '',
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
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
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
        title="Agencies Registry"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Agency
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={agencies}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search agencies..."
          onRefresh={refetch}
        />
      </Card>

      {/* Slide Edit Drawer */}
      <FormDrawer
        title={editingAgency ? 'Edit Agency' : 'Create Agency'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={agencySchema}
        defaultValues={editingAgency || { code: '', name: '', description: '' }}
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
        }}
      >
        {(form) => (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Agency Code"
              required
              help={form.formState.errors.code?.message}
              validateStatus={form.formState.errors.code ? 'error' : ''}
            >
              <Input
                {...form.register('code')}
                disabled={!!editingAgency} // Disable editing code since it is primary key
                placeholder="e.g. ERDI, WB, IMF"
              />
            </Form.Item>

            <Form.Item
              label="Agency Name"
              required
              help={form.formState.errors.name?.message}
              validateStatus={form.formState.errors.name ? 'error' : ''}
            >
              <Input {...form.register('name')} placeholder="e.g. World Bank Group" />
            </Form.Item>

            <Form.Item label="Description">
              <Input.TextArea
                rows={4}
                value={form.watch('description')}
                onChange={(e) => form.setValue('description', e.target.value)}
                placeholder="Enter description of agency scope..."
              />
            </Form.Item>
          </Space>
        )}
      </FormDrawer>
    </div>
  );
}
