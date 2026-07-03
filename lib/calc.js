// Calculation engine for the ASW Sales Shipment Proposal app.
// Item price model: every charge line is { price, unit, tax, currency }.
// `unit` decides the multiplier: "per-quantity" units (Container / W/M / C.W / G.W)
// multiply the price by the shipment quantity for that mode; "flat" units
// (Bill of Lading / Shipment) charge the price once regardless of quantity.
import { TARIFF_SUGGEST, suggestedFor } from './tariffData';

export const MODES = ['fcl20', 'fcl40', 'lcl', 'air'];
export const MODE_LABELS = { fcl20: "FCL 20'", fcl40: "FCL 40'", lcl: 'LCL', air: 'AIR', lclair: 'LCL / AIR' };
export const MODE_UNIT = { fcl20: "/20'", fcl40: "/40'", lcl: '/CBM', air: '/C.W' };

// ── Unit types ──────────────────────────────────────────────────────────────
// Units that multiply the price by the mode's quantity (containers / CBM / weight).
export const PER_QTY_UNITS = ['Container', 'W/M', 'C.W', 'G.W'];
// Units charged once per shipment, regardless of quantity.
export const FLAT_UNITS = ['Bill of Lading', 'Shipment'];
export const UNIT_OPTIONS = [...PER_QTY_UNITS, ...FLAT_UNITS];
export const UNIT_OPTIONS_BY_MODE = {
  fcl20: ['Container', 'Bill of Lading', 'Shipment'],
  fcl40: ['Container', 'Bill of Lading', 'Shipment'],
  lcl: ['W/M', 'Bill of Lading', 'Shipment'],
  air: ['C.W', 'G.W', 'Bill of Lading', 'Shipment'],
};
export function isFlatUnit(unit) { return !PER_QTY_UNITS.includes(unit); }

// ── Item definitions per mode ──────────────────────────────────────────────────
// FCL 20' / FCL 40' — identical charge list; suggested prices differ by container size (see tariffData.js).
export const FCL_ITEM_DEFS = [
  { key: 'ofreight', label: 'OF (cước tàu)', unit: 'Container' },
  { key: 'exThc', label: 'EX-Origin Terminal Handling Charges', unit: 'Container' },
  { key: 'exDocFee', label: 'EX-Origin Documentation Fee', unit: 'Bill of Lading' },
  { key: 'exContSeal', label: 'EX-Container Seal', unit: 'Container' },
  { key: 'exTelex', label: 'EX-Surrender/Telex Release Fee (if any)', unit: 'Bill of Lading' },
  { key: 'exHandling', label: 'EX-Handling Charge', unit: 'Bill of Lading' },
  { key: 'exAms', label: 'EX-AMS/ENS/ACI/AFR/CCAM', unit: 'Bill of Lading' },
  { key: 'exEbs', label: 'EX-Emergency Bulker Surcharge (EBS) (only for Intra Asia)', unit: 'Container' },
  { key: 'exVgm', label: 'EX-VGM filling fee (if any)', unit: 'Shipment' },
  { key: 'exAmend', label: 'EX-Origin Document Amendment Fee (if any)', unit: 'Bill of Lading' },
  { key: 'exSwitch', label: 'EX-Switch bill fee (if any)', unit: 'Bill of Lading' },
  { key: 'exLateSi', label: 'EX-Late SI fee (if any)', unit: 'Bill of Lading' },
  { key: 'exAmsAmend', label: 'EX-AMS/ENS/ACI/AFR/CCAM Amendment Fee (if any)', unit: 'Bill of Lading' },
  { key: 'exIsf', label: 'EX-ISF filling fee (if any)', unit: 'Bill of Lading' },
  { key: 'imThc', label: 'IM-Terminal Handling Charge', unit: 'Container' },
  { key: 'imDoFee', label: 'IM-Delivery Order Fee', unit: 'Bill of Lading' },
  { key: 'imHandling', label: 'IM-Handling Charge', unit: 'Bill of Lading' },
  { key: 'imEmc', label: 'IM-Equipment Management/ Maintenance Charge/ EMCI', unit: 'Container' },
  { key: 'imCic', label: 'IM-Container Imbalance Charge (CIC)/ ERC', unit: 'Container' },
  { key: 'imCleaning', label: 'IM-Container Cleaning Fee (if any) - General cargo', unit: 'Container' },
  { key: 'cktm', label: 'CKTM', unit: 'Shipment' },
];

