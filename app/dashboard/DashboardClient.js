'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { MODES, MODE_LABELS, calcQuote, quoteModes, fmt, statusLabel } from '../../lib/calc';

const PORTS = ['Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Vũng Tàu', 'Hà Nội'];

export default function DashboardClient({ quotes, user, canProposeAdjustment = false }) {
  const router = useRouter();
  const [copyingId, setCopyingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [localQuotes, setLocalQuotes] = useState(quotes);
  const [filters, setFilters] = useState({ mode: '', status: '', sales: '', pol: '', pod: '', search: '', year: '', month: '' });

  async function copyQuote(id) {
    setCopyingId(id);
    try {
      const res = await fetch(`/api/quotes/${id}/duplicate`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Sao chép thất bại.');
      router.push(`/quotes/${body.id}`);
    } catch (e) {
      alert(e.message);
      setCopyingId(null);
    }
  }

  async function deleteQuote(id, no) {
    if (!confirm(`Xoá báo giá ${no || ''} (bản nháp)? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Xoá thất bại.');
      setLocalQuotes(qs => qs.filter(q => q.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  }
  const [chartReady, setChartReady] = useState(false);
  const modeChartRef = useRef(null), statusChartRef = useRef(null), salesChartRef = useRef(null), timeChartRef = useRef(null), routeChartRef = useRef(null);
  const chartInstances = useRef({});

  const salesNames = useMemo(() => [...new Set(localQuotes.map(q => q.sales).filter(Boolean))], [localQuotes]);

  const polOptions = useMemo(() => [...new Set([...PORTS, ...localQuotes.map(q => q.pol).filter(Boolean)])], [localQuotes]);

  const yearsAvailable = useMemo(() => {
    const ys = new Set();
    localQuotes.forEach(q => {
      const d = q.createdAt ? new Date(q.createdAt) : null;
      if (d && !isNaN(d)) ys.add(d.getFullYear());
    });
    return [...ys].sort((a, b) => b - a);
  }, [localQuotes]);

  const filtered = useMemo(() => localQuotes.filter(q => {
    if (filters.mode && !quoteModes(q).includes(filters.mode)) return false;
    if (filters.status && q.status !== filters.status) return false;
    if (filters.sales && q.sales !== filters.sales) return false;
    if (filters.pol && q.pol !== filters.pol) return false;
    if (filters.pod && !(q.pod || '').toLowerCase().includes(filters.pod.toLowerCase())) return false;
    if (filters.year || filters.month) {
      const d = q.createdAt ? new Date(q.createdAt) : null;
      if (!d || isNaN(d)) return false;
      if (filters.year && d.getFullYear() !== Number(filters.year)) return false;
      if (filters.month && (d.getMonth() + 1) !== Number(filters.month)) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const hay = `${q.no || ''} ${q.shpr || ''} ${q.cnee || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [localQuotes, filters]);

  const totalKQKD      = filtered.reduce((a, q) => a + calcQuote(q).KQKD, 0);
  const pricingReview  = filtered.filter(q => q.status === 'pricing_review').length;
  const pending        = filtered.filter(q => q.status === 'pending').length;
  const approved       = filtered.filter(q => q.status === 'approved').length;
  const draft          = filtered.filter(q => q.status === 'draft').length;
  const adjPending     = filtered.filter(q => q.pendingAdjustment).length;

  // Average calendar days from creation to the Manager-approval history entry —
  // a quick read on how fast quotes move through the pipeline for CEO/manager review.
  const avgApprovalDays = useMemo(() => {
    const durations = filtered
      .filter(q => q.createdAt && Array.isArray(q.history))
      .map(q => {
        const approvedEntry = q.history.find(h => h.action === 'approved');
        if (!approvedEntry) return null;
        const start = new Date(q.createdAt).getTime();
        const end = new Date(approvedEntry.date).getTime();
        if (isNaN(start) || isNaN(end) || end < start) return null;
        return (end - start) / 86400000;
      })
      .filter(v => v !== null);
    if (!durations.length) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [filtered]);

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

    const statusCounts = { draft: 0, pricing_review: 0, pending: 0, approved: 0, rejected: 0 };
    filtered.forEach(q => { statusCounts[q.status] = (statusCounts[q.status] || 0) + 1; });
    if (statusChartRef.current) {
      chartInstances.current.status = new Chart(statusChartRef.current, {
        type: 'pie',
        data: {
          labels: ['Nháp', 'Chờ Pricing', 'Chờ Manager', 'Đã duyệt', 'Từ chối'],
          datasets: [{ data: [statusCounts.draft, statusCounts.pricing_review, statusCounts.pending, statusCounts.approved, statusCounts.rejected], backgroundColor: ['#8a8f98', '#c98a1f', '#1a73e8', ok, danger] }],
        },
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

    const byMonth = {};
    filtered.forEach(q => {
      const d = q.createdAt ? new Date(q.createdAt) : null;
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { count: 0, kqkd: 0 };
      byMonth[key].count++;
      byMonth[key].kqkd += calcQuote(q).KQKD;
    });
    const byRoute = {};
    filtered.forEach(q => {
      const route = `${q.pol || '-'} → ${q.pod || '-'}`;
      if (!byRoute[route]) byRoute[route] = { count: 0, kqkd: 0 };
      byRoute[route].count++;
      byRoute[route].kqkd += calcQuote(q).KQKD;
    });
    const topRoutes = Object.entries(byRoute).sort((a, b) => b[1].kqkd - a[1].kqkd).slice(0, 6);
    if (routeChartRef.current) {
      chartInstances.current.route = new Chart(routeChartRef.current, {
        type: 'bar',
        data: {
          labels: topRoutes.length ? topRoutes.map(([r]) => r) : ['-'],
          datasets: [{ label: 'KQKD (USD)', data: topRoutes.length ? topRoutes.map(([, v]) => v.kqkd) : [0], backgroundColor: navy }],
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    const monthKeys = Object.keys(byMonth).sort();
    const monthLabels = monthKeys.map(k => { const [y, m] = k.split('-'); return `${m}/${y}`; });
    if (timeChartRef.current) {
      chartInstances.current.time = new Chart(timeChartRef.current, {
        data: {
          labels: monthKeys.length ? monthLabels : ['-'],
          datasets: [
            { type: 'bar', label: 'Số báo giá', data: monthKeys.length ? monthKeys.map(k => byMonth[k].count) : [0], backgroundColor: navy2, yAxisID: 'y' },
            { type: 'line', label: 'KQKD (USD)', data: monthKeys.length ? monthKeys.map(k => byMonth[k].kqkd) : [0], borderColor: ok, backgroundColor: ok, yAxisID: 'y1', tension: 0.3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Số báo giá' } },
            y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'KQKD (USD)' } },
          },
        },
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
        <div className="kpi warn"><div className="lbl">Chờ Pricing</div><div className="val">{pricingReview}</div></div>
        <div className="kpi warn"><div className="lbl">Chờ Manager duyệt</div><div className="val">{pending}</div></div>
        <div className="kpi ok"><div className="lbl">Đã duyệt</div><div className="val">{approved}</div></div>
        <div className="kpi"><div className="lbl">Bản nháp</div><div className="val">{draft}</div></div>
        <div className={`kpi ${adjPending > 0 ? 'warn' : ''}`}><div className="lbl">Chờ duyệt điều chỉnh</div><div className="val">{adjPending}</div></div>
        <div className="kpi"><div className="lbl">Thời gian duyệt TB (ngày)</div><div className="val">{avgApprovalDays === null ? '-' : avgApprovalDays.toFixed(1)}</div></div>
        <div className={`kpi ${totalKQKD >= 0 ? 'ok' : 'warn'}`}><div className="lbl">Tổng KQKD (USD)</div><div className="val">{fmt(totalKQKD)}</div></div>
      </div>

      <h3 className="section-title">Cơ cấu chung</h3>
      <div className="charts-grid">
        <div className="card chart-card"><div className="chart-title">Cơ cấu loại hàng (FCL/LCL/Air)</div><div className="chart-wrap"><canvas ref={modeChartRef}></canvas></div></div>
        <div className="card chart-card"><div className="chart-title">Cơ cấu trạng thái duyệt</div><div className="chart-wrap"><canvas ref={statusChartRef}></canvas></div></div>
      </div>

      <h3 className="section-title">Hiệu suất Sales &amp; Tuyến</h3>
      <div className="charts-grid">
        <div className="card chart-card"><div className="chart-title">KQKD theo Sales</div><div className="chart-wrap"><canvas ref={salesChartRef}></canvas></div></div>
        <div className="card chart-card"><div className="chart-title">Top tuyến (POL → POD) theo KQKD</div><div className="chart-wrap"><canvas ref={routeChartRef}></canvas></div></div>
      </div>

      <h3 className="section-title">Xu hướng theo thời gian</h3>
      <div className="charts-grid">
        <div className="card chart-card" style={{ gridColumn: '1 / -1' }}><div className="chart-title">Số báo giá &amp; KQKD theo tháng</div><div className="chart-wrap"><canvas ref={timeChartRef}></canvas></div></div>
      </div>

      <div className="filterbar">
        <div className="field"><label>Năm</label>
          <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
            <option value="">Tất cả</option>
            {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field"><label>Tháng</label>
          <select value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}>
            <option value="">Tất cả</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{`Tháng ${m}`}</option>)}
          </select>
        </div>
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
            <option value="pricing_review">Chờ Pricing</option>
            <option value="pending">Chờ Manager duyệt</option>
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
            {polOptions.map(p => <option key={p} value={p}>{p}</option>)}
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
                || (q.status === 'approved' && canProposeAdjustment && (!q.pendingAdjustment || user.role === 'admin')
                    && (user.role !== 'sales' || q.createdById === user.id));
              const canDelete = q.status === 'draft' && (user.role === 'admin' || q.createdById === user.id);
              return (
                <tr key={q.id}>
                  <td>{q.no || '-'}</td>
                  <td>{quoteModes(q).map(m => <span key={m} className="mode-pill">{MODE_LABELS[m]}</span>)}</td>
                  <td>{q.shpr || '-'}</td>
                  <td>{q.cnee || '-'}</td>
                  <td>{q.pol || '-'} → {q.pod || '-'}</td>
                  <td>{q.sales || '-'}</td>
                  <td>
                    <span className={`badge badge-${q.status}`}>{statusLabel(q.status)}</span>
                    {q.pendingAdjustment && <span className="badge badge-pricing_review" style={{ marginLeft: 4 }}>⏳ Điều chỉnh</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: r.KQKD >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.KQKD)}</td>
                  <td>
                    <Link href={`/quotes/${q.id}/view`}><button className="btn btn-outline btn-sm">Xem</button></Link>
                    {canEdit && <Link href={`/quotes/${q.id}`}><button className="btn btn-outline btn-sm">{q.status === 'approved' ? 'Điều chỉnh phí' : 'Sửa'}</button></Link>}
                    <button className="btn btn-outline btn-sm" disabled={copyingId === q.id} onClick={() => copyQuote(q.id)} title="Sao chép báo giá này để nhập lô hàng tương tự">
                      {copyingId === q.id ? '…' : '⧉ Copy'}
                    </button>
                    {canDelete && (
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} disabled={deletingId === q.id} onClick={() => deleteQuote(q.id, q.no)} title="Xoá báo giá nháp này">
                        {deletingId === q.id ? '…' : '🗑 Xoá'}
                      </button>
                    )}
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
