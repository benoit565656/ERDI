'use client';

import React, { useState, useMemo } from 'react';
import { Button, Form, Input, Card, Space, message, Tag, Select, Tabs, Transfer, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined, TableOutlined, BlockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller } from 'react-hook-form';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';

// Zod Validation Schema
const dataflowSchema = z.object({
  code: z.string().min(1, 'Dataflow code is required.'),
  datasetCode: z.string().min(1, 'Dataset code is required.'),
  name: z.string().min(1, 'Dataflow name is required.'),
  description: z.string().optional().nullable(),
  dataflowLevel: z.number().min(1, 'Level must be 1 or greater.').default(1),
  parentCode: z.string().optional().nullable(),
  dsdCode: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
  indicators: z.array(z.string()).optional(),
});

type DataflowFormValues = z.infer<typeof dataflowSchema>;

const hierarchyMap: Record<string, string> = {
  // KIDB & ADO
  "PPL": "1.1",
  "PPL_POP": "1.1.1",
  "PPL_LE": "1.1.2",
  "PPL_POV": "1.1.3",
  "PPL_SI": "1.1.4",
  "EO": "1.2",
  "EO_NA": "1.2.1",
  "EO_NA_CURR": "1.2.1.1",
  "EO_NA_CURR_GDP_EXP": "1.2.1.1.1",
  "EO_NA_CURR_GDP_SOD": "1.2.1.1.2",
  "EO_NA_CURR_GDP_SOO": "1.2.1.1.3",
  "EO_NA_CURR_GVA": "1.2.1.1.4",
  "EO_NA_CONST": "1.2.1.2",
  "EO_NA_CONST_GDP_EXP": "1.2.1.2.1",
  "EO_NA_CONST_GOD": "1.2.1.2.2",
  "EO_NA_CONST_GOO": "1.2.1.2.3",
  "EO_NA_CONST_GVA": "1.2.1.2.4",
  "EO_NA_INV_FIN": "1.2.1.3",
  "EO_PRIX": "1.2.2",
  "MFP": "1.3",
  "MFP_PR": "1.3.1",
  "MFP_MF": "1.3.2",
  "MFP_XR": "1.3.3",
  "GLB": "1.4",
  "GLB_ET": "1.4.1",
  "GLB_BP": "1.4.2",
  "GLB_IR": "1.4.3",
  "GLB_EI": "1.4.4",
  "GLB_CF": "1.4.5",
  "GLB_TM": "1.4.6",
  "TC": "1.5",
  "TC_TR": "1.5.1",
  "TC_COM": "1.5.2",
  "EGELC": "1.6",
  "EGELC_EG": "1.6.1",
  "EGELC_ELC": "1.6.2",
  "ENV": "1.7",
  "ENV_LD": "1.7.1",
  "ENV_PN": "1.7.2",
  "ENV_FW": "1.7.3",
  "ENV_CC": "1.7.4",
  "ENV_GGE": "1.7.5",
  "GG": "1.8",
  "GG_GF": "1.8.1",
  "GG_GV": "1.8.2",
  "SDG": "1.9",
  "SDG_01": "1.9.1",
  "SDG_02": "1.9.2",
  "SDG_03": "1.9.3",
  "SDG_04": "1.9.4",
  "SDG_05": "1.9.5",
  "SDG_06": "1.9.6",
  "SDG_07": "1.9.7",
  "SDG_08": "1.9.8",
  "SDG_09": "1.9.9",
  "SDG_10": "1.9.10",
  "SDG_11": "1.9.11",
  "SDG_12": "1.9.12",
  "SDG_13": "1.9.13",
  "SDG_14": "1.9.14",
  "SDG_15": "1.9.15",
  "SDG_16": "1.9.16",
  "SDG_17": "1.9.17",
  // ARIC
  "ARIC": "2",
  "ARIC_DAF_TRADE": "2.1",
  "ARIC_DAF_FDI": "2.2",
  "ARIC_DAF_FIN": "2.3",
  "ARIC_DAF_PPL": "2.4",
  // EEMRIOT
  "ENV_GGE_EEMRIOT": "3.1"
};

