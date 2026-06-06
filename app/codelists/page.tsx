'use client';

import React, { useState, useMemo } from 'react';
import { Row, Col, Card, List, Button, Space, Tree, Tag, Form, Input, Select, message, Spin, Typography } from 'antd';
import { PlusOutlined, EditOutlined, FolderOutlined, TagOutlined, CloudDownloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Paragraph } = Typography;
import { z } from 'zod';
import FormDrawer from '@/components/FormDrawer';

// Zod schemas
const codeListSchema = z.object({
  action: z.enum(['CREATE_CODELIST', 'UPSERT_ITEM']),
  codeListCode: z.string().optional(),
  code: z.string().min(1, 'Code is required.'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  parentItemCode: z.string().optional().nullable(),
  sortOrder: z.string().optional().or(z.number().optional()),
});

type CodeListFormValues = z.infer<typeof codeListSchema>;

export default function CodeListsPage() {
  const queryClient = useQueryClient();
  const [selectedListCode, setSelectedListCode] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'LIST' | 'ITEM'>('ITEM');
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Fetch Code Lists and nested items
  const { data: codeLists = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['codeListsAll'],
    queryFn: async () => {
      const res = await fetch('/api/codelists');
      if (!res.ok) throw new Error('Failed to fetch code lists');
      return res.json();
    },
  });

  // Automatically select the first code list once loaded
  useEffectAfterLoad();
  function useEffectAfterLoad() {
    React.useEffect(() => {
      if (codeLists.length > 0 && !selectedListCode) {
        setSelectedListCode(codeLists[0].code);
      }
    }, [codeLists, selectedListCode]);
  }

  // Selected Code List object
  const activeCodeList = useMemo(() => {
    return codeLists.find(cl => cl.code === selectedListCode) || null;
  }, [codeLists, selectedListCode]);

  // Transform active code list items into a parent-child tree structure
  const treeData = useMemo(() => {
    if (!activeCodeList) return [];
    const items = activeCodeList.codeListItems || [];

    const buildTree = (parentCode: string | null): any[] => {
      return items
        .filter((item: any) => item.parentItemCode === parentCode)
        .map((item: any) => ({
          key: item.itemCode,
          title: `[${item.itemCode}] ${item.itemName}`,
          icon: <TagOutlined style={{ color: '#6366f1' }} />,
          children: buildTree(item.itemCode),
        }));
    };

    return buildTree(null);
  }, [activeCodeList]);

  // Save Mutator
  const saveMutation = useMutation({
    mutationFn: async (values: CodeListFormValues) => {
      const res = await fetch('/api/codelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save code list configuration');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Code list configuration saved.');
      queryClient.invalidateQueries({ queryKey: ['codeListsAll'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving code list configuration.');
    },
  });

  const handleCreateCodeList = () => {
    setDrawerMode('LIST');
    setEditingItem(null);
    setDrawerVisible(true);
  };

  const handleCreateItem = () => {
    setDrawerMode('ITEM');
    setEditingItem(null);
    setDrawerVisible(true);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin tip="Loading code list registry..." />
      </div>
    );
  }

  // Parent item selector options
  const parentItemOptions = activeCodeList
    ? (activeCodeList.codeListItems || []).map((item: any) => ({
        label: `[${item.itemCode}] ${item.itemName}`,
        value: item.itemCode,
      }))
    : [];

  return (
    <div>
      <Row gutter={[24, 24]}>
        {/* Left Side: Code lists selection */}
        <Col xs={24} md={8}>
          <Card
            title="Code Lists Registry"
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateCodeList}>
                Add List
              </Button>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            <List
              dataSource={codeLists}
              renderItem={(list) => (
                <List.Item
                  onClick={() => setSelectedListCode(list.code)}
                  style={{
                    cursor: 'pointer',
                    background: selectedListCode === list.code ? '#6366f112' : 'transparent',
                    borderLeft: selectedListCode === list.code ? '4px solid #6366f1' : '4px solid transparent',
                    padding: '12px 16px',
                    borderRadius: 4,
                    marginBottom: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <List.Item.Meta
                    title={<span style={{ fontWeight: 600 }}>{list.code}</span>}
                    description={
                      <Space direction="vertical" size={0}>
                        <span>{list.name}</span>
                        <Tag color="blue" style={{ marginTop: 4 }}>
                          {list.codeListItems?.length || 0} items
                        </Tag>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Right Side: Items tree manager */}
        <Col xs={24} md={16}>
          <Card
            title={activeCodeList ? `Items Manager: ${activeCodeList.code}` : 'Code List Items'}
            extra={
              <Space>
                <Button icon={<CloudUploadOutlined />}>Bulk Import</Button>
                <Button icon={<CloudDownloadOutlined />}>Export CSV</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateItem} disabled={!activeCodeList}>
                  Add Item
                </Button>
              </Space>
            }
            style={{ borderRadius: 8 }}
          >
            {activeCodeList ? (
              <div style={{ minHeight: 400 }}>
                <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                  {activeCodeList.description || 'Global code list register managing permitted values.'}
                </Paragraph>

                {treeData.length === 0 ? (
                  <AlertMessage />
                ) : (
                  <Tree
                    showIcon
                    defaultExpandAll
                    treeData={treeData}
                    style={{ fontSize: 14 }}
                  />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                Select a code list from the registry panel to inspect records.
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* CodeList / Item drawer */}
      <FormDrawer
        title={drawerMode === 'LIST' ? 'Create Code List' : 'Add Code List Item'}
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        schema={codeListSchema}
        defaultValues={drawerMode === 'LIST' ? {
          action: 'CREATE_CODELIST' as const,
          code: '',
          name: '',
          description: '',
        } : {
          action: 'UPSERT_ITEM' as const,
          codeListCode: selectedListCode || '',
          code: '',
          name: '',
          description: '',
          parentItemCode: '',
          sortOrder: 0,
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
      >
        {(form) => (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Action flag helper */}
            <input type="hidden" {...form.register('action')} />
            {drawerMode === 'ITEM' && (
              <input type="hidden" {...form.register('codeListCode')} />
            )}

            <Form.Item
              label={drawerMode === 'LIST' ? 'List Code' : 'Item Code'}
              required
              help={form.formState.errors.code?.message}
              validateStatus={form.formState.errors.code ? 'error' : ''}
            >
              <Input {...form.register('code')} placeholder="e.g. CL_FREQUENCY or A" />
            </Form.Item>

            <Form.Item
              label={drawerMode === 'LIST' ? 'List Name' : 'Item Name'}
              required
              help={form.formState.errors.name?.message}
              validateStatus={form.formState.errors.name ? 'error' : ''}
            >
              <Input {...form.register('name')} placeholder="e.g. Frequency Codelist or Annual" />
            </Form.Item>

            {drawerMode === 'ITEM' && (
              <>
                <Form.Item label="Parent Item (for Hierarchy)">
                  <Select
                    placeholder="Select parent code item"
                    options={parentItemOptions}
                    value={form.watch('parentItemCode')}
                    onChange={(val) => form.setValue('parentItemCode', val)}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item label="Sort Order">
                  <Input
                    type="number"
                    value={form.watch('sortOrder')}
                    onChange={(e) => form.setValue('sortOrder', parseInt(e.target.value, 10) || 0)}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label="Description">
              <Input.TextArea
                rows={3}
                value={form.watch('description')}
                onChange={(e) => form.setValue('description', e.target.value)}
                placeholder="Enter description..."
              />
            </Form.Item>
          </Space>
        )}
      </FormDrawer>
    </div>
  );
}

function AlertMessage() {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#8c8c8c' }}>
      No code list records found. Click &quot;Add Item&quot; or &quot;Bulk Import&quot; to seed values.
    </div>
  );
}
