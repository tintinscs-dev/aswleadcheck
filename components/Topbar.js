'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

const ROLE_LABEL = { sales: 'Sales', manager: 'Manager', admin: 'Admin' };

export default function Topbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = p => (pathname === p || pathname.startsWith(p + '/')) ? 'active' : '';

  return (
    <div className="topbar">
      <div className="brand"><span className="dot"></span> ASW Sales Shipment Proposal</div>
      <div className="topnav">
        <Link href="/dashboard"><button className={isActive('/dashboard')}>Dashboard</button></Link>
        <Link href="/quotes/new"><button className={isActive('/quotes/new')}>Tạo báo giá</button></Link>
        {(user.role === 'manager' || user.role === 'admin') && (
          <Link href="/approvals"><button className={isActive('/approvals')}>Duyệt báo giá</button></Link>
        )}
        {user.role === 'admin' && (
          <Link href="/admin/users"><button className={isActive('/admin/users')}>Người dùng</button></Link>
        )}
      </div>
      <div className="userbox">
        <span className={`role-badge role-${user.role}`}>{ROLE_LABEL[user.role] || user.role}</span>
        <span>{user.name}</span>
        <button className="btn btn-outline" onClick={() => signOut({ callbackUrl: '/login' })}>Đăng xuất</button>
      </div>
    </div>
  );
}
