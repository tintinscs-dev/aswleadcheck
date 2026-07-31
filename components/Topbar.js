'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLang } from './LangContext';

const ROLE_LABEL = { sales: 'Sales', pricing: 'Pricing', operation: 'Operation', manager: 'Manager', accounting: 'Accounting', admin: 'Admin' };

export default function Topbar({ user }) {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const isActive = p => (pathname === p || pathname.startsWith(p + '/')) ? 'active' : '';

  // Nav visibility follows the dynamic permission matrix (see /admin/permissions),
  // not a hard-coded role list. While it's loading, fall back to the old
  // role-based default so admin/manager don't see the menu flicker away.
  const [perms, setPerms] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/permissions/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.perms) setPerms(d.perms); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user.role]);

  const fallbackAdminOrManager = user.role === 'admin' || user.role === 'manager';
  const showApprovals = perms ? (perms.approve_quote || perms.approve_adjustment) : fallbackAdminOrManager;
  const showActivity  = perms ? perms.view_activity_log : fallbackAdminOrManager;
  const showUsers     = perms ? perms.manage_users : user.role === 'admin';

  return (
    <div className="topbar">
      <div className="brand"><span className="dot"></span> {t('app.name')}</div>
      <div className="topnav">
        <Link href="/dashboard"><button className={isActive('/dashboard')}>{t('nav.dashboard')}</button></Link>
        <Link href="/quotes/new"><button className={isActive('/quotes/new')}>{t('nav.newQuote')}</button></Link>
        <Link href="/fx-rates"><button className={isActive('/fx-rates')}>{t('nav.fxRates')}</button></Link>
        {showApprovals && (
          <Link href="/approvals"><button className={isActive('/approvals')}>{t('nav.approvals')}</button></Link>
        )}
        {showActivity && (
          <Link href="/admin/activity"><button className={isActive('/admin/activity')}>{t('nav.activity')}</button></Link>
        )}
        {(user.role === 'manager' || user.role === 'admin') && (
          <Link href="/admin/permissions"><button className={isActive('/admin/permissions')}>{t('nav.permissions')}</button></Link>
        )}
        {showUsers && (
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
