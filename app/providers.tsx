'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { useUIStore } from '@/lib/store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const themeMode = useUIStore((state) => state.themeMode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a premium Dark theme by default during hydration to avoid flash
  const algorithm = !mounted || themeMode === 'dark' 
    ? theme.darkAlgorithm 
    : theme.defaultAlgorithm;

  const premiumTheme = {
    algorithm,
    token: {
      colorPrimary: '#6366f1', // Sleek Indigo
      colorInfo: '#3b82f6',     // Info Blue
      borderRadius: 8,          // Modern rounded corners
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={premiumTheme}>
        <AntdRegistry>{children}</AntdRegistry>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
