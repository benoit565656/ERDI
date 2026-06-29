import { Metadata } from 'next';
import PublicLayoutWrapper from '@/components/PublicLayoutWrapper';
import '../../public/css/normalize.css';
import '../../public/css/webflow.css';
import '../../public/css/erdi-site.webflow.css';

export const metadata: Metadata = {
  title: 'API Documentation - ADB Economics & Research',
  description: 'REST and SDMX API Documentation for ERDI datasets including Key Indicators Database, Asian Development Outlook, ARIC, and EEMRIOT.',
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayoutWrapper>{children}</PublicLayoutWrapper>;
}
