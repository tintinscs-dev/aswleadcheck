// "Quote theo mẫu" — a flexible quotation template that mirrors ASW's
// "Shipping Quote Checking" Excel/PDF layout:
//   CUSTOMER & SHIPMENT INFORMATION
//   FREIGHT & CHARGES / LOCAL CHARGES IN VIETNAM
// (Customs and Trucking is folded into Local Charges — no separate section.)
// Used for: manual entry, Excel/PDF import & export, and one-click mapping into
// a real system Quote (lib/calc.js newQuoteData()).
import { newQuoteData } from './calc';

export const TEMPLATE_SECTIONS = [
  { key: 'freight', title: 'FREIGHT & CHARGES' },
  { key: 'local', title: 'LOCAL CHARGES IN VIETNAM' },
];

export function blankChargeRow() {
  return { desc: '', rate: '', currency: 'USD', unit: '', notes: '' };
}

// Fixed "Terms & Notes" content shown on every formal quotation (two columns).
// Left = general terms of service, right = costs that may apply on top of the quote.
export const TERMS_GENERAL = [
  'This quotation is for completing the job as described above. It is based on our evaluation of the use of equipment, physical, human, financial, and information resources required to complete the work.',
  'Cost may increase due to additional, unexpected works.',
  'Temperature control fee at cost from shipping lines.',
  'Shippers / shipping agents must provide all obligated and necessary documents for customs procedures (Import license, certificate of technical inspection, etc.).',
  'Customs declaration sheet has a maximum of 50 items.',
];
// Add thousand separators to a charge row's rate for display (e.g. "4400000" → "4,400,000"),
// while leaving non-numeric text (e.g. "at cost") untouched. Shared by the PDF and Excel builders.
export function formatRateDisplay(rate) {
  if (rate === null || rate === undefined || rate === '') return '';
  const s = String(rate).trim();
  if (/^-?[\d,]+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ''));
    if (!isNaN(n)) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return s;
}

export const TERMS_ADDITIONAL_COSTS = [
  'VAT 8%',
  'Destination local charges (depending on specific Shipping Lines)',
  'Technical inspection',
  'Copy right',
  'On-behalf payment for the third party',
  'Export duty / tax, technical inspection, export license, packing fee…',
  'Unlashing fee / lift-off charge at delivery address / sites',
  'Insurance fee',
];

export function blankTemplate() {
  return {
    customer: '', taxCode: '', commodity: '', term: '', pickup: '', dropoff: '',
    date: '', valid: '', pol: '', pod: '', volume: '', mode: '', notes: '',
    extraTerms: [],
    freight: [blankChargeRow()],
    local: [blankChargeRow()],
  };
}

// --- helpers -------------------------------------------------------------

