// Compute a human-readable diff of cost/sell line items between two quote snapshots.
import { MODES, MODE_LABELS, ITEM_DEFS, COMLINE_DEF, SELL_COM_DEFS } from './calc';

function fieldLabel(side, key) {
  if (key === 'comline') return COMLINE_DEF.label;
  const def = (side === 'buying' ? ITEM_DEFS : [...ITEM_DEFS, ...SELL_COM_DEFS]).find(d => d.key === key);
  return def ? def.label : key;
}

function diffItem(side, mode, key, oldItem, newItem, out) {
  const o = oldItem || {}, n = newItem || {};
  ['flat', 'perUnit', 'tax'].forEach(p => {
    const ov = Number(o[p] || 0), nv = Number(n[p] || 0);
    if (ov !== nv) {
      out.push(`${MODE_LABELS[mode]} / ${side === 'buying' ? 'Giá mua' : 'Giá bán'} / ${fieldLabel(side, key)} (${p}): ${ov} → ${nv}`);
    }
  });
}

export function diffQuoteCosts(oldQ, newQ) {
  const out = [];
  MODES.forEach(mode => {
    ['buying', 'selling'].forEach(side => {
      const o = (oldQ[side] && oldQ[side][mode]) || {};
      const n = (newQ[side] && newQ[side][mode]) || {};
      const defs = ITEM_DEFS;
      defs.forEach(d => diffItem(side, mode, d.key, o[d.key], n[d.key], out));
      if (side === 'buying') {
        const ov = Number(o.comline?.perUnit || 0), nv = Number(n.comline?.perUnit || 0);
        const ot = Number(o.comline?.tax || 0), nt = Number(n.comline?.tax || 0);
        if (ov !== nv) out.push(`${MODE_LABELS[mode]} / Giá mua / ${COMLINE_DEF.label} (perUnit): ${ov} → ${nv}`);
        if (ot !== nt) out.push(`${MODE_LABELS[mode]} / Giá mua / ${COMLINE_DEF.label} (tax): ${ot} → ${nt}`);
      } else {
        SELL_COM_DEFS.forEach(d => diffItem(side, mode, d.key, o[d.key], n[d.key], out));
      }
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
