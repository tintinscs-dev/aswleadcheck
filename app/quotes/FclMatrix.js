'use client';
// FCL input: container mix editor + one price matrix for the whole mix
// (one column per container type, plus one "Theo lô" column for B/L / Shipment fees,
// which are therefore entered — and counted — exactly once per shipment).
import { useState } from 'react';
import {
  EQUIPMENT_TYPES, FCL_ITEM_DEFS, FCL_SPECIAL_ITEM_DEFS, UNIT_OPTIONS_BY_MODE,
  equipmentGroup, equipmentGroupsPresent, normalizeEquipment, parseEquipmentText, equipmentLabel,
  fclDefAppliesToType, fclRowTotal, isFlatUnit, itemCurrency, fmt, priceSuggestionNote,
  suggestedFor, tariffModeForType, blankFclItem,
} from '../../lib/calc';
import { CurrencySelect, MoneyInput, DecimalInput, PriceNote } from './FormInputs';

const UNIT_SHORT = { Container: 'Theo cont', 'Bill of Lading': 'Theo B/L', Shipment: 'Theo lô hàng' };
const GROUP_HINT = { RF: 'Reefer', OT: 'Open Top', FR: 'Flat Rack', TANK: 'ISO Tank', DRY: '' };

// ── Container mix ────────────────────────────────────────────────────────────
export function EquipmentEditor({ equipment, onChange, disabled }) {
  const list = normalizeEquipment(equipment);
  const unused = EQUIPMENT_TYPES.filter(t => !list.some(e => e.type === t));
  const [addType, setAddType] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [paste, setPaste] = useState('');
  const [pasteErr, setPasteErr] = useState('');

  function setQty(type, qty) { onChange(list.map(e => e.type === type ? { ...e, qty: Math.max(0, Number(qty) || 0) } : e)); }
  function remove(type) { onChange(list.filter(e => e.type !== type)); }
  function add() {
    const type = addType || unused[0];
    if (!type) return;
    onChange([...list, { type, qty: Math.max(1, Number(addQty) || 1) }].sort((a, b) => EQUIPMENT_TYPES.indexOf(a.type) - EQUIPMENT_TYPES.indexOf(b.type)));
    setAddType(''); setAddQty(1);
  }
  function applyPaste() {
    const parsed = parseEquipmentText(paste);
    if (!parsed.length) { setPasteErr('Không đọc được. Ví dụ: 2x20GP + 3x40HC + 1x40RF'); return; }
    setPasteErr('');
    onChange(parsed);
    setPaste('');
  }

  return (
    <div className="field equipment-editor">
      <label>Cơ cấu container (FCL)</label>
      <div className="eq-chips">
        {list.length === 0 && <span className="helptext" style={{ margin: 0 }}>Chưa có container — lô LCL/AIR thì bỏ trống.</span>}
        {list.map(e => (
          <span key={e.type} className={`eq-chip eq-${equipmentGroup(e.type).toLowerCase()}`}>
            <input type="number" min="0" step="1" value={e.qty} disabled={disabled} onChange={ev => setQty(e.type, ev.target.value)} aria-label={`Số lượng ${e.type}`} />
            <span className="eq-x">x</span>
            <b>{e.type}</b>
            {!disabled && <button type="button" title="Bỏ loại cont này" onClick={() => remove(e.type)}>✕</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="eq-tools">
          {unused.length > 0 && (
            <span className="eq-add">
              <input type="number" min="1" step="1" value={addQty} onChange={ev => setAddQty(ev.target.value)} aria-label="Số lượng" />
              <span className="eq-x">x</span>
              <select value={addType || unused[0]} onChange={ev => setAddType(ev.target.value)}>
                {unused.map(t => <option key={t} value={t}>{t}{GROUP_HINT[equipmentGroup(t)] ? ` (${GROUP_HINT[equipmentGroup(t)]})` : ''}</option>)}
              </select>
              <button type="button" className="btn-add-item" style={{ marginTop: 0 }} onClick={add}>+ Thêm loại cont</button>
            </span>
          )}
          <span className="eq-paste">
            <input type="text" value={paste} placeholder="Dán nhanh: 2x20GP + 3x40HC + 1x40RF"
              onChange={ev => setPaste(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); applyPaste(); } }} />
            <button type="button" className="btn-add-item" style={{ marginTop: 0 }} onClick={applyPaste} disabled={!paste.trim()}>Áp dụng</button>
          </span>
        </div>
      )}
      {pasteErr && <div className="price-note note-up" style={{ display: 'inline-block' }}>{pasteErr}</div>}
      <div className="helptext" style={{ marginBottom: 0 }}>Mỗi loại cont thành 1 cột giá ở bảng FCL. Dán nhanh sẽ thay toàn bộ cơ cấu hiện tại.</div>
    </div>
  );
}

