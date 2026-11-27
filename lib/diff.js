// Compute a human-readable diff of cost/sell line items between two quote snapshots.
import { MODES, MODE_LABELS, itemDefsForMode, migrateQuote, equipmentLabel } from './calc';

function fieldLabel(mode, key) {
  const def = itemDefsForMode(mode).find(d => d.key === key);
  return def ? def.label : key;
}

function sideLabel(side) { return side === 'buying' ? 'Giá mua' : 'Giá bán'; }

function diffItem(side, mode, label, oldItem, newItem, out) {
  const o = oldItem || {}, n = newItem || {};
  ['price', 'unit', 'tax', 'currency'].forEach(p => {
    const isText = p === 'unit' || p === 'currency';
    const ov = isText ? (o[p] || '') : Number(o[p] || 0);
    const nv = isText ? (n[p] || '') : Number(n[p] || 0);
    if (p === 'currency' && (!ov || !nv)) return;
    if (ov !== nv) {
      out.push(`${MODE_LABELS[mode]} / ${sideLabel(side)} / ${label} (${p}): ${ov} → ${nv}`);
    }
  });
  // FCL matrix rows: per-container prices
  if (o.byType || n.byType) {
    const types = new Set([...Object.keys(o.byType || {}), ...Object.keys(n.byType || {})]);
    types.forEach(t => {
      const ov = Number(o.byType?.[t] || 0), nv = Number(n.byType?.[t] || 0);
      if (ov !== nv) out.push(`${MODE_LABELS[mode]} / ${sideLabel(side)} / ${label} (${t}): ${ov} → ${nv}`);
    });
  }
}

function diffList(side, mode, oList, nList, prefix, out) {
  const oc = oList || [], nc = nList || [];
  const maxLen = Math.max(oc.length, nc.length);
  for (let i = 0; i < maxLen; i++) {
    const ol = oc[i], nl = nc[i];
    if (!ol && nl) out.push(`${MODE_LABELS[mode]} / ${sideLabel(side)} / ${prefix}thêm ${prefix ? 'khoản phí' : 'hạng mục'} mới "${nl.label || '(không tên)'}"`);
    else if (ol && !nl) out.push(`${MODE_LABELS[mode]} / ${sideLabel(side)} / ${prefix}xoá ${prefix ? 'khoản phí' : 'hạng mục'} "${ol.label || '(không tên)'}"`);
    else if (ol && nl) diffItem(side, mode, `${prefix ? 'Overseas: ' : ''}${ol.label || `${prefix ? 'overseas' : 'custom'}${i}`}`, ol, nl, out);
  }
}

export function diffQuoteCosts(oldRaw, newRaw) {
  const oldQ = migrateQuote(oldRaw) || {};
  const newQ = migrateQuote(newRaw) || {};
  const out = [];
  const oEq = equipmentLabel(oldQ.equipment), nEq = equipmentLabel(newQ.equipment);
  if (oEq !== nEq) out.push(`Cơ cấu container: ${oEq || '(trống)'} → ${nEq || '(trống)'}`);
  MODES.forEach(mode => {
    ['buying', 'selling'].forEach(side => {
      const o = (oldQ[side] && oldQ[side][mode]) || {};
      const n = (newQ[side] && newQ[side][mode]) || {};
      itemDefsForMode(mode).forEach(d => diffItem(side, mode, fieldLabel(mode, d.key), o[d.key], n[d.key], out));
      diffList(side, mode, o.customItems, n.customItems, '', out);
      diffList(side, mode, o.overseasItems, n.overseasItems, 'Overseas Charges / ', out);
    });
  });
  ['exchangeRate', 'interestRatePct', 'creditDays0', 'creditDaysLCC', 'creditDaysCusTruck', 'cuocCont', 'creditDaysCuocCont', 'chiHoKhac', 'creditDaysChiHoKhac', 'cpKhac'].forEach(k => {
    const ov = Number(oldQ[k] || 0), nv = Number(newQ[k] || 0);
    if (ov !== nv) out.push(`Công nợ/Chi phí khác / ${k}: ${ov} → ${nv}`);
  });
  return out;
}
