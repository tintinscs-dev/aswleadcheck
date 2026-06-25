// Calculation engine - mirrors the original "Data Input" Excel sheet formulas.
// Ported as-is from the original single-file app so all numbers stay identical.

export const MODES = ['fcl20', 'fcl40', 'lclair'];
export const MODE_LABELS = { fcl20: "FCL 20'", fcl40: "FCL 40'", lclair: 'LCL / AIR' };
export const MODE_UNIT = { fcl20: "/20'", fcl40: "/40'", lclair: '/CBM' };

export const ITEM_DEFS = [
  { key: 'overseas', label: 'OVERSEAS', flat: true, perUnit: true },
  { key: 'ofreight', label: 'O/F (Cước tàu / bay)', flat: false, perUnit: true },
  { key: 'dobill', label: 'DO / BILL', flat: true, perUnit: false },
  { key: 'thc', label: 'THC', flat: false, perUnit: true },
  { key: 'cfs', label: 'CFS', flat: false, perUnit: true },
  { key: 'cic', label: 'CIC', flat: false, perUnit: true },
  { key: 'hdl', label: 'HDL / TLX BILL / LATE PAYMENT', flat: true, perUnit: false },
  { key: 'clean', label: 'CLEAN', flat: false, perUnit: true },
  { key: 'other', label: 'OTHER', flat: false, perUnit: true },
  { key: 'truck', label: 'TRUCK', flat: false, perUnit: true },
  { key: 'cus', label: 'CUS', flat: false, perUnit: true },
];

export const COMLINE_DEF = { key: 'comline', label: 'COM LINE (hãng tàu/line trả lại)' };
export const SELL_COM_DEFS = [
  { key: 'com', label: 'COM (khách hàng)', flat: true, perUnit: true },
  { key: 'com10', label: 'COM 10%', flat: true, perUnit: true },
];

export const DEFAULT_SETTINGS = { exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 };

// Per-line currency tag. USD is the default and the fixed base for KQKD —
// every quote's result is always expressed in USD no matter what currencies
// its individual lines use. VND is kept as a special case (only used when a
// cost is genuinely incurred in VND, e.g. local/domestic charges). The other
// supported currencies needing real FX conversion right now: EUR, GBP, SGD,
// CNY, HKD. A line tagged with any non-USD currency is converted to USD using
// the shared system FX rate table (see FX_CURRENCIES/DEFAULT_FX_RATES below)
// before being summed into GVDV/DTLH/KQKD — the amount/currency entered by
// the user is preserved as-is for display on the form/PDF/Excel.
export const CURRENCIES = ['USD', 'VND', 'EUR', 'GBP', 'SGD', 'CNY', 'HKD'];
export const DEFAULT_CURRENCY = 'USD';
export function itemCurrency(item) { return (item && item.currency) || DEFAULT_CURRENCY; }

// Currencies that require a conversion rate to USD (i.e. all of CURRENCIES minus USD).
export const FX_CURRENCIES = ['VND', 'EUR', 'GBP', 'SGD', 'CNY', 'HKD'];
// Reasonable fallback rates ("1 unit of currency = X USD") used only if the shared
// system rate table (Settings.fxRates) has no value yet for that currency — keeps
// old data / a freshly-migrated DB from ever crashing or silently treating a
// foreign-currency line as if it were USD.
export const DEFAULT_FX_RATES = { VND: 0.00004, EUR: 1.08, GBP: 1.27, SGD: 0.74, CNY: 0.14, HKD: 0.13 };

// Rate to convert 1 unit of `currency` into USD, given a rates map shaped like
// Settings.fxRates / Quote.fxRates ({ VND: 0.00004, EUR: 1.08, ... }).
export function fxRateFor(currency, fxRates) {
  if (!currency || currency === DEFAULT_CURRENCY) return 1;
  const v = Number(fxRates?.[currency]);
  if (v > 0) return v;
  return Number(DEFAULT_FX_RATES[currency]) || 1;
}

// The "Tỷ giá (VND/USD)" figure shown in Công nợ/Chi phí khác (e.g. 23,300) is
// just the inverse of the shared FX table's VND rate ("1 VND = X USD") — kept
// as a derived display value so it always matches the one shared rate table
// instead of being typed by hand on every quote.
export function usdVndRateFromFx(fxRates) {
  const vnd = Number(fxRates?.VND);
  if (vnd > 0) return 1 / vnd;
  return DEFAULT_SETTINGS.exchangeRate;
}

