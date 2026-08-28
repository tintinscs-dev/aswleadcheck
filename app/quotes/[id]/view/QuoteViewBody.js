'use client';
import { useState } from 'react';
import { CURRENCIES, DEFAULT_CURRENCY, calcQuote } from '../../../../lib/calc';
import { SummaryInner } from '../../QuoteForm';
import ReadOnlyItems from './ReadOnlyItems';

const CCY_LABELS = { USD: 'USD', VND: 'VND', EUR: 'EUR', GBP: 'GBP', SGD: 'SGD', CNY: 'CNY', HKD: 'HKD' };

/**
 * Wraps the "Chi tiết các hạng mục" section + the desktop "Kết quả tính
 * toán" sidebar in one client component so both share a single currency
 * toggle. `before`/`after` are the surrounding server-rendered cards (Thông
 * tin chung, Lịch sử/Duyệt) passed in from page.js — this component only
 * owns the currency-display state, it doesn't touch quote data or trigger
 * any save.
 */
export default function QuoteViewBody({ q, before, after }) {
  const [displayCurrency, setDisplayCurrency] = useState('ORIGINAL');
  const r = calcQuote(q);
  const fxRates = q.fxRates || {};
  const summaryCurrency = displayCurrency === 'ORIGINAL' ? DEFAULT_CURRENCY : displayCurrency;

  return (
    <>
      <div>
        {before}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="view-currency-toggle" style={{ fontWeight: 600 }}>Hiển thị tiền tệ:</label>
            <select
              id="view-currency-toggle"
              className="currency-select"
              style={{ width: 'auto', minWidth: 220 }}
              value={displayCurrency}
              onChange={e => setDisplayCurrency(e.target.value)}
            >
              <option value="ORIGINAL">Giữ nguyên (theo từng dòng)</option>
              {CURRENCIES.map(c => <option key={c} value={c}>Quy đổi tất cả về {CCY_LABELS[c] || c}</option>)}
            </select>
          </div>
          <div className="helptext" style={{ marginTop: 6, marginBottom: 0 }}>
            {displayCurrency === 'ORIGINAL'
              ? 'Mỗi hạng mục đang hiển thị đúng loại tiền tệ đã nhập.'
              : 'Chỉ quy đổi tạm thời để xem, không thay đổi dữ liệu gốc đã lưu của báo giá.'}
          </div>
        </div>
        <h3 style={{ margin: '18px 0 8px' }}>Chi tiết các hạng mục đã nhập</h3>
        <div className="pagesub" style={{ marginTop: -4 }}>Hiển thị đầy đủ cho người xem / người duyệt và các bộ phận liên quan.</div>
        <ReadOnlyItems q={q} displayCurrency={displayCurrency === 'ORIGINAL' ? undefined : displayCurrency} />
        {after}
      </div>
      <div className="summary-panel desktop-only">
        <div className="card">
          <h3>Kết quả tính toán</h3>
          <SummaryInner r={r} displayCurrency={summaryCurrency} fxRates={fxRates} />
        </div>
      </div>
    </>
  );
}
