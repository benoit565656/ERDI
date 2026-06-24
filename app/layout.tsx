import React from 'react';
import { Providers } from './providers';
import './global.css';

export const metadata = {
  title: 'ERDI Platform Admin',
  description: 'Enterprise SDMX Administrative Platform',
  icons: {
    icon: '/images/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ margin: 0, padding: 0, height: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