export default function DataflowsPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Fetch Dataflows
  const { data: dataflows = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['dataflowsList'],
    queryFn: async () => {
      const res = await fetch('/api/dataflows');
      if (!res.ok) throw new Error('Failed to fetch dataflows');
      return res.json();
    },
  });

  // Pre-process and sort dataflows by Dataset then Hierarchy
  const sortedDataflows = useMemo(() => {
    const mapped = dataflows.map((df: any) => ({
      ...df,
      hierarchy: hierarchyMap[df.code] || '',
    }));

    return mapped.sort((a, b) => {
      // 1. Dataset comparison
      const dsCompare = (a.datasetCode || '').localeCompare(b.datasetCode || '');
      if (dsCompare !== 0) return dsCompare;

      // 2. Hierarchy comparison
      const pathA = a.hierarchy;
      const pathB = b.hierarchy;
      
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
  }, [dataflows]);

  // Fetch Dataset dropdown options
  const { data: datasetOptions = [] } = useQuery<any[]>({
    queryKey: ['availableDatasets'],
    queryFn: async () => {
      const res = await fetch('/api/available-options?type=datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets options');
      return res.json();
    },
  });

  // Fetch all Indicators for the Transfer list (pageSize=1000 to fetch all 732 shortcut codes)
  const { data: indicatorsData } = useQuery<any>({
    queryKey: ['transferIndicators'],
    queryFn: async () => {
      const res = await fetch('/api/indicators?page=1&pageSize=1000');
      if (!res.ok) throw new Error('Failed to fetch indicators');
      return res.json();
    },
  });

  const allIndicators = indicatorsData?.indicators || [];
  const transferDataSource = allIndicators.map((ind: any) => ({
    key: ind.code,
    title: `[${ind.code}] ${ind.name}`,
    description: ind.name,
  }));

  // Save Mutator
  const saveMutation = useMutation({
    mutationFn: async (values: DataflowFormValues) => {
      const res = await fetch('/api/dataflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save dataflow');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Dataflow saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['dataflowsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving dataflow.');
    },
  });

  const handleCreate = () => {
    setEditingRecord(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    // Fetch currently mapped indicators for this dataflow
    const mappedIndicators = record.dataflowIndicators || [];
    const assignedKeys = mappedIndicators.map((mi: any) => mi.indicatorCode) || [];

    setEditingRecord({
      code: record.code,
      datasetCode: record.datasetCode,
      name: record.name,
      description: record.description || '',
      dataflowLevel: record.dataflowLevel ?? 1,
      parentCode: record.parentCode || '',
      dsdCode: record.dsdCode || '',
      sortOrder: record.sortOrder ?? 0,
      status: record.status || 'ACTIVE',
      indicators: assignedKeys,
    });
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Dataset',
      dataIndex: 'datasetCode',
      key: 'datasetCode',
      sorter: (a: any, b: any) => a.datasetCode.localeCompare(b.datasetCode),
    },
    {
      title: 'Hierarchy',
      dataIndex: 'hierarchy',
      key: 'hierarchy',
      render: (val: string) => val || '-',
      sorter: (a: any, b: any) => {
        const pathA = a.hierarchy;
        const pathB = b.hierarchy;
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
      },
    },
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
      title: 'Level',
      dataIndex: 'dataflowLevel',
      key: 'dataflowLevel',
      render: (level: number) => {
        let color = 'cyan';
        if (level === 1) color = 'purple';
        if (level === 2) color = 'blue';
        if (level === 3) color = 'orange';
        return <Tag color={color}>Level {level || 1}</Tag>;
      },
      sorter: (a: any, b: any) => (a.dataflowLevel || 1) - (b.dataflowLevel || 1),
    },
    {
      title: 'Parent Dataflow',
      dataIndex: ['parent', 'name'],
      key: 'parentCode',
      render: (_: any, record: any) => record.parentCode || '-',
    },
    {
      title: 'Indicators Count',
      dataIndex: '_count',
      key: 'indicatorsCount',
      render: (count: any) => <Tag color="blue">{count?.dataflowIndicators || 0} indicators</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'ACTIVE') color = 'green';
        if (status === 'DRAFT') color = 'gold';
        if (status === 'ARCHIVED') color = 'gray';
        return <Tag color={color}>{status || 'ACTIVE'}</Tag>;
      },
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
        title="Dataflows Manager"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Dataflow
          </Button>
        }
        style={{ borderRadius: 8 }}
      >
        <DataTable
          columns={columns}
          dataSource={sortedDataflows}
          loading={isLoading}
          rowKey="code"
          searchPlaceholder="Search dataflows..."
          onRefresh={refetch}
        />
      </Card>

      {/* Slide Edit Drawer */}
      <FormDrawer
        title={editingRecord ? `Edit Dataflow: ${editingRecord.code}` : 'Create Dataflow'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={dataflowSchema}
        defaultValues={editingRecord || {
          code: '',
          datasetCode: 'KIDB',
          name: '',
          description: '',
          dataflowLevel: 1,
          parentCode: '',
          dsdCode: '',
          sortOrder: 0,
          status: 'ACTIVE',
          indicators: [],
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
        width={750}
      >
        {(form) => {
          // List of other dataflows to select as parent
          const parentOptions = sortedDataflows
            .filter(df => df.datasetCode === form.watch('datasetCode') && df.code !== form.watch('code'))
            .map(df => ({ label: `[${df.code}] ${df.name}`, value: df.code }));

          const generalForm = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="Dataset"
                required
                validateStatus={form.formState.errors.datasetCode ? 'error' : ''}
              >
                <Controller
                  name="datasetCode"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      placeholder="Select Dataset"
                      options={datasetOptions}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Dataflow Code"
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
                      disabled={!!editingRecord}
                      placeholder="e.g. ENV_LD"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Dataflow Name"
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
                      placeholder="e.g. Land and Agriculture"
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Dataflow Level (Numeric Depth)" required>
                <Controller
                  name="dataflowLevel"
                  control={form.control}
                  render={({ field }) => (
                    <InputNumber
                      {...field}
                      style={{ width: '100%' }}
                      min={1}
                      placeholder="e.g. 1, 2, 3, etc."
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Parent Dataflow">
                <Controller
                  name="parentCode"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      placeholder="Select parent category"
                      options={parentOptions}
                      allowClear
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Sort Order">
                <Controller
                  name="sortOrder"
                  control={form.control}
                  render={({ field }) => (
                    <InputNumber
                      {...field}
                      style={{ width: '100%' }}
                      min={0}
                    />
                  )}
                />
              </Form.Item>

              <Form.Item label="Lifecycle Status" required>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={[
                        { label: 'ACTIVE', value: 'ACTIVE' },
                        { label: 'DRAFT', value: 'DRAFT' },
                        { label: 'ARCHIVED', value: 'ARCHIVED' },
                      ]}
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
                      rows={3}
                      placeholder="Enter details..."
                    />
                  )}
                />
              </Form.Item>
            </Space>
          );

          if (!editingRecord) {
            return generalForm;
          }

          // Tabs in Edit mode
          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <InfoCircleOutlined /> General Settings
                    </span>
                  ),
                  children: generalForm,
                },
                {
                  key: 'indicators',
                  label: (
                    <span>
                      <TableOutlined /> Indicators Assignment
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ marginBottom: 16, fontSize: 13, color: '#8c8c8c' }}>
                        Assign indicators to this category. They will show up under this dataflow path in explorer views.
                      </p>
                      <Transfer
                        dataSource={transferDataSource}
                        titles={['All Indicators', 'Assigned Indicators']}
                        targetKeys={form.watch('indicators') || []}
                        onChange={(nextTargetKeys) => form.setValue('indicators', nextTargetKeys.map(k => k.toString()))}
                        render={(item) => item.title || ''}
                        listStyle={{
                          width: '45%',
                          height: 350,
                        }}
                        showSearch
                      />
                    </div>
                  ),
                },
                {
                  key: 'constraints',
                  label: (
                    <span>
                      <BlockOutlined /> DSD Constraints
                    </span>
                  ),
                  children: (
                    <Card size="small" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.1)', marginTop: 12 }}>
                      <p>DSD constraints block validation errors for specific dimensions under this dataflow.</p>
                      <ul style={{ paddingLeft: 20 }}>
                        <li>Dimensions constrained: <strong>ECONOMY</strong></li>
                        <li>No constraints configured. All economy codes are allowed.</li>
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
