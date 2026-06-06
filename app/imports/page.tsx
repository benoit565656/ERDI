'use client';

import React, { useState } from 'react';
import { Tabs, Card, Select, Form, Button, Alert, Tag, Space, Typography } from 'antd';
import { InboxOutlined, HistoryOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ImportWizard from '@/components/ImportWizard';
import DataTable from '@/components/DataTable';

const { Title, Paragraph } = Typography;

export default function ImportsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('new');
  const [importType, setImportType] = useState<'observations' | 'codelists' | 'dataflows' | 'dsds' | 'concepts'>('observations');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [wizardKey, setWizardKey] = useState(0); // to reset wizard state

  // Fetch Datasets for association
  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ['datasetsList'],
    queryFn: async () => {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets');
      return res.json();
    },
  });

  // Fetch Import History
  const { data: importHistory = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['importsHistory'],
    queryFn: async () => {
      const res = await fetch('/api/imports');
      if (!res.ok) throw new Error('Failed to fetch imports history');
      return res.json();
    },
  });

  const handleImportCompleted = async (rowCount: number) => {
    try {
      await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetCode: selectedDataset || null,
          importType: importType.toUpperCase(),
          fileName: `upload_${importType}_${Date.now()}.csv`,
          status: 'IMPORTED',
          totalRows: rowCount,
          validRows: rowCount,
          invalidRows: 0,
          warningRows: 0,
          uploadedBy: 'System Admin',
        }),
      });
      // Invalidate query cache and refresh history
      queryClient.invalidateQueries({ queryKey: ['importsHistory'] });
      refetch();
    } catch (err) {
      console.error('Failed to log import batch:', err);
    }
  };

  const columns = [
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
    },
    {
      title: 'Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
      render: (code: string) => code || <Tag color="default">GLOBAL</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'importType',
      key: 'importType',
      render: (type: string) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          IMPORTED: 'success',
          UPLOADED: 'processing',
          VALIDATED: 'cyan',
          FAILED: 'error',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Total Rows',
      dataIndex: 'totalRows',
      key: 'totalRows',
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
    },
    {
      title: 'Date & Time',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a: any, b: any) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
    },
  ];

  const tabItems = [
    {
      key: 'new',
      label: (
        <span>
          <CloudUploadOutlined />
          New Upload Wizard
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="Upload Parameters" style={{ borderRadius: 8 }}>
            <Form layout="inline" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
              <Form.Item label="Target Dataset" style={{ minWidth: 260, marginBottom: 0 }}>
                <Select
                  value={selectedDataset}
                  onChange={(val) => setSelectedDataset(val)}
                  placeholder="Select associated dataset (optional)"
                  allowClear
                >
                  {datasets.map((d: any) => (
                    <Select.Option key={d.code} value={d.code}>
                      {d.code} - {d.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Structure Type" style={{ minWidth: 220, marginBottom: 0 }}>
                <Select
                  value={importType}
                  onChange={(val) => {
                    setImportType(val);
                    setWizardKey((prev) => prev + 1); // reset wizard when type changes
                  }}
                >
                  <Select.Option value="observations">Observations Data</Select.Option>
                  <Select.Option value="codelists">Code List Items</Select.Option>
                  <Select.Option value="dataflows">Dataflow Mapping</Select.Option>
                  <Select.Option value="dsds">Data Structure Definition (DSD)</Select.Option>
                  <Select.Option value="concepts">Concepts Schemes</Select.Option>
                </Select>
              </Form.Item>

              <Button
                type="dashed"
                onClick={() => {
                  setWizardKey((prev) => prev + 1);
                }}
              >
                Reset Wizard
              </Button>
            </Form>
          </Card>

          <ImportWizard
            key={wizardKey}
            importType={importType}
            onCompleted={handleImportCompleted}
          />
        </Space>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined />
          Import History
        </span>
      ),
      children: (
        <Card title="Database Upload Batches Log" style={{ borderRadius: 8 }}>
          <DataTable
            columns={columns}
            dataSource={importHistory}
            loading={isLoading}
            rowKey="id"
            searchPlaceholder="Search imports..."
            onRefresh={refetch}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Import Center</Title>
        <Paragraph style={{ color: '#666' }}>
          Upload SDMX structures, Code Lists, and bulk Economy Observations using CSV formats.
        </Paragraph>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
}
