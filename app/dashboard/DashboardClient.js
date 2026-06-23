'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { MODES, MODE_LABELS, calcQuote, quoteModes, fmt, statusLabel } from '../../lib/calc';

const PORTS = ['Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Vũng Tàu', 'Hà Nội'];

export default function DashboardClient({ quotes, user }) {
  const [filters, setFilters] = useState({ mode: '', status: '', sales: '', pol: '', pod: '', search: '' });
  const [chartReady, setChartReady] = useState(false);
  const modeChartRef = useRef(null), statusChartRef = useRef(null), salesChartRef = useRef(null);
  const chartInstances = useRef({});

  const salesNames = useMemo(() => [...new Set(quotes.map(q => q.sales).filter(Boolean))], [quotes]);

  const filtered = useMemo(() => quotes.filter(q => {
    if (filters.mode && !quoteModes(q).includes(filters.mode)) return false;
    if (filters.status && q.status !== filters.status) return false;
    if (filters.sales && q.sales !== filters.sales) return false;
    if (filters.pol && q.pol !== filters.pol) return false;
    if (filters.pod && !(q.pod || '').toLowerCase().includes(filters.pod.toLowerCase())) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const hay = `${q.no || ''} ${q.shpr || ''} ${q.cnee || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [quotes, filters]);

  const totalKQKD = filtered.reduce((a, q) => a + calcQuote(q).KQKD, 0);
  const pending = filtered.filter(q => q.status === 'pending').length;
  const approved = filtered.filter(q => q.status === 'approved').length;
  const draft = filtered.filter(q => q.status === 'draft').length;

  useEffect(() => {
    if (!chartReady || typeof window === 'undefined' || !window.Chart) return;
    const Chart = window.Chart;
    Object.values(chartInstances.current).forEach(c => c && c.destroy());
    chartInstances.current = {};
    const navy = '#0b2545', navy2 = '#13315c', ok = '#1d7a4f', warn = '#c98a1f', danger = '#c0392b';

    const modeCounts = { fcl20: 0, fcl40: 0, lclair: 0 };
    filtered.forEach(q => quoteModes(q).forEach(m => modeCounts[m]++));
    if (modeChartRef.current) {
      chartInstances.current.mode = new Chart(modeChartRef.current, {
        type: 'pie',
        data: { labels: [MODE_LABELS.fcl20, MODE_LABELS.fcl40, MODE_LABELS.lclair], datasets: [{ data: [modeCounts.fcl20, modeCounts.fcl40, modeCounts.lclair], backgroundColor: [navy2, navy, ok] }] },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    const statusCounts = { draft: 0, pending: 0, approved: 0, rejected: 0 };
    filtered.forEach(q => statusCounts[q.status] = (statusCounts[q.status] || 0) + 1);
    if (statusChartRef.current) {
      chartInstances.current.status = new Chart(statusChartRef.current, {
        type: 'pie',
        data: { labels: ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'], datasets: [{ data: [statusCounts.draft, statusCounts.pending, statusCounts.approved, statusCounts.rejected], backgroundColor: ['#8a8f98', warn, ok, danger] }] },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    const bySales = {};
    filtered.forEach(q => { const s = q.sales || '(chưa gán)'; bySales[s] = (bySales[s] || 0) + calcQuote(q).KQKD; });
    const salesLabels = Object.keys(bySales);
    if (salesChartRef.current) {
      chartInstances.current.sales = new Chart(salesChartRef.current, {
        type: 'bar',
        data: { labels: salesLabels.length ? salesLabels : ['-'], datasets: [{ label: 'KQKD (USD)', data: salesLabels.length ? salesLabels.map(s => bySales[s]) : [0], backgroundColor: navy2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }
  }, [chartReady, filtered]);

  const rows = filtered.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js" onReady={() => setChartReady(true)} onLoad={() => setChartReady(true)} />
      <h2>Dashboard báo giá</h2>
      <div className="pagesub">Theo dõi và lọc các báo giá FCL / LCL / AIR theo bộ lọc</div>

      <div className="kpis">
        <div className="kpi"><div className="lbl">Tổng báo giá</div><div className="val">{filtered.length}</div></div>
        <div className="kpi warn"><div className="lbl">Chờ duyệt</div><div className="val">{pending}</div></div>
        <div className="kpi ok"><div className="lbl">Đã duyệt</div><div className="val">{approved}</div></div>
        <div className="kpi"><div className="lbl">Bản nháp</div><div className="val">{draft}</div></div>
        <div className={`kpi ${totalKQKD >= 0 ? 'ok' : 'warn'}`}><div className="lbl">Tổng KQKD (USD)</div><div className="val">{fmt(totalKQKD)}</div></div>
      </div>

      <div className="charts-grid">
        <div className="card chart-card"><div className="chart-title">Cơ cấu loại hàng (FCL/LCL/Air)</div><div className="chart-wrap"><canvas ref={modeChartRef}></canvas></div></div>
        <div className="card chart-card"><div className="chart-title">Cơ cấu trạng thái duyệt</div><div className="chart-wrap"><canvas ref={statusChartRef}></canvas></div></div>
        <div className="card chart-card"><div className="chart-title">KQKD theo Sales</div><div className="chart-wrap"><canvas ref={salesChartRef}></canvas></div></div>
      </div>

      <div className="filterbar">
        <div className="field"><label>Loại hàng</label>
          <select value={filters.mode} onChange={e => setFilters(f => ({ ...f, mode: e.target.value }))}>
            <option value="">Tất cả</option>
            {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="field"><label>Trạng thái</label>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
        <div className="field"><label>Sales</label>
          <select value={filters.sales} onChange={e => setFilters(f => ({ ...f, sales: e.target.value }))}>
            <option value="">Tất cả</option>
            {salesNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field"><label>POL</label>
          <select value={filters.pol} onChange={e => setFilters(f => ({ ...f, pol: e.target.value }))}>
            <option value="">Tất cả</option>
            {PORTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field"><label>POD chứa</label><input value={filters.pod} onChange={e => setFilters(f => ({ ...f, pod: e.target.value }))} placeholder="vd: Busan" /></div>
        <div className="field"><label>Tìm kiếm</label><input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Số booking / shipper / consignee" /></div>
        <a className="btn btn-primary" href="/api/quotes/export-all">⬇ Xuất Excel</a>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table>
          <thead><tr><th>No.</th><th>Loại hàng</th><th>Shipper</th><th>Consignee</th><th>Tuyến</th><th>Sales</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>KQKD (USD)</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="empty-state">Chưa có báo giá nào. Bấm &quot;Tạo báo giá&quot; để bắt đầu.</td></tr>}
            {rows.map(q => {
              const r = calcQuote(q);
              const canEdit = ((q.status === 'draft' || q.status === 'rejected') && (user.role === 'admin' || q.createdById === user.id))
                || (q.status === 'approved' && (user.role === 'admin' || user.role === 'manager'));
              return (
                <tr key={q.id}>
                  <td>{q.no || '-'}</td>
                  <td>{quoteModes(q).map(m => <span key={m} className="mode-pill">{MODE_LABELS[m]}</span>)}</td>
                  <td>{q.shpr || '-'}</td>
                  <td>{q.cnee || '-'}</td>
                  <td>{q.pol || '-'} → {q.pod || '-'}</td>
                  <td>{q.sales || '-'}</td>
                  <td><span className={`badge badge-${q.status}`}>{statusLabel(q.status)}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: r.KQKD >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.KQKD)}</td>
                  <td>
                    <Link href={`/quotes/${q.id}/view`}><button className="btn btn-outline btn-sm">Xem</button></Link>
                    {canEdit && <Link href={`/quotes/${q.id}`}><button className="btn btn-outline btn-sm">{q.status === 'approved' ? 'Điều chỉnh phí' : 'Sửa'}</button></Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