// Pull the first numeric token out of a string like "230.00", "1,000,000", "10 (Min charge 1CBM)".
export function numFromString(str) {
  if (str === null || str === undefined || str === '') return null;
  if (typeof str === 'number') return isNaN(str) ? null : str;
  const m = String(str).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Decide whether a charge row's "Unit" column implies the rate is per-container/per-weight
// (should multiply by quantity, like O/F, THC, CFS...) or a flat one-off fee (Bill of Lading,
// AWB, Shipment, Container count, etc.).
function isPerUnitColumn(unit) {
  const u = (unit || '').toLowerCase();
  if (!u) return false;
  if (u.includes('bill of lading') || u.includes('awb') || u.includes('shipment')) return false;
  if (u.includes('w/m') || u.includes('c.w') || u.includes('g.w') || u.includes('/kg') || u.includes('cbm')) return true;
  if (u.includes('20') || u.includes('40') || u.includes('cont') || u.includes('hc') || u.includes('rf') || u.includes('gp')) return true;
  return false;
}

// Guess which costing mode (fcl20 / fcl40 / lclair) a charge row belongs to, from its Unit text.
function modeHintFromUnit(unit) {
  const u = (unit || '').toUpperCase();
  if (u.includes('40')) return 'fcl40';
  if (u.includes('20')) return 'fcl20';
  return 'lclair';
}

// Parse the free-text "Volume" / "Mode" fields (e.g. "2X40HC", "FCL", "Air", "1.428 cbm")
// into the qty20 / qty40 / lcl / weight fields the system needs.
export function parseVolume(volume, mode) {
  const out = { qty20: 0, qty40: 0, lcl: 0, weight: 0 };
  const v = (volume || '').toUpperCase();
  const m = (mode || '').toUpperCase();
  const containerMatches = [...v.matchAll(/(\d+)\s*[X×]\s*(20|40)/g)];
  if (containerMatches.length) {
    containerMatches.forEach(mm => {
      const count = Number(mm[1]) || 0;
      if (mm[2] === '40') out.qty40 += count; else out.qty20 += count;
    });
    return out;
  }
  if (/\b40\b/.test(v)) { out.qty40 = 1; return out; }
  if (/\b20\b/.test(v)) { out.qty20 = 1; return out; }
  const cbmMatch = v.match(/([\d.]+)\s*CBM/);
  if (cbmMatch || v.includes('LCL') || m.includes('LCL')) { out.lcl = cbmMatch ? Number(cbmMatch[1]) : 1; return out; }
  const kgMatch = v.match(/([\d.]+)\s*KGS?/);
  if (kgMatch || m.includes('AIR')) { out.weight = kgMatch ? Number(kgMatch[1]) : 0; return out; }
  // Fallback: assume 1x40' (the most common ASW FCL booking) so the draft has something to edit.
  out.qty40 = 1;
  return out;
}

function chargeRowToCustomItem(row, exchangeRate, mode) {
  const rateNum = numFromString(row.rate);
  const currency = (row.currency || 'USD').toUpperCase();
  const perUnit = isPerUnitColumn(row.unit);
  let amountUsd = null;
  if (rateNum !== null) {
    amountUsd = currency === 'VND' ? rateNum / (exchangeRate || 23300) : rateNum;
  }
  const noteParts = [];
  if (row.unit) noteParts.push(row.unit);
  if (currency === 'VND' && rateNum !== null) noteParts.push(`≈ ${rateNum.toLocaleString('en-US')} VND`);
  if (row.notes) noteParts.push(row.notes);
  const label = noteParts.length ? `${row.desc || '(chưa đặt tên)'} (${noteParts.join(' · ')})` : (row.desc || '(chưa đặt tên)');

  const perQtyUnit = mode === 'lcl' || mode === 'lclair' ? 'W/M' : mode === 'air' ? 'C.W' : 'Container';
  const item = { label, price: 0, unit: perUnit ? perQtyUnit : 'Bill of Lading', tax: 0 };
  if (amountUsd === null) {
    // Couldn't parse a plain number (e.g. "1.1/0.9 +500/1000K") — keep the raw text in the
    // label so a human fills in the real number, instead of silently guessing wrong.
    item.label = `${label} — RATE GỐC: "${row.rate}" (cần nhập tay)`;
  } else {
    item.price = amountUsd;
  }
  return item;
}

// Build a draft system Quote (compatible with lib/calc.js) from a filled-in template.
// This is a best-effort mapping meant to save re-typing — the user should review numbers
// in the normal quote form (especially anything marked "cần nhập tay") before submitting.
export function mapTemplateToQuoteData(template, exchangeRate) {
  const q = newQuoteData();
  q.cnee = template.customer || '';
  q.keys = [template.taxCode && `MST: ${template.taxCode}`, template.commodity && `Hàng: ${template.commodity}`, template.notes]
    .filter(Boolean).join(' | ');
  q.pol = template.pol || '';
  q.pod = template.pod || '';
  q.pickup = template.pickup || '';
  q.delivery = template.dropoff || '';
  q.term = template.term || '';
  q.etd = '';
  q.exchangeRate = exchangeRate || q.exchangeRate;
  q.extraTerms = Array.isArray(template.extraTerms) ? template.extraTerms.filter(Boolean) : [];

  const { qty20, qty40, lcl, weight } = parseVolume(template.volume, template.mode);
  q.qty20 = qty20; q.qty40 = qty40; q.lcl = lcl; q.weight = weight;

  TEMPLATE_SECTIONS.forEach(sec => {
    (template[sec.key] || []).forEach(row => {
      if (!row.desc && !row.rate) return;
      const mode = modeHintFromUnit(row.unit) in q.buying ? modeHintFromUnit(row.unit) : 'lclair';
      const item = chargeRowToCustomItem(row, q.exchangeRate, mode);
      q.buying[mode].customItems.push(item);
    });
  });

  return q;
}
