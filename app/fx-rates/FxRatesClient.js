'use client';
import { useState } from 'react';
import { FX_CURRENCIES, usdVndRateFromFx } from '../../lib/calc';

const LABELS = { EUR: 'EUR', GBP: 'GBP', SGD: 'SGD', CNY: 'CNY (Nhân dân tệ)', HKD: 'HKD' };
// Everything except VND — VND is the target unit here (like the VCB board), not a row of its own.
const FOREIGN_CCYS = FX_CURRENCIES.filter(c => c !== 'VND');

// Stored format (unchanged, used everywhere else in the app): each currency,
// including VND, = "1 đơn vị = ? USD". Convert that into VCB-style display
// values: "1 USD = ? VND" and "1 [ngoại tệ] = ? VND" — the way Sales actually
// looks rates up, so nobody has to hand-divide to USD anymore.
function toVcbStyle(rates) {
  const usdVnd = usdVndRateFromFx(rates); // 1 USD = ? VND
  const out = { usdVnd };
  FOREIGN_CCYS.forEach(c => {
    const usdRate = Number(rates?.[c]); // 1 c = ? USD
    out[c] = usdRate > 0 ? usdRate * usdVnd : 0; // 1 c = ? VND
  });
  return out;
}

// Convert the VCB-style entry back into the stored {VND, EUR, GBP, ...} table
// (each = "1 đơn vị = ? USD") that calcQuote / the save-time snapshot expects.
function fromVcbStyle(vcb) {
  const usdVnd = Number(vcb.usdVnd) || 0;
  const out = { VND: usdVnd > 0 ? 1 / usdVnd : 0 };
  FOREIGN_CCYS.forEach(c => {
    const vndRate = Number(vcb[c]) || 0;
    out[c] = usdVnd > 0 ? vndRate / usdVnd : 0;
  });
  return out;
}

export default function FxRatesClient({ initialRates, fxUpdatedAt, fxUpdatedBy }) {
  const [vcb, setVcb] = useState(() => toVcbStyle(initialRates));
  const [meta, setMeta] = useState({ fxUpdatedAt, fxUpdatedBy });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  function setVal(key, val) { setVcb(v => ({ ...v, [key]: Number(val) || 0 })); setOk(false); }

  async function save(e) {
    e.preventDefault();
    setErr(''); setOk(false); setBusy(true);
    try {
      const fxRates = fromVcbStyle(vcb);
      const res = await fetch('/api/fx-rates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fxRates }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Lưu thất bại.');
      setVcb(toVcbStyle(body.fxRates)); // re-derive display from what the server actually stored
      setMeta({ fxUpdatedAt: body.fxUpdatedAt, fxUpdatedBy: body.fxUpdatedBy });
      setOk(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <h2>Tỷ giá quy đổi</h2>
      <div className="pagesub">
        Nhập tỷ giá y như trên bảng niêm yết Vietcombank — 1 đơn vị ngoại tệ đổi ra bao nhiêu VND —
        không cần tự chia sang USD nữa. Hệ thống tự quy đổi sang USD ở phía sau để tính KQKD (KQKD luôn tính theo USD).
        Ai cũng có thể sửa khi tỷ giá thực tế thay đổi — báo giá sẽ tự lấy tỷ giá mới nhất mỗi khi được lưu/tính lại,
        các báo giá đã lưu trước đó không bị ảnh hưởng.
      </div>

      <div className="card">
        <h3>1 đơn vị ngoại tệ = ? VND</h3>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={save} className="grid grid-3">
          <div className="field">
            <label>USD (đô la Mỹ)</label>
            <input
              type="number" step="any" min="0" required
              value={vcb.usdVnd ?? ''}
              onChange={e => setVal('usdVnd', e.target.value)}
            />
          </div>
          {FOREIGN_CCYS.map(ccy => (
            <div className="field" key={ccy}>
              <label>{LABELS[ccy] || ccy}</label>
              <input
                type="number" step="any" min="0" required
                value={vcb[ccy] ?? ''}
                onChange={e => setVal(ccy, e.target.value)}
              />
            </div>
          ))}
        </form>
        <div className="actions-row">
          <button className="btn btn-primary" disabled={busy} onClick={save}>💾 Lưu tỷ giá</button>
          {ok && <span style={{ color: 'var(--ok)', marginLeft: 10 }}>Đã lưu.</span>}
        </div>
        <div className="meta" style={{ marginTop: 10 }}>
          {meta.fxUpdatedAt
            ? `Cập nhật gần nhất: ${new Date(meta.fxUpdatedAt).toLocaleString('vi-VN')} bởi ${meta.fxUpdatedBy || '-'}`
            : 'Chưa có cập nhật nào, đang dùng tỷ giá mặc định.'}
        </div>
      </div>
    </>
  );
}
