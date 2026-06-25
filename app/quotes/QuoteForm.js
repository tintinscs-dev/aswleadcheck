'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MODES, MODE_LABELS, MODE_UNIT, ITEM_DEFS, COMLINE_DEF, SELL_COM_DEFS,
  calcQuote, blankCustomItem, newQuoteData, fmt, CURRENCIES, DEFAULT_CURRENCY,
  usdVndRateFromFx, DEFAULT_FX_RATES,
} from '../../lib/calc';

function CurrencySelect({ value, onChange }) {
  return (
    <select className="currency-select" value={value || DEFAULT_CURRENCY} onChange={e => onChange(e.target.value)} title="Đơn vị tiền tệ của dòng này">
      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// Plain number while focused (easy to type), comma-separated thousands once
// you click away — used for every money field (giá cả/chi phí) for readability.
function formatMoney(v) {
  const n = Number(v) || 0;
  return n === 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function parseMoney(s) {
  const cleaned = String(s).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}
function MoneyInput({ value, onChange, disabled }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? (value || value === 0 ? String(value) : '') : formatMoney(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(parseMoney(e.target.value))}
    />
  );
}

const TERMS = ['CIF', 'CNF', 'FOB', 'EXW'];
const PORTS = ['Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Vũng Tàu', 'Hà Nội'];

const DEP_OPTIONS = [
  { value: 'FES', label: 'Xuất hàng đường biển' },
  { value: 'FEA', label: 'Xuất hàng đường hàng không' },
  { value: 'FIS', label: 'Nhập hàng đường biển' },
  { value: 'FIA', label: 'Nhập hàng đường hàng không' },
  { value: 'OTHER', label: 'Khác (nhập tay)' },
];
const DEP_KNOWN_VALUES = DEP_OPTIONS.map(o => o.value).filter(v => v !== 'OTHER');

function setPath(obj, path, val) {
  const parts = path.split('.');
  const next = structuredClone(obj);
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = val;
  return next;
}

function ItemRow({ pathPrefix, def, item, onChange, disabled }) {
  return (
    <tr>
      <td className="item-name">{def.label}</td>
      {def.flat
        ? <td><MoneyInput value={item.flat || 0} disabled={disabled} onChange={v => onChange(`${pathPrefix}.flat`, v)} /></td>
        : <td>—</td>}
      {def.perUnit
        ? <td><MoneyInput value={item.perUnit || 0} disabled={disabled} onChange={v => onChange(`${pathPrefix}.perUnit`, v)} /></td>
        : <td>—</td>}
      <td><input type="number" step="0.1" value={item.tax || 0} disabled={disabled} onChange={e => onChange(`${pathPrefix}.tax`, Number(e.target.value) || 0)} /></td>
      <td><CurrencySelect value={item.currency} onChange={v => onChange(`${pathPrefix}.currency`, v)} /></td>
    </tr>
  );
}

function CustomItemRow({ side, mode, idx, item, onChange, onRemove }) {
  const p = `${side}.${mode}.customItems.${idx}`;
  return (
    <tr className="custom-item-row">
      <td className="item-name"><input type="text" placeholder="Tên hạng mục..." value={item.label || ''} onChange={e => onChange(`${p}.label`, e.target.value)} /></td>
      <td><MoneyInput value={item.flat || 0} onChange={v => onChange(`${p}.flat`, v)} /></td>
      <td><MoneyInput value={item.perUnit || 0} onChange={v => onChange(`${p}.perUnit`, v)} /></td>
      <td><input type="number" step="0.1" value={item.tax || 0} onChange={e => onChange(`${p}.tax`, Number(e.target.value) || 0)} /></td>
      <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <CurrencySelect value={item.currency} onChange={v => onChange(`${p}.currency`, v)} />
        <button type="button" title="Xóa hạng mục" onClick={onRemove}>✕</button>
      </td>
    </tr>
  );
}

function ModeItemsTable({ side, mode, q, onChange, onAddCustom, onRemoveCustom, disabled }) {
  const data = q[side][mode];
  const unit = MODE_UNIT[mode];
  return (
    <>
      <table className="item-table">
        <thead><tr><th style={{ width: '28%' }}>Hạng mục</th><th>Flat (/SHPT)</th><th>Đơn giá {unit}</th><th>{side === 'buying' ? 'VAT %' : 'VAT% / Chiết khấu%'}</th><th style={{ width: 76 }}>Tiền</th></tr></thead>
        <tbody>
          {ITEM_DEFS.map(d => <ItemRow key={d.key} pathPrefix={`${side}.${mode}.${d.key}`} def={d} item={data[d.key]} onChange={onChange} disabled={disabled} />)}
          {side === 'buying' ? (
            <tr><td className="item-name">{COMLINE_DEF.label}</td><td>—</td>
              <td><MoneyInput value={data.comline.perUnit || 0} disabled={disabled} onChange={v => onChange(`buying.${mode}.comline.perUnit`, v)} /></td>
              <td><input type="number" step="0.1" value={data.comline.tax || 0} disabled={disabled} onChange={e => onChange(`buying.${mode}.comline.tax`, Number(e.target.value) || 0)} /></td>
              <td><CurrencySelect value={data.comline.currency} onChange={v => onChange(`buying.${mode}.comline.currency`, v)} /></td></tr>
          ) : SELL_COM_DEFS.map(d => <ItemRow key={d.key} pathPrefix={`selling.${mode}.${d.key}`} def={d} item={data[d.key]} onChange={onChange} disabled={disabled} />)}
          {(data.customItems || []).map((ci, idx) => (
            <CustomItemRow key={idx} side={side} mode={mode} idx={idx} item={ci} onChange={onChange} onRemove={() => onRemoveCustom(side, mode, idx)} />
          ))}
        </tbody>
      </table>
      <button type="button" className="btn-add-item" onClick={() => onAddCustom(side, mode)}>+ Thêm hạng mục</button>
      <div className="custom-item-note">Hạng mục tự thêm sẽ được cộng gộp vào cột OTHER khi xuất Excel (file mẫu gốc không có cột riêng cho hạng mục mới).</div>
    </>
  );
}

export default function QuoteForm({ initialQuote, quoteId, currentUser, systemFxRates }) {
  const router = useRouter();
  const [q, setQ] = useState(() => initialQuote || newQuoteData());
  const [tabMode, setTabMode] = useState('fcl20');
  // Tỷ giá VND/USD hiển thị trong Công nợ/Chi phí khác không còn nhập tay —
  // luôn lấy theo bảng tỷ giá chung (trang Tỷ giá), tự cập nhật khi tỷ giá đổi.
  const liveExchangeRate = usdVndRateFromFx(systemFxRates || q.fxRates || DEFAULT_FX_RATES);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [adjustmentComment, setAdjustmentComment] = useState('');

  const isNew = !quoteId;
  const isApproved = q.status === 'approved';
  // General booking info stays locked after approval unless you're Admin.
  const readonly = isApproved && currentUser.role !== 'admin';
  // Fee tables (buying/selling/other costs) can still be adjusted by Admin, Manager, or Operation after approval.
  const feesReadonly = isApproved && !['admin', 'manager', 'operation'].includes(currentUser.role);
  const canAdjustFees = isApproved && !feesReadonly;
  const r = useMemo(() => calcQuote(q), [q]);

  function onChange(path, val) { setQ(prev => setPath(prev, path, val)); }
  function setField(key, val) { setQ(prev => ({ ...prev, [key]: val })); }
  function onAddCustom(side, mode) {
    setQ(prev => {
      const next = structuredClone(prev);
      if (!next[side][mode].customItems) next[side][mode].customItems = [];
      next[side][mode].customItems.push(blankCustomItem());
      return next;
    });
  }
  function onRemoveCustom(side, mode, idx) {
    setQ(prev => {
      const next = structuredClone(prev);
      next[side][mode].customItems.splice(idx, 1);
      return next;
    });
  }

  async function save(targetStatus) {
    setErr('');
    if (!q.shpr || !q.cnee) { setErr('Vui lòng nhập Shipper và Consignee trước khi lưu.'); return; }
    setSaving(true);
    try {
      const payload = { ...q, targetStatus, adjustmentComment };
      const res = await fetch(isNew ? '/api/quotes' : `/api/quotes/${quoteId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { ...q, status: targetStatus } : payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Lưu thất bại.');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>{isNew ? 'Tạo báo giá mới' : `Chi tiết báo giá ${q.no || ''}`}</h2>
      <div className="pagesub">Nhập thông tin chung, giá mua (cost) và giá bán (sell) — kết quả tính ngay bên phải để vừa nhập vừa kiểm tra.</div>
      {isApproved && feesReadonly && <div className="lock-note">Báo giá đã được duyệt — chỉ Admin/Manager có thể điều chỉnh phí.</div>}
      {isApproved && !feesReadonly && (
        <div className="lock-note">Báo giá đã duyệt — bạn chỉ đang điều chỉnh các bảng phí (giá mua/bán/công nợ). Mọi thay đổi sẽ được ghi vào lịch sử để truy vết.</div>
      )}
      {err && <div className="login-err">{err}</div>}
      <div className="layout-form">
        <div>
          <div className="card">
            <h3>1. Thông tin chung</h3>
            <div className="grid grid-4">
              <div className="field"><label>Số booking (No.)</label><input value={q.no || ''} onChange={e => setField('no', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Loại dịch vụ (DEP.)</label>
                {(() => {
                  const depSelectValue = DEP_KNOWN_VALUES.includes(q.dep) ? q.dep : (q.dep ? 'OTHER' : 'FES');
                  return (
                    <>
                      <select
                        value={depSelectValue}
                        onChange={e => setField('dep', e.target.value === 'OTHER' ? '' : e.target.value)}
                        disabled={readonly}
                      >
                        {DEP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {depSelectValue === 'OTHER' && (
                        <input
                          style={{ marginTop: 6 }}
                          placeholder="Nhập loại dịch vụ"
                          value={q.dep || ''}
                          onChange={e => setField('dep', e.target.value)}
                          disabled={readonly}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="field"><label>Keys</label><input value={q.keys || ''} onChange={e => setField('keys', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Sales</label><input value={q.sales || ''} onChange={e => setField('sales', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-3">
              <div className="field"><label>Shipper</label><input value={q.shpr || ''} onChange={e => setField('shpr', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Consignee</label><input value={q.cnee || ''} onChange={e => setField('cnee', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Agent</label><input value={q.agent || ''} onChange={e => setField('agent', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>POL</label>
                <select value={q.pol || ''} onChange={e => setField('pol', e.target.value)} disabled={readonly}>
                  <option value="">--</option>
                  {PORTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label>POD</label><input value={q.pod || ''} onChange={e => setField('pod', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Pick up</label><input value={q.pickup || ''} onChange={e => setField('pickup', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Delivery</label><input value={q.delivery || ''} onChange={e => setField('delivery', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>Term</label>
                <select value={q.term || ''} onChange={e => setField('term', e.target.value)} disabled={readonly}>
                  <option value="">--</option>
                  {TERMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>ETD</label><input type="date" value={q.etd || ''} onChange={e => setField('etd', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>ETA</label><input type="date" value={q.eta || ''} onChange={e => setField('eta', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Line / Co-loader</label><input value={q.lineCoLoader || ''} onChange={e => setField('lineCoLoader', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>Valid (số ngày hiệu lực báo giá)</label><input type="number" min="1" value={q.validDays ?? 30} onChange={e => setField('validDays', Number(e.target.value) || 30)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>Số lượng 20&apos;</label><input type="number" value={q.qty20 || 0} onChange={e => setField('qty20', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>Số lượng 40&apos;</label><input type="number" value={q.qty40 || 0} onChange={e => setField('qty40', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>LCL (CBM)</label><input type="number" value={q.lcl || 0} onChange={e => setField('lcl', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>Khối lượng (KG)</label><input type="number" value={q.weight || 0} onChange={e => setField('weight', Number(e.target.value) || 0)} disabled={readonly} /></div>
            </div>
          </div>

          <div className="card">
            <div className="tabs">
              {MODES.map(m => <button type="button" key={m} className={tabMode === m ? 'active' : ''} onClick={() => setTabMode(m)}>{MODE_LABELS[m]}</button>)}
            </div>
            <div className="grid-buysell">
              <div>
                <h3>II. GIÁ MUA (COST)</h3>
                <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <ModeItemsTable side="buying" mode={tabMode} q={q} onChange={onChange} onAddCustom={onAddCustom} onRemoveCustom={onRemoveCustom} disabled={feesReadonly} />
                </fieldset>
              </div>
              <div>
                <h3>III. GIÁ BÁN (SELL)</h3>
                <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <ModeItemsTable side="selling" mode={tabMode} q={q} onChange={onChange} onAddCustom={onAddCustom} onRemoveCustom={onRemoveCustom} disabled={feesReadonly} />
                </fieldset>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>IV. CÔNG NỢ / CHI PHÍ KHÁC</h3>
            <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div className="grid grid-2">
                <div className="field">
                  <label>Tỷ giá (VND/USD)</label>
                  <input type="text" value={fmt(liveExchangeRate)} disabled readOnly title="Lấy theo bảng tỷ giá chung (trang Tỷ giá) — không nhập tay." />
                </div>
                <div className="field"><label>Lãi suất NH (%/năm)</label><input type="number" step="0.1" value={q.interestRatePct || 0} onChange={e => setField('interestRatePct', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-3">
                <div className="field"><label>Số ngày nợ — CPCN 0% (OVERSEAS/O&#47;F)</label><input type="number" value={q.creditDays0 || 0} onChange={e => setField('creditDays0', Number(e.target.value) || 0)} /></div>
                <div className="field"><label>Số ngày nợ — CPCN LCC 8%</label><input type="number" value={q.creditDaysLCC || 0} onChange={e => setField('creditDaysLCC', Number(e.target.value) || 0)} /></div>
                <div className="field"><label>Số ngày nợ — CPCN CUS+TRUCKING</label><input type="number" value={q.creditDaysCusTruck || 0} onChange={e => setField('creditDaysCusTruck', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>Cược container (USD)</label><MoneyInput value={q.cuocCont || 0} onChange={v => setField('cuocCont', v)} /></div>
                <div className="field"><label>Số ngày nợ cược cont</label><input type="number" value={q.creditDaysCuocCont || 0} onChange={e => setField('creditDaysCuocCont', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>Chi hộ khác (USD)</label><MoneyInput value={q.chiHoKhac || 0} onChange={v => setField('chiHoKhac', v)} /></div>
                <div className="field"><label>Số ngày nợ chi hộ khác</label><input type="number" value={q.creditDaysChiHoKhac || 0} onChange={e => setField('creditDaysChiHoKhac', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="field"><label>CP Khác (USD)</label><MoneyInput value={q.cpKhac || 0} onChange={v => setField('cpKhac', v)} /></div>
              <p className="helptext">CPCN = doanh thu liên quan × lãi suất NH × số ngày nợ / 365. Cược cont &amp; Chi hộ khác chỉ tính phần lãi tài chính, không trừ phần gốc (đã thu lại từ khách).</p>
            </fieldset>
          </div>

          {canAdjustFees && (
            <div className="card">
              <h3>Ghi chú điều chỉnh</h3>
              <textarea className="note" value={adjustmentComment} onChange={e => setAdjustmentComment(e.target.value)} placeholder="Lý do điều chỉnh phí (tuỳ chọn, sẽ lưu vào lịch sử)..."></textarea>
            </div>
          )}

          {!readonly && !canAdjustFees && (
            <div className="actions-row">
              <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>Hủy / Quay lại</button>
              <button className="btn btn-outline" disabled={saving} onClick={() => save('draft')}>Lưu nháp</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => save('pending')}>Gửi duyệt (Submit)</button>
            </div>
          )}
          {canAdjustFees && (
            <div className="actions-row">
              <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>Hủy / Quay lại</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => save('approved')}>💾 Lưu điều chỉnh phí</button>
            </div>
          )}
        </div>

        <div className="summary-panel">
          <div className="card">
            <h3>Kết quả tính toán (live)</h3>
            <SummaryInner r={r} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SummaryInner({ r }) {
  function row(label, val) { return <div className="sum-row"><span>{label}</span><span className="v">{fmt(val)}</span></div>; }
  return (
    <>
      <div className="sum-section-title">Cost &amp; Revenue</div>
      {row('GVDV (Giá vốn dịch vụ)', r.GVDV)}
      {row('DTLH (Doanh thu lô hàng)', r.DTLH)}
      <div className="sum-section-title">Commission (CKTM)</div>
      {row('CKTM - LINE', r.CKTM_LINE)}
      {row('CKTM - CLIENT (COM+COM10%)', r.CKTM_CLIENT)}
      {row('Tổng CKTM', r.CKTM_total)}
      <div className="sum-section-title">Chi phí công nợ (CPCN)</div>
      {row('CPCN 0% (OVS/O&#47;F)', r.CPCN0)}
      {row('CPCN LCC 8%', r.CPCNLCC)}
      {row('CPCN CUS+TRUCKING', r.CPCNCusTruck)}
      {row('Tổng CPCN', r.CPCN_total)}
      <div className="sum-section-title">Chi hộ &amp; Chi khác</div>
      {row('Lãi cược cont', r.interestCuocCont)}
      {row('Lãi chi hộ khác', r.interestChiHoKhac)}
      {row('CP Khác', r.CPKhac)}
      <div className="sum-row total"><span>CPLH (Chi phí lô hàng)</span><span className="v">{fmt(r.CPLH)}</span></div>
      <div className="sum-row total"><span>KQKD</span><span className={`v ${r.KQKD >= 0 ? 'pos' : 'neg'}`}>{fmt(r.KQKD)}</span></div>
      {row('Tỷ suất lợi nhuận (TSLN)', r.TSLN * 100)}
      <div className="helptext" style={{ marginTop: -8, marginBottom: 6 }}>% trên CPLH</div>
    </>
  );
}
