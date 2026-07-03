import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import Topbar from '../../../../components/Topbar';
import { calcQuote, statusLabel, expiryDateLabel, migrateQuote } from '../../../../lib/calc';
import { SummaryInner } from '../../QuoteForm';
import ReadOnlyItems from './ReadOnlyItems';
import ApproveBox from './ApproveBox';
import CopyButton from './CopyButton';
import DeleteButton from './DeleteButton';

export default async function QuoteViewPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) notFound();
  if (user.role === 'sales' && quote.createdById !== user.id) redirect('/dashboard');

  const q = migrateQuote(JSON.parse(JSON.stringify(quote)));
  const r = calcQuote(q);
  const canApprove = (user.role === 'manager' || user.role === 'admin') && q.status === 'pending';
  const canAdjustFees = q.status === 'approved' && (user.role === 'admin' || user.role === 'manager');
  const canDelete = q.status === 'draft' && (user.role === 'admin' || q.createdById === user.id);
  const history = Array.isArray(q.history) ? q.history.slice().reverse() : [];
  const ACTION_LABELS = { submitted: 'GỬI DUYỆT', approved: 'ĐÃ DUYỆT', rejected: 'TỪ CHỐI', adjusted: 'ĐIỀU CHỈNH PHÍ' };

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Báo giá {q.no || q.id} <span className={`badge badge-${q.status}`}>{statusLabel(q.status)}</span></h2>
        <div className="pagesub">
          {[
            (q.shpr || q.cnee) && [q.shpr, q.cnee].filter(Boolean).join(' → '),
            (q.pol || q.pod) && [q.pol, q.pod].filter(Boolean).join(' → '),
            `Sales: ${q.sales || '-'}`,
          ].filter(Boolean).join('  |  ')}
        </div>
        <div className="layout-form">
          <div>
            <div className="card">
              <h3>Thông tin chung</h3>
              <div className="grid grid-3">
                <div><b>Term:</b> {q.term || '-'}</div><div><b>ETD:</b> {q.etd || '-'}</div><div><b>ETA:</b> {q.eta || '-'}</div>
                <div><b>20&apos;:</b> {q.qty20}</div><div><b>40&apos;:</b> {q.qty40}</div><div><b>CBM:</b> {q.lcl}</div>
                <div><b>G.W (kg):</b> {q.weight}</div><div><b>C.W (kg):</b> {q.cw || 0}</div><div><b>Số kiện:</b> {q.pieces || 0} PKGS</div>
                <div><b>Agent:</b> {q.agent || '-'}</div>
                <div><b>Line:</b> {q.lineCoLoader || '-'}</div><div><b>Hết hiệu lực:</b> {expiryDateLabel(q.createdAt, q.validDays)}</div>
                {q.keys && <div><b>Commodity:</b> {q.keys}</div>}
                {q.notes && <div style={{ gridColumn: '1 / -1' }}><b>Ghi chú:</b> {q.notes}</div>}
              </div>
            </div>
            <h3 style={{ margin: '18px 0 8px' }}>Chi tiết các hạng mục đã nhập</h3>
            <div className="pagesub" style={{ marginTop: -4 }}>Hiển thị đầy đủ cho người xem / người duyệt và các bộ phận liên quan để tiếp tục xử lý.</div>
            <ReadOnlyItems q={q} />
            <div className="card">
              <h3>Lịch sử / Duyệt</h3>
              {history.length === 0 && <div className="empty-state">Chưa có lịch sử.</div>}
              {history.map((h, i) => (
                <div className="history-item" key={i}>
                  <b>{ACTION_LABELS[h.action] || h.action.toUpperCase()}</b> — {h.comment || ''}
                  <div className="meta">{h.by} ({h.role}) · {new Date(h.date).toLocaleString('vi-VN')}</div>
                  {h.action === 'adjusted' && Array.isArray(h.changes) && h.changes.length > 0 && (
                    <ul className="diff-list">
                      {h.changes.map((c, ci) => <li key={ci}>{c}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              {canApprove && <ApproveBox quoteId={q.id} />}
              {canAdjustFees && (
                <div className="actions-row">
                  <a className="btn btn-outline" href={`/quotes/${q.id}`}>💾 Điều chỉnh phí (giá mua / giá bán)</a>
                </div>
              )}
            </div>
          </div>
          <div className="summary-panel">
            <div className="card">
              <h3>Kết quả tính toán</h3>
              <SummaryInner r={r} />
            </div>
          </div>
        </div>
        <div className="actions-row">
          <a className="btn btn-outline" href="/dashboard">← Quay lại Dashboard</a>
          <CopyButton quoteId={q.id} />
          {canDelete && <DeleteButton quoteId={q.id} quoteNo={q.no} />}
        </div>
        <div className="actions-row">
          <a className="btn btn-primary" href={`/api/quotes/${q.id}/pdf`}>⬇ Xuất PDF Costing/Selling</a>
        </div>
        <div className="actions-row">
          <a className="btn btn-ok" href={`/api/quotes/${q.id}/print-pdf`}>🖨 In báo giá VI (PDF)</a>
          <a className="btn btn-ok" href={`/api/quotes/${q.id}/print-pdf?lang=en`}>🖨 In báo giá EN (PDF)</a>
          <a className="btn btn-ok" href={`/api/quotes/${q.id}/print-excel`}>🖨 In báo giá VI (Excel)</a>
          <a className="btn btn-ok" href={`/api/quotes/${q.id}/print-excel?lang=en`}>🖨 In báo giá EN (Excel)</a>
        </div>
      </div>
    </div>
  );
}