// LCL / LCL BCN — local charges only (ocean freight, if any, is entered as a custom item).
export const LCL_ITEM_DEFS = [
  { key: 'exThc', label: 'EX-Terminal Handling Charge', unit: 'W/M' },
  { key: 'exDocFee', label: 'EX-Origin Documentation Fee', unit: 'Bill of Lading' },
  { key: 'exCfs', label: 'EX-CFS Charge', unit: 'W/M' },
  { key: 'exTelex', label: 'EX-Telex Release Fee (if any)', unit: 'Bill of Lading' },
  { key: 'exHandling', label: 'EX-Handling Charge', unit: 'Bill of Lading' },
  { key: 'exAms', label: 'EX-AMS/ENS/ACI/AFR/CCAM/AMO', unit: 'Bill of Lading' },
  { key: 'exEbs', label: 'EX-Emergency Bulker Surcharge (EBS)', unit: 'W/M' },
  { key: 'exLoadUnload', label: 'EX-Loading/ Unloading Fee', unit: 'W/M' },
  { key: 'exStorage', label: 'EX-Storage fee', unit: 'W/M' },
  { key: 'exAmend', label: 'EX-Document Amendement Fee', unit: 'Bill of Lading' },
  { key: 'exSwitch', label: 'EX-Switch bill fee', unit: 'Bill of Lading' },
  { key: 'exLateSi', label: 'EX-Late SI fee', unit: 'Bill of Lading' },
  { key: 'exAmsAmend', label: 'EX-AMS/ENS/ACI/AFR/CCAM/AMO Amendment Fee', unit: 'Bill of Lading' },
  { key: 'exVgm', label: 'EX-VGM filling fee (if any)', unit: 'Bill of Lading' },
  { key: 'imThc', label: 'IM-Terminal Handling Charge', unit: 'W/M' },
  { key: 'imDoFee', label: 'IM-Delivery Order Fee', unit: 'Bill of Lading' },
  { key: 'imCfs', label: 'IM-CFS Charge', unit: 'W/M' },
  { key: 'imHandling', label: 'IM-Handling Charge', unit: 'Bill of Lading' },
  { key: 'imCic', label: 'IM-Container Imbalance Charge (CIC)', unit: 'W/M' },
  { key: 'imLowSulfur', label: 'IM-Low Sulfur Surcharge (if any)', unit: 'W/M' },
  { key: 'cktm', label: 'CKTM', unit: 'Shipment' },
];

// AIR — tariff items for air freight (both buy and sell sides).
export const AIR_ITEM_DEFS = [
  { key: 'overseas', label: 'OVERSEAS', unit: 'C.W' },
  { key: 'af', label: 'AF', unit: 'C.W' },
  { key: 'hawb', label: 'House Airway Bill (HAWB) fee', unit: 'Bill of Lading' },
  { key: 'ams', label: 'AMS/ENS/AFR/FWB+FHL', unit: 'Bill of Lading' },
  { key: 'airthc', label: 'Terminal Handling Charge', unit: 'C.W' },
  { key: 'xray', label: 'Security Screening (X-ray)', unit: 'G.W' },
  { key: 'dofee', label: 'Delivery Order (D/O) fee', unit: 'Bill of Lading' },
  { key: 'hdlcharge', label: 'Handling Charge', unit: 'Bill of Lading' },
  { key: 'docamend', label: 'Document Amendment Fee (if any)', unit: 'Bill of Lading' },
  { key: 'truck', label: 'TRUCK', unit: 'Shipment' },
  { key: 'cus', label: 'CUS', unit: 'Shipment' },
  { key: 'cktm', label: 'CKTM', unit: 'Shipment' },
];

