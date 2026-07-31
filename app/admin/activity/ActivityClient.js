'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

const ACTION_LABELS = {
  submitted:            'Gửi kiểm tra giá mua',
  pricing_approved:     'Pricing xác nhận giá mua',
  pricing_rejected:     'Pricing yêu cầu chỉnh sửa',
  approved:             'Đã duyệt',
  rejected:             'Từ chối',
  adjusted:             'Điều chỉnh phí (Admin)',
  adjustment_proposed:  'Đề xuất điều chỉnh phí',
  adjustment_approved:  'Duyệt điều chỉnh phí',
  adjustment_rejected:  'Từ chối điều chỉnh phí',
  created_from_copy:    'Tạo từ bản sao',
  created_from_template: 'Tạo từ mẫu',
};

const ROLE_LABEL = { sales: 'Sales', pricing: 'Pricing', operation: 'Operation', manager: 'Manager', accounting: 'Accounting', admin: 'Admin' };

export default function ActivityClient({ events, users }) {
  const [filters, setFilters] = useState({ account: '', action: '', year: '', month: '', search: '' });

  const yearsAvailable = useMemo(() => {
    const ys = new Set();
    events.forEach(e => {
      const d = e.date ? new Date(e.date) : null;
      if (d && !isNaN(d)) ys.add(d.getFullYear());
    });
    return [...ys].sort((a, b) => b - a);
  }, [events]);

  const actionsAvailable = useMemo(() => [...new Set(events.map(e => e.action).filter(Boolean))], [events]);

  const filtered = useMemo(() => events.filter(e => {
    if (filters.account && e.byId !== filters.account) return false;
    if (filters.action && e.action !== filters.action) return false;
    if (filters.year || filters.month) {
      const d = e.date ? new Date(e.date) : null;
      if (!d || isNaN(d)) return false;
      if (filters.year && d.getFullYear() !== Number(filters.year)) return false;
      if (filters.month && (d.getMonth() + 1) !== Number(filters.month)) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const hay = `${e.quoteNo} ${e.by} ${e.comment} ${e.sales}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [events, filters]);

  return (
    <>
      <div className="filterbar">
        <div className="field"><label>Tài khoản</label>
          <select value={filters.account} onChange={e => setFilters(f => ({ ...f, account: e.target.value }))}>
            <option value="">Tất cả</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABEL[u.role] || u.role})</option>)}
          </select>
        </div>
        <div className="field"><label>Hành động</label>
          <select value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
            <option value="">Tất cả</option>
            {actionsAvailable.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
        </div>
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
        <div className="field"><label>Tìm kiếm</label><input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Số báo giá / người thực hiện / ghi chú" /></div>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table>
          <thead>
            <tr><th>Thời gian</th><th>Tài khoản</th><th>Vai trò</th><th>Báo giá</th><th>Tuyến</th><th>Sales</th><th>Hành động</th><th>Ghi chú / Thay đổi</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="empty-state">Không có hoạt động nào khớp bộ lọc.</td></tr>}
            {filtered.map(e => (
              <tr key={e.key}>
                <td>{e.date ? new Date(e.date).toLocaleString('vi-VN') : '-'}</td>
                <td>{e.by}</td>
                <td>{ROLE_LABEL[e.role] || e.role}</td>
                <td><Link href={`/quotes/${e.quoteId}/view`}>{e.quoteNo}</Link></td>
                <td>{e.route}</td>
                <td>{e.sales}</td>
                <td>{ACTION_LABELS[e.action] || e.action}</td>
                <td>
                  {e.comment && <div>{e.comment}</div>}
                  {e.changes.length > 0 && (
                    <ul className="diff-list">
                      {e.changes.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  )}
                  {!e.comment && e.changes.length === 0 && '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
