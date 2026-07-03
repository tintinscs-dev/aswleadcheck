import './globals.css';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/auth';
import Providers from '../components/Providers';

export const metadata = {
  title: 'Sales Shipment Proposal',
  description: 'Hệ thống báo giá lô hàng & duyệt nội bộ',
};

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="vi">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
