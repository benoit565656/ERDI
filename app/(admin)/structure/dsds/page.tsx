'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  message,
  Tabs,
  Table,
  Modal,
  Checkbox,
  Select,
  Popconfirm,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ApartmentOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@/components/DataTable';
import FormDrawer from '@/components/FormDrawer';
import { z } from 'zod';
import { Controller } from 'react-hook-form';

const { Title, Paragraph, Text } = Typography;

const dsdSchema = z.object({
  code: z.string().min(1, 'Code is required.').max(50),
  agency: z.string().min(1, 'Agency is required.'),
  version: z.string().min(1, 'Version is required.').default('1.0'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
});

type DsdFormValues = z.infer<typeof dsdSchema>;

export default function DsdsPage() {
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingDsd, setEditingDsd] = useState<DsdFormValues | null>(null);
  
  // Sub-component Modal State
  const [componentModalVisible, setComponentModalVisible] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any | null>(null);

  const [subForm] = Form.useForm();

  // Fetch DSDs
  const { data: dsds = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['dsdsList'],
    queryFn: () => fetch('/api/dsds').then((res) => res.json()),
  });

  // Fetch Concept Schemes to get all concepts
  const { data: conceptSchemes = [] } = useQuery<any[]>({
    queryKey: ['conceptSchemesList'],
    queryFn: () => fetch('/api/concept-schemes').then((res) => res.json()),
  });

  const conceptsOptions = useMemo(() => {
    const list: any[] = [];
    const codesSeen = new Set<string>();
    conceptSchemes.forEach((s) => {
      if (s.concepts) {
        s.concepts.forEach((c: any) => {
          if (!codesSeen.has(c.code)) {
            codesSeen.add(c.code);
            list.push({ label: `[${c.code}] ${c.name || c.code}`, value: c.code });
          }
        });
      }
    });
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [conceptSchemes]);

  // Fetch Code Lists
  const { data: codelists = [] } = useQuery<any[]>({
    queryKey: ['codelistsList'],
    queryFn: () => fetch('/api/codelists').then((res) => res.json()),
  });

  const codelistsOptions = useMemo(() => {
    return codelists
      .map((cl) => ({ label: `[${cl.code}] ${cl.name}`, value: cl.code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [codelists]);

  // Fetch DSD Components of the DSD being edited
  const { data: components = [], refetch: refetchComponents, isLoading: loadingComponents } = useQuery<any[]>({
    queryKey: ['dsdComponents', editingDsd?.code],
    queryFn: async () => {
      if (!editingDsd?.code) return [];
      const res = await fetch(`/api/dsds/components?dsdCode=${editingDsd.code}`);
      if (!res.ok) throw new Error('Failed to fetch DSD components');
      return res.json();
    },
    enabled: !!editingDsd?.code && drawerVisible,
  });

  const typeOrder = useMemo(() => ({
    DIMENSION: 1,
    TIME_DIMENSION: 2,
    MEASURE: 3,
    ATTRIBUTE: 4,
    METADATA: 5,
  }), []);

  const sortedComponents = useMemo(() => {
    if (!components) return [];
    return [...components].sort((a, b) => {
      const orderA = typeOrder[a.componentType as keyof typeof typeOrder] || 99;
      const orderB = typeOrder[b.componentType as keyof typeof typeOrder] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.componentCode.localeCompare(b.componentCode);
    });
  }, [components, typeOrder]);

  // Save DSD Mutation
  const saveDsdMutation = useMutation({
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
      message.success('Data Structure Definition saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['dsdsList'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving DSD.');
    },
  });

  // Save Component Mutation
  const saveComponentMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch('/api/dsds/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, dsdCode: editingDsd?.code }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save DSD component');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('DSD Component saved successfully.');
      refetchComponents();
      queryClient.invalidateQueries({ queryKey: ['dsdsList'] });
      setComponentModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving DSD component.');
    },
  });

  // Delete Component Mutation
  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dsds/components?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete component');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('DSD Component deleted successfully.');
      refetchComponents();
      queryClient.invalidateQueries({ queryKey: ['dsdsList'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Error deleting DSD component.');
    },
  });

  // Triggered when editing sub-form opens
  useEffect(() => {
    if (componentModalVisible) {
      if (editingComponent) {
        subForm.setFieldsValue({
          id: editingComponent.id,
          componentCode: editingComponent.componentCode,
          componentType: editingComponent.componentType,
          conceptCode: editingComponent.conceptCode,
          codeListCode: editingComponent.codeListCode || undefined,
          isRequired: !!editingComponent.isRequired,
          attachmentLevel: editingComponent.attachmentLevel || undefined,
          defaultValue: editingComponent.defaultValue || '',
        });
      } else {
        subForm.resetFields();
        subForm.setFieldsValue({
          isRequired: false,
          componentType: 'DIMENSION',
        });
      }
    }
  }, [componentModalVisible, editingComponent, subForm]);

  const handleCreate = () => {
    setEditingDsd(null);
    setDrawerVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingDsd({
      code: record.code,
      name: record.name,
      agency: record.agency,
      version: record.version,
      description: record.description || '',
      status: (record.status as 'ACTIVE' | 'DRAFT' | 'ARCHIVED') || 'ACTIVE',
    });
    setDrawerVisible(true);
  };

  const handleSaveComponent = async () => {
    try {
      const values = await subForm.validateFields();
      await saveComponentMutation.mutateAsync(values);
    } catch (err: any) {
      console.error(err);
    }
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
      title: 'Components',
      dataIndex: 'components',
      key: 'components',
      render: (components: any[]) => <Tag color="purple">{components?.length || 0} fields</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'ACTIVE') color = 'green';
        if (status === 'DRAFT') color = 'orange';
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

  const subColumns = [
    {
      title: 'Code',
      dataIndex: 'componentCode',
      key: 'componentCode',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'componentType',
      key: 'componentType',
      render: (type: string) => {
        let color = 'cyan';
        if (type === 'DIMENSION') color = 'blue';
        if (type === 'TIME_DIMENSION') color = 'indigo';
        if (type === 'MEASURE') color = 'magenta';
        if (type === 'ATTRIBUTE') color = 'orange';
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Concept',
      dataIndex: 'conceptCode',
      key: 'conceptCode',
    },
    {
      title: 'Codelist',
      dataIndex: 'codeListCode',
      key: 'codeListCode',
      render: (code: string) => code ? <Tag color="geekblue">{code}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Req',
      dataIndex: 'isRequired',
      key: 'isRequired',
      render: (req: boolean) => (req ? <Tag color="red">Yes</Tag> : 'No'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingComponent(record);
              setComponentModalVisible(true);
            }}
          />
          <Popconfirm
            title="Delete Component"
            description="Are you sure you want to remove this DSD component?"
            okText="Yes"
            cancelText="No"
            onConfirm={() => deleteComponentMutation.mutate(record.id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
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

      {/* Slide Edit / Create Drawer */}
      <FormDrawer
        title={editingDsd ? 'Edit Data Structure Definition' : 'Create DSD'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={dsdSchema}
        defaultValues={editingDsd || {
          code: '',
          agency: 'ADB',
          version: '1.0',
          name: '',
          description: '',
          status: 'ACTIVE' as const,
        }}
        onSubmit={async (data) => {
          await saveDsdMutation.mutateAsync(data);
        }}
        width={750}
      >
        {(form) => {
          const generalFields = (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                label="DSD Code"
                required
                help={form.formState.errors.code?.message}
                validateStatus={form.formState.errors.code ? 'error' : ''}
              >
                <Controller
                  name="code"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} disabled={!!editingDsd} placeholder="e.g. DSD_KIDB" />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="DSD Name"
                required
                help={form.formState.errors.name?.message}
                validateStatus={form.formState.errors.name ? 'error' : ''}
              >
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="e.g. KIDB Data Structure Definition" />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Agency"
                required
                help={form.formState.errors.agency?.message}
                validateStatus={form.formState.errors.agency ? 'error' : ''}
              >
                <Controller
                  name="agency"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="e.g. ADB" />
                  )}
                />
              </Form.Item>

              <Form.Item
                label="Version"
                required
                help={form.formState.errors.version?.message}
                validateStatus={form.formState.errors.version ? 'error' : ''}
              >
                <Controller
                  name="version"
                  control={form.control}
                  render={({ field }) => (
                    <Input {...field} placeholder="e.g. 1.0" />
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
                  render={({ field }) => (
                    <Input.TextArea {...field} value={field.value || ''} rows={4} placeholder="Describe DSD components..." />
                  )}
                />
              </Form.Item>
            </Space>
          );

          if (!editingDsd) {
            // Creation mode - show only General info fields
            return generalFields;
          }

          // Edit mode - show Tabs: General info + DSD Components list
          return (
            <Tabs
              defaultActiveKey="general"
              items={[
                {
                  key: 'general',
                  label: (
                    <span>
                      <ApartmentOutlined /> General Details
                    </span>
                  ),
                  children: generalFields,
                },
                {
                  key: 'components',
                  label: (
                    <span>
                      <SettingOutlined /> DSD Components ({components.length})
                    </span>
                  ),
                  children: (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text type="secondary">Define the layout dimensions and attributes structure for this DSD schema.</Text>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          size="small"
                          onClick={() => {
                            setEditingComponent(null);
                            setComponentModalVisible(true);
                          }}
                        >
                          Add Component
                        </Button>
                      </div>

                      <Table
                        columns={subColumns}
                        dataSource={sortedComponents}
                        rowKey="id"
                        pagination={false}
                        loading={loadingComponents}
                        size="small"
                        bordered
                      />
                    </div>
                  ),
                },
              ]}
            />
          );
        }}
      </FormDrawer>

      {/* Sub-component Modal for Add/Edit component */}
      <Modal
        title={editingComponent ? 'Edit DSD Component' : 'Add DSD Component'}
        open={componentModalVisible}
        onOk={handleSaveComponent}
        onCancel={() => setComponentModalVisible(false)}
        confirmLoading={saveComponentMutation.isPending}
        destroyOnClose
        width={550}
      >
        <Form form={subForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="componentCode"
                label="Component Code"
                required
                rules={[{ required: true, message: 'Please input component code!' }]}
              >
                <Input placeholder="e.g. SEX, AGE, REGION" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="componentType"
                label="Component Type"
                required
                rules={[{ required: true, message: 'Please select component type!' }]}
              >
                <Select
                  options={[
                    { label: 'DIMENSION', value: 'DIMENSION' },
                    { label: 'TIME_DIMENSION', value: 'TIME_DIMENSION' },
                    { label: 'MEASURE', value: 'MEASURE' },
                    { label: 'ATTRIBUTE', value: 'ATTRIBUTE' },
                    { label: 'METADATA', value: 'METADATA' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="conceptCode"
                label="Concept Reference"
                required
                rules={[{ required: true, message: 'Please select a concept reference!' }]}
              >
                <Select
                  options={conceptsOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select concept"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="codeListCode"
                label="Codelist Code (Optional)"
              >
                <Select
                  options={codelistsOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select codelist"
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="attachmentLevel"
                label="Attachment Level (Optional)"
              >
                <Select
                  options={[
                    { label: 'OBSERVATION', value: 'OBSERVATION' },
                    { label: 'SERIES', value: 'SERIES' },
                    { label: 'DATASET', value: 'DATASET' },
                  ]}
                  placeholder="Select attachment level"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="defaultValue"
                label="Default Value (Optional)"
              >
                <Input placeholder="Default code or text" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isRequired"
            valuePropName="checked"
          >
            <Checkbox>Component is Required</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
