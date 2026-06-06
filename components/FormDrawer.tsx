'use client';

import React, { useState, useEffect } from 'react';
import { Drawer, Space, Button, Spin, Alert } from 'antd';
import { useForm, FormProvider, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface FormDrawerProps<TFieldValues extends FieldValues> {
  title: string;
  visible: boolean;
  onClose: () => void;
  schema: z.ZodType<any, any, any>;
  defaultValues?: TFieldValues;
  onSubmit: (data: TFieldValues) => Promise<void>;
  children: (form: UseFormReturn<TFieldValues>) => React.ReactNode;
  width?: number;
}

export default function FormDrawer<TFieldValues extends FieldValues>({
  title,
  visible,
  onClose,
  schema,
  defaultValues,
  onSubmit,
  children,
  width = 500,
}: FormDrawerProps<TFieldValues>) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formMethods = useForm<TFieldValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any,
  });

  const { handleSubmit, reset } = formMethods;

  // Reset form when defaultValues change or visibility toggles
  useEffect(() => {
    if (visible) {
      reset(defaultValues as any);
      setErrorMsg(null);
    }
  }, [visible, defaultValues, reset]);

  const handleFormSubmit = async (data: TFieldValues) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      console.error('Form submission error:', err);
      setErrorMsg(err.message || 'An error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={title}
      width={width}
      open={visible}
      onClose={onClose}
      destroyOnClose
      maskClosable={!submitting}
      extra={
        <Space>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit(handleFormSubmit)}
            loading={submitting}
          >
            Save Changes
          </Button>
        </Space>
      }
    >
      <Spin spinning={submitting}>
        <FormProvider {...formMethods}>
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            {errorMsg && (
              <Alert
                message="Error Saving"
                description={errorMsg}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            
            {/* Render fields using the formMethods context */}
            {children(formMethods)}
          </form>
        </FormProvider>
      </Spin>
    </Drawer>
  );
}
