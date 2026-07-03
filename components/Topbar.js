'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLang } from './LangContext';

const ROLE_LABEL = { sales: 'Sales', operation: 'Operation', manager: 'Manager', admin: 'Admin' };

export default function Topbar({ user }) {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const isActive = p => (pathname === p || pathname.startsWith(p + '/')) ? 'active' : '';

  return (
    <div className="topbar">
      <div className="brand"><span className="dot"></span> {t('app.name')}</div>
      <div className="topnav">
        <Link href="/dashboard"><button className={isActive('/dashboard')}>{t('nav.dashboard')}</button></Link>
        <Link href="/quotes/new"><button className={isActive('/quotes/new')}>{t('nav.newQuote')}</button></Link>
        <Link href="/fx-rates"><button className={isActive('/fx-rates')}>{t('nav.fxRates')}</button></Link>
        {(user.role === 'manager' || user.role === 'admin') && (
          <Link href="/approvals"><button className={isActive('/approvals')}>{t('nav.approvals')}</button></Link>
        )}
        {user.role === 'admin' && (
          <Link href="/admin/users"><button className={isActive('/admin/users')}>{t('nav.users')}</button></Link>
        )}
      </div>
      <div className="userbox">
        <button
          className="btn-lang"
          onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
          title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        >
          {t('nav.lang')}
        </button>
        <span className={`role-badge role-${user.role}`}>{ROLE_LABEL[user.role] || user.role}</span>
        <span>{user.name}</span>
        <button className="btn btn-outline" onClick={() => signOut({ callbackUrl: '/login' })}>{t('nav.logout')}</button>
      </div>
    </div>
  );
}
