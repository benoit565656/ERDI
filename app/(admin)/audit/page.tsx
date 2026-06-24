'use client';

import React, { useState } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Space } from 'antd';
import { SafetyCertificateOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';

const { Title, Paragraph, Text } = Typography;

export default function AuditPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Fetch Audit Logs
  const { data: auditResponse, isLoading, refetch } = useQuery<any>({
    queryKey: ['auditLogs', currentPage, pageSize],
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize;
      const res = await fetch(`/api/audit?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
  });

  const logs = auditResponse?.logs || [];
  const total = auditResponse?.total || 0;

  const handleInspect = (log: any) => {
    setSelectedLog(log);
  };

  const columns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => {
        let color = 'default';
        if (action.startsWith('CREATE') || action.startsWith('UPSERT')) color = 'green';
        if (action.startsWith('UPDATE')) color = 'blue';
        if (action.startsWith('DELETE')) color = 'red';
        if (action.startsWith('IMPORT')) color = 'purple';
        return <Tag color={color}>{action}</Tag>;
      },
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      render: (type: string) => <strong style={{ color: '#555' }}>{type}</strong>,
    },
    {
      title: 'Entity Key ID',
      dataIndex: 'entityId',
      key: 'entityId',
      render: (id: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{id || '-'}</code>,
    },
    {
      title: 'Changed By',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email: string) => email || 'System / Admin',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => ip || '127.0.0.1',
    },
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Payload',
      key: 'payload',
      render: (_: any, record: any) => (
        <Button
          type="text"
          icon={<EyeOutlined style={{ color: '#6366f1' }} />}
          onClick={() => handleInspect(record)}
        >
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Security & Audit Logs</Title>
        <Paragraph style={{ color: '#666' }}>
          Monitor structural modifications, metadata updates, and API transactions performed in the SDMX engine.
        </Paragraph>
      </div>

      <Card
        title={
          <span>
            <SafetyCertificateOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            System Audit Trail
          </span>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={logs}
          loading={isLoading}
          rowKey="id"
          searchPlaceholder="Filter activity logs..."
          onRefresh={refetch}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page: number, size: number) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* Inspect Log details Modal */}
      <Modal
        title={`Audit Payload [${selectedLog?.action || ''}]`}
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedLog(null)}>
            Dismiss
          </Button>,
        ]}
        width={700}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
            <div>
              <Text type="secondary">Action Performed: </Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>{selectedLog.action}</Tag>
            </div>
            <div>
              <Text type="secondary">Entity Reference: </Text>
              <Text strong style={{ marginLeft: 8 }}>
                {selectedLog.entityType} ({selectedLog.entityId || 'Global'})
              </Text>
            </div>
            <div>
              <Text type="secondary">Executed At: </Text>
              <Text style={{ marginLeft: 8 }}>
                {new Date(selectedLog.createdAt).toLocaleString()}
              </Text>
            </div>

            {selectedLog.newValues && (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  Operation Data Values (Payload JSON):
                </Text>
                <pre
                  style={{
                    background: '#1e1e1e',
                    color: '#9cdcfe',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 320,
                    overflow: 'auto',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  {JSON.stringify(selectedLog.newValues, null, 2)}
                </pre>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
