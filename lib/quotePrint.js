// Map a real, saved system Quote (lib/calc.js shape) into the formal
// "Shipping Quote Checking" template shape (lib/templateQuote.js), so the
// existing template PDF/Excel builders can render a polished, customer-facing
// quotation directly from live selling-side data — no manual re-entry.
import { MODE_LABELS, lineTotal, qtyForMode, quoteModes, itemCurrency, expiryDateLabel, itemDefsForMode, migrateQuote } from './calc';
import { blankTemplate, blankChargeRow } from './templateQuote';

// Which formal section each internal selling-side charge belongs to.
// CKTM is intentionally excluded — internal-only commission/discount, never
// shown to the customer (see the explicit skip in the forEach below).
const SECTION_BY_KEY = {
  // FCL / LCL
  ofreight: 'freight',
  exThc: 'local', exDocFee: 'local', exContSeal: 'local', exTelex: 'local', exHandling: 'local',
  exAms: 'local', exEbs: 'local', exVgm: 'local', exAmend: 'local', exSwitch: 'local', exLateSi: 'local',
  exAmsAmend: 'local', exIsf: 'local', exCfs: 'local', exLoadUnload: 'local', exStorage: 'local',
  imThc: 'local', imDoFee: 'local', imHandling: 'local', imEmc: 'local', imCic: 'local', imCleaning: 'local',
  imCfs: 'local', imLowSulfur: 'local',
  // AIR
  overseas: 'freight', af: 'freight',
  hawb: 'local', ams: 'local', airthc: 'local', xray: 'local',
  dofee: 'local', hdlcharge: 'local', docamend: 'local',
  truck: 'customs', cus: 'customs',
};

function volumeLabel(q) {
  const parts = [];
  if (Number(q.qty20) > 0) parts.push(`${q.qty20} x 20'`);
  if (Number(q.qty40) > 0) parts.push(`${q.qty40} x 40'`);
  if (Number(q.lcl) > 0) parts.push(`${q.lcl} CBM`);
  if (Number(q.cw) > 0) parts.push(`${q.cw} KGS (C.W)`);
  else if (Number(q.weight) > 0) parts.push(`${q.weight} KGS`);
  return parts.join(' + ') || '-';
}

export function quoteToFormalTemplate(quote, opts = {}) {
  // Migrate old 'lclair' data → 'lcl' so server-side PDF/Excel exports work
  // correctly even when the quote was created before the LCL/AIR split.
  const q = migrateQuote(quote);
  const t = blankTemplate();
  t.customer = q.cnee || q.shpr || '-';
  t.commodity = q.keys || '';
  t.term = q.term || '';
  t.pickup = q.pickup || '';
  t.dropoff = q.delivery || '';
  t.date = new Date().toLocaleDateString('vi-VN');
  // Valid days comes from the quote's own "Valid" field (set in Thông tin chung);
  // opts.validDays can still override it for one-off exports, falling back to 30.
  // Shown to the customer as an actual expiry date, not a day-count.
  const validDays = opts.validDays ?? q.validDays ?? 30;
  t.valid = expiryDateLabel(q.createdAt, validDays);
  t.pol = q.pol || '';
  t.pod = q.pod || '';
  t.volume = volumeLabel(q);
  const modes = quoteModes(q);
  t.mode = modes.map(m => MODE_LABELS[m]).join(' + ');
  t.notes = opts.notes || q.notes || '';

  t.freight = [];
  t.local = [];
  t.customs = [];

  modes.forEach(mode => {
    const qty = qtyForMode(mode, q);
    // Fallback: old quotes may still have selling data under 'lclair' key
    const s = (q.selling && (q.selling[mode] || (mode === 'lcl' ? q.selling.lclair : null))) || {};
    const modeTag = modes.length > 1 ? ` (${MODE_LABELS[mode]})` : '';

    itemDefsForMode(mode).forEach(d => {
      if (d.key === 'cktm') return; // internal-only commission/discount — never shown to the customer
      const item = s[d.key];
      if (!item) return;
      const amount = lineTotal(item, qty, +1);
      if (!amount) return;
      const sectionKey = SECTION_BY_KEY[d.key] || 'local';
      t[sectionKey].push({
        desc: `${d.label}${modeTag}`,
        rate: item.price ? String(item.price) : '',
        currency: itemCurrency(item),
        unit: item.unit || '',
        notes: item.tax ? `Phí/VAT ${item.tax}%` : '',
      });
    });

    (s.customItems || []).forEach(ci => {
      const amount = lineTotal(ci, qty, +1);
      if (!amount) return;
      t.local.push({
        desc: `${ci.label || '(Hạng mục)'}${modeTag}`,
        rate: ci.price ? String(ci.price) : '',
        currency: itemCurrency(ci),
        unit: ci.unit || '',
        notes: ci.tax ? `Phí/VAT ${ci.tax}%` : '',
      });
    });
  });

  ['freight', 'local', 'customs'].forEach(k => { if (!t[k].length) t[k] = [blankChargeRow()]; });

  return t;
}
