'use client';

import React, { useState } from 'react';
import { Card, Switch, Form, Input, Button, Divider, Typography, Row, Col, Space, Badge, Radio, Alert, message } from 'antd';
import { SettingOutlined, DatabaseOutlined, SafetyOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function SettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [cacheTtl, setCacheTtl] = useState('3600');
  const [rateLimit, setRateLimit] = useState(true);

  const handleSave = () => {
    message.success('System parameters updated successfully.');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>System Settings</Title>
        <Paragraph style={{ color: '#666' }}>
          Configure administrative controls, database synchronization intervals, and default SDMX registry configurations.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card title="System Services Health" style={{ borderRadius: 8 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                  <Space direction="vertical">
                    <Text strong style={{ color: '#389e0d' }}>PostgreSQL Database</Text>
                    <Badge status="success" text="Connected (Port 5432)" />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                  <Space direction="vertical">
                    <Text strong style={{ color: '#389e0d' }}>SDMX Engine API</Text>
                    <Badge status="success" text="Online (Port 4000)" />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
                  <Space direction="vertical">
                    <Text strong style={{ color: '#096dd9' }}>Next.js App Server</Text>
                    <Badge status="processing" text="Active (Port 3000)" />
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={
              <span>
                <SettingOutlined style={{ marginRight: 8, color: '#6366f1' }} />
                Platform Configurations
              </span>
            }
            style={{ borderRadius: 8 }}
          >
            <Form layout="vertical">
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item label="API Rate Limiting">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Switch checked={rateLimit} onChange={setRateLimit} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Restricts endpoints to maximum 100 requests per minute per origin IP.
                      </Text>
                    </Space>
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Maintenance Mode">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Switch checked={maintenance} onChange={setMaintenance} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Redirects all public client query traffic to a temporary holding page.
                      </Text>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              <Form.Item label="Client Cache Expiry TTL (Seconds)">
                <Radio.Group value={cacheTtl} onChange={(e) => setCacheTtl(e.target.value)}>
                  <Radio.Button value="0">No Cache</Radio.Button>
                  <Radio.Button value="300">5 Mins</Radio.Button>
                  <Radio.Button value="3600">1 Hour</Radio.Button>
                  <Radio.Button value="86400">24 Hours</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item label="Default SDMX Agency Code ID">
                <Input defaultValue="ERDI" style={{ maxWidth: 320 }} />
              </Form.Item>

              <Form.Item label="DotStat Engine URL endpoint">
                <Input defaultValue="http://localhost:4000/api/v1" style={{ maxWidth: 480 }} />
              </Form.Item>

              <Button type="primary" onClick={handleSave}>
                Save System Parameters
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={24}>
          <Alert
            message="Data Integrity Lock"
            description="All configuration updates made in this settings console are tracked in the Security Audit Logs registry."
            type="warning"
            showIcon
          />
        </Col>
      </Row>
    </div>
  );
}
