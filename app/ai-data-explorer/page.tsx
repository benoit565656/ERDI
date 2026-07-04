'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Table, Space, Alert, Empty, Badge, Spin, Tooltip as AntTooltip, Select } from 'antd';
import { 
  RobotOutlined, 
  UserOutlined, 
  SendOutlined, 
  SyncOutlined, 
  BarChartOutlined, 
  TableOutlined,
  PlayCircleOutlined,
  CompassOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  type?: 'text' | 'clarification' | 'dashboard' | 'report';
  options?: Array<{ code: string; name: string; description?: string }>;
  dashboardData?: {
    indicatorCode: string;
    indicatorName: string;
    economies: string[];
    periods: string[];
    isGroup: boolean;
    groupName: string;
    data: Array<{
      period: string;
      economyCode: string;
      economyName: string;
      indicatorCode: string;
      indicatorName: string;
      obsValue: number | null;
      unit: string;
    }>;
  };
  reportData?: {
    economyCode: string;
    economyName: string;
    periods: string[];
    reportData: Record<string, {
      code: string;
      name: string;
      category: string;
      unit: string;
      data: Array<{
        period: string;
        obsValue: number | null;
        economyCode: string;
        economyName: string;
        indicatorCode: string;
        indicatorName: string;
        unit: string;
      }>;
      latestValue: number | null;
      latestYear: string | null;
    }>;
  };
}

const SUGGESTIONS = [
  'Provide me the most relevant economy indicators for Philippines',
  'Total population for South East Asia 2020 2024',
  'Give me inflation rate for South Asia',
  'Compare GDP growth for Vietnam and Indonesia'
];

