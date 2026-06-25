// Map a real, saved system Quote (lib/calc.js shape) into the formal
// "Shipping Quote Checking" template shape (lib/templateQuote.js), so the
// existing template PDF/Excel builders can render a polished, customer-facing
// quotation directly from live selling-side data — no manual re-entry.
import { MODE_LABELS, MODE_UNIT, ITEM_DEFS, lineTotal, qtyForMode, quoteModes, itemCurrency, expiryDateLabel } from './calc';
import { blankTemplate, blankChargeRow } from './templateQuote';

// Which formal section each internal selling-side charge belongs to.
// Commission (com / com10) is intentionally excluded — internal-only, never
// shown to the customer.
const SECTION_BY_KEY = {
  overseas: 'freight', ofreight: 'freight',
  dobill: 'local', thc: 'local', cfs: 'local', cic: 'local', hdl: 'local', clean: 'local', other: 'local',
  truck: 'customs', cus: 'customs',
};

function volumeLabel(q) {
  const parts = [];
  if (Number(q.qty20) > 0) parts.push(`${q.qty20} x 20'`);
  if (Number(q.qty40) > 0) parts.push(`${q.qty40} x 40'`);
  if (Number(q.lcl) > 0) parts.push(`${q.lcl} CBM`);
  if (Number(q.weight) > 0) parts.push(`${q.weight} KGS`);
  return parts.join(' + ') || '-';
}

export function quoteToFormalTemplate(quote, opts = {}) {
  const q = quote;
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
  t.notes = opts.notes || '';

  t.freight = [];
  t.local = [];
  t.customs = [];

  modes.forEach(mode => {
    const qty = qtyForMode(mode, q);
    const s = (q.selling && q.selling[mode]) || {};
    const modeTag = modes.length > 1 ? ` (${MODE_LABELS[mode]})` : '';

    ITEM_DEFS.forEach(d => {
      const item = s[d.key];
      if (!item) return;
      const amount = lineTotal(item, qty, +1);
      if (!amount) return;
      const sectionKey = SECTION_BY_KEY[d.key] || 'local';
      const isPerUnit = Number(item.perUnit || 0) !== 0;
      const rate = isPerUnit ? item.perUnit : item.flat;
      const unit = isPerUnit ? MODE_UNIT[mode] : '/SHPT';
      t[sectionKey].push({
        desc: `${d.label}${modeTag}`,
        rate: rate ? String(rate) : '',
        currency: itemCurrency(item),
        unit,
        notes: item.tax ? `Phí/VAT ${item.tax}%` : '',
      });
    });

    (s.customItems || []).forEach(ci => {
      const amount = lineTotal(ci, qty, +1);
      if (!amount) return;
      const isPerUnit = Number(ci.perUnit || 0) !== 0;
      const rate = isPerUnit ? ci.perUnit : ci.flat;
      const unit = isPerUnit ? MODE_UNIT[mode] : '/SHPT';
      t.local.push({
        desc: `${ci.label || '(Hạng mục)'}${modeTag}`,
        rate: rate ? String(rate) : '',
        currency: itemCurrency(ci),
        unit,
        notes: ci.tax ? `Phí/VAT ${ci.tax}%` : '',
      });
    });
  });

  ['freight', 'local', 'customs'].forEach(k => { if (!t[k].length) t[k] = [blankChargeRow()]; });

  return t;
}