// ── Reefer / OOG specs (only when the mix has such equipment) ────────────────
export function FclSpecsEditor({ equipment, specs, onChange, disabled }) {
  const groups = equipmentGroupsPresent(equipment);
  const hasRf = groups.has('RF');
  const hasOog = groups.has('OT') || groups.has('FR');
  if (!hasRf && !hasOog) return null;
  const s = specs || {};
  const set = (path, v) => onChange({ ...s, [path[0]]: { ...(s[path[0]] || {}), [path[1]]: v } });
  return (
    <div className="fcl-specs">
      {hasRf && (
        <div className="grid grid-3">
          <div className="field"><label>Reefer — Nhiệt độ (°C)</label><input value={s.reefer?.temp || ''} disabled={disabled} placeholder="VD: -18" onChange={e => set(['reefer', 'temp'], e.target.value)} /></div>
          <div className="field"><label>Reefer — Ventilation</label><input value={s.reefer?.vent || ''} disabled={disabled} placeholder="VD: Closed / 25 CBM/H" onChange={e => set(['reefer', 'vent'], e.target.value)} /></div>
          <div className="field"><label>Reefer — Humidity</label><input value={s.reefer?.humidity || ''} disabled={disabled} placeholder="VD: OFF / 85%" onChange={e => set(['reefer', 'humidity'], e.target.value)} /></div>
        </div>
      )}
      {hasOog && (
        <div className="grid grid-3">
          <div className="field"><label>OOG — Kích thước L×W×H (cm)</label><input value={s.oog?.dims || ''} disabled={disabled} placeholder="VD: 1250×260×300" onChange={e => set(['oog', 'dims'], e.target.value)} /></div>
          <div className="field"><label>OOG — Trọng lượng/kiện (kg)</label><input value={s.oog?.weight || ''} disabled={disabled} placeholder="VD: 18,500" onChange={e => set(['oog', 'weight'], e.target.value)} /></div>
          <div className="field"><label>OOG — Ghi chú (over-height/width…)</label><input value={s.oog?.note || ''} disabled={disabled} placeholder="VD: OH 40cm, OW 20cm mỗi bên" onChange={e => set(['oog', 'note'], e.target.value)} /></div>
        </div>
      )}
      <div className="helptext">Thông số này in kèm trên báo giá gửi khách (phần Notes).</div>
    </div>
  );
}

// ── Price matrix ─────────────────────────────────────────────────────────────
function rowHasAnyPrice(row) {
  return !!row && (!!Number(row.price || 0) || Object.values(row.byType || {}).some(v => Number(v)));
}

/** Which standard/special lines to show for the current mix. */
export function visibleFclDefs(equipment, data) {
  const groups = equipmentGroupsPresent(equipment);
  const std = FCL_ITEM_DEFS.filter(d => d.key !== 'cktm');
  const special = FCL_SPECIAL_ITEM_DEFS.filter(d => d.groups.some(g => groups.has(g)) || rowHasAnyPrice(data?.[d.key]));
  return [...std, ...special, ...FCL_ITEM_DEFS.filter(d => d.key === 'cktm')];
}

function suggestionFor(def, type, row) {
  if (!def) return null;
  if (type) {
    const mode = tariffModeForType(type);
    return mode ? priceSuggestionNote(mode, def.key, row.byType?.[type], 'Container') : null;
  }
  return priceSuggestionNote('fcl20', def.key, row.price, row.unit);
}

