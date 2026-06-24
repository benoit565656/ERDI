import React from 'react';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import { ConfigProvider, theme } from 'antd';
import '../../public/css/normalize.css';
import '../../public/css/webflow.css';
import '../../public/css/erdi-site.webflow.css';

export const metadata = {
  title: 'Country Outlook',
  description: 'Country Outlook profiles listing active countries with flags and observation values.',
};

export default function CountryOutlookLayout({
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
