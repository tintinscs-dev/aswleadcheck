// Calculation engine - mirrors the original "Data Input" Excel sheet formulas.
// Ported as-is from the original single-file app so all numbers stay identical.

export const MODES = ['fcl20', 'fcl40', 'lcl', 'air'];
export const MODE_LABELS = { fcl20: "FCL 20'", fcl40: "FCL 40'", lcl: 'LCL', air: 'AIR', lclair: 'LCL / AIR' };
export const MODE_UNIT = { fcl20: "/20'", fcl40: "/40'", lcl: '/CBM/CW', air: '/KG', lclair: '/CBM/CW' };

// ── Item definitions per mode ──────────────────────────────────────────────────

// FCL 20' / FCL 40'
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

// LCL — same structure, O/F renamed to "OF (Cước tàu)"
export const LCL_ITEM_DEFS = ITEM_DEFS.map(d =>
  d.key === 'ofreight' ? { ...d, label: 'OF (Cước tàu)' } : d
);

// AIR — Tariff items for air freight (both buy and sell sides)
export const AIR_ITEM_DEFS = [
  { key: 'overseas', label: 'OVERSEAS', flat: true, perUnit: true },
  { key: 'af',        label: 'AF', flat: false, perUnit: true },
  { key: 'hawb',      label: 'House Airway Bill (HAWB) fee', flat: true, perUnit: false },
  { key: 'ams',       label: 'AMS/ENS/AFR/FWB+FHL', flat: true, perUnit: false },
  { key: 'airthc',    label: 'Terminal Handling Charge', flat: true, perUnit: false },
  { key: 'xray',      label: 'Security Screening (X-ray)', flat: true, perUnit: false },
  { key: 'dofee',     label: 'Delivery Order (D/O) fee', flat: true, perUnit: false },
  { key: 'hdlcharge', label: 'Handling Charge', flat: true, perUnit: false },
  { key: 'docamend',  label: 'Document Amendment Fee (if any)', flat: true, perUnit: false },
  { key: 'truck',     label: 'TRUCK', flat: false, perUnit: true },
  { key: 'cus',       label: 'CUS', flat: false, perUnit: true },
];

/** Returns the item defs for a given transport mode. */
export function itemDefsForMode(mode) {
  if (mode === 'lcl' || mode === 'lclair') return LCL_ITEM_DEFS;
  if (mode === 'air') return AIR_ITEM_DEFS;
  return ITEM_DEFS; // fcl20, fcl40
}

export const COMLINE_DEF = { key: 'comline', label: 'COM LINE (hãng tàu/line trả lại)' };
export const SELL_COM_DEFS = [
  { key: 'com', label: 'COM (khách hàng)', flat: true, perUnit: true },
  { key: 'com10', label: 'COM 10%', flat: true, perUnit: true },
];

export const DEFAULT_SETTINGS = { exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 };

export const CURRENCIES = ['USD', 'VND', 'EUR', 'GBP', 'SGD', 'CNY', 'HKD'];
export const DEFAULT_CURRENCY = 'USD';
export function itemCurrency(item) { return (item && item.currency) || DEFAULT_CURRENCY; }

export const FX_CURRENCIES = ['VND', 'EUR', 'GBP', 'SGD', 'CNY', 'HKD'];
export const DEFAULT_FX_RATES = { VND: 0.00004, EUR: 1.08, GBP: 1.27, SGD: 0.74, CNY: 0.14, HKD: 0.13 };

export function fxRateFor(currency, fxRates) {
  if (!currency || currency === DEFAULT_CURRENCY) return 1;
  const v = Number(fxRates?.[currency]);
  if (v > 0) return v;
  return Number(DEFAULT_FX_RATES[currency]) || 1;
}

export function usdVndRateFromFx(fxRates) {
  const vnd = Number(fxRates?.VND);
  if (vnd > 0) return 1 / vnd;
  return DEFAULT_SETTINGS.exchangeRate;
}

export function blankItem() { return { flat: 0, perUnit: 0, tax: 0, currency: DEFAULT_CURRENCY }; }

/** Creates a blank buying-side mode object for the given mode. */
export function blankModeBuying(mode) {
  const m = {};
  itemDefsForMode(mode).forEach(d => (m[d.key] = blankItem()));
  m.comline = { perUnit: 0, tax: 0, currency: DEFAULT_CURRENCY };
  m.customItems = [];
  return m;
}

