import React from 'react';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import { ConfigProvider, theme } from 'antd';
import '../../public/css/normalize.css';
import '../../public/css/webflow.css';
import '../../public/css/erdi-site.webflow.css';
import '../data-explorer/explorer-custom.css';

export const metadata = {
  title: 'AI Data Explorer',
  description: 'AI-powered Conversational Economic Data Assistant and Dashboard Generator.',
};

export default function AiDataExplorerLayout({
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
          borderRadius: 12,
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