export function blankItem() { return { flat: 0, perUnit: 0, tax: 0, currency: DEFAULT_CURRENCY }; }
export function blankModeBuying() {
  const m = {};
  ITEM_DEFS.forEach(d => (m[d.key] = blankItem()));
  m.comline = { perUnit: 0, tax: 0, currency: DEFAULT_CURRENCY };
  m.customItems = [];
  return m;
}
export function blankModeSelling() {
  const m = {};
  ITEM_DEFS.forEach(d => (m[d.key] = blankItem()));
  m.com = blankItem();
  m.com10 = blankItem();
  m.customItems = [];
  return m;
}
export function blankCustomItem() { return { label: '', flat: 0, perUnit: 0, tax: 0, currency: DEFAULT_CURRENCY }; }

export function newQuoteData() {
  return {
    no: '', dep: 'FES', keys: '', shpr: '', cnee: '', agent: '',
    pol: '', pod: '', pickup: '', delivery: '', term: '',
    etd: '', eta: '', lineCoLoader: '', validDays: 30,
    qty20: 0, qty40: 0, lcl: 0, weight: 0, sales: '',
    exchangeRate: DEFAULT_SETTINGS.exchangeRate,
    interestRatePct: DEFAULT_SETTINGS.interestRatePct,
    creditDays0: 0, creditDaysLCC: 0, creditDaysCusTruck: 0,
    cuocCont: 0, creditDaysCuocCont: 0,
    chiHoKhac: 0, creditDaysChiHoKhac: 0, cpKhac: 0,
    buying: { fcl20: blankModeBuying(), fcl40: blankModeBuying(), lclair: blankModeBuying() },
    selling: { fcl20: blankModeSelling(), fcl40: blankModeSelling(), lclair: blankModeSelling() },
  };
}

export function qtyForMode(mode, q) {
  if (mode === 'fcl20') return Number(q.qty20) || 0;
  if (mode === 'fcl40') return Number(q.qty40) || 0;
  const lcl = Number(q.lcl) || 0, w = Number(q.weight) || 0;
  if (lcl > 0) return Math.max(lcl, w / 1000, 1);
  if ((Number(q.qty20) || 0) === 0 && (Number(q.qty40) || 0) === 0 && lcl === 0) return w;
  return w / 1000;
}

export function lineTotal(item, qty, sign) {
  const flat = Number(item?.flat || 0), per = Number(item?.perUnit || 0), tax = Number(item?.tax || 0);
  const base = flat + per * qty;
  return sign > 0 ? base * (1 + tax / 100) : base * (1 - tax / 100);
}

export function quoteModes(q) {
  const modes = [];
  if (Number(q.qty20) > 0) modes.push('fcl20');
  if (Number(q.qty40) > 0) modes.push('fcl40');
  if (Number(q.lcl) > 0 || (Number(q.qty20) === 0 && Number(q.qty40) === 0 && Number(q.weight) > 0)) modes.push('lclair');
  return modes.length ? modes : ['lclair'];
}