export default function AiDataExplorerPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      type: 'text',
      content: 'Hello! I am your AI Data Explorer Assistant. Ask me any economic query, e.g. "Show me GDP growth for Philippines" or "Total population for South East Asia". I will help resolve indicators, perform weighted regional aggregations, calculate growth rates dynamically, and build custom dashboards for you!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch('/api/public-explorer/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ sender: m.sender, content: m.content }))
        })
      });

      if (!response.ok) {
        throw new Error('API server returned error status.');
      }

      const resData = await response.json();

      if (resData.type === 'clarification') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          type: 'clarification',
          content: resData.message,
          options: resData.options
        }]);
      } else if (resData.type === 'dashboard') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          type: 'dashboard',
          content: resData.summary,
          dashboardData: resData.dashboard
        }]);
      } else if (resData.type === 'report') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          type: 'report',
          content: resData.summary,
          reportData: resData.report
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          type: 'text',
          content: resData.message || 'I processed your request but no visual data could be resolved.'
        }]);
      }

    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        type: 'text',
        content: `Error: ${e.message || 'Something went wrong while executing query.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToExplorer = (dbData: NonNullable<Message['dashboardData']>) => {
    // Navigate back to Main Data Explorer with preselected parameters
    const inds = dbData.indicatorCode;
    const ecos = dbData.economies.join(',');
    const periods = dbData.periods.join(',');
    window.location.href = `/data-explorer?indicator=${inds}&economy=${ecos}&period=${periods}`;
  };
  return (
    <div style={{ width: '100%', maxWidth: '100%', padding: '104px 40px 40px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderRadius: '16px', padding: '40px', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <RobotOutlined style={{ fontSize: '32px', color: '#60a5fa' }} />
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', color: '#ffffff' }}>
            AI Data Explorer & Dashboard Copilot
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '15px', color: '#bfdbfe', maxWidth: '800px', lineHeight: '1.6' }}>
          Ask economics questions naturally. Our AI Copilot clarifies what indicator you need, calculates derived metrics (like growth rates), aggregates custom regions using regional weights, and renders custom dashboards inline.
        </p>
      </div>

      {/* QUICK SUGGESTIONS ROW */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', alignSelf: 'center', marginRight: '5px' }}>Try asking:</span>
        {SUGGESTIONS.map((s, idx) => (
          <Button
            key={idx}
            type="default"
            shape="round"
            onClick={() => handleSend(s)}
            disabled={loading}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}
          >
            {s}
          </Button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '30px', flexDirection: 'column' }}>
        
        {/* CHAT INTERFACE - Left/Main Column */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <Input
                placeholder="Ask me a question (e.g. 'most relevant indicators for Philippines' or 'give me a report about the economy in Philippines')..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={() => handleSend(inputValue)}
                disabled={loading}
                style={{ borderRadius: '6px', height: '44px', fontSize: '15px' }}
                suffix={<SendOutlined style={{ color: inputValue ? '#2563eb' : '#94a3b8', cursor: 'pointer', fontSize: '18px' }} onClick={() => handleSend(inputValue)} />}
              />
            </div>

            {/* Messages Log - Dynamic Height, No Scrollbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    alignItems: 'flex-start',
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: msg.type === 'dashboard' ? '100%' : '80%'
                  }}
                >
                  {msg.sender === 'ai' && (
                    <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RobotOutlined style={{ fontSize: '18px' }} />
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Text Message Content */}
                    <div 
                      style={{ 
                        background: msg.sender === 'user' ? '#2563eb' : '#f8fafc',
                        color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Clarification Dialog Options */}
                    {msg.type === 'clarification' && msg.options && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {msg.options.map(opt => (
                          <button
                            key={opt.code}
                            onClick={() => handleSend(`Select indicator: ${opt.name} (${opt.code})`)}
                            style={{ 
                              textAlign: 'left',
                              padding: '10px 14px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              color: '#334155',
                              fontSize: '13px',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                            className="hover-card"
                          >
                            <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{opt.name}</span>
                            {opt.description && <span style={{ fontSize: '11px', color: '#64748b' }}>{opt.description}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Dashboard Rendering Panel */}
                    {msg.type === 'dashboard' && msg.dashboardData && (
                      <Card 
                        style={{ 
                          marginTop: '15px', 
                          borderRadius: '12px', 
                          border: '1px solid #bfdbfe', 
                          background: '#fafcff',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.05)'
                        }}
                        bodyStyle={{ padding: '20px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px' }}>
                          <div>
                            <Badge status="processing" text="Active AI Dashboard" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#2563eb' }} />
                            <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 700, color: '#1e3a8a' }}>
                              {msg.dashboardData.indicatorName}
                            </h3>
                          </div>
                          <Button 
                            type="primary" 
                            icon={<SyncOutlined />} 
                            onClick={() => handleApplyToExplorer(msg.dashboardData!)}
                            style={{ background: '#2563eb', borderRadius: '6px' }}
                          >
                            Apply to Explorer
                          </Button>
                        </div>

                        {/* Visual Charts */}
                        <div style={{ height: '300px', width: '100%', marginBottom: '25px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={msg.dashboardData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                              <YAxis stroke="#94a3b8" fontSize={11} />
                              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                              <Legend verticalAlign="top" height={36} />
                              <Line 
                                type="monotone" 
                                dataKey="obsValue" 
                                name={msg.dashboardData.indicatorName} 
                                stroke="#2563eb" 
                                strokeWidth={3} 
                                activeDot={{ r: 8 }} 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Visual Table */}
                        <Table 
                          dataSource={msg.dashboardData.data}
                          columns={[
                            { title: 'Period', dataIndex: 'period', key: 'period', width: 100 },
                            { title: 'Economy', dataIndex: 'economyName', key: 'economyName' },
                            { 
                              title: 'Observation Value', 
                              dataIndex: 'obsValue', 
                              key: 'obsValue',
                              render: (val) => val !== null ? `${val} ${msg.dashboardData!.data[0]?.unit || ''}` : '-'
                            }
                          ]}
                          pagination={{ pageSize: 5 }}
                          size="small"
                          bordered
                        />
                      </Card>
                    )}

                    {/* Multi-Indicator Report Rendering Panel */}
                    {msg.type === 'report' && msg.reportData && (
                      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '25px', width: '100%' }}>
                        {['Demographics', 'Economy & Growth'].map(catName => {
                          const catIndicators = Object.values(msg.reportData!.reportData).filter(ind => ind.category === catName);
                          if (catIndicators.length === 0) return null;

                          return (
                            <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e3a8a', borderLeft: '4px solid #2563eb', paddingLeft: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {catName}
                              </h3>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%' }}>
                                {catIndicators.map(ind => {
                                  const formattedVal = ind.latestValue !== null ? ind.latestValue.toLocaleString() : '-';
                                  const isPercent = ind.unit.includes('Percent') || ind.unit.includes('%');
                                  
                                  return (
                                    <div 
                                      key={ind.code} 
                                      style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 300px', 
                                        gap: '20px', 
                                        alignItems: 'stretch',
                                        width: '100%'
                                      }}
                                    >
                                      {/* Left Card: Historical Chart */}
                                      <Card
                                        size="small"
                                        style={{ 
                                          borderRadius: '12px', 
                                          border: '1px solid #e2e8f0', 
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.01)', 
                                          background: '#ffffff',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          height: '100%'
                                        }}
                                        bodyStyle={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}
                                      >
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', letterSpacing: '0.3px' }}>
                                          {ind.name} (Trend)
                                        </div>
                                        <div style={{ height: '300px', width: '100%', flex: 1 }}>
                                          <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={ind.data} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                              <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                              <Tooltip 
                                                formatter={(value: any) => [
                                                  `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${isPercent ? '%' : ` ${ind.unit || ''}`}`,
                                                  ind.name
                                                ]}
                                                labelFormatter={(label) => `Year: ${label}`}
                                                contentStyle={{ borderRadius: 8, fontSize: '11px', border: '1px solid #e2e8f0' }}
                                              />
                                              <Line
                                                type="monotone"
                                                dataKey="obsValue"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                dot={{ r: 3 }}
                                                activeDot={{ r: 6 }}
                                              />
                                            </LineChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </Card>

                                      {/* Right Card: Statistic callout */}
                                      <Card
                                        size="small"
                                        style={{ 
                                          borderRadius: '12px', 
                                          border: '1px solid #dbeafe', 
                                          boxShadow: '0 2px 4px rgba(37, 99, 235, 0.01)', 
                                          background: '#eff6ff',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between',
                                          height: '100%'
                                        }}
                                        bodyStyle={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Latest Statistic
                                          </span>
                                          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                                            <span style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', lineHeight: '1.1' }}>
                                              {formattedVal}
                                            </span>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginTop: '2px', lineHeight: '1.3' }}>
                                              {isPercent ? '%' : ind.unit}
                                            </span>
                                          </div>
                                          {ind.latestYear && (
                                            <div style={{ marginTop: '8px' }}>
                                              <span style={{ display: 'inline-block', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}>
                                                Year: {ind.latestYear}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ borderTop: '1px solid #dbeafe', paddingTop: '12px', marginTop: '12px' }}>
                                          <Button
                                            type="primary"
                                            size="middle"
                                            icon={<CompassOutlined />}
                                            onClick={() => handleApplyToExplorer({
                                              indicatorCode: ind.code,
                                              indicatorName: ind.name,
                                              economies: [msg.reportData!.economyCode],
                                              periods: msg.reportData!.periods,
                                              isGroup: false,
                                              groupName: '',
                                              data: ind.data
                                            })}
                                            style={{ 
                                              width: '100%', 
                                              background: '#2563eb', 
                                              border: 'none', 
                                              borderRadius: '8px', 
                                              fontSize: '12px', 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              justifyContent: 'center', 
                                              gap: '6px' 
                                            }}
                                          >
                                            Apply to Explorer
                                          </Button>
                                        </div>
                                      </Card>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div style={{ background: '#2563eb', color: '#ffffff', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserOutlined style={{ fontSize: '18px' }} />
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', alignSelf: 'flex-start' }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RobotOutlined style={{ fontSize: '18px' }} />
                  </div>
                  <Card size="small" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <Space>
                      <Spin size="small" />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>AI Agent resolving indicators and fetching data...</span>
                    </Space>
                  </Card>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
