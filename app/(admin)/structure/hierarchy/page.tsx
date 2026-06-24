'use client';

import React, { useMemo } from 'react';
import { Tree, Card, Spin, Alert, message, Button, Space, Typography, Row, Col } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlobalOutlined,
  DatabaseOutlined,
  FolderOutlined,
  ReloadOutlined,
  TableOutlined,
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

    const hierarchyOrder: Record<string, string> = {
      // KIDB & ADO (Prefix 1.x shifted to root level)
      PPL: '1',
      PPL_POP: '1.1',
      PPL_LE: '1.2',
      PPL_POV: '1.3',
      PPL_SI: '1.4',
      EO: '2',
      EO_NA: '2.1',
      EO_NA_CURR: '2.1.1',
      EO_NA_CURR_GDP_EXP: '2.1.1.1',
      EO_NA_CURR_GDP_SOD: '2.1.1.2',
      EO_NA_CURR_GDP_SOO: '2.1.1.3',
      EO_NA_CURR_GVA: '2.1.1.4',
      EO_NA_CONST: '2.1.2',
      EO_NA_CONST_GDP_EXP: '2.1.2.1',
      EO_NA_CONST_GOD: '2.1.2.2',
      EO_NA_CONST_GOO: '2.1.2.3',
      EO_NA_CONST_GVA: '2.1.2.4',
      EO_NA_INV_FIN: '2.1.3',
      EO_PRIX: '2.2',
      MFP: '3',
      MFP_PR: '3.1',
      MFP_MF: '3.2',
      MFP_XR: '3.3',
      GLB: '4',
      GLB_ET: '4.1',
      GLB_BP: '4.2',
      GLB_IR: '4.3',
      GLB_EI: '4.4',
      GLB_CF: '4.5',
      GLB_TM: '4.6',
      TC: '5',
      TC_TR: '5.1',
      TC_COM: '5.2',
      EGELC: '6',
      EGELC_EG: '6.1',
      EGELC_ELC: '6.2',
      ENV: '7',
      ENV_LD: '7.1',
      ENV_PN: '7.2',
      ENV_FW: '7.3',
      ENV_CC: '7.4',
      ENV_GGE: '7.5',
      GG: '8',
      GG_GF: '8.1',
      GG_GV: '8.2',
      SDG: '9',
      SDG_01: '9.1',
      SDG_02: '9.2',
      SDG_03: '9.3',
      SDG_04: '9.4',
      SDG_05: '9.5',
      SDG_06: '9.6',
      SDG_07: '9.7',
      SDG_08: '9.8',
      SDG_09: '9.9',
      SDG_10: '9.10',
      SDG_11: '9.11',
      SDG_12: '9.12',
      SDG_13: '9.13',
      SDG_14: '9.14',
      SDG_15: '9.15',
      SDG_16: '9.16',
      SDG_17: '9.17',
      // ARIC (Prefix 10.x shifted to root level)
      ARIC: '10',
      ARIC_DAF_TRADE: '10.1',
      ARIC_DAF_FDI: '10.2',
      ARIC_DAF_FIN: '10.3',
      ARIC_DAF_PPL: '10.4'
    };

    // Helper to recursively find children dataflows or indicators for a parent dataflow or dataset
    const getCategoryChildren = (datasetCode: string, parentCode: string | null): any[] => {
      const subCategories = dataflows.filter((df: any) => df.datasetCode === datasetCode && df.parentCode === parentCode);
      
      // Sort according to dot-notation path
      const sortedSubCategories = [...subCategories].sort((a: any, b: any) => {
        const pathA = hierarchyOrder[a.code] || "";
        const pathB = hierarchyOrder[b.code] || "";
        
        if (!pathA && !pathB) return a.code.localeCompare(b.code);
        if (!pathA) return 1;
        if (!pathB) return -1;
        
        const partsA = pathA.split('.').map(Number);
        const partsB = pathB.split('.').map(Number);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const valA = partsA[i] ?? 0;
          const valB = partsB[i] ?? 0;
          if (valA !== valB) return valA - valB;
        }
        return 0;
      });

      return sortedSubCategories.map((df: any) => {
        // Check if this subcategory itself has child dataflows
        const grandChildren = dataflows.filter((child: any) => child.datasetCode === datasetCode && child.parentCode === df.code);
        
        let childrenNodes: any[] = [];
        if (grandChildren.length > 0) {
          // If it has children dataflows, recurse
          childrenNodes = getCategoryChildren(datasetCode, df.code);
        } else {
          // It's a leaf dataflow! Nest its mapped indicators under it, sorted alphabetically by indicatorCode
          const mapped = [...(df.dataflowIndicators || [])].sort((a: any, b: any) =>
            a.indicatorCode.localeCompare(b.indicatorCode)
          );
          childrenNodes = mapped.map((mi: any) => ({
            key: `indicator|${mi.indicatorCode}|${datasetCode}|${df.code}`,
            title: `[Indicator] [${mi.indicatorCode}] ${mi.indicator?.name || ''}`,
            icon: <TableOutlined style={{ color: '#8b5cf6' }} />,
            isDraggable: false,
          }));
        }

        return {
          key: `dataflow|${df.code}|${datasetCode}`,
          title: `[Dataflow] ${df.name}`,
          icon: <FolderOutlined style={{ color: '#10b981' }} />,
          children: childrenNodes,
          isDraggable: true,
        };
      });
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
        <Spin description="Loading visual hierarchy manager..." />
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