// Legacy alias kept for any lingering imports (== FCL defs).
export const ITEM_DEFS = FCL_ITEM_DEFS;

/** Returns the item defs for a given transport mode. */
export function itemDefsForMode(mode) {
  if (mode === 'lcl' || mode === 'lclair') return LCL_ITEM_DEFS;
  if (mode === 'air') return AIR_ITEM_DEFS;
  return FCL_ITEM_DEFS; // fcl20, fcl40
}

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

export function blankItem(unit) { return { price: 0, unit: unit || 'Shipment', tax: 0, currency: DEFAULT_CURRENCY }; }

/** Creates a blank mode object (buying or selling — same shape now that COM/CKTM is unified). */
export function blankMode(mode) {
  const m = {};
  itemDefsForMode(mode).forEach(d => (m[d.key] = blankItem(d.unit)));
  m.customItems = [];
  return m;
}
// Kept for backward-compat call sites.
export function blankModeBuying(mode) { return blankMode(mode); }
export function blankModeSelling(mode) { return blankMode(mode); }

export function blankCustomItem() { return { label: '', price: 0, unit: 'Shipment', tax: 0, currency: DEFAULT_CURRENCY }; }

export function newQuoteData() {
  return {
    no: '', dep: 'FES', keys: '', shpr: '', cnee: '', agent: '',
    pol: '', pod: '', pickup: '', delivery: '', term: '',
    etd: '', eta: '', lineCoLoader: '', validDays: 30,
    pieces: 0, notes: '',
    qty20: 0, qty40: 0, lcl: 0, weight: 0, cw: 0, sales: '',
    exchangeRate: DEFAULT_SETTINGS.exchangeRate,
    interestRatePct: DEFAULT_SETTINGS.interestRatePct,
    creditDays0: 0, creditDaysLCC: 0, creditDaysCusTruck: 0,
    cuocCont: 0, creditDaysCuocCont: 0,
    chiHoKhac: 0, creditDaysChiHoKhac: 0, cpKhac: 0,
    buying: {
      fcl20: blankMode('fcl20'),
      fcl40: blankMode('fcl40'),
      lcl:   blankMode('lcl'),
      air:   blankMode('air'),
    },
    selling: {
      fcl20: blankMode('fcl20'),
      fcl40: blankMode('fcl40'),
      lcl:   blankMode('lcl'),
      air:   blankMode('air'),
    },
  };
}

// ── Migration from the old {flat, perUnit} + COM/COM10/COM-line model ──────────
// Old ITEM_DEFS labels, needed so money on removed fields isn't silently lost —
// it's folded into a custom item on load instead, keeping historical quotes intact.
const OLD_LABELS = {
  overseas: 'OVERSEAS', ofreight: 'O/F (Cước tàu / bay)', dobill: 'DO / BILL', thc: 'THC', cfs: 'CFS', cic: 'CIC',
  hdl: 'HDL / TLX BILL / LATE PAYMENT', clean: 'CLEAN', other: 'OTHER', truck: 'TRUCK', cus: 'CUS',
};
const NEW_KEYS_BY_MODE = {
  fcl20: new Set(FCL_ITEM_DEFS.map(d => d.key)),
  fcl40: new Set(FCL_ITEM_DEFS.map(d => d.key)),
  lcl: new Set(LCL_ITEM_DEFS.map(d => d.key)),
  air: new Set(AIR_ITEM_DEFS.map(d => d.key)),
};
function defaultPerQtyUnitForMode(mode) {
  if (mode === 'lcl' || mode === 'lclair') return 'W/M';
  if (mode === 'air') return 'C.W';
  return 'Container';
}
// Convert one legacy {flat, perUnit, tax, currency} item into the new {price, unit, ...} shape,
// baking flat+perUnit*qty into a single price snapshot (unit chosen so it won't be re-multiplied).
function migrateOldItemToNew(old, mode, qty) {
  const flat = Number(old?.flat || 0), per = Number(old?.perUnit || 0);
  const price = flat + per * (Number(qty) || 0);
  return { price, unit: 'Shipment', tax: Number(old?.tax || 0), currency: old?.currency || DEFAULT_CURRENCY };
}
function isOldShape(item) { return item && typeof item === 'object' && ('flat' in item || 'perUnit' in item) && !('unit' in item); }

