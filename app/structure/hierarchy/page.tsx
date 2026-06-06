'use client';

import React, { useMemo } from 'react';
import { Tree, Card, Spin, Alert, message, Button, Space, Typography, Row, Col } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlobalOutlined,
  DatabaseOutlined,
  FolderOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function HierarchyPage() {
  const queryClient = useQueryClient();

  // Fetch full hierarchy components
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['hierarchyData'],
    queryFn: async () => {
      const res = await fetch('/api/hierarchy');
      if (!res.ok) throw new Error('Failed to load hierarchy data');
      return res.json();
    },
  });

  // Mutator to save drag and drop changes
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/hierarchy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update hierarchy');
      }
      return res.json();
    },
    onSuccess: (data) => {
      message.success(data.message || 'Hierarchy updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['hierarchyData'] });
      // Invalidate datasets and dataflows lists too
      queryClient.invalidateQueries({ queryKey: ['datasetsList'] });
      queryClient.invalidateQueries({ queryKey: ['dataflowsList'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Error updating hierarchy.');
    },
  });

  // Transform flat database tables into a nested Tree node structure
  const treeData = useMemo(() => {
    if (!data) return [];
    const { agencies = [], datasets = [], dataflows = [] } = data;

    // Helper to recursively find children dataflows for a parent dataflow or dataset
    const getCategoryChildren = (datasetCode: string, parentCode: string | null): any[] => {
      return dataflows
        .filter((df: any) => df.datasetCode === datasetCode && df.parentCode === parentCode)
        .map((df: any) => ({
          key: `dataflow|${df.code}|${datasetCode}`,
          title: `[Dataflow] ${df.name}`,
          icon: <FolderOutlined style={{ color: '#10b981' }} />,
          children: getCategoryChildren(datasetCode, df.code),
          isDraggable: true,
        }));
    };

    // Build the nodes
    return agencies.map((agency: any) => {
      // Find datasets under this agency
      const agencyDatasets = datasets.filter((d: any) => d.agencyCode === agency.code);

      return {
        key: `agency|${agency.code}`,
        title: `[Agency] ${agency.name}`,
        icon: <GlobalOutlined style={{ color: '#6366f1' }} />,
        isDraggable: false, // Cannot drag agency
        children: agencyDatasets.map((ds: any) => {
          // Find root categories (dataflows with parentCode = null) under this dataset
          const datasetDataflows = getCategoryChildren(ds.code, null);

          return {
            key: `dataset|${ds.code}`,
            title: `[Dataset] ${ds.name}`,
            icon: <DatabaseOutlined style={{ color: '#f59e0b' }} />,
            isDraggable: true, // Datasets can be dragged under different agencies
            children: datasetDataflows,
          };
        }),
      };
    });
  }, [data]);

  // Handle drop node operations
  const handleDrop = (info: any) => {
    const dragNodeKey = info.dragNode.key as string;
    const dropNodeKey = info.node.key as string;

    const [dragType, dragCode, dragDataset] = dragNodeKey.split('|');
    const [dropType, dropCode, dropDataset] = dropNodeKey.split('|');

    // Case 1: Dragged a Dataset
    if (dragType === 'dataset') {
      if (dropType !== 'agency') {
        message.warning('Datasets can only be nested directly under Agency nodes.');
        return;
      }
      
      saveMutation.mutate({
        draggedType: 'dataset',
        draggedCode: dragCode,
        targetParentType: 'agency',
        targetParentCode: dropCode,
      });
      return;
    }

    // Case 2: Dragged a Dataflow
    if (dragType === 'dataflow') {
      if (dropType === 'agency') {
        message.warning('Dataflow categories must be nested under Datasets or other Dataflows.');
        return;
      }

      if (dropType === 'dataset') {
        // Drop at root level of this dataset
        saveMutation.mutate({
          draggedType: 'dataflow',
          draggedCode: dragCode,
          datasetCode: dragDataset,
          targetParentType: 'dataset',
          targetParentCode: dropCode,
        });
      } else if (dropType === 'dataflow') {
        // Drop under another dataflow category
        if (dragDataset !== dropDataset) {
          message.warning('Cannot move dataflow categories across different datasets.');
          return;
        }

        // Check self-nesting loop
        if (dragCode === dropCode) return;

        saveMutation.mutate({
          draggedType: 'dataflow',
          draggedCode: dragCode,
          datasetCode: dragDataset,
          targetParentType: 'dataflow',
          targetParentCode: dropCode,
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin tip="Loading visual hierarchy manager..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Visual Hierarchy Builder</Title>
        <Text type="secondary">
          Configure classification mappings by dragging and dropping datasets and dataflow categories.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Help panel */}
        <Col xs={24} lg={8}>
          <Card title="Builder Guide" style={{ borderRadius: 8 }}>
            <Space direction="vertical">
              <Alert
                message="Draggable Rules"
                description={
                  <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
                    <li><strong>Datasets</strong> (orange) can only be dragged under <strong>Agencies</strong> (blue).</li>
                    <li><strong>Dataflows</strong> (green) can be dragged under <strong>Datasets</strong> or other <strong>Dataflows</strong>.</li>
                    <li>Dataflows cannot be moved to a different Dataset.</li>
                  </ul>
                }
                type="info"
                showIcon
              />
              <Paragraph style={{ marginTop: 16 }}>
                Your drops are instantly validated and saved to the database. Re-order categories to organize how they appear on the frontend application.
              </Paragraph>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                Refresh Tree Structure
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Tree panel */}
        <Col xs={24} lg={16}>
          <Card
            title="Statistical Classification Tree"
            styles={{ body: { padding: '24px 32px' } }}
            style={{ borderRadius: 8 }}
          >
            <Spin spinning={saveMutation.isPending}>
              {treeData.length === 0 ? (
                <Alert message="No classification nodes found. Seed database first." type="warning" />
              ) : (
                <Tree
                  showIcon
                  draggable={(node: any) => node.isDraggable}
                  blockNode
                  defaultExpandAll
                  onDrop={handleDrop}
                  treeData={treeData}
                  style={{ fontSize: 15 }}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
