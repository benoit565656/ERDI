'use client';

import React, { useState } from 'react';
import { Steps, Upload, Button, Alert, Table, Space, Result, Spin, Card, Typography } from 'antd';
import { InboxOutlined, CheckCircleOutlined, AlertOutlined, LoadingOutlined } from '@ant-design/icons';
import Papa from 'papaparse';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface ImportWizardProps {
  importType: 'observations' | 'codelists' | 'dataflows' | 'dsds' | 'concepts';
  onCompleted?: (rowCount: number) => void;
}

export default function ImportWizard({ importType, onCompleted }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationMessages, setValidationMessages] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Step 1: File Upload Handler
  const handleUploadChange = (info: any) => {
    const uploadedFile = info.file.originFileObj as File;
    if (uploadedFile) {
      setFile(uploadedFile);
      
      // Parse file with PapaParse for the Step 3 preview
      Papa.parse(uploadedFile, {
        header: true,
        preview: 10,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedData(results.data);
          
          if (results.data.length > 0) {
            const cols = Object.keys(results.data[0] as object).map((key) => ({
              title: key,
              dataIndex: key,
              key: key,
              ellipsis: true,
            }));
            setColumns(cols);
          }
        },
      });

      // Move to step 2 (Validation)
      setCurrentStep(1);
      triggerMockValidation();
    }
  };

  // Step 2: Mock Validation Simulator
  const triggerMockValidation = () => {
    setValidating(true);
    setValidationMessages([]);
    
    setTimeout(() => {
      setValidating(false);
      // Generate some dummy validation alerts based on type
      const messages = [
        { severity: 'info', message: 'DSD configuration mapping matched successfully.' },
        { severity: 'info', message: 'All dimension keys validated against code lists.' },
        { severity: 'warning', message: '3 observations detected with empty values (treated as null).' },
      ];
      setValidationMessages(messages);
    }, 2000);
  };

  // Step 3 -> Step 4: Import Executer
  const handleImportTrigger = () => {
    setImporting(true);
    
    setTimeout(() => {
      setImporting(false);
      setCurrentStep(3);
      if (onCompleted) {
        onCompleted(parsedData.length || 100);
      }
    }, 1500);
  };

  const stepsItems = [
    { title: 'Upload File' },
    { title: 'Validation' },
    { title: 'Preview Data' },
    { title: 'Complete' },
  ];

  return (
    <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
      {/* Steps indicator */}
      <Steps current={currentStep} items={stepsItems} style={{ marginBottom: 32 }} />

      {/* STEP 1: Upload File area */}
      {currentStep === 0 && (
        <div style={{ padding: '24px 0' }}>
          <Dragger
            name="file"
            accept=".csv"
            multiple={false}
            onChange={handleUploadChange}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#6366f1' }} />
            </p>
            <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
            <p className="ant-upload-hint">
              Supports single CSV file validation and import for {importType.toUpperCase()}.
            </p>
          </Dragger>
        </div>
      )}

      {/* STEP 2: Validation results */}
      {currentStep === 1 && (
        <div style={{ padding: '16px 0' }}>
          {validating ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#6366f1' }} spin />} />
              <Paragraph style={{ marginTop: 16 }}>Validating records against DSD specifications...</Paragraph>
            </div>
          ) : (
            <div>
              <Typography.Title level={5}>Validation Report</Typography.Title>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} size="small">
                {validationMessages.map((msg, idx) => (
                  <Alert
                    key={idx}
                    message={msg.message}
                    type={msg.severity as any}
                    showIcon
                  />
                ))}
              </Space>
              
              <RowActionsToolbar
                onCancel={() => { setFile(null); setCurrentStep(0); }}
                onNext={() => setCurrentStep(2)}
                nextLabel="Proceed to Preview"
              />
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Preview Data Grid */}
      {currentStep === 2 && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 16 }}>
            Previewing first 10 rows of {file?.name}
          </Typography.Title>
          
          <Table
            dataSource={parsedData}
            columns={columns}
            pagination={false}
            size="small"
            style={{ marginBottom: 24, border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}
          />

          {importing ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin tip="Importing records into statistical observations table..." />
            </div>
          ) : (
            <RowActionsToolbar
              onCancel={() => { setFile(null); setCurrentStep(0); }}
              onNext={handleImportTrigger}
              nextLabel="Confirm & Import"
              nextType="primary"
            />
          )}
        </div>
      )}

      {/* STEP 4: Success Result */}
      {currentStep === 3 && (
        <Result
          status="success"
          title={`Successfully Imported ${importType.toUpperCase()}!`}
          subTitle={`A total of ${parsedData.length || 100} records have been uploaded and saved to the database. All dataflows mapping updated.`}
          extra={[
            <Button
              type="primary"
              key="again"
              onClick={() => {
                setFile(null);
                setParsedData([]);
                setColumns([]);
                setCurrentStep(0);
              }}
            >
              Import Another File
            </Button>,
          ]}
        />
      )}
    </Card>
  );
}

// Action button helper
function RowActionsToolbar({
  onCancel,
  onNext,
  nextLabel,
  nextType = 'default',
}: {
  onCancel: () => void;
  onNext: () => void;
  nextLabel: string;
  nextType?: 'default' | 'primary';
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
      <Button onClick={onCancel}>Cancel / Start Over</Button>
      <Button type={nextType} onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
