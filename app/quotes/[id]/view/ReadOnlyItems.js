import { MODE_LABELS, qtyForMode, lineTotal, quoteModes, fmt, itemCurrency, itemDefsForMode, calcQuote, toUsd, fromUsd } from '../../../../lib/calc';
import SwipeCarousel from '../../../../components/SwipeCarousel';
import { SummaryInner } from '../../QuoteForm';

function debtInsight(r) {
  const financeCost = (r.CPCN_total || 0) + (r.CPCH_interest || 0);
  if (financeCost <= 0) {
    return { financeCost, level: 'ok', text: 'Không phát sinh chi phí công nợ / tài chính cho lô hàng này.' };
  }
  if (r.KQKD <= 0) {
    return { financeCost, level: 'danger', text: 'Lô hàng đang lỗ trước cả chi phí công nợ — cần xem lại giá bán trước khi tính đến việc rút ngắn công nợ.' };
  }
  const ratio = (financeCost / r.KQKD) * 100;
  let level, text;
  if (ratio < 10) {
    level = 'ok';
    text = `Chi phí công nợ chiếm ${fmt(ratio)}% lợi nhuận (KQKD) — mức thấp, không đáng lo ngại.`;
  } else if (ratio < 25) {
    level = 'warn';
    text = `Chi phí công nợ chiếm ${fmt(ratio)}% lợi nhuận (KQKD) — mức trung bình, nên cân nhắc khi đàm phán thời hạn thanh toán với khách.`;
  } else {
    level = 'danger';
    text = `Chi phí công nợ chiếm ${fmt(ratio)}% lợi nhuận (KQKD) — khá cao, đang ăn phần lớn lợi nhuận. Nên rút ngắn số ngày công nợ hoặc tăng giá bán để bù đắp.`;
  }
  return { financeCost, ratio, level, text };
}

// null/undefined/'ORIGINAL' displayCurrency = keep each line's own currency
// (current behaviour). Any other value = convert every line's total into
// that one currency for display, via USD as the pivot (same fxRates the
// quote was last saved/snapshotted with) — never changes the stored data.
function isOriginalMode(displayCurrency) { return !displayCurrency || displayCurrency === 'ORIGINAL'; }

function Row({ label, item, qty, displayCurrency, fxRates }) {
  const total = lineTotal(item, qty, +1);
  const originalCcy = itemCurrency(item);
  const original = isOriginalMode(displayCurrency);
  const shownTotal = original ? total : fromUsd(toUsd(total, originalCcy, fxRates), displayCurrency, fxRates);
  const shownCcy = original ? originalCcy : displayCurrency;
  return (
    <tr>
      <td className="item-name">{label}</td>
      <td data-label="Đơn giá">{fmt(item.price || 0)}</td>
      <td data-label="Đơn vị tính">{item.unit || ''}</td>
      <td data-label="VAT%">{fmt(item.tax || 0)}%</td>
      <td data-label="Tiền">{shownCcy}</td>
      <td className="v" data-label="Thành tiền">{fmt(shownTotal)}</td>
      <td data-label="Ghi chú">{item.note || ''}</td>
    </tr>
  );
}

function isZeroItem(item) {
  return !Number(item?.price || 0);
}

function CostTable({ side, mode, q, displayCurrency, fxRates }) {
  // Fallback for old quotes: if mode data is empty, try lclair key
  const modeData = q[side]?.[mode];
  const data = (modeData && Object.keys(modeData).length > 1 ? modeData : null)
    || (mode === 'lcl' ? q[side]?.lclair : null)
    || modeData
    || {};
  const qty = qtyForMode(mode, q);
  const rows = [
    ...itemDefsForMode(mode).map(d => ({ key: d.key, label: d.label, item: data[d.key] || {} })),
    ...(data.customItems || []).map((ci, idx) => ({ key: `custom-${idx}`, label: ci.label || '(Hạng mục tự thêm)', item: ci })),
  ].filter(r => !isZeroItem(r.item));
  if (!rows.length) {
    return <div className="custom-item-note">Không có chi phí nào được nhập.</div>;
  }
  return (
    <table className="item-table">
      <thead><tr><th style={{ width: '24%' }}>Hạng mục</th><th>Đơn giá</th><th>Đơn vị tính</th><th>VAT%</th><th>Tiền</th><th>Thành tiền</th><th style={{ width: '16%' }}>Ghi chú</th></tr></thead>
      <tbody>
        {rows.map(r => <Row key={r.key} label={r.label} item={r.item} qty={qty} displayCurrency={displayCurrency} fxRates={fxRates} />)}
      </tbody>
    </table>
  );
}

