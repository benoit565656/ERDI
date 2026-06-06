/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'rc-util',
    '@ant-design/icons',
    'antd',
    'rc-pagination',
    'rc-picker',
    'rc-tree',
    'rc-table',
  ],
};

module.exports = nextConfig;