function migrateModeData(mode, data, qty) {
  if (!data) return blankMode(mode);
  const out = { customItems: Array.isArray(data.customItems) ? data.customItems.slice() : [] };
  const newKeys = NEW_KEYS_BY_MODE[mode];

  // Carry over/convert keys that still exist in the new item list.
  newKeys.forEach(key => {
    const existing = data[key];
    if (existing && !isOldShape(existing)) { out[key] = existing; return; }
    if (existing && isOldShape(existing)) {
      // 'ofreight' keeps its per-unit semantics (still a per-container freight line).
      if (key === 'ofreight') {
        out[key] = { price: Number(existing.perUnit || 0) || Number(existing.flat || 0), unit: defaultPerQtyUnitForMode(mode), tax: Number(existing.tax || 0), currency: existing.currency || DEFAULT_CURRENCY };
      } else {
        out[key] = migrateOldItemToNew(existing, mode, qty);
      }
      return;
    }
    out[key] = blankItem(itemDefsForMode(mode).find(d => d.key === key)?.unit);
  });

  // Fold money from removed keys (old THC/CFS/CIC/HDL/CLEAN/OTHER/TRUCK/CUS/OVERSEAS on FCL/LCL,
  // or old OVERSEAS/OFREIGHT on LCL which no longer has a freight line) into custom items, so no
  // historical financial data disappears silently.
  Object.keys(OLD_LABELS).forEach(oldKey => {
    if (newKeys.has(oldKey)) return; // still a real field on this mode (e.g. air keeps truck/cus)
    const old = data[oldKey];
    if (!old || !isOldShape(old)) return;
    const flat = Number(old.flat || 0), per = Number(old.perUnit || 0);
    if (!flat && !per) return;
    const price = flat + per * (Number(qty) || 0);
    out.customItems.push({ label: `${OLD_LABELS[oldKey]} (dữ liệu cũ)`, price, unit: 'Shipment', tax: Number(old.tax || 0), currency: old.currency || DEFAULT_CURRENCY });
  });
  if (mode === 'lcl' && data.ofreight && isOldShape(data.ofreight)) {
    const of = data.ofreight;
    const price = Number(of.perUnit || 0) * (Number(qty) || 0) + Number(of.flat || 0);
    if (price) out.customItems.push({ label: 'OF (Cước tàu / bay) (dữ liệu cũ)', price, unit: 'Shipment', tax: Number(of.tax || 0), currency: of.currency || DEFAULT_CURRENCY });
  }

  return out;
}

function migrateComToCktm(buyingData, sellingData, qty) {
  const comline = buyingData?.comline;
  const com = sellingData?.com, com10 = sellingData?.com10;
  let buyPrice = 0, sellPrice = 0, buyTax = 0, sellTax = 0, buyCcy = DEFAULT_CURRENCY, sellCcy = DEFAULT_CURRENCY;
  if (comline && (Number(comline.perUnit) || Number(comline.flat))) {
    buyPrice = Number(comline.perUnit || 0) * (Number(qty) || 0) + Number(comline.flat || 0);
    buyTax = Number(comline.tax || 0); buyCcy = comline.currency || DEFAULT_CURRENCY;
  }
  if (com && (Number(com.perUnit) || Number(com.flat))) {
    sellPrice += Number(com.perUnit || 0) * (Number(qty) || 0) + Number(com.flat || 0);
    sellTax = Number(com.tax || 0); sellCcy = com.currency || DEFAULT_CURRENCY;
  }
  if (com10 && (Number(com10.perUnit) || Number(com10.flat))) {
    sellPrice += Number(com10.perUnit || 0) * (Number(qty) || 0) + Number(com10.flat || 0);
    if (!sellTax) sellTax = Number(com10.tax || 0);
  }
  return {
    buyCktm: buyPrice ? { price: buyPrice, unit: 'Shipment', tax: buyTax, currency: buyCcy } : null,
    sellCktm: sellPrice ? { price: sellPrice, unit: 'Shipment', tax: sellTax, currency: sellCcy } : null,
  };
}