function FclRow({ def, label, row, types, equipment, side, onPatch, onCell, onRemove, labelEditable, disabled }) {
  const r = row || blankFclItem(def?.unit);
  const flat = isFlatUnit(r.unit);
  const total = fclRowTotal(r, equipment, def);
  const units = UNIT_OPTIONS_BY_MODE.fcl.includes(r.unit) ? UNIT_OPTIONS_BY_MODE.fcl : [r.unit, ...UNIT_OPTIONS_BY_MODE.fcl];
  return (
    <tr className={labelEditable ? 'custom-item-row' : ''}>
      <td className="item-name">
        {labelEditable
          ? <input type="text" placeholder="Tên hạng mục..." value={r.label || ''} disabled={disabled} onChange={e => onPatch({ label: e.target.value })} />
          : <>{label}{def?.groups && <span className="mode-pill" style={{ marginLeft: 6 }}>{def.groups.join('/')}</span>}</>}
      </td>
      {types.map(type => {
        const applies = fclDefAppliesToType(def, type);
        if (flat || !applies) {
          return <td key={type} className="na-cell" data-label={type} title={flat ? 'Phí theo lô — nhập ở cột "Theo lô"' : `Không áp dụng cho ${type}`}><span className="na">–</span></td>;
        }
        const note = side === 'selling' ? suggestionFor(def, type, r) : null;
        return (
          <td key={type} data-label={type}>
            <MoneyInput value={r.byType?.[type] || 0} disabled={disabled} onChange={v => onCell(type, v)} />
            <PriceNote note={note} />
          </td>
        );
      })}
      {flat ? (
        <td data-label="Theo lô">
          <MoneyInput value={r.price || 0} disabled={disabled} onChange={v => onPatch({ price: v })} />
          <PriceNote note={side === 'selling' ? suggestionFor(def, null, r) : null} />
        </td>
      ) : <td className="na-cell" data-label="Theo lô" title='Phí theo cont — nhập ở các cột loại cont'><span className="na">–</span></td>}
      <td data-label="Đơn vị">
        <select value={r.unit || 'Container'} disabled={disabled} onChange={e => onPatch({ unit: e.target.value })}>
          {units.map(u => <option key={u} value={u}>{UNIT_SHORT[u] || u}</option>)}
        </select>
      </td>
      <td data-label="VAT%"><DecimalInput value={r.tax || 0} disabled={disabled} onChange={v => onPatch({ tax: v })} /></td>
      <td data-label="Tiền" style={labelEditable ? { display: 'flex', gap: 4, alignItems: 'center' } : undefined}>
        <CurrencySelect value={r.currency} onChange={v => onPatch({ currency: v })} />
        {labelEditable && !disabled && <button type="button" title="Xóa hạng mục" onClick={onRemove}>✕</button>}
      </td>
      <td className="lt" data-label="Thành tiền">{total ? fmt(total) : ''}</td>
      <td data-label="Ghi chú"><input type="text" placeholder="Ghi chú..." value={r.note || ''} disabled={disabled} onChange={e => onPatch({ note: e.target.value })} /></td>
    </tr>
  );
}

/**
 * kind 'charges' = standard + special + custom rows; 'overseas' = overseas rows only.
 * Mutations go through onUpdate(side, recipe) where recipe(fclData) mutates a clone.
 */
