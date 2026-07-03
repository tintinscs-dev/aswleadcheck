'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MODES, MODE_LABELS, MODE_UNIT, ITEM_DEFS, COMLINE_DEF, SELL_COM_DEFS,
  calcQuote, blankCustomItem, newQuoteData, fmt, CURRENCIES, DEFAULT_CURRENCY,
  usdVndRateFromFx, DEFAULT_FX_RATES,
} from '../../lib/calc';
import { useLang } from '../../components/LangContext';

function CurrencySelect({ value, onChange }) {
  return (
    <select className="currency-select" value={value || DEFAULT_CURRENCY} onChange={e => onChange(e.target.value)} title="Đơn vị tiền tệ của dòng này">
      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// Format a JS Date as YYYY-MM-DD (the value format required by <input type="date">).
function toDateInput(d) { return d.toISOString().split('T')[0]; }
// Compute the expiry date string from the quote's base date + validDays.
function expiryDateInput(createdAt, validDays) {
  const base = createdAt ? new Date(createdAt) : new Date();
  return toDateInput(new Date(base.getTime() + (Number(validDays) || 30) * 86400000));
}
// Convert a chosen expiry date back to validDays (min 1) relative to base.
function expiryToValidDays(dateStr, createdAt) {
  const base = createdAt ? new Date(createdAt) : new Date();
  const selected = new Date(dateStr);
  return Math.max(1, Math.round((selected - base) / 86400000));
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

function ModeItemsTable({ side, mode, q, onChange, onAddCustom, onRemoveCustom, disabled, t }) {
  const data = q[side][mode];
  const unit = MODE_UNIT[mode];
  return (
    <>
      <table className="item-table">
        <thead><tr>
          <th style={{ width: '28%' }}>{t('table.col.item')}</th>
          <th>{t('table.col.flat')}</th>
          <th>{t('table.col.perUnit')} {unit}</th>
          <th>{side === 'buying' ? t('table.col.vat') : t('table.col.vatDisc')}</th>
          <th style={{ width: 76 }}>{t('table.col.currency')}</th>
        </tr></thead>
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
      <button type="button" className="btn-add-item" onClick={() => onAddCustom(side, mode)}>{t('table.addItem')}</button>
      <div className="custom-item-note">{t('table.customNote')}</div>
    </>
  );
}

export default function QuoteForm({ initialQuote, quoteId, currentUser, systemFxRates }) {
  const router = useRouter();
  const { t } = useLang();
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
      <h2>{isNew ? t('form.title.new') : `${t('form.title.edit')} ${q.no || ''}`}</h2>
      <div className="pagesub">{t('form.subtitle')}</div>
      {isApproved && feesReadonly && <div className="lock-note">{t('form.locked')}</div>}
      {isApproved && !feesReadonly && <div className="lock-note">{t('form.adjusting')}</div>}
      {err && <div className="login-err">{err}</div>}
      <div className="layout-form">
        <div>
          <div className="card">
            <h3>{t('sec1.title')}</h3>
            <div className="grid grid-4">
              <div className="field"><label>{t('field.no')}</label><input value={q.no || ''} onChange={e => setField('no', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.dep')}</label>
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
                          placeholder={t('field.dep.other')}
                          value={q.dep || ''}
                          onChange={e => setField('dep', e.target.value)}
                          disabled={readonly}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="field"><label>{t('field.keys')}</label><input value={q.keys || ''} onChange={e => setField('keys', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.sales')}</label><input value={q.sales || ''} onChange={e => setField('sales', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-3">
              <div className="field"><label>{t('field.shipper')}</label><input value={q.shpr || ''} onChange={e => setField('shpr', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.consignee')}</label><input value={q.cnee || ''} onChange={e => setField('cnee', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.agent')}</label><input value={q.agent || ''} onChange={e => setField('agent', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>{t('field.pol')}</label>
                <select value={q.pol || ''} onChange={e => setField('pol', e.target.value)} disabled={readonly}>
                  <option value="">--</option>
                  {PORTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('field.pod')}</label><input value={q.pod || ''} onChange={e => setField('pod', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.pickup')}</label><input value={q.pickup || ''} onChange={e => setField('pickup', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.delivery')}</label><input value={q.delivery || ''} onChange={e => setField('delivery', e.target.value)} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>{t('field.term')}</label>
                <select value={q.term || ''} onChange={e => setField('term', e.target.value)} disabled={readonly}>
                  <option value="">--</option>
                  {TERMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('field.etd')}</label><input type="date" value={q.etd || ''} onChange={e => setField('etd', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.eta')}</label><input type="date" value={q.eta || ''} onChange={e => setField('eta', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.lineCoLoader')}</label><input value={q.lineCoLoader || ''} onChange={e => setField('lineCoLoader', e.target.value)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.validUntil')}</label><input type="date" value={expiryDateInput(q.createdAt, q.validDays)} onChange={e => setField('validDays', expiryToValidDays(e.target.value, q.createdAt))} disabled={readonly} /></div>
            </div>
            <div className="grid grid-4">
              <div className="field"><label>{t('field.qty20')}</label><input type="number" value={q.qty20 || 0} onChange={e => setField('qty20', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.qty40')}</label><input type="number" value={q.qty40 || 0} onChange={e => setField('qty40', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.lcl')}</label><input type="number" step="0.01" value={q.lcl || 0} onChange={e => setField('lcl', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.weight')}</label><input type="number" step="0.01" value={q.weight || 0} onChange={e => setField('weight', Number(e.target.value) || 0)} disabled={readonly} /></div>
              <div className="field"><label>{t('field.pieces')}</label><input type="number" step="1" value={q.pieces || 0} onChange={e => setField('pieces', Number(e.target.value) || 0)} disabled={readonly} /></div>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>{t('field.notes')}</label>
              <textarea rows={2} value={q.notes || ''} onChange={e => setField('notes', e.target.value)} disabled={readonly} style={{ width: '100%', resize: 'vertical' }} />
            </div>
          </div>

          <div className="card">
            <div className="tabs">
              {MODES.map(m => <button type="button" key={m} className={tabMode === m ? 'active' : ''} onClick={() => setTabMode(m)}>{MODE_LABELS[m]}</button>)}
            </div>
            <div className="grid-buysell">
              <div>
                <h3>{t('sec2.title')}</h3>
                <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <ModeItemsTable side="buying" mode={tabMode} q={q} onChange={onChange} onAddCustom={onAddCustom} onRemoveCustom={onRemoveCustom} disabled={feesReadonly} t={t} />
                </fieldset>
              </div>
              <div>
                <h3>{t('sec3.title')}</h3>
                <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <ModeItemsTable side="selling" mode={tabMode} q={q} onChange={onChange} onAddCustom={onAddCustom} onRemoveCustom={onRemoveCustom} disabled={feesReadonly} t={t} />
                </fieldset>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>{t('sec4.title')}</h3>
            <fieldset disabled={feesReadonly} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div className="grid grid-2">
                <div className="field">
                  <label>{t('field.fxRate')}</label>
                  <input type="text" value={fmt(liveExchangeRate)} disabled readOnly title={t('field.fxRate.help')} />
                </div>
                <div className="field"><label>{t('field.interestRate')}</label><input type="number" step="0.1" value={q.interestRatePct || 0} onChange={e => setField('interestRatePct', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-3">
                <div className="field"><label>{t('field.creditDays0')}</label><input type="number" value={q.creditDays0 || 0} onChange={e => setField('creditDays0', Number(e.target.value) || 0)} /></div>
                <div className="field"><label>{t('field.creditDaysLCC')}</label><input type="number" value={q.creditDaysLCC || 0} onChange={e => setField('creditDaysLCC', Number(e.target.value) || 0)} /></div>
                <div className="field"><label>{t('field.creditDaysCusTruck')}</label><input type="number" value={q.creditDaysCusTruck || 0} onChange={e => setField('creditDaysCusTruck', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>{t('field.cuocCont')}</label><MoneyInput value={q.cuocCont || 0} onChange={v => setField('cuocCont', v)} /></div>
                <div className="field"><label>{t('field.creditDaysCuocCont')}</label><input type="number" value={q.creditDaysCuocCont || 0} onChange={e => setField('creditDaysCuocCont', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>{t('field.chiHoKhac')}</label><MoneyInput value={q.chiHoKhac || 0} onChange={v => setField('chiHoKhac', v)} /></div>
                <div className="field"><label>{t('field.creditDaysChiHoKhac')}</label><input type="number" value={q.creditDaysChiHoKhac || 0} onChange={e => setField('creditDaysChiHoKhac', Number(e.target.value) || 0)} /></div>
              </div>
              <div className="field"><label>{t('field.cpKhac')}</label><MoneyInput value={q.cpKhac || 0} onChange={v => setField('cpKhac', v)} /></div>
              <p className="helptext">{t('sec4.help')}</p>
            </fieldset>
          </div>

          {canAdjustFees && (
            <div className="card">
              <h3>{t('adjust.title')}</h3>
              <textarea className="note" value={adjustmentComment} onChange={e => setAdjustmentComment(e.target.value)} placeholder={t('adjust.placeholder')}></textarea>
            </div>
          )}

          {!readonly && !canAdjustFees && (
            <div className="actions-row">
              <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>{t('btn.cancel')}</button>
              <button className="btn btn-outline" disabled={saving} onClick={() => save('draft')}>{t('btn.saveDraft')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => save('pending')}>{t('btn.submit')}</button>
            </div>
          )}
          {canAdjustFees && (
            <div className="actions-row">
              <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>{t('btn.cancel')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => save('approved')}>{t('btn.saveAdjust')}</button>
            </div>
          )}
        </div>

        <div className="summary-panel">
          <div className="card">
            <h3>{t('sum.title')}</h3>
            <SummaryInner r={r} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SummaryInner({ r }) {
  const { t } = useLang();
  function row(label, val) { return <div className="sum-row"><span>{label}</span><span className="v">{fmt(val)}</span></div>; }
  return (
    <>
      <div className="sum-section-title">{t('sum.cost')}</div>
      {row(t('sum.gvdv'), r.GVDV)}
      {row(t('sum.dtlh'), r.DTLH)}
      <div className="sum-section-title">{t('sum.cktm')}</div>
      {row(t('sum.cktmLine'), r.CKTM_LINE)}
      {row(t('sum.cktmClient'), r.CKTM_CLIENT)}
      {row(t('sum.cktmTotal'), r.CKTM_total)}
      <div className="sum-section-title">{t('sum.cpcn')}</div>
      {row(t('sum.cpcn0'), r.CPCN0)}
      {row(t('sum.cpcnLcc'), r.CPCNLCC)}
      {row(t('sum.cpcnCus'), r.CPCNCusTruck)}
      {row(t('sum.cpcnTotal'), r.CPCN_total)}
      <div className="sum-section-title">{t('sum.other')}</div>
      {row(t('sum.cuocCont'), r.interestCuocCont)}
      {row(t('sum.chiHo'), r.interestChiHoKhac)}
      {row(t('sum.cpKhac'), r.CPKhac)}
      <div className="sum-row total"><span>{t('sum.cplh')}</span><span className="v">{fmt(r.CPLH)}</span></div>
      <div className="sum-row total"><span>{t('sum.kqkd')}</span><span className={`v ${r.KQKD >= 0 ? 'pos' : 'neg'}`}>{fmt(r.KQKD)}</span></div>
      {row(t('sum.tsln'), r.TSLN * 100)}
      <div className="helptext" style={{ marginTop: -8, marginBottom: 6 }}>{t('sum.tslnNote')}</div>
    </>
  );
}
