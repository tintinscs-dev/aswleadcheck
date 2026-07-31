import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/db';
import Topbar from '../../components/Topbar';
import Link from 'next/link';
import { calcQuote, fmt } from '../../lib/calc';
import { can } from '../../lib/permissions';

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;
  const canApproveQuote      = await can(user.role, 'approve_quote');
  const canApproveAdjustment = await can(user.role, 'approve_adjustment');
  if (!canApproveQuote && !canApproveAdjustment) redirect('/dashboard');

  const [pending, adjustments] = await Promise.all([
    canApproveQuote
      ? prisma.quote.findMany({ where: { status: 'pending' }, orderBy: { updatedAt: 'asc' } })
      : [],
    canApproveAdjustment
      ? prisma.quote.findMany({ where: { status: 'approved', pendingAdjustment: { not: null } }, orderBy: { updatedAt: 'asc' } })
      : [],
  ]);
  const quotes = JSON.parse(JSON.stringify(pending)).map(q => ({ ...q, kind: 'new' }));
  const adjQuotes = JSON.parse(JSON.stringify(adjustments)).map(q => ({ ...q, kind: 'adjustment' }));
  const all = [...quotes, ...adjQuotes];

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Báo giá chờ duyệt</h2>
        <div className="pagesub">Danh sách báo giá Sales đã gửi và đề xuất điều chỉnh phí, chờ Manager/Admin phê duyệt</div>
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table>
            <thead><tr><th>No.</th><th>Loại</th><th>Shipper</th><th>Consignee</th><th>Tuyến</th><th>Sales</th><th style={{ textAlign: 'right' }}>KQKD (USD)</th><th>Thao tác</th></tr></thead>
            <tbody>
              {all.length === 0 && <tr><td colSpan={8} className="empty-state">Không có báo giá nào chờ duyệt.</td></tr>}
              {all.map(q => {
                const r = calcQuote(q);
                return (
                  <tr key={`${q.kind}-${q.id}`}>
                    <td>{q.no || '-'}</td>
                    <td>{q.kind === 'adjustment'
                      ? <span className="badge badge-pricing_review">⏳ Điều chỉnh phí</span>
                      : <span className="badge badge-pending">Báo giá mới</span>}</td>
                    <td>{q.shpr || '-'}</td><td>{q.cnee || '-'}</td><td>{q.pol} → {q.pod}</td>
                    <td>{q.sales || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: r.KQKD >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.KQKD)}</td>
                    <td><Link href={`/quotes/${q.id}/view`}><button className="btn btn-outline btn-sm">Xem &amp; Duyệt</button></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
