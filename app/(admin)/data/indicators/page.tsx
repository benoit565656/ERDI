'use client';

import React, { useState } from 'react';
import { Card, Space, Button, Form, Input, Tabs, Tag, message } from 'antd';
import { InfoCircleOutlined, TagsOutlined, PartitionOutlined, InteractionOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Schema placeholder for Indicator edit drawer
const indicatorSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export default function IndicatorsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Indicators with pagination & search
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['indicatorsList', currentPage, pageSize, searchText],
    queryFn: async () => {
      const res = await fetch(`/api/indicators?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(searchText)}`);
      if (!res.ok) throw new Error('Failed to fetch indicators');
      return res.json();
    },
  });

  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save indicator');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Indicator saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['indicatorsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving indicator.');
    },
  });

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: true,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Mapped Dataflows',
      dataIndex: 'indicatorDataflowMapping',
      key: 'dataflows',
      render: (mappings: any[]) => {
        if (!mappings || mappings.length === 0) return <Tag>None</Tag>;
        return (
          <Space size="small" wrap>
            {mappings.map((m: any, idx: number) => (
              <Tag color="cyan" key={idx}>
                {m.mainDataflowCode}
              </Tag>
            ))}
          </Space>
        );
      },
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
          View / Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card title="Indicators Directory" style={{ borderRadius: 8 }}>
        <DataTable
          columns={columns}
          dataSource={data?.indicators || []}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search indicators by code or name..."
          onSearch={(val) => {
            setSearchText(val);
            setCurrentPage(1); // Reset page
          }}
          onRefresh={refetch}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: data?.total || 0,
            onChange: (p: number, ps: number) => {
              setCurrentPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* Drawer */}
      <FormDrawer
        title={editingRecord ? `Indicator: ${editingRecord.code}` : 'Create Indicator'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={indicatorSchema}
        defaultValues={editingRecord ? {
          code: editingRecord.code,
          name: editingRecord.name,
          description: editingRecord.description || '',
        } : {
          code: '',
          name: '',
          description: '',
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        width={650}
      >
        {(form) => {
          const generalForm = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item label="Indicator Code">
                <Controller
                  name="code"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      disabled
                      placeholder="e.g. AG_LND_AGRI_ZS"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Indicator Name" required>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g. Agricultural land (% of land area)"
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
                      placeholder="Enter details..."
                    />
                  )}
                />
              </Form.Item>
            </Space>
          );

          if (!editingRecord) return generalForm;

          // Multi-tab in Edit mode
          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <InfoCircleOutlined /> General Details
                    </span>
                  ),
                  children: generalForm,
                },
                {
                  key: 'metadata',
                  label: (
                    <span>
                      <TagsOutlined /> Dataset Metadata
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #f0f0f0', marginTop: 12 }}>
                      <p>Metadata attributes registered:</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li><strong>Methodology:</strong> Standard FAO definition.</li>
                        <li><strong>Source:</strong> Food and Agriculture Organization (FAO) Database.</li>
                        <li><strong>Notes:</strong> Reflects arable land under permanent crops.</li>
                      </ul>
                    </Card>
                  ),
                },
                {
                  key: 'dataflows',
                  label: (
                    <span>
                      <PartitionOutlined /> Dataflows mapping
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <p>Assigned under the following categories:</p>
                      <Space size="middle" wrap>
                        {(editingRecord.indicatorDataflowMapping || []).map((m: any, idx: number) => (
                          <Tag color="cyan" key={idx} style={{ padding: '4px 12px', fontSize: 13 }}>
                            {m.mainDataflowCode}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  ),
                },
                {
                  key: 'harmonization',
                  label: (
                    <span>
                      <InteractionOutlined /> Harmonization
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #f0f0f0', marginTop: 12 }}>
                      <p>Active conversion rules for this indicator:</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li>Multiplier scaling: <strong>0 (Reported scale) to 3 (Thousands)</strong></li>
                        <li>Currency exchange: <strong>Resolved from dataset_attributes</strong></li>
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

// Inline edit icon helper
function EditOutlined(props: any) {
  return (
    <span style={{ fontSize: 14, ...props.style }}>
      📝
    </span>
  );
}