export function calcQuote(q) {
  const qtys = { qty20: q.qty20, qty40: q.qty40, lcl: q.lcl, weight: q.weight };
  // Snapshot of the system FX rate table taken when this quote was last saved
  // (see app/api/quotes routes) — every non-USD line is converted through this
  // before being summed, so KQKD always ends up in USD regardless of which
  // currencies were used on individual cost/sell lines.
  const fxRates = q.fxRates || {};
  const rateOf = (item) => fxRateFor(itemCurrency(item), fxRates);
  let GVDV = 0, DTLH = 0, CKTM_LINE = 0, CKTM_CLIENT = 0;
  let baseCPCN0 = 0, baseLCC = 0, baseCusTruck = 0;
  const byMode = {};
  MODES.forEach(mode => {
    const qty = qtyForMode(mode, qtys);
    // Defensive fallbacks: older saved quotes may predate a newly-added ITEM_DEFS
    // key, a whole mode, or the comline/com/com10 sub-objects — never let a
    // missing field crash the calc, just treat it as zero.
    const b = q.buying?.[mode] || {};
    const s = q.selling?.[mode] || {};
    const zeroItem = { flat: 0, perUnit: 0, tax: 0 };
    let costSub = 0, revSub = 0;
    ITEM_DEFS.forEach(d => { const it = b[d.key] || zeroItem; costSub += lineTotal(it, qty, +1) * rateOf(it); });
    ITEM_DEFS.forEach(d => { const it = s[d.key] || zeroItem; revSub += lineTotal(it, qty, +1) * rateOf(it); });
    (b.customItems || []).forEach(ci => { costSub += lineTotal(ci, qty, +1) * rateOf(ci); });
    (s.customItems || []).forEach(ci => { revSub += lineTotal(ci, qty, +1) * rateOf(ci); });
    const sCustomSub = (s.customItems || []).reduce((sum, ci) => sum + lineTotal(ci, qty, +1) * rateOf(ci), 0);
    const comline = b.comline || zeroItem;
    const com = s.com || zeroItem, com10 = s.com10 || zeroItem;
    const overseas = s.overseas || zeroItem, ofreight = s.ofreight || zeroItem;
    const thc = s.thc || zeroItem, cfs = s.cfs || zeroItem, cic = s.cic || zeroItem;
    const clean = s.clean || zeroItem, other = s.other || zeroItem;
    const dobill = s.dobill || zeroItem, hdl = s.hdl || zeroItem;
    const truck = s.truck || zeroItem, cus = s.cus || zeroItem;
    const comlineVal = (Number(comline.perUnit || 0) * qty) * (1 - (Number(comline.tax || 0) / 100)) * rateOf(comline);
    const comVal = lineTotal(com, qty, -1) * rateOf(com);
    const com10Val = lineTotal(com10, qty, -1) * rateOf(com10);
    GVDV += costSub; DTLH += revSub;
    CKTM_LINE += comlineVal; CKTM_CLIENT += comVal + com10Val;
    baseCPCN0 += ((Number(overseas.flat || 0) + Number(overseas.perUnit || 0) * qty) * rateOf(overseas)) + ((Number(ofreight.perUnit || 0) * qty) * rateOf(ofreight));
    baseLCC += ((Number(thc.perUnit || 0) * rateOf(thc) + Number(cfs.perUnit || 0) * rateOf(cfs) + Number(cic.perUnit || 0) * rateOf(cic) + Number(clean.perUnit || 0) * rateOf(clean) + Number(other.perUnit || 0) * rateOf(other)) * qty + Number(dobill.flat || 0) * rateOf(dobill) + Number(hdl.flat || 0) * rateOf(hdl) + sCustomSub) * 1.08;
    baseCusTruck += ((Number(truck.perUnit || 0) * rateOf(truck) + Number(cus.perUnit || 0) * rateOf(cus)) * qty) * 1.1;
    byMode[mode] = { qty, costSub, revSub, comlineVal, comVal, com10Val };
  });

  const rate = Number(q.interestRatePct || 0) / 100;
  const CPCN0 = baseCPCN0 * (Number(q.creditDays0 || 0) / 365) * rate;
  const CPCNLCC = baseLCC * (Number(q.creditDaysLCC || 0) / 365) * rate;
  const CPCNCusTruck = baseCusTruck * (Number(q.creditDaysCusTruck || 0) / 365) * rate;
  const CPCN_total = CPCN0 + CPCNLCC + CPCNCusTruck;
  const CKTM_total = CKTM_LINE + CKTM_CLIENT;
  const interestCuocCont = Number(q.cuocCont || 0) * (Number(q.creditDaysCuocCont || 0) / 365) * rate;
  const interestChiHoKhac = Number(q.chiHoKhac || 0) * (Number(q.creditDaysChiHoKhac || 0) / 365) * rate;
  const CPCH_interest = interestCuocCont + interestChiHoKhac;
  const CPKhac = Number(q.cpKhac || 0);
  const CPLH = GVDV + CKTM_total + CPCN_total + CPCH_interest + CPKhac;
  const KQKD = DTLH - CPLH;
  const TSLN = CPLH > 0 ? KQKD / CPLH : 0;

  return {
    byMode, GVDV, DTLH, CKTM_LINE, CKTM_CLIENT, CKTM_total,
    CPCN0, CPCNLCC, CPCNCusTruck, CPCN_total,
    interestCuocCont, interestChiHoKhac, CPCH_interest, CPKhac, CPLH, KQKD, TSLN,
  };
}

export function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// "Valid" is shown as an actual expiry date (dd/mm/yyyy) — ngày phát hành
// (createdAt, or today for a brand-new/unsaved quote) plus validDays.
export function expiryDateLabel(createdAt, validDays) {
  const base = createdAt ? new Date(createdAt) : new Date();
  const days = Number(validDays) || 30;
  const expiry = new Date(base.getTime() + days * 86400000);
  return expiry.toLocaleDateString('vi-VN');
}

export function statusLabel(s) {
  return { draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }[s] || s;
}
