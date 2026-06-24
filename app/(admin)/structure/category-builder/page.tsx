'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  Tree,
  Card,
  Spin,
  Alert,
  message,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tabs,
  Form,
  Input,
  Select,
  Switch,
  Table,
  Modal,
  Upload,
  Tooltip,
  Popconfirm,
  Tag
} from 'antd';
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import {
  FolderOutlined,
  ReloadOutlined,
  TableOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownloadOutlined,
  UploadOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import Papa from 'papaparse';

const { Title, Text, Paragraph } = Typography;

// Zod schema for individual category creation/edit
const categoryFormSchema = z.object({
  code: z.string().min(1, 'Category Code is required.'),
  name: z.string().min(1, 'Category Name is required.'),
  description: z.string().optional().nullable(),
  parentCode: z.string().optional().nullable(),
  hierarchyPath: z.string().min(1, 'Hierarchy path is required.'),
  slug: z.string().optional(),
  icon: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  isVisible: z.boolean().default(true),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function CategoryBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const setCode = searchParams.get('setCode') || 'MAIN_NAV';

  // State hooks
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  
  // Local copy of tree structure for drag and drop edits
  const [treeNodes, setTreeNodes] = useState<any[]>([]);

  // React Hook Form for Category General Details
  const categoryForm = useForm<CategoryFormValues>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      parentCode: '',
      hierarchyPath: '',
      slug: '',
      icon: '',
      image: '',
      isVisible: true,
      metaTitle: '',
      metaDescription: '',
    },
  });

  // React Hook Form for new Indicator Assignment
  const assignForm = useForm({
    defaultValues: {
      agencyCode: 'ADB',
      datasetCode: 'KIDB',
      sourceCodeListCode: 'CL_KIDB_INDICATORS',
      indicatorCode: '',
      dataflowCode: '',
      sortOrder: 1,
    },
  });

  // Queries
  // 1. Fetch Category Sets for dropdown
  const { data: categorySets = [] } = useQuery<any[]>({
    queryKey: ['categorySetsList'],
    queryFn: async () => {
      const res = await fetch('/api/category-sets');
      if (!res.ok) throw new Error('Failed to load category sets');
      return res.json();
    },
  });

  // 2. Fetch Categories list under active set
  const { data: categories = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['categoriesList', setCode],
    queryFn: async () => {
      const res = await fetch(`/api/front-end-categories?categorySetCode=${setCode}`);
      if (!res.ok) throw new Error('Failed to load categories');
      return res.json();
    },
  });

  // 3. Fetch drop down parameters for indicator assignments
  const { data: agencies = [] } = useQuery<any[]>({
    queryKey: ['agenciesList'],
    queryFn: async () => {
      const res = await fetch('/api/agencies');
      if (!res.ok) throw new Error('Failed to load agencies');
      return res.json();
    },
  });

  const { data: datasets = [] } = useQuery<any[]>({
    queryKey: ['datasetsList'],
    queryFn: async () => {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Failed to load datasets');
      return res.json();
    },
  });

  const { data: codelists = [] } = useQuery<any[]>({
    queryKey: ['codelistsList'],
    queryFn: async () => {
      const res = await fetch('/api/codelists');
      if (!res.ok) throw new Error('Failed to load codelists');
      return res.json();
    },
  });

  const { data: dataflows = [] } = useQuery<any[]>({
    queryKey: ['dataflowsList'],
    queryFn: async () => {
      const res = await fetch('/api/dataflows');
      if (!res.ok) throw new Error('Failed to load dataflows');
      return res.json();
    },
  });

  // Dynamic filter for indicator search
  const selectedCodelistCode = assignForm.watch('sourceCodeListCode');
  const availableIndicators = useMemo(() => {
    const list = codelists.find((cl) => cl.code === selectedCodelistCode);
    return list?.codeListItems || [];
  }, [codelists, selectedCodelistCode]);

  const selectedDatasetCode = assignForm.watch('datasetCode');
  const availableDataflows = useMemo(() => {
    return dataflows.filter((df) => df.datasetCode === selectedDatasetCode);
  }, [dataflows, selectedDatasetCode]);

  // Restrict codelist options to indicator-relevant ones based on Dataset scope
  const filteredCodelists = useMemo(() => {
    const targetCodelistCode = `CL_${selectedDatasetCode}_INDICATORS`;
    return codelists.filter((c) => c.code === targetCodelistCode);
  }, [codelists, selectedDatasetCode]);

  // Auto-select correct codelist when Dataset Scope changes
  useEffect(() => {
    if (selectedDatasetCode) {
      assignForm.setValue('sourceCodeListCode', `CL_${selectedDatasetCode}_INDICATORS`);
    }
  }, [selectedDatasetCode, assignForm]);

  // Transform flat categories into Antd Tree nodes structure (nesting indicators as leaf nodes)
  const buildVisualTree = (flatCategories: any[], parentCode: string | null): any[] => {
    return flatCategories
      .filter((c) => c.parentCode === parentCode)
      .map((c) => {
        // Build subcategory children
        const subCatChildren = buildVisualTree(flatCategories, c.code);
        
        // Build indicator children, sorted by their sortOrder
        const indicatorChildren = (c.indicators || []).map((mi: any) => ({
          key: `indicator|${mi.id}|${mi.indicatorCode}|${mi.datasetCode}|${c.code}`,
          title: `[${c.hierarchyPath}.${mi.indicatorCode}] ${mi.codeListItem?.itemName || mi.indicatorCode} (${mi.datasetCode})`,
          icon: <TableOutlined style={{ color: '#8b5cf6' }} />,
          isLeaf: true,
          code: mi.indicatorCode,
          datasetCode: mi.datasetCode,
          categoryCode: c.code,
          id: mi.id,
        }));
        
        return {
          key: `category|${c.code}`,
          title: `[${c.hierarchyPath}] ${c.name}`,
          icon: <FolderOutlined style={{ color: '#10b981' }} />,
          code: c.code,
          hierarchyPath: c.hierarchyPath,
          children: [...subCatChildren, ...indicatorChildren],
        };
      });
  };

  // Sync flat categories query data to local treeNodes state
  useEffect(() => {
    if (categories.length > 0) {
      setTreeNodes(buildVisualTree(categories, null));
    } else {
      setTreeNodes([]);
    }
  }, [categories]);

  // Helper state to check if selected tree node is an indicator node
  const isSelectedNodeIndicator = useMemo(() => {
    return selectedNodeKey ? selectedNodeKey.startsWith('indicator|') : false;
  }, [selectedNodeKey]);

  // Set general details form values when selecting a category node
  const activeCategory = useMemo(() => {
    if (!selectedNodeKey) return null;
    const code = selectedNodeKey.split('|')[1];
    return categories.find((c) => c.code === code) || null;
  }, [selectedNodeKey, categories]);

  useEffect(() => {
    if (activeCategory) {
      categoryForm.reset({
        code: activeCategory.code,
        name: activeCategory.name,
        description: activeCategory.description || '',
        parentCode: activeCategory.parentCode || '',
        hierarchyPath: activeCategory.hierarchyPath,
        slug: activeCategory.slug || '',
        icon: activeCategory.icon || '',
        image: activeCategory.image || '',
        isVisible: activeCategory.isVisible,
        metaTitle: activeCategory.metaTitle || '',
        metaDescription: activeCategory.metaDescription || '',
      });
    }
  }, [activeCategory, categoryForm]);

  // Mutations
  // 1. Individual Category Upsert (POST)
  const upsertCategoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const res = await fetch('/api/front-end-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, categorySetCode: setCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save category');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Category details saved.');
      refetch();
      setCreateModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving category.');
    },
  });

  // 2. Delete Category (DELETE)
  const deleteCategoryMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/front-end-categories?categorySetCode=${setCode}&code=${code}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete category');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Category deleted successfully.');
      setSelectedNodeKey(null);
      refetch();
    },
    onError: (err: any) => {
      message.error(err.message || 'Error deleting category.');
    },
  });

  // 3. Bulk Tree updates (PUT)
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      const res = await fetch('/api/front-end-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorySetCode: setCode, updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update hierarchy');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Hierarchy updated successfully.');
      refetch();
    },
    onError: (err: any) => {
      message.error(err.message || 'Error updating category structure.');
    },
  });

  // 4. Save Indicator Mappings (POST)
  const saveAssignmentsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/front-end-categories/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save assignments');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Indicator assignments saved.');
      refetch();
      setAssignModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.message || 'Error saving mappings.');
    },
  });

  // 5. Bulk Indicator Position updates (PUT)
  const bulkUpdateIndicatorsMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      const res = await fetch('/api/front-end-categories/indicators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorySetCode: setCode, updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update indicators positions');
      }
      return res.json();
    },
    onSuccess: () => {
      message.success('Indicator position updated successfully.');
      refetch();
    },
    onError: (err: any) => {
      message.error(err.message || 'Error updating indicator placement.');
    },
  });

  // Helper to rebuild hierarchy paths sequentially after drops (ignoring indicators)
  const rebuildPaths = (nodes: any[], parentPath: string = '', parentCode: string | null = null): any[] => {
    const updates: any[] = [];
    let categoryIndex = 1;
    nodes.forEach((node) => {
      const parts = node.key.split('|');
      const type = parts[0];
      if (type !== 'category') return;

      const code = parts[1];
      const segment = categoryIndex.toString();
      const hierarchyPath = parentPath ? `${parentPath}.${segment}` : segment;
      const depthLevel = hierarchyPath.split('.').length;

      updates.push({
        code,
        parentCode,
        hierarchyPath,
        depthLevel,
        sortOrder: categoryIndex,
      });

      categoryIndex++;

      if (node.children && node.children.length > 0) {
        const childUpdates = rebuildPaths(node.children, hierarchyPath, code);
        updates.push(...childUpdates);
      }
    });
    return updates;
  };

  // Helper to rebuild indicator assignments and positions across categories
  const rebuildPathsAndAssignments = (nodes: any[], parentPath: string = '', parentCode: string | null = null) => {
    const categoryUpdates: any[] = [];
    const indicatorUpdates: any[] = [];

    const traverse = (nodeList: any[], currParentPath: string, currParentCode: string | null) => {
      let categoryIndex = 1;
      let indicatorIndex = 1;

      nodeList.forEach((node) => {
        const parts = node.key.split('|');
        const type = parts[0];

        if (type === 'category') {
          const code = parts[1];
          const segment = categoryIndex.toString();
          const hierarchyPath = currParentPath ? `${currParentPath}.${segment}` : segment;
          const depthLevel = hierarchyPath.split('.').length;

          categoryUpdates.push({
            code,
            parentCode: currParentCode,
            hierarchyPath,
            depthLevel,
            sortOrder: categoryIndex,
          });

          categoryIndex++;

          if (node.children && node.children.length > 0) {
            traverse(node.children, hierarchyPath, code);
          }
        } else if (type === 'indicator') {
          const id = parts[1];
          const indicatorCode = parts[2];
          const datasetCode = parts[3];
          const oldCategoryCode = parts[4];
          const categoryCode = currParentCode || oldCategoryCode;

          indicatorUpdates.push({
            id,
            indicatorCode,
            datasetCode,
            categoryCode,
            sortOrder: indicatorIndex,
          });

          indicatorIndex++;
        }
      });
    };

    traverse(nodes, parentPath, parentCode);
    return { categoryUpdates, indicatorUpdates };
  };

  // Ant Design Tree Drop Handler
  const handleDrop = (info: any) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    const dragType = dragKey.split('|')[0];
    const dropType = dropKey.split('|')[0];

    // Validation 1: Cannot nest under an indicator node (indicators are leaf nodes)
    if (!info.dropToGap && dropType === 'indicator') {
      message.warning('Cannot nest nodes under indicator leaf nodes.');
      return;
    }

    // Validation 2: Cannot nest indicator under indicator via drop to gap expanding children
    if (dragType === 'indicator' && dropType === 'indicator' && !info.dropToGap) {
      message.warning('Cannot nest indicators under other indicators.');
      return;
    }

    const loop = (data: any[], key: string, callback: (item: any, index: number, arr: any[]) => void) => {
      for (let i = 0; i < data.length; i++) {
        if (data[i].key === key) {
          return callback(data[i], i, data);
        }
        if (data[i].children) {
          loop(data[i].children, key, callback);
        }
      }
    };
    const data = JSON.parse(JSON.stringify(treeNodes)); // deep clone

    // Find dragObject
    let dragObj: any;
    loop(data, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!info.dropToGap) {
      // Drop on the node itself (nest under it)
      loop(data, dropKey, (item) => {
        item.children = item.children || [];
        item.children.push(dragObj);
      });
    } else if (
      (info.node.children || []).length > 0 &&
      info.node.expanded &&
      dropPosition === 1
    ) {
      loop(data, dropKey, (item) => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else {
      let ar: any[] = [];
      let i = 0;
      loop(data, dropKey, (_item, index, arr) => {
        ar = arr;
        i = index;
      });
      if (dropPosition === -1) {
        ar.splice(i, 0, dragObj);
      } else {
        ar.splice(i + 1, 0, dragObj);
      }
    }

    // Check if any indicator ended up at the root level
    const hasRootIndicator = data.some((node: any) => node.key.startsWith('indicator|'));
    if (hasRootIndicator) {
      message.warning('Indicators must be nested inside category folders, not placed at the root level.');
      return;
    }

    setTreeNodes(data);

    if (dragType === 'category') {
      const updates = rebuildPaths(data);
      bulkUpdateMutation.mutate(updates);
    } else {
      const { indicatorUpdates } = rebuildPathsAndAssignments(data);
      bulkUpdateIndicatorsMutation.mutate(indicatorUpdates);
    }
  };

  // Indent Selected Node (move it as a child of its previous sibling)
  const handleIndent = () => {
    if (!selectedNodeKey) return;
    const code = selectedNodeKey.split('|')[1];

    const data = JSON.parse(JSON.stringify(treeNodes));
    let indentItem: any = null;
    let found = false;

    const traverseAndIndent = (nodes: any[]): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].code === code) {
          if (i > 0) {
            indentItem = nodes[i];
            nodes.splice(i, 1); // Remove from current parent
            nodes[i - 1].children = nodes[i - 1].children || [];
            nodes[i - 1].children.push(indentItem); // Nest under sibling
            return true;
          }
          message.warning('Cannot indent first sibling.');
          return false;
        }
        if (nodes[i].children && nodes[i].children.length > 0) {
          if (traverseAndIndent(nodes[i].children)) return true;
        }
      }
      return false;
    };

    if (traverseAndIndent(data)) {
      setTreeNodes(data);
      const updates = rebuildPaths(data);
      bulkUpdateMutation.mutate(updates);
    }
  };

  // Outdent Selected Node (move it up to its grandparent level)
  const handleOutdent = () => {
    if (!selectedNodeKey) return;
    const code = selectedNodeKey.split('|')[1];

    const data = JSON.parse(JSON.stringify(treeNodes));
    let outdentItem: any = null;

    const traverseAndOutdent = (nodes: any[], parentNodes: any[] | null = null, parentIndex: number = -1): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].code === code) {
          if (parentNodes && parentNodes.length > 0) {
            outdentItem = nodes[i];
            nodes.splice(i, 1); // Remove from parent
            
            // Insert after parent in grandparent array
            if (parentNodes === data) {
              data.splice(parentIndex + 1, 0, outdentItem);
            } else {
              // Find parent node index in grandparent children array
              parentNodes.splice(parentIndex + 1, 0, outdentItem);
            }
            return true;
          }
          message.warning('Already at root level.');
          return false;
        }
        if (nodes[i].children && nodes[i].children.length > 0) {
          if (traverseAndOutdent(nodes[i].children, nodes, i)) return true;
        }
      }
      return false;
    };

    if (traverseAndOutdent(data, null, -1)) {
      setTreeNodes(data);
      const updates = rebuildPaths(data);
      bulkUpdateMutation.mutate(updates);
    }
  };

  // Export Category Structure to CSV
  const handleExportStructure = () => {
    if (categories.length === 0) {
      message.warning('No categories to export.');
      return;
    }
    const csvData = categories.map((c) => ({
      'Category Code': c.code,
      'Category Name': c.name,
      'Hierarchy': c.hierarchyPath,
      'Description': c.description || '',
      'Visible': c.isVisible ? 'true' : 'false',
    }));

    const csvContent = Papa.unparse(csvData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${setCode}_categories_structure_${Date.now()}.csv`;
    link.click();
  };

  // Export Indicators Assignments to CSV
  const handleExportIndicators = () => {
    const list: any[] = [];
    categories.forEach((c) => {
      const assigned = c.indicators || [];
      assigned.forEach((mi: any) => {
        list.push({
          'Agency': mi.agencyCode,
          'Dataset': mi.datasetCode,
          'Indicator Code List': mi.sourceCodeListCode,
          'Indicator Code': mi.indicatorCode,
          'Dataflow': mi.dataflowCode || '',
          'Category Code': c.code,
          'Order': mi.sortOrder,
        });
      });
    });

    if (list.length === 0) {
      message.warning('No indicator assignments to export.');
      return;
    }

    const csvContent = Papa.unparse(list);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${setCode}_category_indicators_${Date.now()}.csv`;
    link.click();
  };

  // Handle CSV Import Submit
  const [importType, setImportType] = useState<'structure' | 'indicators'>('structure');
  const [fileList, setFileList] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleImportSubmit = () => {
    if (fileList.length === 0) {
      message.error('Please select a CSV file.');
      return;
    }

    setImporting(true);
    setImportErrors([]);

    const file = fileList[0].originFileObj;
    const reader = new FileReader();

    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const res = await fetch('/api/front-end-categories/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                categorySetCode: setCode,
                importType,
                rows: results.data,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              setImportErrors(data.errors || [data.error || 'Failed to import CSV.']);
              message.error('Import failed validation.');
            } else {
              message.success(data.message || 'Imported successfully.');
              setImportModalVisible(false);
              setFileList([]);
              refetch();
            }
          } catch (err: any) {
            setImportErrors([err.message || 'Error sending import request.']);
          } finally {
            setImporting(false);
          }
        },
        error: (err: any) => {
          setImportErrors([err.message || 'Error parsing CSV file.']);
          setImporting(false);
        },
      });
    };

    reader.readAsText(file);
  };

  // Add Indicator Assignment Submit
  const handleAssignIndicator = (values: any) => {
    if (!activeCategory) return;
    const currentAssignments = activeCategory.indicators || [];

    // Map existing indicators and append new one
    const payloadAssignments = currentAssignments.map((mi: any) => ({
      agencyCode: mi.agencyCode,
      datasetCode: mi.datasetCode,
      sourceCodeListCode: mi.sourceCodeListCode,
      indicatorCode: mi.indicatorCode,
      dataflowCode: mi.dataflowCode || null,
      sortOrder: mi.sortOrder,
    }));

    payloadAssignments.push({
      agencyCode: values.agencyCode,
      datasetCode: values.datasetCode,
      sourceCodeListCode: values.sourceCodeListCode,
      indicatorCode: values.indicatorCode,
      dataflowCode: values.dataflowCode || null,
      sortOrder: values.sortOrder,
    });

    saveAssignmentsMutation.mutate({
      categorySetCode: setCode,
      categoryCode: activeCategory.code,
      assignments: payloadAssignments,
    });
  };

  // Delete Indicator Assignment
  const handleDeleteAssignment = (record: any) => {
    if (!activeCategory) return;
    const currentAssignments = activeCategory.indicators || [];

    // Filter out target indicator mapping
    const payloadAssignments = currentAssignments
      .filter((mi: any) => 
        !(mi.datasetCode === record.datasetCode && 
          mi.sourceCodeListCode === record.sourceCodeListCode && 
          mi.indicatorCode === record.indicatorCode)
      )
      .map((mi: any) => ({
        agencyCode: mi.agencyCode,
        datasetCode: mi.datasetCode,
        sourceCodeListCode: mi.sourceCodeListCode,
        indicatorCode: mi.indicatorCode,
        dataflowCode: mi.dataflowCode || null,
        sortOrder: mi.sortOrder,
      }));

    saveAssignmentsMutation.mutate({
      categorySetCode: setCode,
      categoryCode: activeCategory.code,
      assignments: payloadAssignments,
    });
  };

  // Create individual Category submit (Modal)
  const handleCreateCategory = (values: CategoryFormValues) => {
    upsertCategoryMutation.mutate(values);
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3}>Visual Hierarchy Builder</Title>
          <Text type="secondary">
            Manage category structures, menu nodes, and indicator mappings for client websites.
          </Text>
        </div>
        <div>
          <Space>
            <Text strong>Active Category Set:</Text>
            <Select
              style={{ width: 220 }}
              value={setCode}
              onChange={(val) => router.push(`/structure/category-builder?setCode=${val}`)}
              options={categorySets.map((s) => ({ label: s.name, value: s.code }))}
            />
          </Space>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Tree Column */}
        <Col xs={24} lg={10}>
          <Card
            title="Category Navigation Tree"
            styles={{ body: { padding: '16px 24px' } }}
            style={{ borderRadius: 8, height: '100%' }}
            extra={
              <Space>
                <Tooltip title="Create new category node">
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      categoryForm.reset({
                        code: '',
                        name: '',
                        description: '',
                        parentCode: activeCategory?.code || '',
                        hierarchyPath: activeCategory ? `${activeCategory.hierarchyPath}.1` : '1',
                        isVisible: true,
                      });
                      setCreateModalVisible(true);
                    }}
                  >
                    Add Category
                  </Button>
                </Tooltip>
                <Tooltip title="Upload Category CSV file">
                  <Button size="small" icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
                    Import
                  </Button>
                </Tooltip>
                <Tooltip title="Download Categories structure CSV">
                  <Button size="small" icon={<DownloadOutlined />} onClick={handleExportStructure}>
                    Export
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            <div style={{ marginBottom: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12 }}>
              <Space>
                <Button
                  size="small"
                  icon={<ArrowLeftOutlined />}
                  onClick={handleOutdent}
                  disabled={!selectedNodeKey || isSelectedNodeIndicator}
                >
                  Outdent
                </Button>
                <Button
                  size="small"
                  icon={<ArrowRightOutlined />}
                  onClick={handleIndent}
                  disabled={!selectedNodeKey || isSelectedNodeIndicator}
                >
                  Indent
                </Button>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
                  Refresh
                </Button>
              </Space>
            </div>

            {isLoading ? (
              <Spin style={{ width: '100%', padding: '40px 0' }} />
            ) : treeNodes.length === 0 ? (
              <Alert
                message="No classification nodes found."
                description="Use 'Add Category' above or import a CSV configuration template to initialize the tree."
                type="info"
                showIcon
              />
            ) : (
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 6, minHeight: 400 }}>
                <Tree
                  showIcon
                  draggable
                  blockNode
                  defaultExpandAll
                  onDrop={handleDrop}
                  treeData={treeNodes}
                  onSelect={(keys) => setSelectedNodeKey(keys.length > 0 ? (keys[0] as string) : null)}
                  style={{ fontSize: 14 }}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* Right Details/Mapping Column */}
        <Col xs={24} lg={14}>
          {!selectedNodeKey ? (
            <Card style={{ borderRadius: 8, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <InfoCircleOutlined style={{ fontSize: 32, marginBottom: 16 }} />
                <Paragraph style={{ fontSize: 16 }}>Select a category from the tree on the left to edit details or assign indicators.</Paragraph>
              </div>
            </Card>
          ) : (
            <Card
              title={activeCategory ? `Category Details: [${activeCategory.code}] ${activeCategory.name}` : 'Category Editor'}
              style={{ borderRadius: 8 }}
              extra={
                <Popconfirm
                  title="Are you sure to delete this category?"
                  description="Sub-indicators assigned will lose mapping."
                  onConfirm={() => activeCategory && deleteCategoryMutation.mutate(activeCategory.code)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                    Delete Category
                  </Button>
                </Popconfirm>
              }
            >
              <Tabs
                defaultActiveKey="details"
                items={[
                  {
                    key: 'details',
                    label: <span><InfoCircleOutlined /> General Details</span>,
                    children: (
                      <Form
                        layout="vertical"
                        onFinish={categoryForm.handleSubmit((data) => upsertCategoryMutation.mutate(data))}
                        style={{ marginTop: 16 }}
                      >
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item label="Category Code" required>
                              <Controller
                                name="code"
                                control={categoryForm.control}
                                render={({ field }) => <Input {...field} disabled />}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Hierarchy Path" required>
                              <Controller
                                name="hierarchyPath"
                                control={categoryForm.control}
                                render={({ field }) => <Input {...field} disabled />}
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item label="Category Name" required>
                          <Controller
                            name="name"
                            control={categoryForm.control}
                            render={({ field }) => <Input {...field} placeholder="e.g. Economy and Output" />}
                          />
                        </Form.Item>

                        <Form.Item label="Description">
                          <Controller
                            name="description"
                            control={categoryForm.control}
                            render={({ field: { value, ...fieldWithoutValue } }) => (
                              <Input.TextArea {...fieldWithoutValue} value={value || ''} rows={3} placeholder="Describe details..." />
                            )}
                          />
                        </Form.Item>

                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item label="Custom Icon (AntD name)">
                              <Controller
                                name="icon"
                                control={categoryForm.control}
                                render={({ field: { value, ...fieldWithoutValue } }) => (
                                  <Input {...fieldWithoutValue} value={value || ''} placeholder="e.g. BankOutlined" />
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Custom Image URL">
                              <Controller
                                name="image"
                                control={categoryForm.control}
                                render={({ field: { value, ...fieldWithoutValue } }) => (
                                  <Input {...fieldWithoutValue} value={value || ''} placeholder="e.g. /images/economy.png" />
                                )}
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item label="Is Visible on Site Menu" valuePropName="checked">
                          <Controller
                            name="isVisible"
                            control={categoryForm.control}
                            render={({ field: { value, ...fieldWithoutValue } }) => (
                              <Switch {...fieldWithoutValue} checked={!!value} />
                            )}
                          />
                        </Form.Item>

                        <Card size="small" title="SEO Fields" style={{ background: 'rgba(255, 255, 255, 0.01)', marginBottom: 20 }}>
                          <Form.Item label="SEO Meta Title">
                            <Controller
                              name="metaTitle"
                              control={categoryForm.control}
                              render={({ field: { value, ...fieldWithoutValue } }) => (
                                <Input {...fieldWithoutValue} value={value || ''} placeholder="Search title..." />
                              )}
                            />
                          </Form.Item>
                          <Form.Item label="SEO Meta Description">
                            <Controller
                              name="metaDescription"
                              control={categoryForm.control}
                              render={({ field: { value, ...fieldWithoutValue } }) => (
                                <Input.TextArea {...fieldWithoutValue} value={value || ''} rows={2} placeholder="Search description snippets..." />
                              )}
                            />
                          </Form.Item>
                        </Card>

                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={upsertCategoryMutation.isPending}>
                          Save Category Details
                        </Button>
                      </Form>
                    ),
                  },
                  {
                    key: 'indicators',
                    label: <span><TableOutlined /> Assigned Indicators</span>,
                    children: (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                          <Text type="secondary">Map indicators from any dataset, source list, or dataflow under this category.</Text>
                          <Space>
                            <Button size="small" icon={<DownloadOutlined />} onClick={handleExportIndicators}>Export Assignments</Button>
                            <Button type="primary" size="small" icon={<LinkOutlined />} onClick={() => setAssignModalVisible(true)}>Assign Indicator</Button>
                          </Space>
                        </div>

                        <Table
                          dataSource={activeCategory?.indicators || []}
                          rowKey={(record) => `${record.datasetCode}-${record.sourceCodeListCode}-${record.indicatorCode}`}
                          size="small"
                          columns={[
                            {
                              title: 'Dataset',
                              dataIndex: 'datasetCode',
                              key: 'datasetCode',
                            },
                            {
                              title: 'Indicator List',
                              dataIndex: 'sourceCodeListCode',
                              key: 'sourceCodeListCode',
                            },
                            {
                              title: 'Code',
                              dataIndex: 'indicatorCode',
                              key: 'indicatorCode',
                              render: (val: string) => <Tag color="purple">{val}</Tag>,
                            },
                            {
                              title: 'Name',
                              key: 'name',
                              render: (_: any, record: any) => `${record.codeListItem?.itemName || record.indicatorCode} (${record.datasetCode})`,
                            },
                            {
                              title: 'Order ID',
                              dataIndex: 'sortOrder',
                              key: 'sortOrder',
                            },
                            {
                              title: 'Actions',
                              key: 'actions',
                              render: (_: any, record: any) => (
                                <Popconfirm
                                  title="Unassign indicator?"
                                  onConfirm={() => handleDeleteAssignment(record)}
                                >
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />}>Unassign</Button>
                                </Popconfirm>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* MODAL 1: Create Category Node */}
      <Modal
        title="Create Category Node"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical" onFinish={categoryForm.handleSubmit(handleCreateCategory)}>
          <Form.Item label="Category Code (Unique)" required help="e.g. PPL_POP">
            <Controller
              name="code"
              control={categoryForm.control}
              render={({ field }) => <Input {...field} placeholder="e.g. ECO_GDP" />}
            />
          </Form.Item>

          <Form.Item label="Category Name" required>
            <Controller
              name="name"
              control={categoryForm.control}
              render={({ field }) => <Input {...field} placeholder="e.g. Gross Domestic Product" />}
            />
          </Form.Item>

          <Form.Item label="Hierarchy Path" required help="Dotted sequential hierarchy path.">
            <Controller
              name="hierarchyPath"
              control={categoryForm.control}
              render={({ field }) => <Input {...field} placeholder="e.g. 1.2.1" />}
            />
          </Form.Item>

          <Form.Item label="Parent Code (Optional)">
            <Controller
              name="parentCode"
              control={categoryForm.control}
              render={({ field }) => (
                <Select
                  {...field}
                  allowClear
                  options={categories.map((c) => ({ label: `[${c.code}] ${c.name}`, value: c.code }))}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Description">
            <Controller
              name="description"
              control={categoryForm.control}
              render={({ field: { value, ...fieldProps } }) => (
                <Input.TextArea {...fieldProps} value={value || ''} rows={2} />
              )}
            />
          </Form.Item>

          <Form.Item label="Is Visible Prop" valuePropName="checked">
            <Controller
              name="isVisible"
              control={categoryForm.control}
              render={({ field: { value, ...fieldWithoutValue } }) => <Switch {...fieldWithoutValue} checked={!!value} />}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setCreateModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={upsertCategoryMutation.isPending}>Create Category</Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 2: Assign Indicator */}
      <Modal
        title="Map Indicator Assignment"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        footer={null}
        width={550}
      >
        <Form layout="vertical" onFinish={assignForm.handleSubmit(handleAssignIndicator)}>
          <Form.Item label="Agency Scope" required>
            <Controller
              name="agencyCode"
              control={assignForm.control}
              render={({ field }) => (
                <Select {...field} options={agencies.map((a) => ({ label: `[${a.code}] ${a.name}`, value: a.code }))} />
              )}
            />
          </Form.Item>

          <Form.Item label="Dataset Scope" required>
            <Controller
              name="datasetCode"
              control={assignForm.control}
              render={({ field }) => (
                <Select {...field} options={datasets.map((d) => ({ label: `[${d.code}] ${d.name}`, value: d.code }))} />
              )}
            />
          </Form.Item>

          <Form.Item label="Source Code List" required>
            <Controller
              name="sourceCodeListCode"
              control={assignForm.control}
              render={({ field }) => (
                <Select {...field} options={filteredCodelists.map((c) => ({ label: `[${c.code}] ${c.name}`, value: c.code }))} />
              )}
            />
          </Form.Item>

          <Form.Item label="Indicator" required>
            <Controller
              name="indicatorCode"
              control={assignForm.control}
              render={({ field }) => (
                <Select
                  {...field}
                  showSearch
                  placeholder="Search and select indicator"
                  optionFilterProp="label"
                  options={availableIndicators.map((item: any) => ({
                    label: `[${item.itemCode}] ${item.itemName}`,
                    value: item.itemCode,
                  }))}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Dataflow Reference (Optional)">
            <Controller
              name="dataflowCode"
              control={assignForm.control}
              render={({ field }) => (
                <Select
                  {...field}
                  allowClear
                  placeholder="Optionally link directly to a dataflow"
                  options={availableDataflows.map((df: any) => ({
                    label: `[${df.code}] ${df.name}`,
                    value: df.code,
                  }))}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Indicator Sort Order ID" required help="Order ID must be unique under this category.">
            <Controller
              name="sortOrder"
              control={assignForm.control}
              render={({ field }) => <Input {...field} type="number" />}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setAssignModalVisible(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saveAssignmentsMutation.isPending}>Map Indicator</Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 3: Import CSV */}
      <Modal
        title="Import Visual Hierarchy Structure"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Import Type:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={importType}
              onChange={(val) => {
                setImportType(val);
                setFileList([]);
                setImportErrors([]);
              }}
              options={[
                { label: 'Category Structure CSV (Menu / Categories)', value: 'structure' },
                { label: 'Category Indicators Assignments CSV', value: 'indicators' },
              ]}
            />
          </div>

          <Card size="small" style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
            {importType === 'structure' ? (
              <div>
                <Paragraph strong style={{ marginBottom: 4 }}>Required Structure Headers:</Paragraph>
                <Paragraph code style={{ fontSize: 13 }}>Category Code, Category Name, Hierarchy, Description, Visible</Paragraph>
              </div>
            ) : (
              <div>
                <Paragraph strong style={{ marginBottom: 4 }}>Required Indicators Headers:</Paragraph>
                <Paragraph code style={{ fontSize: 13 }}>Agency, Dataset, Indicator Code List, Indicator Code, Dataflow, Category Code, Order</Paragraph>
              </div>
            )}
          </Card>

          <Upload
            accept=".csv"
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList.slice(-1))}
          >
            <Button icon={<UploadOutlined />}>Select CSV File</Button>
          </Upload>

          {importErrors.length > 0 && (
            <Alert
              message="CSV Import Validation Errors"
              description={
                <ul style={{ paddingLeft: 16, marginBottom: 0, maxHeight: 150, overflowY: 'auto' }}>
                  {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              }
              type="error"
              showIcon
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setImportModalVisible(false)}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleImportSubmit}
              loading={importing}
              disabled={fileList.length === 0}
            >
              Start Import
            </Button>
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default function CategoryBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}><Spin description="Loading visual hierarchy builder..." /></div>}>
      <CategoryBuilderContent />
    </Suspense>
  );
}