/**
 * Migrate old quotes to the current shape:
 *  - `buying.lclair` / `selling.lclair` → `lcl` (pre-existing LCL/AIR split migration)
 *  - old {flat, perUnit} items → {price, unit}
 *  - old COM-line / COM / COM10 → a single CKTM line per side
 * Safe to call multiple times (idempotent) — already-migrated quotes pass through untouched.
 */
export function migrateQuote(q) {
  if (!q) return q;
  let buying = q.buying || {};
  let selling = q.selling || {};
  if (buying.lclair && !buying.lcl) {
    buying = { ...buying, lcl: buying.lclair };
    selling = { ...selling, lcl: selling.lclair || {} };
  }

  const needsMigration = MODES.some(mode => {
    const b = buying[mode], s = selling[mode];
    return (b && (isOldShape(b.overseas) || isOldShape(b.ofreight) || isOldShape(b.thc) || b.comline)) ||
           (s && (isOldShape(s.overseas) || isOldShape(s.ofreight) || isOldShape(s.thc) || s.com || s.com10));
  });
  if (!needsMigration) return (buying !== (q.buying || {}) || selling !== (q.selling || {})) ? { ...q, buying, selling } : q;

  const newBuying = {}, newSelling = {};
  MODES.forEach(mode => {
    const qty = qtyForMode(mode, q);
    const migratedBuying = migrateModeData(mode, buying[mode], qty);
    const migratedSelling = migrateModeData(mode, selling[mode], qty);
    const { buyCktm, sellCktm } = migrateComToCktm(buying[mode], selling[mode], qty);
    if (buyCktm && !(Number(migratedBuying.cktm?.price) || 0)) migratedBuying.cktm = buyCktm;
    if (sellCktm && !(Number(migratedSelling.cktm?.price) || 0)) migratedSelling.cktm = sellCktm;
    newBuying[mode] = migratedBuying;
    newSelling[mode] = migratedSelling;
  });

  return { ...q, buying: newBuying, selling: newSelling };
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
    // Chargeable Weight (C.W) drives Air pricing; fall back to Weight (G.W) for old quotes.
    return Number(q.cw) || Number(q.weight) || 0;
  }
  // Backward compat: lclair (old quotes not yet migrated)
  const lcl = Number(q.lcl) || 0, w = Number(q.weight) || 0;
  if (lcl > 0) return Math.max(lcl, w / 1000, 1);
  if ((Number(q.qty20) || 0) === 0 && (Number(q.qty40) || 0) === 0 && lcl === 0) return w;
  return w / 1000;
}

export function lineTotal(item, qty, sign) {
  const price = Number(item?.price ?? item?.perUnit ?? 0);
  const flatExtra = item && 'flat' in item && !('price' in item) ? Number(item.flat || 0) : 0;
  const multiplier = isFlatUnit(item?.unit) ? 1 : (Number(qty) || 0);
  const tax = Number(item?.tax || 0);
  const base = price * multiplier + flatExtra;
  return (sign ?? 1) >= 0 ? base * (1 + tax / 100) : base * (1 - tax / 100);
}

/** Returns true if a mode's buying or selling data has at least one non-zero charge. */
function modeHasData(q, mode) {
  const hasNonZero = (data) => {
    if (!data) return false;
    return Object.entries(data).some(([k, v]) => {
      if (k === 'customItems') return Array.isArray(v) && v.some(ci => Number(ci?.price ?? ci?.flat ?? ci?.perUnit));
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return Number(v.price ?? 0) !== 0 || Number(v.flat ?? 0) !== 0 || Number(v.perUnit ?? 0) !== 0;
      }
      return false;
    });
  };
  return hasNonZero(q.buying?.[mode]) || hasNonZero(q.selling?.[mode]);
}