/** Creates a blank selling-side mode object for the given mode. */
export function blankModeSelling(mode) {
  const m = {};
  itemDefsForMode(mode).forEach(d => (m[d.key] = blankItem()));
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
    pieces: 0, notes: '',
    qty20: 0, qty40: 0, lcl: 0, weight: 0, sales: '',
    exchangeRate: DEFAULT_SETTINGS.exchangeRate,
    interestRatePct: DEFAULT_SETTINGS.interestRatePct,
    creditDays0: 0, creditDaysLCC: 0, creditDaysCusTruck: 0,
    cuocCont: 0, creditDaysCuocCont: 0,
    chiHoKhac: 0, creditDaysChiHoKhac: 0, cpKhac: 0,
    buying: {
      fcl20: blankModeBuying('fcl20'),
      fcl40: blankModeBuying('fcl40'),
      lcl:   blankModeBuying('lcl'),
      air:   blankModeBuying('air'),
    },
    selling: {
      fcl20: blankModeSelling('fcl20'),
      fcl40: blankModeSelling('fcl40'),
      lcl:   blankModeSelling('lcl'),
      air:   blankModeSelling('air'),
    },
  };
}

/**
 * Migrate old quotes that have `buying.lclair` to the new `lcl`/`air` split.
 * Also ensures `lcl` and `air` keys exist for older DB records that predate
 * this change. Safe to call multiple times (idempotent).
 */
export function migrateQuote(q) {
  if (!q) return q;
  let buying  = q.buying  || {};
  let selling = q.selling || {};
  let changed = false;

  // Migrate lclair → lcl (air stays empty; user fills it if needed)
  if (buying.lclair && !buying.lcl) {
    buying  = { ...buying,  lcl: buying.lclair,   air: buying.air   || blankModeBuying('air') };
    selling = { ...selling, lcl: selling.lclair || blankModeSelling('lcl'), air: selling.air || blankModeSelling('air') };
    changed = true;
  }

  // Ensure lcl/air keys exist (quotes created before this update)
  if (!buying.lcl || !buying.air) {
    buying  = { ...buying,  lcl: buying.lcl  || blankModeBuying('lcl'),  air: buying.air  || blankModeBuying('air') };
    selling = { ...selling, lcl: selling.lcl || blankModeSelling('lcl'), air: selling.air || blankModeSelling('air') };
    changed = true;
  }

  return changed ? { ...q, buying, selling } : q;
}

export function qtyForMode(mode, q) {
  if (mode === 'fcl20') return Number(q.qty20) || 0;
  if (mode === 'fcl40') return Number(q.qty40) || 0;
  if (mode === 'lcl') {
    const lcl = Number(q.lcl) || 0, w = Number(q.weight) || 0;
    if (lcl > 0) return Math.max(lcl, w / 1000, 1);
    return w / 1000;
  }
  if (mode === 'air') {
    return Number(q.weight) || 0; // chargeable weight in KG
  }
  // Backward compat: lclair (old quotes not yet migrated)
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
  // LCL: has CBM data
  if (Number(q.lcl) > 0) modes.push('lcl');
  // AIR: has weight but no CBM (pure air freight)
  else if (Number(q.weight) > 0 && !Number(q.qty20) && !Number(q.qty40)) modes.push('air');
  // Backward compat: old lclair data not yet migrated
  if (q.buying?.lclair && !modes.includes('lcl') && !modes.includes('air')) modes.push('lclair');
  return modes.length ? modes : ['lcl'];
}

