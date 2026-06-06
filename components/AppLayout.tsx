'use client';

import React, { useMemo } from 'react';
import { Layout, Menu, Button, Breadcrumb, Space, Avatar, Tooltip, ConfigProvider } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  TableOutlined,
  CloudUploadOutlined,
  InteractionOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  UserOutlined,
  BranchesOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/store';
import Link from 'next/link';

const { Header, Sider, Content, Footer } = Layout;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';

  const { themeMode, sidebarCollapsed, toggleThemeMode, setSidebarCollapsed } = useUIStore();

  // Define sidebar menu options using Next.js Link
  const menuItems = useMemo(() => [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">Dashboard</Link>,
    },
    {
      key: 'structure-group',
      icon: <ClusterOutlined />,
      label: 'Structure',
      children: [
        {
          key: '/structure/agencies',
          label: <Link href="/structure/agencies">Agencies</Link>,
        },
        {
          key: '/structure/datasets',
          label: <Link href="/structure/datasets">Datasets</Link>,
        },
        {
          key: '/structure/dataflows',
          label: <Link href="/structure/dataflows">Dataflows</Link>,
        },
        {
          key: '/structure/hierarchy',
          icon: <BranchesOutlined />,
          label: <Link href="/structure/hierarchy">Visual Hierarchy</Link>,
        },
        {
          key: '/structure/dsds',
          label: <Link href="/structure/dsds">DSDs</Link>,
        },
        {
          key: '/structure/concept-schemes',
          label: <Link href="/structure/concept-schemes">Concept Schemes</Link>,
        },
      ],
    },
    {
      key: 'codelists-group',
      icon: <OrderedListOutlined />,
      label: 'Code Lists',
      children: [
        {
          key: '/codelists',
          label: <Link href="/codelists">Code Lists Manager</Link>,
        },
      ],
    },
    {
      key: 'data-group',
      icon: <DatabaseOutlined />,
      label: 'Data',
      children: [
        {
          key: '/data/indicators',
          label: <Link href="/data/indicators">Indicators</Link>,
        },
        {
          key: '/data/economies',
          label: <Link href="/data/economies">Economies</Link>,
        },
        {
          key: '/data/observations',
          label: <Link href="/data/observations">Observations Grid</Link>,
        },
      ],
    },
    {
      key: '/imports',
      icon: <CloudUploadOutlined />,
      label: <Link href="/imports">Import Center</Link>,
    },
    {
      key: '/harmonization',
      icon: <InteractionOutlined />,
      label: <Link href="/harmonization">Harmonization</Link>,
    },
    {
      key: '/explorer',
      icon: <FileSearchOutlined />,
      label: <Link href="/explorer">Page Builder</Link>,
    },
    {
      key: '/audit',
      icon: <HistoryOutlined />,
      label: <Link href="/audit">Audit & Logs</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link href="/settings">Settings</Link>,
    },
  ], []);

  // Compute breadcrumbs from pathname
  const breadcrumbItems = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const items = [{ title: <Link href="/dashboard">Home</Link> }];
    
    let currentPath = '';
    segments.forEach((seg, index) => {
      currentPath += `/${seg}`;
      const name = seg.charAt(0).toUpperCase() + seg.slice(1).replace('-', ' ');
      const isLast = index === segments.length - 1;
      
      items.push({
        title: isLast ? (
          <span>{name}</span>
        ) : (
          <Link href={currentPath}>{name}</Link>
        ),
      });
    });

    return items;
  }, [pathname]);

  // Find currently selected key(s)
  const selectedKeys = useMemo(() => {
    // Exact match or matches parent sub-path
    if (pathname === '/') return ['/dashboard'];
    return [pathname];
  }, [pathname]);

  // Find currently open submenu keys
  const openKeys = useMemo(() => {
    if (pathname.startsWith('/structure')) return ['structure-group'];
    if (pathname.startsWith('/data')) return ['data-group'];
    if (pathname.startsWith('/codelists')) return ['codelists-group'];
    return [];
  }, [pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        theme={themeMode}
        width={250}
        style={{
          boxShadow: '2px 0 8px 0 rgba(29,35,41,0.05)',
          zIndex: 10,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Brand Logo Header */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '0' : '0 24px',
            borderBottom: `1px solid ${themeMode === 'dark' ? '#303030' : '#f0f0f0'}`,
            overflow: 'hidden',
          }}
        >
          <Space size="middle">
            <ClusterOutlined style={{ fontSize: 24, color: '#6366f1' }} />
            {!sidebarCollapsed && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: themeMode === 'dark' ? '#fff' : '#000',
                  whiteSpace: 'nowrap',
                }}
              >
                ERDI Platform Admin
              </span>
            )}
          </Space>
        </div>

        {/* Menu Navigation Links */}
        <Menu
          mode="inline"
          theme={themeMode}
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          style={{ borderRight: 0, paddingTop: 16 }}
          items={menuItems}
        />
      </Sider>

      {/* Main App Layout */}
      <Layout>
        {/* Header Bar */}
        <Header
          style={{
            background: themeMode === 'dark' ? '#1f1f1f' : '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${themeMode === 'dark' ? '#303030' : '#f0f0f0'}`,
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 9,
            height: 64,
          }}
        >
          <Space size="large">
            {/* Collapse Trigger Button */}
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ fontSize: 16, width: 64, height: 64 }}
            />
            
            {/* Breadcrumb Navigation */}
            <Breadcrumb items={breadcrumbItems} />
          </Space>

          <Space size="middle">
            {/* Dark Mode Switcher */}
            <Tooltip title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <Button
                type="text"
                shape="circle"
                icon={themeMode === 'dark' ? <BulbFilled style={{ color: '#eab308' }} /> : <BulbOutlined />}
                onClick={toggleThemeMode}
                style={{ fontSize: 18 }}
              />
            </Tooltip>

            {/* Profile Avatar */}
            <Tooltip title="Administrator (ERDI)">
              <Avatar
                style={{ backgroundColor: '#6366f1', verticalAlign: 'middle', cursor: 'pointer' }}
                icon={<UserOutlined />}
              />
            </Tooltip>
          </Space>
        </Header>

        {/* Dynamic Content Panel */}
        <Content
          style={{
            margin: '24px 24px 0',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Content>

        {/* Footer */}
        <Footer style={{ textAlign: 'center', color: '#8c8c8c' }}>
          ERDI Statistical Platform Administration Panel ©2026 Developed by Antigravity
        </Footer>
      </Layout>
    </Layout>
  );
}
