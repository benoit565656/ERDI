'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Table, Space, Alert, Empty, Badge, Spin, Tooltip as AntTooltip } from 'antd';
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
  type?: 'text' | 'clarification' | 'dashboard';
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
  const [geminiKey, setGeminiKey] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load Gemini key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('erdi_gemini_key') || '';
    setGeminiKey(savedKey);
  }, []);

  const handleSaveKey = (key: string) => {
    setGeminiKey(key);
    localStorage.setItem('erdi_gemini_key', key);
  };

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
          messages: [...messages, userMsg].map(m => ({ sender: m.sender, content: m.content })),
          apiKey: geminiKey
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
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
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

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* CHAT INTERFACE - Left/Main Column */}
        <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* Messages Log */}
            <div style={{ height: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '8px', marginBottom: '20px' }}>
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
                          style={{ background: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}
                        />
                      </Card>
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

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Input
                placeholder="Ask me a question (e.g. 'most relevant indicators for Philippines')..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={() => handleSend(inputValue)}
                disabled={loading}
                style={{ borderRadius: '6px' }}
                suffix={<SendOutlined style={{ color: inputValue ? '#2563eb' : '#94a3b8', cursor: 'pointer' }} onClick={() => handleSend(inputValue)} />}
              />
            </div>

          </Card>
        </div>

        {/* CONTROLS & SUGGESTIONS - Right/Sidebar Column */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* AI Settings / Keys */}
          <Card title="AI Copilot Configuration" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                Optionally insert a Gemini API Key to enable semantic narrative summaries of generated tables and charts. If omitted, the assistant resolves everything locally.
              </p>
              <Input.Password
                placeholder="Insert Gemini API Key..."
                value={geminiKey}
                onChange={e => handleSaveKey(e.target.value)}
                style={{ borderRadius: '6px' }}
              />
              {geminiKey ? (
                <Badge status="success" text="Gemini API Connected" style={{ fontSize: '12px' }} />
              ) : (
                <Badge status="default" text="Running Offline Local Solver" style={{ fontSize: '12px' }} />
              )}
            </div>
          </Card>

          {/* Quick Suggestions Chips */}
          <Card title="Quick Suggestions" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  disabled={loading}
                  style={{
                    textAlign: 'left',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    color: '#334155',
                    lineHeight: '1.4',
                    transition: 'all 0.2s'
                  }}
                  className="hover-card"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

        </div>

      </div>

    </div>
  );
}