// Loại dịch vụ (DEP.) → whether the shipment is by Sea or Air. This is the source of
// truth for which mode tabs are valid, so PDF/Excel exports never mix up the mode.
function transportFromDep(dep) {
  if (dep === 'FEA' || dep === 'FIA') return 'air';
  if (dep === 'FES' || dep === 'FIS') return 'sea';
  return null; // OTHER / empty → fall back to auto-detection
}

export function quoteModes(q) {
  const transport = transportFromDep(q.dep);
  if (transport === 'air') return ['air'];

  const modes = [];
  if (Number(q.qty20) > 0 || modeHasData(q, 'fcl20')) modes.push('fcl20');
  if (Number(q.qty40) > 0 || modeHasData(q, 'fcl40')) modes.push('fcl40');
  // LCL: has CBM data OR charges were entered in lcl tab
  if (Number(q.lcl) > 0 || modeHasData(q, 'lcl')) modes.push('lcl');
  if (transport === 'sea') return modes.length ? modes : ['lcl'];

  // AIR: chargeable-weight shipment OR charges were entered in air tab (even alongside LCL)
  if (((Number(q.cw) > 0 || Number(q.weight) > 0) && !Number(q.qty20) && !Number(q.qty40) && !Number(q.lcl)) || modeHasData(q, 'air')) modes.push('air');
  // Backward compat: old lclair data not yet migrated
  if (q.buying?.lclair && !modes.includes('lcl') && !modes.includes('air')) modes.push('lclair');
  return modes.length ? modes : ['lcl'];
}

