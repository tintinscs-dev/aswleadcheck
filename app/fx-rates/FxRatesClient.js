'use client';
import { useState } from 'react';
import { FX_CURRENCIES } from '../../lib/calc';

const LABELS = { VND: 'VND', EUR: 'EUR', GBP: 'GBP', SGD: 'SGD', CNY: 'CNY (Nhân dân tệ)', HKD: 'HKD' };

export default function FxRatesClient({ initialRates, fxUpdatedAt, fxUpdatedBy }) {
  const [rates, setRates] = useState(initialRates);
  const [meta, setMeta] = useState({ fxUpdatedAt, fxUpdatedBy });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  async function save(e) {
    e.preventDefault();
    setErr(''); setOk(false); setBusy(true);
    try {
      const res = await fetch('/api/fx-rates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fxRates: rates }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Lưu thất bại.');
      setMeta({ fxUpdatedAt: body.fxUpdatedAt, fxUpdatedBy: body.fxUpdatedBy });
      setOk(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <h2>Tỷ giá quy đổi</h2>
      <div className="pagesub">
        Bảng tỷ giá chung dùng để quy đổi các hạng mục chi phí không phải USD sang USD khi tính KQKD.
        KQKD luôn tính theo USD; VND chỉ dùng khi chi phí thực tế phát sinh bằng VND.
        Ai cũng có thể sửa khi tỷ giá thực tế thay đổi — báo giá sẽ tự lấy tỷ giá mới nhất mỗi khi được lưu/tính lại,
        các báo giá đã lưu trước đó không bị ảnh hưởng.
      </div>

      <div className="card">
        <h3>1 đơn vị ngoại tệ = ? USD</h3>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={save} className="grid grid-3">
          {FX_CURRENCIES.map(ccy => (
            <div className="field" key={ccy}>
              <label>{LABELS[ccy] || ccy}</label>
              <input
                type="number" step="any" min="0" required
                value={rates[ccy] ?? ''}
                onChange={e => setRates(r => ({ ...r, [ccy]: Number(e.target.value) || 0 }))}
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
