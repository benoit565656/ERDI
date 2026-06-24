import React from 'react';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import { ConfigProvider, theme } from 'antd';
import '../../public/css/normalize.css';
import '../../public/css/webflow.css';
import '../../public/css/erdi-site.webflow.css';
import './explorer-custom.css';

export const metadata = {
  title: 'ERDI Data Explorer',
  description: 'Statistical explorer where users can quickly find, compare, analyze, and visualize data.',
};

export default function DataExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#155dfc', // ADB Accent Blue
          colorInfo: '#155dfc',
          borderRadius: 12,          // Matching card rounding
          fontFamily: 'Inter, sans-serif',
        },
        components: {
          Checkbox: {
            borderRadiusSM: 4,
          },
        },
      }}
    >
      <PublicLayoutWrapper>{children}</PublicLayoutWrapper>
    </ConfigProvider>
  );
}
