'use client';

import React, { useState } from 'react';
import { Button, Card, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PartitionOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { Form, Input } from 'antd';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const categorySetSchema = z.object({
  code: z.string().min(1, 'Category Set code is required.').max(30, 'Code must be 30 characters or less.'),
  name: z.string().min(1, 'Category Set name is required.'),
  description: z.string().optional().nullable(),
});

type CategorySetFormValues = z.infer<typeof categorySetSchema>;

export default function CategorySetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingSet, setEditingSet] = useState<CategorySetFormValues | null>(null);

  // Fetch Category Sets
  const { data: categorySets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['categorySetsList'],
    queryFn: async () => {
      const res = await fetch('/api/category-sets');
      if (!res.ok) throw new Error('Failed to fetch category sets');
      return res.json();
    },
  });

  // Save Mutator (POST)
  const saveMutation = useMutation({
    mutationFn: async (values: CategorySetFormValues) => {
      const res = await fetch('/api/category-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save category set');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Category Set saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['categorySetsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving category set.');
    },
  });

  // Delete Mutator
  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/category-sets?code=${code}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete category set');
      }
      return res.json();
    },
    onSuccess: (data) => {
      message.success(data.message || 'Category Set deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['categorySetsList'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Error deleting category set.');
    },
  });

  const handleCreate = () => {
    setEditingSet(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingSet({
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
      render: (desc: string) => desc || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<PartitionOutlined style={{ color: '#10b981' }} />}
            onClick={() => router.push(`/structure/category-builder?setCode=${record.code}`)}
          >
            Manage Hierarchy
          </Button>
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#6366f1' }} />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title={`Are you sure to delete category set ${record.code}?`}
            description="This will delete all categories and indicator mappings in this set."
            onConfirm={() => deleteMutation.mutate(record.code)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Category Sets Manager"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Category Set
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={categorySets}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search category sets..."
          onRefresh={refetch}
        />
      </Card>

      {/* Slide Edit Drawer */}
      <FormDrawer
        title={editingSet ? `Edit Category Set: ${editingSet.code}` : 'Create Category Set'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={categorySetSchema}
        defaultValues={editingSet || {
          code: '',
          name: '',
          description: '',
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        width={500}
      >
        {(form) => (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Category Set Code"
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
                    disabled={!!editingSet}
                    placeholder="e.g. MAIN_NAV"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Name"
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
                    placeholder="e.g. Main Navigation Menu"
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
                    placeholder="Provide details about how this category set is used..."
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
