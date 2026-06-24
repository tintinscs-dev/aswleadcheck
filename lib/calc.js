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

// Per-line currency tag. Default is always USD; user can re-tag any individual
// cost/sell line with a different currency for reference (e.g. a rate quoted
// by the carrier in EUR). This is a display label only — no FX conversion is
// applied to the underlying number, the calc engine still sums raw values.
export const CURRENCIES = ['USD', 'VND', 'EUR', 'JPY', 'CNY', 'KRW', 'SGD', 'THB', 'GBP', 'AUD'];
export const DEFAULT_CURRENCY = 'USD';
export function itemCurrency(item) { return (item && item.currency) || DEFAULT_CURRENCY; }

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
  let GVDV = 0, DTLH = 0, CKTM_LINE = 0, CKTM_CLIENT = 0;
  let baseCPCN0 = 0, baseLCC = 0, baseCusTruck = 0;
  const byMode = {};
  MODES.forEach(mode => {
    const qty = qtyForMode(mode, qtys);
    const b = q.buying[mode], s = q.selling[mode];
    let costSub = 0, revSub = 0;
    ITEM_DEFS.forEach(d => { costSub += lineTotal(b[d.key], qty, +1); });
    ITEM_DEFS.forEach(d => { revSub += lineTotal(s[d.key], qty, +1); });
    (b.customItems || []).forEach(ci => { costSub += lineTotal(ci, qty, +1); });
    (s.customItems || []).forEach(ci => { revSub += lineTotal(ci, qty, +1); });
    const sCustomSub = (s.customItems || []).reduce((sum, ci) => sum + lineTotal(ci, qty, +1), 0);
    const comlineVal = (Number(b.comline.perUnit || 0) * qty) * (1 - (Number(b.comline.tax || 0) / 100));
    const comVal = lineTotal(s.com, qty, -1);
    const com10Val = lineTotal(s.com10, qty, -1);
    GVDV += costSub; DTLH += revSub;
    CKTM_LINE += comlineVal; CKTM_CLIENT += comVal + com10Val;
    baseCPCN0 += (Number(s.overseas.flat || 0) + Number(s.overseas.perUnit || 0) * qty) + (Number(s.ofreight.perUnit || 0) * qty);
    baseLCC += ((Number(s.thc.perUnit || 0) + Number(s.cfs.perUnit || 0) + Number(s.cic.perUnit || 0) + Number(s.clean.perUnit || 0) + Number(s.other.perUnit || 0)) * qty + Number(s.dobill.flat || 0) + Number(s.hdl.flat || 0) + sCustomSub) * 1.08;
    baseCusTruck += ((Number(s.truck.perUnit || 0) + Number(s.cus.perUnit || 0)) * qty) * 1.1;
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

export function statusLabel(s) {
  return { draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }[s] || s;
}
