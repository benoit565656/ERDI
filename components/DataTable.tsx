'use client';

import React, { useState, useMemo } from 'react';
import { Table, Input, Button, Space, Dropdown, Checkbox, MenuProps, Tooltip } from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  SettingOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

interface DataTableProps<T> {
  columns: any[];
  dataSource: T[];
  loading?: boolean;
  rowKey?: string | ((record: T) => string);
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onRefresh?: () => void;
  // Bulk Actions
  bulkActions?: {
    label: string;
    icon?: React.ReactNode;
    type?: 'default' | 'primary' | 'dashed' | 'link' | 'text' | 'danger';
    onClick: (selectedKeys: React.Key[], selectedRows: T[]) => void;
  }[];
  // Pagination config
  pagination?: any;
  onChange?: (pagination: any, filters: any, sorter: any) => void;
}

export default function DataTable<T extends object>({
  columns,
  dataSource,
  loading = false,
  rowKey = 'id',
  searchPlaceholder = 'Search records...',
  onSearch,
  onRefresh,
  bulkActions = [],
  pagination,
  onChange,
}: DataTableProps<T>) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() =>
    columns.map((col) => col.key || col.dataIndex || '')
  );

  const [searchInput, setSearchInput] = useState('');

  // Handle column selection dropdown changes
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Build the dynamic visible columns list
  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      const colKey = col.key || col.dataIndex || '';
      return visibleColumnKeys.includes(colKey);
    });
  }, [columns, visibleColumnKeys]);

  // Export to CSV helper
  const handleExportCsv = () => {
    if (dataSource.length === 0) return;
    
    // Get headers
    const headers = columns
      .filter((col) => col.title && typeof col.title === 'string')
      .map((col) => col.title);

    const dataIndexKeys = columns
      .filter((col) => col.title && typeof col.title === 'string')
      .map((col) => col.dataIndex || col.key || '');

    const csvContent = [
      headers.join(','),
      ...dataSource.map((row: any) =>
        dataIndexKeys
          .map((key) => {
            const cell = row[key];
            const cellStr = cell !== null && cell !== undefined ? cell.toString() : '';
            // Escape quotes
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',')
      ),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Row selection configuration
  const rowSelection = useMemo(() => {
    if (bulkActions.length === 0) return undefined;
    return {
      selectedRowKeys,
      onChange: (keys: React.Key[], rows: T[]) => {
        setSelectedRowKeys(keys);
        setSelectedRows(rows);
      },
    };
  }, [bulkActions, selectedRowKeys]);

  // Handle search input trigger
  const handleSearchTrigger = (val: string) => {
    if (onSearch) {
      onSearch(val);
    }
  };

  // Column selection items for the settings dropdown
  const columnSelectionMenu: MenuProps = {
    items: columns
      .filter((col) => col.title && typeof col.title === 'string')
      .map((col) => {
        const colKey = col.key || col.dataIndex || '';
        return {
          key: colKey,
          label: (
            <Checkbox
              checked={visibleColumnKeys.includes(colKey)}
              onChange={() => toggleColumnVisibility(colKey)}
            >
              {col.title}
            </Checkbox>
          ),
        };
      }),
  };

  return (
    <div style={{ background: 'transparent', width: '100%' }}>
      {/* Top Toolbar panel */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Left Side: Search & Bulk Actions */}
        <Space size="middle" style={{ flexWrap: 'wrap' }}>
          {onSearch && (
            <Input
              placeholder={searchPlaceholder}
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => handleSearchTrigger(searchInput)}
              style={{ width: 280 }}
              allowClear
            />
          )}

          {/* Render Active Bulk Actions Toolbar */}
          {selectedRowKeys.length > 0 && (
            <Space
              style={{
                background: '#6366f112',
                border: '1px solid #6366f133',
                padding: '4px 12px',
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>
                {selectedRowKeys.length} selected
              </span>
              {bulkActions.map((action, idx) => (
                <Button
                  key={idx}
                  size="small"
                  type={action.type === 'danger' ? 'primary' : action.type || 'default'}
                  danger={action.type === 'danger'}
                  icon={action.icon}
                  onClick={() => {
                    action.onClick(selectedRowKeys, selectedRows);
                    setSelectedRowKeys([]); // Reset selection
                    setSelectedRows([]);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          )}
        </Space>

        {/* Right Side: Options & Exporters */}
        <Space size="small">
          <Tooltip title="Export to CSV">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportCsv}
              disabled={dataSource.length === 0}
            >
              Export CSV
            </Button>
          </Tooltip>

          {onRefresh && (
            <Tooltip title="Refresh data">
              <Button icon={<ReloadOutlined />} onClick={onRefresh} />
            </Tooltip>
          )}

          <Dropdown menu={columnSelectionMenu} trigger={['click']} placement="bottomRight">
            <Button icon={<SettingOutlined />} title="Columns" />
          </Dropdown>
        </Space>
      </div>

      {/* Main Table view */}
      <Table
        loading={loading}
        columns={filteredColumns}
        dataSource={dataSource}
        rowKey={rowKey}
        rowSelection={rowSelection}
        pagination={
          pagination === false
            ? false
            : {
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} records`,
                ...pagination,
              }
        }
        onChange={onChange}
        style={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