export function FclMatrixTable({ side, kind = 'charges', q, onUpdate, disabled, t }) {
  const data = q[side]?.fcl || {};
  const equipment = normalizeEquipment(q.equipment);
  const types = equipment.map(e => e.type);
  const listKey = kind === 'overseas' ? 'overseasItems' : 'customItems';
  const defs = kind === 'charges' ? visibleFclDefs(equipment, data) : [];
  const [copySrc, setCopySrc] = useState('');
  const [copyDst, setCopyDst] = useState('');

  const patchDef = (key, def) => patch => onUpdate(side, d => { d[key] = { ...(d[key] || blankFclItem(def.unit)), ...patch }; });
  const cellDef = (key, def) => (type, v) => onUpdate(side, d => {
    const row = { ...(d[key] || blankFclItem(def.unit)) };
    row.byType = { ...(row.byType || {}), [type]: v };
    d[key] = row;
  });
  const patchCustom = idx => patch => onUpdate(side, d => { d[listKey][idx] = { ...d[listKey][idx], ...patch }; });
  const cellCustom = idx => (type, v) => onUpdate(side, d => {
    const row = { ...d[listKey][idx] };
    row.byType = { ...(row.byType || {}), [type]: v };
    d[listKey][idx] = row;
  });
  const addCustom = () => onUpdate(side, d => {
    d[listKey] = [...(d[listKey] || []), { label: '', byType: {}, price: 0, unit: 'Container', tax: 0, currency: 'USD', note: '' }];
  });
  const removeCustom = idx => onUpdate(side, d => { d[listKey] = d[listKey].filter((_, i) => i !== idx); });

  const src = copySrc || types[0] || '';
  const dst = copyDst || types.find(x => x !== src) || '';
  function copyColumn() {
    if (!src || !dst || src === dst) return;
    onUpdate(side, d => {
      const copyRow = (row, def) => {
        if (!row || isFlatUnit(row.unit) || !fclDefAppliesToType(def, dst)) return row;
        const v = Number(row.byType?.[src] || 0);
        if (!v) return row;
        return { ...row, byType: { ...(row.byType || {}), [dst]: v } };
      };
      if (kind === 'charges') defs.forEach(def => { d[def.key] = copyRow(d[def.key], def); });
      d[listKey] = (d[listKey] || []).map(r => copyRow(r));
    });
  }
  function fillSuggested() {
    onUpdate(side, d => {
      defs.forEach(def => {
        const row = { ...(d[def.key] || blankFclItem(def.unit)) };
        if (isFlatUnit(row.unit)) {
          const sug = suggestedFor('fcl20', def.key);
          if (sug && sug.price !== null && isFlatUnit(sug.unit) && !Number(row.price || 0)) row.price = sug.price;
        } else {
          const byType = { ...(row.byType || {}) };
          types.forEach(type => {
            const mode = tariffModeForType(type);
            const sug = mode ? suggestedFor(mode, def.key) : null;
            if (sug && sug.price !== null && sug.unit === 'Container' && !Number(byType[type] || 0)) byType[type] = sug.price;
          });
          row.byType = byType;
        }
        d[def.key] = row;
      });
    });
  }

  const minWidth = 260 + types.length * 105 + 105 + 110 + 70 + 80 + 100 + 140;
  return (
    <>
      {!disabled && (types.length > 1 || (kind === 'charges' && side === 'selling')) && (
        <div className="fcl-toolbar">
          {types.length > 1 && (
            <span>
              Copy giá cột
              <select value={src} onChange={e => setCopySrc(e.target.value)}>{types.map(x => <option key={x}>{x}</option>)}</select>
              →
              <select value={dst} onChange={e => setCopyDst(e.target.value)}>{types.filter(x => x !== src).map(x => <option key={x}>{x}</option>)}</select>
              <button type="button" className="btn-add-item" style={{ marginTop: 0 }} onClick={copyColumn}>Copy</button>
            </span>
          )}
          {kind === 'charges' && side === 'selling' && (
            <button type="button" className="btn-add-item" style={{ marginTop: 0 }} onClick={fillSuggested} title="Chỉ điền vào ô đang trống, cho cont thường (GP/HC). Không ghi đè giá đã nhập.">Điền giá đề xuất (ô trống)</button>
          )}
        </div>
      )}
      {types.length === 0 && (
        <div className="custom-item-note" style={{ marginBottom: 6 }}>Chưa có loại cont — thêm ở mục &quot;Cơ cấu container&quot; (Thông tin chung) để nhập giá theo cont. Phí theo lô vẫn nhập được.</div>
      )}
      <div className="item-table-wrap">
        <table className="item-table fcl-matrix" style={{ '--fcl-min': `${minWidth}px` }}>
          <thead><tr>
            <th style={{ width: 260 }}>{t('table.col.item')}</th>
            {equipment.map(e => <th key={e.type} style={{ width: 105 }} className="num">{e.type}<div className="th-sub">x {e.qty}</div></th>)}
            <th style={{ width: 105 }} className="num">Theo lô<div className="th-sub">B/L · Shipment</div></th>
            <th style={{ width: 110 }}>{t('table.col.unit')}</th>
            <th style={{ width: 70 }}>{t('table.col.vat')}</th>
            <th style={{ width: 80 }}>{t('table.col.currency')}</th>
            <th style={{ width: 100 }} className="num">Thành tiền</th>
            <th style={{ width: 140 }}>{t('table.col.note')}</th>
          </tr></thead>
          <tbody>
            {defs.map(def => (
              <FclRow key={def.key} def={def} label={def.label} row={data[def.key]} types={types} equipment={equipment} side={side}
                onPatch={patchDef(def.key, def)} onCell={cellDef(def.key, def)} disabled={disabled} />
            ))}
            {(data[listKey] || []).map((ci, idx) => (
              <FclRow key={`${listKey}-${idx}`} row={ci} types={types} equipment={equipment} side={side} labelEditable
                onPatch={patchCustom(idx)} onCell={cellCustom(idx)} onRemove={() => removeCustom(idx)} disabled={disabled} />
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && <button type="button" className="btn-add-item" onClick={addCustom}>{t('table.addItem')}</button>}
      {kind === 'charges' && <div className="custom-item-note">Đơn vị &quot;Theo cont&quot; = nhập giá ở từng cột loại cont (× số cont). Bill of Lading / Shipment = nhập 1 lần ở cột &quot;Theo lô&quot;.</div>}
    </>
  );
}

export function fclMixSummary(equipment) {
  return equipmentLabel(equipment) || 'Chưa có container';
}
