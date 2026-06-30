'use client';

import React, { useState, useMemo } from 'react';
import { 
  CodeOutlined, 
  CopyOutlined, 
  CheckOutlined, 
  PlayCircleOutlined, 
  DownOutlined, 
  RightOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Button, Input, Select, Tooltip, Collapse, Spin, Radio } from 'antd';

export default function ApiDocsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Query Builder State
  const [qbMode, setQbMode] = useState<'INDICATOR' | 'DATAFLOW'>('INDICATOR');
  const [qbDataflow, setQbDataflow] = useState<string>('EO');
  const [qbIndicators, setQbIndicators] = useState<string>('CPI_PC,BOP_CAB_PER_NGDP');
  const [qbEconomies, setQbEconomies] = useState<string>('ARM,PHI,GEO');
  const [qbStartPeriod, setQbStartPeriod] = useState<string>('2020');
  const [qbEndPeriod, setQbEndPeriod] = useState<string>('2024');

  // Test Runner State
  const [testEndpoint, setTestEndpoint] = useState<string>('/api/public-explorer/indicators');
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testTime, setTestTime] = useState<number | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://erdi-fawn.vercel.app';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const queryBuilderUrl = useMemo(() => {
    const params = new URLSearchParams();
    
    if (qbMode === 'DATAFLOW') {
      if (qbDataflow) params.set('dataflow', qbDataflow);
    } else {
      if (qbIndicators) params.set('indicator', qbIndicators);
    }
    
    if (qbEconomies) params.set('economy', qbEconomies);
    if (qbStartPeriod) params.set('startPeriod', qbStartPeriod);
    if (qbEndPeriod) params.set('endPeriod', qbEndPeriod);
    return `${baseUrl}/api/public-explorer/data?${params.toString()}`;
  }, [qbMode, qbDataflow, qbIndicators, qbEconomies, qbStartPeriod, qbEndPeriod, baseUrl]);

  const handleRunTest = async (targetUrl?: string) => {
    const url = targetUrl || testEndpoint;
    setTestEndpoint(url.replace(baseUrl, ''));
    setTestLoading(true);
    setTestResponse(null);
    setTestStatus(null);
    
    // Smooth scroll down to the Live API Test Runner Console
    setTimeout(() => {
      document.getElementById('api-console')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);

    const start = performance.now();
    try {
      const res = await fetch(url);
      const duration = Math.round(performance.now() - start);
      setTestStatus(res.status);
      setTestTime(duration);
      
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('xml')) {
        const text = await res.text();
        setTestResponse({ __isXml: true, content: text });
      } else {
        const data = await res.json();
        setTestResponse(data);
      }
    } catch (err: any) {
      setTestStatus(500);
      setTestResponse({ error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '110px 24px 64px', color: '#1e293b' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HERO HEADER */}
        <div style={{ background: 'linear-gradient(135deg, #002a69 0%, #0f172a 100%)', borderRadius: '16px', padding: '40px', color: '#fff', marginBottom: '32px', boxShadow: '0 10px 25px -5px rgba(0, 42, 105, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
              v1.0 REST & SDMX API
            </span>
            <span style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
              Public Open Access
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            ERDI API Documentation
          </h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', maxWidth: '800px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            Access comprehensive macroeconomic and social statistics from across Asia and the Pacific across multiple databases including <strong>Key Indicators Database (KIDB)</strong>, <strong>Asian Development Outlook (ADO)</strong>, <strong>ARIC</strong>, and <strong>EEMRIOT</strong>.
          </p>

          {/* BASE URL BOX */}
          <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8' }}>Base URL</span>
              <code style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {baseUrl}/api/public-explorer
              </code>
            </div>
            <Tooltip title="Copy Base URL">
              <Button 
                type="text" 
                icon={copiedKey === 'base' ? <CheckOutlined style={{ color: '#4ade80' }} /> : <CopyOutlined />} 
                onClick={() => copyToClipboard(`${baseUrl}/api/public-explorer`, 'base')}
                style={{ color: '#fff' }}
              />
            </Tooltip>
          </div>
        </div>

        {/* BLUE CALLOUT BANNER */}
        <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '12px', padding: '20px 24px', marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <InfoCircleOutlined style={{ color: '#0284c7', fontSize: '20px', marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0369a1' }}>
              Flexible Query Options (Dataflows or Individual Indicators)
            </h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#0c4a6e', lineHeight: 1.5 }}>
              You have 2 query modes: You can query an entire <strong>Dataflow</strong> (to fetch observation values for all indicators in that category, e.g., <code>?dataflow=EO</code>) OR you can query <strong>Individual Indicators</strong> (e.g., <code>?indicator=CPI_PC</code>).
            </p>
          </div>
        </div>

        {/* MAIN API SPECIFICATIONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px', marginBottom: '40px' }}>
          
          {/* DATASET & OBSERVATIONS ENDPOINT */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', fontSize: '13px' }}>GET</span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>/api/public-explorer/data</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              Query macroeconomic and social observation data values by specifying either a <code>dataflow</code> code (for all indicators in a category) or specific <code>indicator</code> codes. Returns SDMX-ML XML formatted response by default.
            </p>

            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>Query Parameters</h4>
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Parameter</th>
                    <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Required</th>
                    <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>indicator <span style={{ color: '#94a3b8', fontWeight: 400 }}>(or indicators)</span></td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ color: '#2563eb', fontWeight: 600 }}>Required (or dataflow)</span></td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Comma-separated indicator code(s) (e.g. <code>CPI_PC,BOP_CAB_PER_NGDP</code>). Support <code>+</code> or <code>,</code> separators. Use <code>.</code> for wildcard.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>dataflow <span style={{ color: '#94a3b8', fontWeight: 400 }}>(or dataflows)</span></td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ color: '#2563eb', fontWeight: 600 }}>Required (or indicator)</span></td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Dataflow / Topic code (e.g. <code>EO</code> for Economy and Output, <code>PPL</code> for People) to query all indicators under that dataflow.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>economy <span style={{ color: '#94a3b8', fontWeight: 400 }}>(or economies)</span></td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ color: '#dc2626', fontWeight: 600 }}>Required</span></td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Comma-separated 3-letter ISO economy code(s) (e.g. <code>ARM,PHI,GEO</code>). Support <code>+</code> or <code>,</code> separators. Use <code>.</code> for wildcard.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>startPeriod</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Starting period year filter (e.g. <code>2020</code>).</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>endPeriod</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Ending period year filter (e.g. <code>2024</code>).</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>format</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>string</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>Optional</td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>Output format (<code>sdmx-ml</code> (default XML) or <code>sdmx-json</code> / <code>json</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ACCORDION EXAMPLES */}
            <Collapse 
              expandIcon={({ isActive }) => isActive ? <DownOutlined /> : <RightOutlined />}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              items={[
                {
                  key: '1',
                  label: <span style={{ fontWeight: 700, color: '#1e293b' }}>Basic Usage Examples</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                          1. Option 1: Query entire Dataflow (Economy & Output) for Philippines (PHI) and Armenia (ARM) as XML (default):
                        </div>
                        <div style={{ background: '#0f172a', padding: '12px 16px', borderRadius: '6px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>GET {baseUrl}/api/public-explorer/data?dataflow=EO&economy=PHI,ARM</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                          2. Option 2: Query individual Indicator (CPI) for specific start and end years:
                        </div>
                        <div style={{ background: '#0f172a', padding: '12px 16px', borderRadius: '6px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '13px' }}>
                          <span>GET {baseUrl}/api/public-explorer/data?indicator=CPI_PC&economy=ARM,PHI,GEO&startPeriod=2020&endPeriod=2024</span>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  key: '2',
                  label: <span style={{ fontWeight: 700, color: '#1e293b' }}>XML Response Format Example (Default)</span>,
                  children: (
                    <pre style={{ background: '#0f172a', color: '#a7f3d0', padding: '16px', borderRadius: '6px', fontSize: '13px', overflowX: 'auto', margin: 0, maxHeight: '250px', overflowY: 'auto' }}>
{`<message:StructureSpecificData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ...>
  <message:Header>
    <message:ID>IREF928374</message:ID>
    <message:Sender>ADB_ERDI</message:Sender>
  </message:Header>
  <message:DataSet ss:structureRef="ADB_KIDB_DSD_1_0" xsi:type="ns1:DataSetType">
    <Series FREQ="A" INDICATOR="CPI_PC" ECONOMY_CODE="ARM">
      <Obs TIME_PERIOD="2024" OBS_VALUE="3.2" UNIT="PERSONS" UNIT_MULT="0" DECIMALS="1" OBS_STATUS="A" REF_YEAR="2024"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`}
                    </pre>
                  )
                },
                {
                  key: '3',
                  label: <span style={{ fontWeight: 700, color: '#1e293b' }}>Access with Python</span>,
                  children: (
                    <div>
                      <p style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                        Query the ERDI API in Python using <code>requests</code>:
                      </p>
                      <pre style={{ background: '#0f172a', color: '#f8fafc', padding: '16px', borderRadius: '6px', fontSize: '13px', overflowX: 'auto', margin: 0, maxHeight: '250px', overflowY: 'auto' }}>
{`import requests

url = "${baseUrl}/api/public-explorer/data"
params = {
    "indicator": "CPI_PC",
    "economy": "ARM,PHI,GEO",
    "startPeriod": "2020",
    "endPeriod": "2024",
    "format": "json"
}

response = requests.get(url, params=params)
data = response.json()

print(f"Retrieved {len(data['data'])} observation points")
`}
                      </pre>
                    </div>
                  )
                },
                {
                  key: '4',
                  label: <span style={{ fontWeight: 700, color: '#1e293b' }}>Interactive Query Builder & Live Test Runner</span>,
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Query Mode</label>
                        <Radio.Group value={qbMode} onChange={e => setQbMode(e.target.value)}>
                          <Radio.Button value="INDICATOR">Option 1: Query by Individual Indicator(s)</Radio.Button>
                          <Radio.Button value="DATAFLOW">Option 2: Query by Entire Dataflow</Radio.Button>
                        </Radio.Group>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        {qbMode === 'DATAFLOW' ? (
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Select Dataflow Code</label>
                            <Select value={qbDataflow} onChange={setQbDataflow} style={{ width: '100%' }}>
                              <Select.Option value="EO">EO - Economy and Output</Select.Option>
                              <Select.Option value="PPL">PPL - People and Labor Force</Select.Option>
                              <Select.Option value="MFP">MFP - Money, Finance, and Prices</Select.Option>
                              <Select.Option value="GLB">GLB - Globalization and Trade</Select.Option>
                              <Select.Option value="ENV">ENV - Environment and Climate Change</Select.Option>
                            </Select>
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Indicator Code(s)</label>
                            <Input value={qbIndicators} onChange={e => setQbIndicators(e.target.value)} placeholder="e.g. CPI_PC" />
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Economy Code(s)</label>
                          <Input value={qbEconomies} onChange={e => setQbEconomies(e.target.value)} placeholder="e.g. ARM,PHI,GEO" />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Start Period (Year)</label>
                          <Input value={qbStartPeriod} onChange={e => setQbStartPeriod(e.target.value)} placeholder="e.g. 2020" />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>End Period (Year)</label>
                          <Input value={qbEndPeriod} onChange={e => setQbEndPeriod(e.target.value)} placeholder="e.g. 2024" />
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>Generated Query URL:</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#1e293b', wordBreak: 'break-all' }}>
                          {queryBuilderUrl}
                        </div>
                      </div>

                      <Button 
                        type="primary" 
                        icon={<PlayCircleOutlined />} 
                        onClick={() => handleRunTest(queryBuilderUrl)}
                        style={{ background: '#155dfc', fontWeight: 600 }}
                      >
                        Execute Request Live
                      </Button>
                    </div>
                  )
                }
              ]}
            />
          </div>

          {/* STRUCTURAL METADATA ENDPOINTS */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              Structural Metadata Endpoints
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              Retrieve dataflows lists, codelists, indicators catalogs, region hierarchies, mappings, and definitions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* ENDPOINT 0: DATAFLOWS */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/dataflows</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/dataflows`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns complete catalog of top-level Dataflows and Sub-topics.
                </p>
              </div>
              
              {/* ENDPOINT 1: INDICATORS */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/indicators?dataflow=EO</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/indicators?dataflow=EO`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns full indicator codelist (or filtered by specific dataflow code).
                </p>
              </div>

              {/* ENDPOINT 2: INDICATORS MAPPING */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/indicators/mapping</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/indicators/mapping`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns all indicators alongside where they belong in terms of dataflows/topics.
                </p>
              </div>

              {/* ENDPOINT 3: ECONOMIES */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/economies</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/economies`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns nested hierarchy tree of 50 member economies and parent regions.
                </p>
              </div>

              {/* ENDPOINT 4: TREE */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/tree</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/tree`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns complete hierarchical category tree (topics & subtopics) with mapped indicator leaves.
                </p>
              </div>

              {/* ENDPOINT 5: SDMX DATA */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/sdmx/data/ADB,PPL/A.LE_PE_AGR_XTE_RT_PS.ARM,PHI,GEO?startPeriod=2020&amp;endPeriod=2024</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/sdmx/data/ADB,PPL/A.LE_PE_AGR_XTE_RT_PS.ARM,PHI,GEO?startPeriod=2020&endPeriod=2024`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Returns SDMX observations XML matching standard KIDB formats.
                </p>
              </div>

              {/* ENDPOINT 6: SDMX CODELISTS (NEW) */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/sdmx/structure/codelist/ADB/CL_UNIT/latest</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/sdmx/structure/codelist/ADB/CL_UNIT/latest`)}>
                    Test Endpoint
                  </Button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Extract Codelist names and codes (e.g. units <code>CL_UNIT</code>, multipliers <code>CL_UNIT_MULT</code>, or status <code>CL_OBS_STATUS</code>) to decode observation attribute values.
                </p>
              </div>

              {/* ENDPOINT 7: SDMX STRUCTURE METADATA */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>GET</span>
                    <code style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>/api/public-explorer/sdmx/structure/codelist/ADB/CL_ECONOMY/latest</code>
                  </div>
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTest(`${baseUrl}/api/public-explorer/sdmx/structure/codelist/ADB/CL_ECONOMY/latest`)}>
                    Test Endpoint
                  </Button>
                </div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>SDMX queries consist of the following structure:</p>
                  <code style={{ display: 'block', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: '#0f172a', marginBottom: '8px', overflowX: 'auto' }}>
                    /api/public-explorer/sdmx/structure/{"{structure_type}"}/{"{agency}"}/{"{structure_id}"}/{"{version}"}?[optionalParameters]
                  </code>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    <li><strong>structure_type</strong>: <code>agencyscheme</code>, <code>codelist</code>, <code>conceptscheme</code>, <code>datastructure</code>, <code>dataflow</code></li>
                    <li><strong>agency</strong>: Owning agency (e.g. <code>ADB</code>)</li>
                    <li><strong>structure_id</strong>: ID in registry (e.g. <code>CL_ECONOMY</code>, <code>CL_INDICATOR</code>, <code>CL_UNIT</code>, <code>CL_UNIT_MULT</code>, <code>CL_OBS_STATUS</code>, <code>all</code>)</li>
                    <li><strong>version</strong>: <code>latest</code> or <code>+</code></li>
                    <li><strong>optionalParameters</strong>: <code>format</code> (<code>sdmx-ml</code> (default XML) or <code>sdmx-json</code>)</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>

          {/* LIVE TEST RUNNER CONSOLE (WITH FIXED SCROLLER INSIDE BLOCK) */}
          <div id="api-console" style={{ background: '#0f172a', borderRadius: '12px', padding: '24px', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '100%', overflow: 'hidden' }}>
                <ThunderboltOutlined style={{ color: '#38bdf8', fontSize: '18px' }} />
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>Live API Test Console</span>
                <code style={{ background: '#1e293b', padding: '4px 10px', borderRadius: '6px', color: '#38bdf8', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{testEndpoint}</code>
              </div>
              {testStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ background: testStatus === 200 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: testStatus === 200 ? '#4ade80' : '#f87171', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                    {testStatus} {testStatus === 200 ? 'OK' : 'ERROR'}
                  </span>
                  {testTime && <span style={{ color: '#94a3b8', fontSize: '12px' }}>{testTime} ms</span>}
                </div>
              )}
            </div>

            {testLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
                <Spin description="Executing API request..." style={{ color: '#fff' }} />
              </div>
            ) : testResponse ? (
              <div style={{ position: 'relative', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%' }}>
                <Button 
                  size="small" 
                  icon={copiedKey === 'test' ? <CheckOutlined style={{ color: '#4ade80' }} /> : <CopyOutlined />} 
                  onClick={() => copyToClipboard(testResponse.__isXml ? testResponse.content : JSON.stringify(testResponse, null, 2), 'test')}
                  style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                >
                  Copy {testResponse.__isXml ? 'XML' : 'JSON'}
                </Button>
                <pre style={{ background: '#020617', padding: '16px', borderRadius: '8px', maxHeight: '300px', overflowX: 'auto', overflowY: 'auto', fontSize: '13px', color: testResponse.__isXml ? '#a7f3d0' : '#38bdf8', fontFamily: 'monospace', margin: 0, maxWidth: '100%', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {testResponse.__isXml ? testResponse.content : JSON.stringify(testResponse, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ background: '#1e293b', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Click "Test Endpoint" or "Execute Request Live" above to test responses in real-time.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
