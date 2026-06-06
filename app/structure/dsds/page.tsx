'use client';

import React, { useState } from 'react';
import { Card, Button, Form, Input, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import { z } from 'zod';

const { Title, Paragraph } = Typography;

const dsdSchema = z.object({
  code: z.string().min(1, 'Code is required.').max(50),
  agency: z.string().min(1, 'Agency is required.'),
  version: z.string().min(1, 'Version is required.').default('1.0'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
});

type DsdFormValues = z.infer<typeof dsdSchema>;

export default function DsdsPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Fetch DSDs
  const { data: dsds = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['dsdsList'],
    queryFn: () => fetch('/api/dsds').then((res) => res.json()),
  });

  const mutation = useMutation({
    mutationFn: async (values: DsdFormValues) => {
      const res = await fetch('/api/dsds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save DSD');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Data Structure Definition created.');
      queryClient.invalidateQueries({ queryKey: ['dsdsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving DSD.');
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
      render: (v: string) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: 'Components Count',
      dataIndex: 'components',
      key: 'components',
      render: (components: any[]) => components?.length || 0,
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
        <Title level={3}>Data Structure Definitions (DSD)</Title>
        <Paragraph style={{ color: '#666' }}>
          Define the dimensions, attributes, and measures that make up the structure of observation datasets.
        </Paragraph>
      </div>

      <Card
        title={
          <span>
            <ApartmentOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            DSD Registry
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
            Create DSD
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={dsds}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search DSDs..."
          onRefresh={refetch}
        />
      </Card>

      <FormDrawer
        title="Create DSD"
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={dsdSchema}
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
              label="DSD Code"
              required
              help={form.formState.errors.code?.message}
              validateStatus={form.formState.errors.code ? 'error' : ''}
            >
              <Input {...form.register('code')} placeholder="e.g. DSD_KIDB" />
            </Form.Item>

            <Form.Item
              label="DSD Name"
              required
              help={form.formState.errors.name?.message}
              validateStatus={form.formState.errors.name ? 'error' : ''}
            >
              <Input {...form.register('name')} placeholder="e.g. KIDB Data Structure Definition" />
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
                placeholder="Describe DSD dimensions..."
              />
            </Form.Item>
          </Space>
        )}
      </FormDrawer>
    </div>
  );
}
