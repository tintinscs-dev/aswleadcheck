import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/db';
import Topbar from '../../components/Topbar';
import Link from 'next/link';
import { calcQuote, fmt } from '../../lib/calc';

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;
  if (user.role !== 'manager' && user.role !== 'admin') redirect('/dashboard');

  const pending = await prisma.quote.findMany({ where: { status: 'pending' }, orderBy: { updatedAt: 'asc' } });
  const quotes = JSON.parse(JSON.stringify(pending));

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Báo giá chờ duyệt</h2>
        <div className="pagesub">Danh sách báo giá Sales đã gửi, chờ Manager/Admin phê duyệt</div>
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table>
            <thead><tr><th>No.</th><th>Shipper</th><th>Consignee</th><th>Tuyến</th><th>Sales</th><th style={{ textAlign: 'right' }}>KQKD (USD)</th><th>Thao tác</th></tr></thead>
            <tbody>
              {quotes.length === 0 && <tr><td colSpan={7} className="empty-state">Không có báo giá nào chờ duyệt.</td></tr>}
              {quotes.map(q => {
                const r = calcQuote(q);
                return (
                  <tr key={q.id}>
                    <td>{q.no || '-'}</td><td>{q.shpr || '-'}</td><td>{q.cnee || '-'}</td><td>{q.pol} → {q.pod}</td>
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