export function calcQuote(q) {
  const qtys = { qty20: q.qty20, qty40: q.qty40, lcl: q.lcl, weight: q.weight };
  const fxRates = q.fxRates || {};
  const rateOf = (item) => fxRateFor(itemCurrency(item), fxRates);
  let GVDV = 0, DTLH = 0, CKTM_LINE = 0, CKTM_CLIENT = 0;
  let baseCPCN0 = 0, baseLCC = 0, baseCusTruck = 0;
  const byMode = {};

  // Include old lclair key if it exists (backward compat for un-migrated quotes)
  const allModes = q.buying?.lclair && !q.buying?.lcl ? [...MODES, 'lclair'] : MODES;

  allModes.forEach(mode => {
    const qty = qtyForMode(mode, qtys);
    const b = q.buying?.[mode] || {};
    const s = q.selling?.[mode] || {};
    const zeroItem = { flat: 0, perUnit: 0, tax: 0 };
    const defs = itemDefsForMode(mode);
    let costSub = 0, revSub = 0;
    defs.forEach(d => { const it = b[d.key] || zeroItem; costSub += lineTotal(it, qty, +1) * rateOf(it); });
    defs.forEach(d => { const it = s[d.key] || zeroItem; revSub  += lineTotal(it, qty, +1) * rateOf(it); });
    (b.customItems || []).forEach(ci => { costSub += lineTotal(ci, qty, +1) * rateOf(ci); });
    (s.customItems || []).forEach(ci => { revSub  += lineTotal(ci, qty, +1) * rateOf(ci); });
    const sCustomSub = (s.customItems || []).reduce((sum, ci) => sum + lineTotal(ci, qty, +1) * rateOf(ci), 0);

    const comline = b.comline || zeroItem;
    const com = s.com || zeroItem, com10 = s.com10 || zeroItem;
    const comlineVal = (Number(comline.perUnit || 0) * qty) * (1 - (Number(comline.tax || 0) / 100)) * rateOf(comline);
    const comVal   = lineTotal(com,   qty, -1) * rateOf(com);
    const com10Val = lineTotal(com10, qty, -1) * rateOf(com10);

    GVDV += costSub; DTLH += revSub;
    CKTM_LINE += comlineVal; CKTM_CLIENT += comVal + com10Val;

    // Interest-rate base calculations — varies by mode
    if (mode === 'air') {
      const overseas_ = s.overseas || zeroItem;
      const af_       = s.af       || zeroItem;
      baseCPCN0 += ((Number(overseas_.flat || 0) + Number(overseas_.perUnit || 0) * qty) * rateOf(overseas_)) +
                   (Number(af_.perUnit || 0) * qty * rateOf(af_));
      let localSum = 0;
      ['hawb','ams','airthc','xray','dofee','hdlcharge','docamend'].forEach(k => {
        const it = s[k] || zeroItem;
        localSum += (Number(it.flat || 0) + Number(it.perUnit || 0) * qty) * rateOf(it);
      });
      baseLCC += (localSum + sCustomSub) * 1.08;
      const truck_ = s.truck || zeroItem, cus_ = s.cus || zeroItem;
      baseCusTruck += ((Number(truck_.perUnit || 0) * rateOf(truck_) + Number(cus_.perUnit || 0) * rateOf(cus_)) * qty) * 1.1;
    } else {
      // FCL20 / FCL40 / LCL / lclair (backward compat)
      const overseas = s.overseas || zeroItem, ofreight = s.ofreight || zeroItem;
      const thc = s.thc || zeroItem, cfs = s.cfs || zeroItem, cic = s.cic || zeroItem;
      const clean = s.clean || zeroItem, other = s.other || zeroItem;
      const dobill = s.dobill || zeroItem, hdl = s.hdl || zeroItem;
      const truck = s.truck || zeroItem, cus = s.cus || zeroItem;
      baseCPCN0 += ((Number(overseas.flat || 0) + Number(overseas.perUnit || 0) * qty) * rateOf(overseas)) +
                   ((Number(ofreight.perUnit || 0) * qty) * rateOf(ofreight));
      baseLCC += ((Number(thc.perUnit || 0) * rateOf(thc) + Number(cfs.perUnit || 0) * rateOf(cfs) +
                   Number(cic.perUnit || 0) * rateOf(cic) + Number(clean.perUnit || 0) * rateOf(clean) +
                   Number(other.perUnit || 0) * rateOf(other)) * qty +
                  Number(dobill.flat || 0) * rateOf(dobill) + Number(hdl.flat || 0) * rateOf(hdl) + sCustomSub) * 1.08;
      baseCusTruck += ((Number(truck.perUnit || 0) * rateOf(truck) + Number(cus.perUnit || 0) * rateOf(cus)) * qty) * 1.1;
    }

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

export function expiryDateLabel(createdAt, validDays) {
  const base = createdAt ? new Date(createdAt) : new Date();
  const days = Number(validDays) || 30;
  const expiry = new Date(base.getTime() + days * 86400000);
  return expiry.toLocaleDateString('vi-VN');
}

export function statusLabel(s) {
  return { draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }[s] || s;
}
