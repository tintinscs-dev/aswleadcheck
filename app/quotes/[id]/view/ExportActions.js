'use client';
import { useState } from 'react';
import { CURRENCIES } from '../../../../lib/calc';

const CCY_LABELS = { USD: 'USD', VND: 'VND', EUR: 'EUR', GBP: 'GBP', SGD: 'SGD', CNY: 'CNY', HKD: 'HKD' };

/**
 * One currency dropdown that drives all 4 "In báo giá" export links — picking
 * a currency here quy đổi (converts) every charge line in the exported
 * PDF/Excel into that one currency; "Giữ nguyên" exports each line in its own
 * entered currency, same as before this control existed.
 */
export default function ExportActions({ quoteId }) {
  const [ccy, setCcy] = useState('ORIGINAL');
  const qs = ccy === 'ORIGINAL' ? '' : `ccy=${ccy}`;
  const withQs = (base) => (qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base);

  return (
    <>
      <div className="actions-row" style={{ alignItems: 'center' }}>
        <label htmlFor="export-currency" style={{ fontWeight: 600 }}>Xuất báo giá theo tiền tệ:</label>
        <select
          id="export-currency"
          className="currency-select"
          style={{ width: 'auto', minWidth: 220 }}
          value={ccy}
          onChange={e => setCcy(e.target.value)}
        >
          <option value="ORIGINAL">Giữ nguyên (theo từng dòng)</option>
          {CURRENCIES.map(c => <option key={c} value={c}>Quy đổi tất cả về {CCY_LABELS[c] || c}</option>)}
        </select>
      </div>
      <div className="actions-row">
        <a className="btn btn-ok" href={withQs(`/api/quotes/${quoteId}/print-pdf`)}>In báo giá VI (PDF)</a>
        <a className="btn btn-ok" href={withQs(`/api/quotes/${quoteId}/print-pdf?lang=en`)}>In báo giá EN (PDF)</a>
        <a className="btn btn-ok" href={withQs(`/api/quotes/${quoteId}/print-excel`)}>In báo giá VI (Excel)</a>
        <a className="btn btn-ok" href={withQs(`/api/quotes/${quoteId}/print-excel?lang=en`)}>In báo giá EN (Excel)</a>
      </div>
    </>
  );
}
