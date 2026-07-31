import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import Topbar from '../../../components/Topbar';
import ActivityClient from './ActivityClient';
import { can } from '../../../lib/permissions';

export default async function ActivityLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;
  if (!(await can(user.role, 'view_activity_log'))) redirect('/dashboard');

  const [quotes, users] = await Promise.all([
    prisma.quote.findMany({
      select: { id: true, no: true, pol: true, pod: true, sales: true, history: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
  ]);

  // Flatten every quote's history into one combined, chronologically-sorted feed —
  // this is the per-account audit trail: who did what, on which quote, and when.
  const events = [];
  quotes.forEach(q => {
    const hist = Array.isArray(q.history) ? q.history : [];
    hist.forEach((h, i) => {
      events.push({
        key: `${q.id}-${i}`,
        quoteId: q.id,
        quoteNo: q.no || q.id,
        route: [q.pol, q.pod].filter(Boolean).join(' → ') || '-',
        sales: q.sales || '-',
        by: h.by || '-',
        byId: h.byId || null,
        role: h.role || '-',
        action: h.action || '-',
        comment: h.comment || '',
        changes: Array.isArray(h.changes) ? h.changes : [],
        date: h.date || null,
      });
    });
  });
  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Nhật ký hoạt động</h2>
        <div className="pagesub">Toàn bộ hoạt động của mọi tài khoản trên tất cả báo giá — lọc theo tài khoản, thời gian, loại hành động.</div>
        <ActivityClient events={JSON.parse(JSON.stringify(events))} users={JSON.parse(JSON.stringify(users))} />
      </div>
    </div>
  );
}
