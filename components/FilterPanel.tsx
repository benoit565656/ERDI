'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Input, Select, Col, Row, Space, Collapse } from 'antd';
import { FilterOutlined, ClearOutlined, SearchOutlined } from '@ant-design/icons';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: { label: string; value: string | number }[];
  loading?: boolean;
  onChange?: (value: any) => void;
}

interface FilterPanelProps {
  fields: FilterField[];
  onSearch: (values: Record<string, any>) => void;
  onReset: () => void;
  initialValues?: Record<string, any>;
  collapsedDefault?: boolean;
}

export default function FilterPanel({
  fields,
  onSearch,
  onReset,
  initialValues = {},
  collapsedDefault = false,
}: FilterPanelProps) {
  const [form] = Form.useForm();
  const [collapsed, setCollapsed] = useState(collapsedDefault);

  // Sync initial values with form
  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues, form]);

  const handleFinish = (values: any) => {
    // Strip empty values
    const cleanedValues = Object.keys(values).reduce((acc: any, key) => {
      const val = values[key];
      if (val !== undefined && val !== null && val !== '') {
        acc[key] = val;
      }
      return acc;
    }, {});
    onSearch(cleanedValues);
  };

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  // Renders the individual form fields
  const renderField = (field: FilterField) => {
    if (field.type === 'select') {
      return (
        <Select
          placeholder={field.placeholder || `Select ${field.label}`}
          options={field.options || []}
          loading={field.loading}
          allowClear
          showSearch
          optionFilterProp="label"
          onChange={(val) => {
            if (field.onChange) {
              field.onChange(val);
            }
          }}
        />
      );
    }

    return (
      <Input
        placeholder={field.placeholder || `Enter ${field.label}`}
        allowClear
      />
    );
  };

  return (
    <Card
      styles={{ body: { padding: '16px 24px' } }}
      style={{
        marginBottom: 24,
        borderRadius: 8,
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Header bar with collapse trigger */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          marginBottom: collapsed ? 0 : 16,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Space>
          <FilterOutlined style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Advanced Filter Panel</span>
        </Space>
        <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}>
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
      </div>

      {/* Main filters grid */}
      {!collapsed && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={initialValues}
        >
          <Row gutter={[16, 8]}>
            {fields.map((field) => (
              <Col xs={24} sm={12} md={8} lg={6} key={field.key}>
                <Form.Item name={field.key} label={field.label} style={{ marginBottom: 12 }}>
                  {renderField(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>

          {/* Action buttons bar */}
          <Row justify="end" style={{ marginTop: 8 }}>
            <Space>
              <Button icon={<ClearOutlined />} onClick={handleReset}>
                Reset
              </Button>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                Apply Filters
              </Button>
            </Space>
          </Row>
        </Form>
      )}
    </Card>
  );
}