function OverseasTable({ side, mode, q, displayCurrency, fxRates }) {
  const modeData = q[side]?.[mode];
  const data = (modeData && Object.keys(modeData).length > 1 ? modeData : null)
    || (mode === 'lcl' ? q[side]?.lclair : null)
    || modeData
    || {};
  const qty = qtyForMode(mode, q);
  const rows = (data.overseasItems || []).map((oi, idx) => ({ key: `overseas-${idx}`, label: oi.label || '(Chưa đặt tên)', item: oi })).filter(r => !isZeroItem(r.item));
  if (!rows.length) {
    return <div className="custom-item-note">Không có chi phí nào được nhập.</div>;
  }
  return (
    <table className="item-table">
      <thead><tr><th style={{ width: '24%' }}>Hạng mục</th><th>Đơn giá</th><th>Đơn vị tính</th><th>VAT%</th><th>Tiền</th><th>Thành tiền</th><th style={{ width: '16%' }}>Ghi chú</th></tr></thead>
      <tbody>
        {rows.map(r => <Row key={r.key} label={r.label} item={r.item} qty={qty} displayCurrency={displayCurrency} fxRates={fxRates} />)}
      </tbody>
    </table>
  );
}

function hasOverseasData(q, mode) {
  const b = q.buying?.[mode]?.overseasItems || [];
  const s = q.selling?.[mode]?.overseasItems || [];
  return [...b, ...s].some(it => Number(it?.price || 0));
}

// displayCurrency: undefined/'ORIGINAL' = keep each item's own currency (as
// before). Any FX_CURRENCIES value = consolidate every line's display total
// (and the embedded mobile summary) into that one currency.
export default function ReadOnlyItems({ q, displayCurrency }) {
  const modes = quoteModes(q);
  const r = calcQuote(q);
  const insight = debtInsight(r);
  const fxRates = q.fxRates || {};
  const summaryCurrency = isOriginalMode(displayCurrency) ? undefined : displayCurrency;
  return (
    <>
      {modes.map(mode => hasOverseasData(q, mode) && (
        <div className="card" key={`overseas-${mode}`}>
          <h4 style={{ marginTop: 0 }}>I. Overseas Charges (Chi phí đầu nước ngoài) — {MODE_LABELS[mode]}</h4>
          <SwipeCarousel panels={[
            { key: 'costing', label: 'Giá mua (Cost)', content: (<><div className="sum-section-title">Giá mua (Cost)</div><OverseasTable side="buying" mode={mode} q={q} displayCurrency={displayCurrency} fxRates={fxRates} /></>) },
            { key: 'billing', label: 'Giá bán (Sell)', content: (<><div className="sum-section-title">Giá bán (Sell)</div><OverseasTable side="selling" mode={mode} q={q} displayCurrency={displayCurrency} fxRates={fxRates} /></>) },
          ]} />
        </div>
      ))}
      {modes.map(mode => (
        <div className="card" key={mode}>
          <h4 style={{ marginTop: 0 }}>{MODE_LABELS[mode]}</h4>
          <SwipeCarousel panels={[
            { key: 'costing', label: 'Giá mua (Cost)', content: (<><div className="sum-section-title">II. Giá mua (Cost)</div><CostTable side="buying" mode={mode} q={q} displayCurrency={displayCurrency} fxRates={fxRates} /></>) },
            { key: 'billing', label: 'Giá bán (Sell)', content: (<><div className="sum-section-title">III. Giá bán (Sell)</div><CostTable side="selling" mode={mode} q={q} displayCurrency={displayCurrency} fxRates={fxRates} /></>) },
            { key: 'result', label: 'Kết quả tính toán', mobileOnly: true, content: (<><div className="sum-section-title">Kết quả tính toán</div><SummaryInner r={r} displayCurrency={summaryCurrency} fxRates={fxRates} /></>) },
          ]} />
        </div>
      ))}
      <div className="card">
        <h4 style={{ marginTop: 0 }}>IV. Công nợ / Chi phí khác</h4>
        <div className="grid grid-3">
          <div><b>Tỷ giá (VND/USD):</b> {fmt(q.exchangeRate)}</div>
          <div><b>Lãi suất NH (%/năm):</b> {fmt(q.interestRatePct)}</div>
          <div><b>Cược container (USD):</b> {fmt(q.cuocCont)}</div>
          <div><b>Số ngày nợ CPCN 0%:</b> {fmt(q.creditDays0)}</div>
          <div><b>Số ngày nợ CPCN LCC 8%:</b> {fmt(q.creditDaysLCC)}</div>
          <div><b>Số ngày nợ CPCN CUS+TRUCKING:</b> {fmt(q.creditDaysCusTruck)}</div>
          <div><b>Số ngày nợ cược cont:</b> {fmt(q.creditDaysCuocCont)}</div>
          <div><b>Chi hộ khác (USD):</b> {fmt(q.chiHoKhac)}</div>
          <div><b>Số ngày nợ chi hộ khác:</b> {fmt(q.creditDaysChiHoKhac)}</div>
          <div><b>CP Khác (USD):</b> {fmt(q.cpKhac)}</div>
        </div>
        <div className={`debt-insight debt-insight-${insight.level}`}>
          <div className="di-row">Tổng chi phí công nợ / tài chính: {fmt(insight.financeCost)} USD</div>
          <div>{insight.text}</div>
        </div>
      </div>
    </>
  );
}
