'use client';

import React, { useState } from 'react';
import { Row, Col, Card, Statistic, Table, List, Button, Space, Typography, Tag, Spin, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  DatabaseOutlined,
  ClusterOutlined,
  GlobalOutlined,
  TableOutlined,
  PlusOutlined,
  UploadOutlined,
  RightOutlined,
  ArrowRightOutlined,
  FieldTimeOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');

  // Fetch Agencies dropdown options
  const { data: agencies = [] } = useQuery<any[]>({
    queryKey: ['filterAgenciesDashboard'],
    queryFn: () => fetch('/api/agencies').then((res) => res.json()),
  });

  // Fetch Datasets dropdown options
  const { data: datasetsOpt = [] } = useQuery<any[]>({
    queryKey: ['filterDatasetsDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=datasets');
      if (!res.ok) throw new Error('Failed to load datasets options');
      return res.json();
    },
  });

  // Fetch Dashboard statistics and logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboardData', selectedAgency, selectedDataset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAgency) params.append('agencyCode', selectedAgency);
      if (selectedDataset) params.append('datasetCode', selectedDataset);
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    },
  });

  const counts = data?.counts || {
    datasets: 0,
    dataflows: 0,
    indicators: 0,
    economies: 0,
    observations: 0,
    draft: 0,
    published: 0,
  };

  const statCards = [
    { title: 'Datasets', value: counts.datasets, icon: <DatabaseOutlined />, color: '#6366f1' },
    { title: 'Dataflows', value: counts.dataflows, icon: <ClusterOutlined />, color: '#3b82f6' },
    { title: 'Indicators', value: counts.indicators, icon: <TableOutlined />, color: '#10b981' },
    { title: 'Economies', value: counts.economies, icon: <GlobalOutlined />, color: '#f59e0b' },
    { title: 'Total Observations', value: counts.observations, icon: <FieldTimeOutlined />, color: '#8b5cf6' },
  ];

  const recentImportsColumns = [
    { title: 'File Name', dataIndex: 'fileName', key: 'fileName' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => (
      <Tag color={status === 'IMPORTED' ? 'green' : 'orange'}>{status}</Tag>
    )},
    { title: 'Rows', dataIndex: 'totalRows', key: 'totalRows', render: (rows: number) => rows.toLocaleString() },
    { title: 'Date', dataIndex: 'uploadedAt', key: 'uploadedAt', render: (date: string) => new Date(date).toLocaleDateString() },
  ];

  return (
    <div style={{ padding: '4px 0 24px' }}>
      {/* Welcome Title */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>ERDI Statistical Platform</Title>
        <Text type="secondary">Welcome to your SDMX-inspired data administration dashboard.</Text>
      </div>

      {/* Dynamic Filters Row */}
      <Card style={{ marginBottom: 24, borderRadius: 8 }}>
        <Space size="middle" align="center" wrap>
          <FilterOutlined style={{ color: '#4f46e5', fontSize: '18px' }} />
          <Text strong>Filter Dashboard Stats:</Text>
          <Space>
            <span>Agency:</span>
            <Select
              style={{ width: 220 }}
              placeholder="All Agencies"
              allowClear
              value={selectedAgency || undefined}
              onChange={(val) => {
                setSelectedAgency(val || '');
              }}
              options={agencies.map((a) => ({ label: `[${a.code}] ${a.name}`, value: a.code }))}
            />
          </Space>
          <Space>
            <span>Dataset:</span>
            <Select
              style={{ width: 240 }}
              placeholder="All Datasets"
              allowClear
              value={selectedDataset || undefined}
              onChange={(val) => setSelectedDataset(val || '')}
              options={datasetsOpt}
            />
          </Space>
        </Space>
      </Card>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
          <Spin size="large" description="Loading administrative dashboard stats..." />
        </div>
      ) : (
        <>
          {/* Main Stats Cards Grid */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {statCards.map((card, idx) => (
              <Col xs={24} sm={12} md={12} lg={4} key={idx}>
                <Card
                  bordered={false}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: `4px solid ${card.color}`,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <Statistic
                    title={card.title}
                    value={card.value}
                    valueStyle={{ color: card.color, fontWeight: 700 }}
                    prefix={card.icon}
                  />
                </Card>
              </Col>
            ))}

            {/* Observation Status Breakdowns */}
            <Col xs={24} sm={24} md={24} lg={8}>
              <Card bordered={false} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="Published Records" value={counts.published} valueStyle={{ color: '#10b981' }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Draft Records" value={counts.draft} valueStyle={{ color: '#f59e0b' }} />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Quick Actions Panel */}
          <Card title="Quick Actions Panel" style={{ marginBottom: 24, borderRadius: 8 }}>
            <Space size="large" wrap>
              <Link href="/imports">
                <Button type="primary" icon={<UploadOutlined />} size="large">
                  Import Observations
                </Button>
              </Link>
              <Link href="/codelists">
                <Button icon={<PlusOutlined />} size="large">
                  Manage Code Lists
                </Button>
              </Link>
              <Link href="/structure/datasets">
                <Button icon={<PlusOutlined />} size="large">
                  Create Dataset
                </Button>
              </Link>
              <Link href="/structure/hierarchy">
                <Button icon={<ClusterOutlined />} size="large">
                  Visual Hierarchy Builder
                </Button>
              </Link>
            </Space>
          </Card>

          {/* Bottom Layout split panel */}
          <Row gutter={[24, 24]}>
            {/* Recent Imports Table */}
            <Col xs={24} lg={14}>
              <Card
                title="Recent Import Batches"
                extra={<Link href="/imports">View All <RightOutlined /></Link>}
                styles={{ body: { padding: 0 } }}
                style={{ borderRadius: 8 }}
              >
                <Table
                  dataSource={data?.recentImports || []}
                  columns={recentImportsColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              </Card>
            </Col>

            {/* Recent Audit Logs activity */}
            <Col xs={24} lg={10}>
              <Card
                title="Recent Audit Logs"
                extra={<Link href="/audit">View Log history <RightOutlined /></Link>}
                style={{ borderRadius: 8 }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={data?.recentActivity || []}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Text strong>{item.action.replace(/_/g, ' ')}</Text>}
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Entity: {item.entityType} ({item.entityId})
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
