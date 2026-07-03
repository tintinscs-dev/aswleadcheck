import { MODE_LABELS, qtyForMode, lineTotal, quoteModes, fmt, itemCurrency, itemDefsForMode } from '../../../../lib/calc';

function Row({ label, item, qty }) {
  const total = lineTotal(item, qty, +1);
  return (
    <tr>
      <td className="item-name">{label}</td>
      <td>{fmt(item.price || 0)}</td>
      <td>{item.unit || ''}</td>
      <td>{fmt(item.tax || 0)}%</td>
      <td>{itemCurrency(item)}</td>
      <td className="v">{fmt(total)}</td>
    </tr>
  );
}

function isZeroItem(item) {
  return !Number(item?.price || 0);
}

function CostTable({ side, mode, q }) {
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
      <thead><tr><th style={{ width: '28%' }}>Hạng mục</th><th>Đơn giá</th><th>Đơn vị tính</th><th>VAT%</th><th>Tiền</th><th>Thành tiền</th></tr></thead>
      <tbody>
        {rows.map(r => <Row key={r.key} label={r.label} item={r.item} qty={qty} />)}
      </tbody>
    </table>
  );
}

export default function ReadOnlyItems({ q }) {
  const modes = quoteModes(q);
  return (
    <>
      {modes.map(mode => (
        <div className="card" key={mode}>
          <h4 style={{ marginTop: 0 }}>{MODE_LABELS[mode]}</h4>
          <div className="grid grid-2">
            <div><div className="sum-section-title">II. Giá mua (Cost)</div><CostTable side="buying" mode={mode} q={q} /></div>
            <div><div className="sum-section-title">III. Giá bán (Sell)</div><CostTable side="selling" mode={mode} q={q} /></div>
          </div>
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
      </div>
    </>
  );
}
