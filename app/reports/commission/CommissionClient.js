'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fmt, statusLabel } from '../../../lib/calc';
import { filterCommissionRows, summarizeByMonth, visibleSides, monthLabel, dateLabel } from '../../../lib/commission';

export default function CommissionClient({ rows }) {
  const [filters, setFilters] = useState({ year: '', month: '', sales: '', status: 'approved' });
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const years = useMemo(() => [...new Set(rows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a), [rows]);
  const salesNames = useMemo(() => [...new Set(rows.map(r => r.sales).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => filterCommissionRows(rows, filters), [rows, filters]);
  const summary = useMemo(() => summarizeByMonth(filtered), [filtered]);
  const { showBuy, showSell, showTotal } = visibleSides(filtered);

  const totBuy = filtered.reduce((a, r) => a + r.buy, 0);
  const totSell = filtered.reduce((a, r) => a + r.sell, 0);

  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const cell = v => (v ? fmt(v) : '-');

  return (
    <>
      <h2>Báo cáo Commission (CKTM) theo tháng</h2>
      <div className="pagesub">Lấy từ dòng CKTM Sales đã nhập trong báo giá · quy đổi USD theo tỷ giá snapshot của từng báo giá · tháng tính theo ngày tạo báo giá</div>

      <div className="filterbar">
        <div className="field"><label>Năm</label>
          <select value={filters.year} onChange={e => set('year', e.target.value)}>
            <option value="">Tất cả</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field"><label>Tháng</label>
          <select value={filters.month} onChange={e => set('month', e.target.value)}>
            <option value="">Tất cả</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{`Tháng ${m}`}</option>)}
          </select>
        </div>
        <div className="field"><label>Sales</label>
          <select value={filters.sales} onChange={e => set('sales', e.target.value)}>
            <option value="">Tất cả</option>
            {salesNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field"><label>Trạng thái</label>
          <select value={filters.status} onChange={e => set('status', e.target.value)}>
            <option value="">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="pricing_review">Chờ Pricing</option>
            <option value="pending">Chờ Manager duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
        <a className="btn btn-primary" href={`/api/reports/commission/export${qs ? `?${qs}` : ''}`}>⬇ Xuất Excel</a>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lbl">Số job có com</div><div className="val">{filtered.length}</div></div>
        {showBuy && <div className="kpi"><div className="lbl">CKTM giá mua (USD)</div><div className="val">{fmt(totBuy)}</div></div>}
        {showSell && <div className="kpi"><div className="lbl">CKTM giá bán (USD)</div><div className="val">{fmt(totSell)}</div></div>}
        {showTotal && <div className="kpi ok"><div className="lbl">Tổng CKTM (USD)</div><div className="val">{fmt(totBuy + totSell)}</div></div>}
      </div>

      <h3 className="section-title">Tổng hợp theo tháng</h3>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table>
          <thead><tr>
            <th>Tháng</th><th>Sales</th><th style={{ textAlign: 'right' }}>Số job</th>
            {showBuy && <th style={{ textAlign: 'right' }}>CKTM mua (USD)</th>}
            {showSell && <th style={{ textAlign: 'right' }}>CKTM bán (USD)</th>}
            {showTotal && <th style={{ textAlign: 'right' }}>Tổng (USD)</th>}
          </tr></thead>
          <tbody>
            {summary.length === 0 && <tr><td colSpan={6} className="empty-state">Không có báo giá nào có CKTM trong bộ lọc này.</td></tr>}
            {summary.map(s => (
              <tr key={`${s.monthKey}|${s.sales}`}>
                <td>{monthLabel(s.monthKey)}</td>
                <td><span className="sales-name">{s.sales}</span></td>
                <td style={{ textAlign: 'right' }}>{s.jobs}</td>
                {showBuy && <td style={{ textAlign: 'right' }}>{cell(s.buy)}</td>}
                {showSell && <td style={{ textAlign: 'right' }}>{cell(s.sell)}</td>}
                {showTotal && <td style={{ textAlign: 'right', fontWeight: 700 }}>{cell(s.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="section-title">Chi tiết từng job</h3>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table>
          <thead><tr>
            <th>No.</th><th>Ngày tạo</th><th>Shipper</th><th>Consignee</th><th>Tuyến</th><th>Sales</th><th>Trạng thái</th>
            {showBuy && <th style={{ textAlign: 'right' }}>CKTM mua</th>}
            {showSell && <th style={{ textAlign: 'right' }}>CKTM bán</th>}
            {showTotal && <th style={{ textAlign: 'right' }}>Tổng</th>}
            <th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={11} className="empty-state">Không có dữ liệu.</td></tr>}
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.no || '-'}</td>
                <td>{dateLabel(r.createdAt)}</td>
                <td>{r.shpr || '-'}</td>
                <td>{r.cnee || '-'}</td>
                <td>{r.pol || '-'} → {r.pod || '-'}</td>
                <td><span className="sales-name">{r.sales || '-'}</span></td>
                <td><span className={`badge badge-${r.status}`}>{statusLabel(r.status)}</span></td>
                {showBuy && <td style={{ textAlign: 'right' }}>{cell(r.buy)}</td>}
                {showSell && <td style={{ textAlign: 'right' }}>{cell(r.sell)}</td>}
                {showTotal && <td style={{ textAlign: 'right', fontWeight: 700 }}>{cell(r.total)}</td>}
                <td><Link href={`/quotes/${r.id}/view`}><button className="btn btn-outline btn-sm">Xem</button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