export function calcQuote(q) {
  const fxRates = q.fxRates || {};
  const rateOf = (item) => fxRateFor(itemCurrency(item), fxRates);
  let GVDV = 0, DTLH = 0, CKTM_BUY = 0, CKTM_SELL = 0;
  let baseCPCN0 = 0, baseLCC = 0, baseCusTruck = 0;
  const byMode = {};

  // Include old lclair key if it exists (backward compat for un-migrated quotes)
  const allModes = q.buying?.lclair && !q.buying?.lcl ? [...MODES, 'lclair'] : MODES;

  allModes.forEach(mode => {
    const qty = qtyForMode(mode, q);
    const b = q.buying?.[mode] || {};
    const s = q.selling?.[mode] || {};
    const zeroItem = { price: 0, unit: 'Shipment', tax: 0 };
    const defs = itemDefsForMode(mode);
    let costSub = 0, revSub = 0;
    defs.forEach(d => { const it = b[d.key] || zeroItem; costSub += lineTotal(it, qty, +1) * rateOf(it); });
    defs.forEach(d => { const it = s[d.key] || zeroItem; revSub  += lineTotal(it, qty, +1) * rateOf(it); });
    (b.customItems || []).forEach(ci => { costSub += lineTotal(ci, qty, +1) * rateOf(ci); });
    (s.customItems || []).forEach(ci => { revSub  += lineTotal(ci, qty, +1) * rateOf(ci); });
    const sCustomSub = (s.customItems || []).reduce((sum, ci) => sum + lineTotal(ci, qty, +1) * rateOf(ci), 0);

    GVDV += costSub; DTLH += revSub;
    const bCktm = b.cktm || zeroItem, sCktm = s.cktm || zeroItem;
    CKTM_BUY += lineTotal(bCktm, qty, +1) * rateOf(bCktm);
    CKTM_SELL += lineTotal(sCktm, qty, +1) * rateOf(sCktm);

    // Interest-rate base calculations — varies by mode
    if (mode === 'air') {
      const overseas_ = s.overseas || zeroItem;
      const af_       = s.af       || zeroItem;
      baseCPCN0 += lineTotal(overseas_, qty, +1) * rateOf(overseas_) + lineTotal(af_, qty, +1) * rateOf(af_);
      let localSum = 0;
      ['hawb','ams','airthc','xray','dofee','hdlcharge','docamend'].forEach(k => {
        const it = s[k] || zeroItem;
        localSum += lineTotal(it, qty, +1) * rateOf(it);
      });
      baseLCC += (localSum + sCustomSub) * 1.08;
      const truck_ = s.truck || zeroItem, cus_ = s.cus || zeroItem;
      baseCusTruck += (lineTotal(truck_, qty, +1) * rateOf(truck_) + lineTotal(cus_, qty, +1) * rateOf(cus_)) * 1.1;
    } else if (mode === 'fcl20' || mode === 'fcl40') {
      const ofreight = s.ofreight || zeroItem;
      baseCPCN0 += lineTotal(ofreight, qty, +1) * rateOf(ofreight);
      let localSum = 0;
      defs.forEach(d => { if (d.key !== 'ofreight' && d.key !== 'cktm') localSum += lineTotal(s[d.key] || zeroItem, qty, +1) * rateOf(s[d.key] || zeroItem); });
      baseLCC += (localSum + sCustomSub) * 1.08;
    } else {
      // LCL / lclair (backward compat) — no freight line in the new local-charges-only list
      let localSum = 0;
      defs.forEach(d => { if (d.key !== 'cktm') localSum += lineTotal(s[d.key] || zeroItem, qty, +1) * rateOf(s[d.key] || zeroItem); });
      baseLCC += (localSum + sCustomSub) * 1.08;
    }

    byMode[mode] = { qty, costSub, revSub };
  });

  const rate = Number(q.interestRatePct || 0) / 100;
  const CPCN0 = baseCPCN0 * (Number(q.creditDays0 || 0) / 365) * rate;
  const CPCNLCC = baseLCC * (Number(q.creditDaysLCC || 0) / 365) * rate;
  const CPCNCusTruck = baseCusTruck * (Number(q.creditDaysCusTruck || 0) / 365) * rate;
  const CPCN_total = CPCN0 + CPCNLCC + CPCNCusTruck;
  // CKTM is already included in GVDV/DTLH above (it's a normal line item now) — these
  // totals are shown for visibility only and are NOT added again into CPLH.
  const CKTM_total = CKTM_BUY + CKTM_SELL;
  const interestCuocCont = Number(q.cuocCont || 0) * (Number(q.creditDaysCuocCont || 0) / 365) * rate;
  const interestChiHoKhac = Number(q.chiHoKhac || 0) * (Number(q.creditDaysChiHoKhac || 0) / 365) * rate;
  const CPCH_interest = interestCuocCont + interestChiHoKhac;
  const CPKhac = Number(q.cpKhac || 0);
  const CPLH = GVDV + CPCN_total + CPCH_interest + CPKhac;
  const KQKD = DTLH - CPLH;
  const TSLN = CPLH > 0 ? KQKD / CPLH : 0;

  return {
    byMode, GVDV, DTLH, CKTM_LINE: CKTM_BUY, CKTM_CLIENT: CKTM_SELL, CKTM_total,
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

// ── Suggested tariff (internal data) helpers ────────────────────────────────
export { TARIFF_SUGGEST, suggestedFor };

/**
 * Compares an entered selling price against the suggested tariff for that mode/key.
 * Returns null if there's nothing to compare (no suggestion, or price matches),
 * otherwise { diff, direction: 'higher'|'lower', suggestedPrice, unit }.
 */
export function priceSuggestionNote(mode, key, enteredPrice, enteredUnit) {
  const sug = suggestedFor(mode, key);
  if (!sug || sug.price === null || sug.price === undefined) return null;
  const price = Number(enteredPrice) || 0;
  if (!price) return null;
  const diff = Number((price - sug.price).toFixed(4));
  if (Math.abs(diff) < 0.005) return null;
  return {
    diff: Math.abs(diff),
    direction: diff > 0 ? 'higher' : 'lower',
    suggestedPrice: sug.price,
    unit: sug.unit,
    unitMismatch: enteredUnit && sug.unit && enteredUnit !== sug.unit,
  };
}
