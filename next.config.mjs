/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['jszip', 'pdfkit'] }
};
export default nextConfig;
