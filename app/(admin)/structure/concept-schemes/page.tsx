'use client';

import React, { useState } from 'react';
import { Card, Button, Form, Input, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, BookOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import { z } from 'zod';

const { Title, Paragraph } = Typography;

const schemeSchema = z.object({
  code: z.string().min(1, 'Code is required.').max(50),
  agency: z.string().min(1, 'Agency is required.'),
  version: z.string().min(1, 'Version is required.').default('1.0'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
});

type SchemeFormValues = z.infer<typeof schemeSchema>;

export default function ConceptSchemesPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch Schemes
  const { data: schemes = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['schemesList'],
    queryFn: () => fetch('/api/concept-schemes').then((res) => res.json()),
  });

  const mutation = useMutation({
    mutationFn: async (values: SchemeFormValues) => {
      const res = await fetch('/api/concept-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save concept scheme');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Concept Scheme successfully created.');
      queryClient.invalidateQueries({ queryKey: ['schemesList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving scheme.');
    },
  });

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
      dataIndex: 'agency',
      key: 'agency',
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (v: string) => <Tag color="purple">v{v}</Tag>,
    },
    {
      title: 'Concepts defined',
      dataIndex: 'concepts',
      key: 'concepts',
      render: (concepts: any[]) => concepts?.length || 0,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Concept Schemes Registry</Title>
        <Paragraph style={{ color: '#666' }}>
          Define the dictionary definitions for dimensions, attributes, and indicators to maintain system-wide semantic metadata.
        </Paragraph>
      </div>

      <Card
        title={
          <span>
            <BookOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            Concept Schemes
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
            Create Concept Scheme
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={schemes}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search schemes..."
          onRefresh={refetch}
        />
      </Card>

      <FormDrawer
        title="Create Concept Scheme"
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={schemeSchema}
        defaultValues={{
          code: '',
          agency: 'ERDI',
          version: '1.0',
          name: '',
          description: '',
        }}
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
        }}
      >
        {(form) => (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Form.Item
              label="Concept Scheme Code"
              required
              help={form.formState.errors.code?.message}
              validateStatus={form.formState.errors.code ? 'error' : ''}
            >
              <Input {...form.register('code')} placeholder="e.g. CS_COMMON" />
            </Form.Item>

            <Form.Item
              label="Scheme Name"
              required
              help={form.formState.errors.name?.message}
              validateStatus={form.formState.errors.name ? 'error' : ''}
            >
              <Input {...form.register('name')} placeholder="e.g. Common Metadata Concept Scheme" />
            </Form.Item>

            <Form.Item
              label="Agency"
              required
              help={form.formState.errors.agency?.message}
              validateStatus={form.formState.errors.agency ? 'error' : ''}
            >
              <Input {...form.register('agency')} placeholder="e.g. ERDI" />
            </Form.Item>

            <Form.Item
              label="Version"
              required
              help={form.formState.errors.version?.message}
              validateStatus={form.formState.errors.version ? 'error' : ''}
            >
              <Input {...form.register('version')} placeholder="e.g. 1.0" />
            </Form.Item>

            <Form.Item label="Description">
              <Input.TextArea
                rows={4}
                value={form.watch('description') || ''}
                onChange={(e) => form.setValue('description', e.target.value)}
                placeholder="Describe concept classifications..."
              />
            </Form.Item>
          </Space>
        )}
      </FormDrawer>
    </div>
  );
}
