// Compute a human-readable diff of cost/sell line items between two quote snapshots.
import { MODES, MODE_LABELS, itemDefsForMode } from './calc';

function fieldLabel(mode, key) {
  const def = itemDefsForMode(mode).find(d => d.key === key);
  return def ? def.label : key;
}

function diffItem(side, mode, label, oldItem, newItem, out) {
  const o = oldItem || {}, n = newItem || {};
  ['price', 'unit', 'tax'].forEach(p => {
    const ov = p === 'unit' ? (o[p] || '') : Number(o[p] || 0);
    const nv = p === 'unit' ? (n[p] || '') : Number(n[p] || 0);
    if (ov !== nv) {
      out.push(`${MODE_LABELS[mode]} / ${side === 'buying' ? 'Giá mua' : 'Giá bán'} / ${label} (${p}): ${ov} → ${nv}`);
    }
  });
}

export function diffQuoteCosts(oldQ, newQ) {
  const out = [];
  MODES.forEach(mode => {
    ['buying', 'selling'].forEach(side => {
      const o = (oldQ[side] && oldQ[side][mode]) || {};
      const n = (newQ[side] && newQ[side][mode]) || {};
      itemDefsForMode(mode).forEach(d => diffItem(side, mode, fieldLabel(mode, d.key), o[d.key], n[d.key], out));
      const oc = o.customItems || [], nc = n.customItems || [];
      const maxLen = Math.max(oc.length, nc.length);
      for (let i = 0; i < maxLen; i++) {
        const ol = oc[i], nl = nc[i];
        if (!ol && nl) out.push(`${MODE_LABELS[mode]} / ${side === 'buying' ? 'Giá mua' : 'Giá bán'} / thêm hạng mục mới "${nl.label || '(không tên)'}"`);
        else if (ol && !nl) out.push(`${MODE_LABELS[mode]} / ${side === 'buying' ? 'Giá mua' : 'Giá bán'} / xoá hạng mục "${ol.label || '(không tên)'}"`);
        else if (ol && nl) diffItem(side, mode, ol.label || `custom${i}`, ol, nl, out);
      }
    });
  });
  ['exchangeRate', 'interestRatePct', 'creditDays0', 'creditDaysLCC', 'creditDaysCusTruck', 'cuocCont', 'creditDaysCuocCont', 'chiHoKhac', 'creditDaysChiHoKhac', 'cpKhac'].forEach(k => {
    const ov = Number(oldQ[k] || 0), nv = Number(newQ[k] || 0);
    if (ov !== nv) out.push(`Công nợ/Chi phí khác / ${k}: ${ov} → ${nv}`);
  });
  return out;
}
