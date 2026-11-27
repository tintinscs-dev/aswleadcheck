// Calculation engine for the ASW Sales Shipment Proposal app.
// Item price model: every charge line is { price, unit, tax, currency }.
// `unit` decides the multiplier: "per-quantity" units (Container / W/M / C.W / G.W)
// multiply the price by the shipment quantity for that mode; "flat" units
// (Bill of Lading / Shipment) charge the price once regardless of quantity.
import { TARIFF_SUGGEST, suggestedFor } from './tariffData';

// 'fcl' = one matrix for the whole container mix (20GP + 40HC + 40RF ... in one lô).
// 'fcl20' / 'fcl40' are LEGACY keys — old quotes are converted into 'fcl' on load
// by migrateQuote() (totals preserved exactly), they're kept here only for labels.
export const MODES = ['fcl', 'lcl', 'air'];
export const MODE_LABELS = { fcl: 'FCL', fcl20: "FCL 20'", fcl40: "FCL 40'", lcl: 'LCL', air: 'AIR', lclair: 'LCL / AIR' };
export const MODE_UNIT = { fcl: '/Cont', fcl20: "/20'", fcl40: "/40'", lcl: '/CBM', air: '/C.W' };

// ── FCL equipment (container mix) ───────────────────────────────────────────
export const EQUIPMENT_TYPES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR', 'ISO Tank'];
/** 'DRY' | 'RF' | 'OT' | 'FR' | 'TANK' */
export function equipmentGroup(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('RF')) return 'RF';
  if (t.includes('OT')) return 'OT';
  if (t.includes('FR')) return 'FR';
  if (t.includes('TANK')) return 'TANK';
  return 'DRY';
}
/** '20' | '40' | '45' — ISO Tank counts as a 20'. */
export function equipmentSize(type) {
  const m = String(type || '').match(/^(20|40|45)/);
  return m ? m[1] : '20';
}
/** Legacy tariff mode used for the suggested-price lookup of one container type (dry boxes only). */
export function tariffModeForType(type) {
  if (equipmentGroup(type) !== 'DRY') return null;
  return equipmentSize(type) === '20' ? 'fcl20' : 'fcl40';
}
export function normalizeEquipment(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(e => {
    if (!e || !e.type) return;
    const qty = Number(e.qty) || 0;
    const existing = out.find(x => x.type === e.type);
    if (existing) existing.qty += qty; else out.push({ type: e.type, qty });
  });
  return out;
}
export function equipmentTotal(list) {
  return normalizeEquipment(list).reduce((a, e) => a + (Number(e.qty) || 0), 0);
}
/** "2 x 20GP + 3 x 40HC" */
export function equipmentLabel(list) {
  return normalizeEquipment(list).filter(e => e.qty > 0).map(e => `${e.qty} x ${e.type}`).join(' + ');
}
export function equipmentGroupsPresent(list) {
  return new Set(normalizeEquipment(list).filter(e => e.qty > 0).map(e => equipmentGroup(e.type)));
}
/**
 * Parses free text like "2x20GP + 3x40HC + 1x40RF", "1X40'HQ", "2 x 20DC", "1 x ISO tank"
 * into an equipment list. Returns [] when nothing recognisable is found.
 */
export function parseEquipmentText(text) {
  const s = String(text || '').toUpperCase().replace(/[’']/g, '');
  const out = [];
  const add = (type, qty) => { const e = out.find(x => x.type === type); if (e) e.qty += qty; else out.push({ type, qty }); };
  const tankRe = /(\d+)\s*[X×*]\s*(?:ISO\s*)?(?:TANK|TK|ISO)\b/g;
  let m;
  while ((m = tankRe.exec(s))) add('ISO Tank', Number(m[1]) || 0);
  const re = /(\d+)\s*[X×*]\s*(20|40|45)\s*(GP|DC|DV|ST|SD|HC|HQ|RF|RH|RQ|HR|OT|FR|FL|PF)?/g;
  while ((m = re.exec(s))) {
    const qty = Number(m[1]) || 0, size = m[2], kind = m[3] || 'GP';
    let suffix = 'GP';
    if (['HC', 'HQ'].includes(kind)) suffix = 'HC';
    else if (['RF', 'RH', 'RQ', 'HR'].includes(kind)) suffix = 'RF';
    else if (kind === 'OT') suffix = 'OT';
    else if (['FR', 'FL', 'PF'].includes(kind)) suffix = 'FR';
    let type = `${size}${suffix}`;
    if (size === '45') type = '45HC';
    if (type === '20HC') type = '20GP';
    if (!EQUIPMENT_TYPES.includes(type)) type = size === '20' ? '20GP' : '40GP';
    add(type, qty);
  }
  return out.filter(e => e.qty > 0).sort((a, b) => EQUIPMENT_TYPES.indexOf(a.type) - EQUIPMENT_TYPES.indexOf(b.type));
}

// ── Unit types ──────────────────────────────────────────────────────────────
// Units that multiply the price by the mode's quantity (containers / CBM / weight).
export const PER_QTY_UNITS = ['Container', 'W/M', 'C.W', 'G.W'];
// Units charged once per shipment, regardless of quantity.
export const FLAT_UNITS = ['Bill of Lading', 'Shipment'];
export const UNIT_OPTIONS = [...PER_QTY_UNITS, ...FLAT_UNITS];
export const UNIT_OPTIONS_BY_MODE = {
  fcl: ['Container', 'Bill of Lading', 'Shipment'],
  fcl20: ['Container', 'Bill of Lading', 'Shipment'],
  fcl40: ['Container', 'Bill of Lading', 'Shipment'],
  lcl: ['W/M', 'Bill of Lading', 'Shipment'],
  air: ['C.W', 'G.W', 'Bill of Lading', 'Shipment'],
};
export function isFlatUnit(unit) { return !PER_QTY_UNITS.includes(unit); }

// ── Item definitions per mode ──────────────────────────────────────────────────
// FCL 20' / FCL 40' — identical charge list; suggested prices differ by container size (see tariffData.js).
export const FCL_ITEM_DEFS = [
  { key: 'ofreight', label: 'OF (Ocean Freight)', unit: 'Container' },
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
  { key: 'af', label: 'AF (Air Freight)', unit: 'C.W' },
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

// Extra FCL lines that only make sense for special equipment. They appear in the
// matrix only when the container mix has a matching type (or already hold money),
// and only the matching columns are editable.
export const FCL_SPECIAL_ITEM_DEFS = [
  { key: 'rfPlugin', label: 'Reefer Plug-in / Monitoring', unit: 'Container', groups: ['RF'] },
  { key: 'rfPti', label: 'PTI (Pre-Trip Inspection)', unit: 'Container', groups: ['RF'] },
  { key: 'rfGenset', label: 'Genset (if any)', unit: 'Container', groups: ['RF'] },
  { key: 'oogSurcharge', label: 'OOG Surcharge (Out of Gauge)', unit: 'Container', groups: ['OT', 'FR'] },
  { key: 'oogLashing', label: 'Lashing / Securing / Survey (OOG)', unit: 'Container', groups: ['OT', 'FR'] },
];
// Full FCL list: standard lines, then the special-equipment lines, CKTM always last.
export const FCL_ALL_ITEM_DEFS = [
  ...FCL_ITEM_DEFS.filter(d => d.key !== 'cktm'),
  ...FCL_SPECIAL_ITEM_DEFS,
  ...FCL_ITEM_DEFS.filter(d => d.key === 'cktm'),
];
/** True when a special FCL line applies to this container type (always true for standard lines). */
export function fclDefAppliesToType(def, type) {
  if (!def || !def.groups) return true;
  return def.groups.includes(equipmentGroup(type));
}

/** Returns the item defs for a given transport mode. */
export function itemDefsForMode(mode) {
  if (mode === 'lcl' || mode === 'lclair') return LCL_ITEM_DEFS;
  if (mode === 'air') return AIR_ITEM_DEFS;
  if (mode === 'fcl') return FCL_ALL_ITEM_DEFS;
  return FCL_ITEM_DEFS; // legacy fcl20, fcl40
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

/** Converts an amount already denominated in `currency` into USD (inverse of fromUsd). */
export function toUsd(amount, currency, fxRates) {
  return (Number(amount) || 0) * fxRateFor(currency, fxRates);
}

/** Rounds up to the nearest 5 — used for currency-converted display amounts,
 *  so a quy-đổi (converted) number never shows an awkward fraction. */
export function roundUp5(n) {
  const v = Number(n) || 0;
  return Math.ceil(v / 5) * 5;
}

/**
 * Converts a USD amount into `currency`, for display only (e.g. the "quy đổi
 * tất cả về 1 loại tiền tệ" toggle on the quote view page, or the "xuất báo
 * giá theo tiền tệ" export). Internal accounting — GVDV/DTLH/KQKD/... inside
 * calcQuote — always stays in USD and unrounded; this never feeds back into
 * that calculation. Result is rounded up to the nearest 5.
 */
export function fromUsd(amountUsd, currency, fxRates) {
  if (!currency || currency === DEFAULT_CURRENCY) return roundUp5(amountUsd);
  const rate = fxRateFor(currency, fxRates);
  const converted = rate > 0 ? (Number(amountUsd) || 0) / rate : (Number(amountUsd) || 0);
  return roundUp5(converted);
}

export function blankItem(unit) { return { price: 0, unit: unit || 'Shipment', tax: 0, currency: DEFAULT_CURRENCY, note: '' }; }

/** FCL matrix line: `byType` holds per-container prices (Container unit); `price` is the
 *  one-off price used when the unit is flat (Bill of Lading / Shipment = "theo lô"). */
export function blankFclItem(unit) { return { byType: {}, price: 0, unit: unit || 'Container', tax: 0, currency: DEFAULT_CURRENCY, note: '' }; }
export function blankFclCustomItem() { return { label: '', byType: {}, price: 0, unit: 'Container', tax: 0, currency: DEFAULT_CURRENCY, note: '' }; }

/** Creates a blank mode object (buying or selling — same shape now that COM/CKTM is unified). */
export function blankMode(mode) {
  const m = {};
  if (mode === 'fcl') {
    FCL_ALL_ITEM_DEFS.forEach(d => (m[d.key] = blankFclItem(d.unit)));
  } else {
    itemDefsForMode(mode).forEach(d => (m[d.key] = blankItem(d.unit)));
  }
  m.customItems = [];
  m.overseasItems = [];
  return m;
}
// Kept for backward-compat call sites.
export function blankModeBuying(mode) { return blankMode(mode); }
export function blankModeSelling(mode) { return blankMode(mode); }

export function blankCustomItem() { return { label: '', price: 0, unit: 'Shipment', tax: 0, currency: DEFAULT_CURRENCY, note: '' }; }

export function blankFclSpecs() {
  return { reefer: { temp: '', vent: '', humidity: '' }, oog: { dims: '', weight: '', note: '' } };
}

export function newQuoteData() {
  return {
    no: '', dep: 'FES', keys: '', shpr: '', cnee: '', agent: '',
    pol: '', pod: '', pickup: '', delivery: '', term: '',
    etd: '', eta: '', lineCoLoader: '', validDays: 30,
    pieces: 0, notes: '', extraTerms: [],
    qty20: 0, qty40: 0, lcl: 0, weight: 0, cw: 0, sales: '',
    equipment: [], fclSpecs: blankFclSpecs(),
    exchangeRate: DEFAULT_SETTINGS.exchangeRate,
    interestRatePct: DEFAULT_SETTINGS.interestRatePct,
    creditDays0: 0, creditDaysLCC: 0, creditDaysCusTruck: 0,
    cuocCont: 0, creditDaysCuocCont: 0,
    chiHoKhac: 0, creditDaysChiHoKhac: 0, cpKhac: 0,
    buying: {
      fcl: blankMode('fcl'),
      lcl: blankMode('lcl'),
      air: blankMode('air'),
    },
    selling: {
      fcl: blankMode('fcl'),
      lcl: blankMode('lcl'),
      air: blankMode('air'),
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
  const out = {
    customItems: Array.isArray(data.customItems) ? data.customItems.slice() : [],
    overseasItems: Array.isArray(data.overseasItems) ? data.overseasItems.slice() : [],
  };
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

const LEGACY_MODES = ['fcl20', 'fcl40', 'lcl', 'air'];

// Step 1 (older history): lclair → lcl, {flat, perUnit} → {price, unit}, COM → CKTM.
function migrateLegacyShapes(q) {
  let buying = q.buying || {};
  let selling = q.selling || {};
  if (buying.lclair && !buying.lcl) {
    buying = { ...buying, lcl: buying.lclair };
    selling = { ...selling, lcl: selling.lclair || {} };
  }

  const needsMigration = LEGACY_MODES.some(mode => {
    const b = buying[mode], s = selling[mode];
    return (b && (isOldShape(b.overseas) || isOldShape(b.ofreight) || isOldShape(b.thc) || b.comline)) ||
           (s && (isOldShape(s.overseas) || isOldShape(s.ofreight) || isOldShape(s.thc) || s.com || s.com10));
  });
  if (!needsMigration) return (buying !== (q.buying || {}) || selling !== (q.selling || {})) ? { ...q, buying, selling } : q;

  const newBuying = { ...buying }, newSelling = { ...selling };
  LEGACY_MODES.forEach(mode => {
    const qty = qtyForMode(mode, q);
    const migratedBuying = migrateModeData(mode, buying[mode], qty);
    const migratedSelling = migrateModeData(mode, selling[mode], qty);
    const { buyCktm, sellCktm } = migrateComToCktm(buying[mode], selling[mode], qty);
    if (buyCktm && !(Number(migratedBuying.cktm?.price) || 0)) migratedBuying.cktm = buyCktm;
    if (sellCktm && !(Number(migratedSelling.cktm?.price) || 0)) migratedSelling.cktm = sellCktm;
    newBuying[mode] = migratedBuying;
    newSelling[mode] = migratedSelling;
  });
  delete newBuying.lclair; delete newSelling.lclair;

  return { ...q, buying: newBuying, selling: newSelling };
}

// Step 2: separate FCL 20' / FCL 40' tabs → one 'fcl' matrix.
// Totals are preserved exactly:
//  - per-container lines keep their price under byType['20GP'] / byType['40GP'];
//  - flat (B/L / Shipment) lines entered in BOTH old tabs were counted twice by the old
//    calc, so their prices are summed into one "theo lô" price (same money, now visible);
//  - if the 20' and 40' versions of a line can't share one row (different unit kind,
//    VAT% or currency), the 40' version becomes a custom row tagged with `legacyKey`, so
//    CPCN base / CKTM / print section still treat it exactly like the original line.
function legacyToFclItem(item, type) {
  const it = item || {};
  const out = { byType: {}, price: 0, unit: it.unit || 'Container', tax: Number(it.tax || 0), currency: it.currency || DEFAULT_CURRENCY, note: it.note || '' };
  if (isFlatUnit(out.unit)) out.price = Number(it.price || 0);
  else out.byType[type] = Number(it.price || 0);
  return out;
}
function legacyItemsCompatible(a, b) {
  return isFlatUnit(a.unit) === isFlatUnit(b.unit)
    && Number(a.tax || 0) === Number(b.tax || 0)
    && (a.currency || DEFAULT_CURRENCY) === (b.currency || DEFAULT_CURRENCY);
}
function mergeLegacyFclSide(d20, d40) {
  const a = d20 || {}, b = d40 || {};
  const out = blankMode('fcl');
  FCL_ITEM_DEFS.forEach(def => {
    const i20 = a[def.key], i40 = b[def.key];
    const has20 = !!Number(i20?.price || 0), has40 = !!Number(i40?.price || 0);
    if (!has20 && !has40) {
      const unit = i20?.unit || i40?.unit || def.unit;
      out[def.key] = { ...blankFclItem(unit), tax: Number(i20?.tax || 0), currency: i20?.currency || DEFAULT_CURRENCY, note: i20?.note || i40?.note || '' };
      return;
    }
    if (has20 && !has40) { out[def.key] = legacyToFclItem(i20, '20GP'); return; }
    if (!has20 && has40) { out[def.key] = legacyToFclItem(i40, '40GP'); return; }
    if (legacyItemsCompatible(i20, i40)) {
      const merged = legacyToFclItem(i20, '20GP');
      if (isFlatUnit(merged.unit)) merged.price = Number(i20.price || 0) + Number(i40.price || 0);
      else merged.byType['40GP'] = Number(i40.price || 0);
      const notes = [i20.note, i40.note].filter(Boolean);
      merged.note = [...new Set(notes)].join(' / ');
      out[def.key] = merged;
    } else {
      out[def.key] = legacyToFclItem(i20, '20GP');
      out.customItems.push({ ...legacyToFclItem(i40, '40GP'), label: `${def.label} (40')`, legacyKey: def.key });
    }
  });
  [['customItems', a, '20GP'], ['customItems', b, '40GP'], ['overseasItems', a, '20GP'], ['overseasItems', b, '40GP']].forEach(([list, src, type]) => {
    (src[list] || []).forEach(ci => {
      out[list].push({ ...legacyToFclItem(ci, type), label: ci.label || '', ...(ci.legacyKey ? { legacyKey: ci.legacyKey } : {}) });
    });
  });
  return out;
}
function migrateLegacyFcl(q) {
  const buying = q.buying || {}, selling = q.selling || {};
  if (buying.fcl && selling.fcl) return q;
  const hasLegacy = buying.fcl20 || buying.fcl40 || selling.fcl20 || selling.fcl40;
  const nb = { ...buying }, ns = { ...selling };
  if (hasLegacy) {
    nb.fcl = buying.fcl || mergeLegacyFclSide(buying.fcl20, buying.fcl40);
    ns.fcl = selling.fcl || mergeLegacyFclSide(selling.fcl20, selling.fcl40);
  } else {
    nb.fcl = buying.fcl || blankMode('fcl');
    ns.fcl = selling.fcl || blankMode('fcl');
  }
  delete nb.fcl20; delete nb.fcl40; delete ns.fcl20; delete ns.fcl40;
  let equipment = q.equipment;
  if (!Array.isArray(equipment) || !equipment.length) {
    equipment = [];
    if (Number(q.qty20) > 0) equipment.push({ type: '20GP', qty: Number(q.qty20) });
    if (Number(q.qty40) > 0) equipment.push({ type: '40GP', qty: Number(q.qty40) });
  }
  return { ...q, buying: nb, selling: ns, equipment };
}

/** qty20 / qty40 DB columns are kept in sync with the mix (dashboard, legacy Excel, search). */
export function syncLegacyQty(q) {
  const eq = normalizeEquipment(q.equipment);
  const qty20 = eq.filter(e => equipmentSize(e.type) === '20').reduce((a, e) => a + e.qty, 0);
  const qty40 = eq.filter(e => equipmentSize(e.type) !== '20').reduce((a, e) => a + e.qty, 0);
  return (q.qty20 === qty20 && q.qty40 === qty40) ? q : { ...q, qty20, qty40 };
}

/**
 * Migrate old quotes to the current shape:
 *  - `buying.lclair` / `selling.lclair` → `lcl` (pre-existing LCL/AIR split migration)
 *  - old {flat, perUnit} items → {price, unit}
 *  - old COM-line / COM / COM10 → a single CKTM line per side
 *  - separate FCL 20' / 40' tabs → one FCL matrix + container mix (`equipment`)
 *  - unpacks `buying.__fclMeta` (how equipment/fclSpecs are stored in the DB, see toDbQuoteData)
 * Safe to call multiple times (idempotent) — already-migrated quotes pass through untouched.
 */
export function migrateQuote(q) {
  if (!q) return q;
  if (q.__fclReady && q.buying?.fcl && q.selling?.fcl && !q.buying.__fclMeta) return q;
  let out = q;
  const meta = out.buying?.__fclMeta;
  if (meta) {
    const buying = { ...out.buying };
    delete buying.__fclMeta;
    out = {
      ...out, buying,
      equipment: Array.isArray(out.equipment) && out.equipment.length ? out.equipment : (meta.equipment || []),
      fclSpecs: out.fclSpecs || meta.fclSpecs,
    };
  }
  out = migrateLegacyShapes(out);
  out = migrateLegacyFcl(out);
  const specs = out.fclSpecs || {};
  out = {
    ...out,
    equipment: normalizeEquipment(out.equipment),
    fclSpecs: { reefer: { ...blankFclSpecs().reefer, ...(specs.reefer || {}) }, oog: { ...blankFclSpecs().oog, ...(specs.oog || {}) } },
  };
  out = syncLegacyQty(out);
  Object.defineProperty(out, '__fclReady', { value: true, enumerable: false, configurable: true, writable: true });
  return out;
}

/**
 * Shape a quote payload for prisma.quote.create/update. There are no DB columns for
 * the container mix / RF-OOG specs, so they ride inside the `buying` JSON column
 * (no schema migration needed) and are unpacked again by migrateQuote().
 */
export function toDbQuoteData(data) {
  if (!data) return data;
  const out = { ...data };
  const hasFcl = 'equipment' in out || 'fclSpecs' in out;
  if (hasFcl && out.buying) {
    const eq = normalizeEquipment(out.equipment);
    out.buying = { ...out.buying, __fclMeta: { equipment: eq, fclSpecs: out.fclSpecs || blankFclSpecs() } };
    Object.assign(out, syncLegacyQty({ qty20: out.qty20, qty40: out.qty40, equipment: eq }));
    delete out.equipment;
  }
  delete out.equipment;
  delete out.fclSpecs;
  return out;
}


export function qtyForMode(mode, q) {
  if (mode === 'fcl') return equipmentTotal(q.equipment);
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

/**
 * Expands one FCL matrix row into priced lines: one line per container type in the mix
 * (Container unit), or a single "theo lô" line (Bill of Lading / Shipment unit).
 * Zero-priced cells are skipped. Each line: { item: {price, unit, tax, currency, note}, qty, type }.
 */
export function fclItemLines(item, equipment, def) {
  if (!item) return [];
  const base = { unit: item.unit || 'Container', tax: Number(item.tax || 0), currency: itemCurrency(item), note: item.note || '' };
  if (isFlatUnit(base.unit)) {
    const price = Number(item.price || 0);
    return price ? [{ item: { ...base, price }, qty: 1, type: null }] : [];
  }
  return normalizeEquipment(equipment)
    .filter(e => e.qty > 0 && fclDefAppliesToType(def, e.type))
    .map(e => ({ item: { ...base, price: Number(item.byType?.[e.type] || 0) }, qty: e.qty, type: e.type }))
    .filter(l => l.item.price);
}

/** Sum of every line of one FCL matrix row (in the row's own currency, VAT included). */
export function fclRowTotal(item, equipment, def) {
  return fclItemLines(item, equipment, def).reduce((a, l) => a + lineTotal(l.item, l.qty, +1), 0);
}

function modeData(q, side, mode) {
  return (q[side] && (q[side][mode] || (mode === 'lcl' ? q[side].lclair : null))) || {};
}

/**
 * Every priced line of one side/mode, flattened — the single source used by calcQuote,
 * the view page and every export. kind: 'charges' (standard + custom rows) or 'overseas'.
 * Line: { key, label, item, qty, type, src: 'def'|'custom'|'overseas', legacyKey, row }
 *  - key: item key for standard rows (or the custom row's legacyKey), null otherwise
 *  - type: container type for FCL per-container lines, null otherwise
 *  - row: the stored row object (FCL: the matrix row, others: same as item)
 */
export function modeLines(q, side, mode, kind = 'charges') {
  const data = modeData(q, side, mode);
  const out = [];
  if (mode === 'fcl') {
    const eq = q.equipment;
    if (kind === 'charges') {
      FCL_ALL_ITEM_DEFS.forEach(d => {
        fclItemLines(data[d.key], eq, d).forEach(l => out.push({ ...l, key: d.key, label: d.label, src: 'def', row: data[d.key] }));
      });
      (data.customItems || []).forEach((ci, idx) => {
        fclItemLines(ci, eq).forEach(l => out.push({ ...l, key: ci.legacyKey || null, label: ci.label || '(Hạng mục tự thêm)', src: 'custom', idx, row: ci }));
      });
    } else {
      (data.overseasItems || []).forEach((oi, idx) => {
        fclItemLines(oi, eq).forEach(l => out.push({ ...l, key: null, label: oi.label || '(Chưa đặt tên)', src: 'overseas', idx, row: oi }));
      });
    }
    return out;
  }
  const qty = qtyForMode(mode, q);
  const push = (key, label, item, src, idx) => {
    if (!item || !Number(item.price ?? item.perUnit ?? item.flat ?? 0)) return;
    out.push({ key, label, item, qty, type: null, src, idx, row: item });
  };
  if (kind === 'charges') {
    itemDefsForMode(mode).forEach(d => push(d.key, d.label, data[d.key], 'def'));
    (data.customItems || []).forEach((ci, idx) => push(ci.legacyKey || null, ci.label || '(Hạng mục tự thêm)', ci, 'custom', idx));
  } else {
    (data.overseasItems || []).forEach((oi, idx) => push(null, oi.label || '(Chưa đặt tên)', oi, 'overseas', idx));
  }
  return out;
}

/**
 * FCL rows with money on them, for read-only displays and exports.
 * kind: 'charges' | 'overseas'. Row: { key, label, def, row, total, lines, src }
 * (total = row currency, VAT included; lines = fclItemLines output).
 */
export function fclDisplayRows(quote, side, kind = 'charges') {
  const q = migrateQuote(quote);
  const data = q[side]?.fcl || {};
  const eq = q.equipment;
  const out = [];
  const push = (key, label, def, row, src) => {
    const lines = fclItemLines(row, eq, def);
    if (!lines.length) return;
    out.push({ key, label, def, row, lines, src, total: lines.reduce((a, l) => a + lineTotal(l.item, l.qty, +1), 0) });
  };
  if (kind === 'charges') {
    FCL_ALL_ITEM_DEFS.forEach(d => push(d.key, d.label, d, data[d.key], 'def'));
    (data.customItems || []).forEach(ci => push(ci.legacyKey || null, ci.label || '(Hạng mục tự thêm)', null, ci, 'custom'));
  } else {
    (data.overseasItems || []).forEach(oi => push(null, oi.label || '(Chưa đặt tên)', null, oi, 'overseas'));
  }
  return out;
}

/** Container types in the mix with qty > 0 (column order for displays/exports). */
export function activeEquipment(quote) {
  return normalizeEquipment(migrateQuote(quote).equipment).filter(e => e.qty > 0);
}

/** One-line RF / OOG spec summary (empty string when not applicable). */
export function fclSpecsLines(quote) {
  const q = migrateQuote(quote);
  const groups = equipmentGroupsPresent(q.equipment);
  const s = q.fclSpecs || {};
  const lines = [];
  if (groups.has('RF')) {
    const parts = [s.reefer?.temp && `Temp ${s.reefer.temp}°C`, s.reefer?.vent && `Vent ${s.reefer.vent}`, s.reefer?.humidity && `Humidity ${s.reefer.humidity}`].filter(Boolean);
    if (parts.length) lines.push(`Reefer: ${parts.join(', ')}`);
  }
  if (groups.has('OT') || groups.has('FR')) {
    const parts = [s.oog?.dims && `Dims ${s.oog.dims} cm`, s.oog?.weight && `${s.oog.weight} kg/pkg`, s.oog?.note].filter(Boolean);
    if (parts.length) lines.push(`OOG: ${parts.join(', ')}`);
  }
  return lines;
}

/** Returns true if a mode's buying or selling data has at least one non-zero charge. */
function modeHasData(q, mode) {
  return ['buying', 'selling'].some(side => modeLines(q, side, mode, 'charges').length || modeLines(q, side, mode, 'overseas').length
    || (mode === 'fcl' && fclHasAnyPrice(modeData(q, side, mode))));
}
// FCL rows can hold prices for container types not (or no longer) in the mix.
function fclHasAnyPrice(data) {
  const rowHas = r => r && (Number(r.price || 0) || Object.values(r.byType || {}).some(v => Number(v)));
  return Object.entries(data || {}).some(([k, v]) => {
    if (k === 'customItems' || k === 'overseasItems') return Array.isArray(v) && v.some(rowHas);
    return typeof v === 'object' && rowHas(v);
  });
}

// Loại dịch vụ (DEP.) → whether the shipment is by Sea or Air. This is the source of
// truth for which mode tabs are valid, so PDF/Excel exports never mix up the mode.
function transportFromDep(dep) {
  if (dep === 'FEA' || dep === 'FIA') return 'air';
  if (dep === 'FES' || dep === 'FIS') return 'sea';
  return null; // OTHER / empty → fall back to auto-detection
}

export function quoteModes(quote) {
  const q = migrateQuote(quote);
  const transport = transportFromDep(q.dep);
  if (transport === 'air') return ['air'];

  const modes = [];
  if (equipmentTotal(q.equipment) > 0 || modeHasData(q, 'fcl')) modes.push('fcl');
  // LCL: has CBM data OR charges were entered in lcl tab
  if (Number(q.lcl) > 0 || modeHasData(q, 'lcl')) modes.push('lcl');
  if (transport === 'sea') return modes.length ? modes : ['lcl'];

  // AIR: chargeable-weight shipment OR charges were entered in air tab (even alongside LCL)
  if (((Number(q.cw) > 0 || Number(q.weight) > 0) && !equipmentTotal(q.equipment) && !Number(q.lcl)) || modeHasData(q, 'air')) modes.push('air');
  return modes.length ? modes : ['lcl'];
}

// Which CPCN (credit-cost) bucket a selling line feeds:
//   'freight' → CPCN 0% base (ocean / air freight), 'cus' → CUS+TRUCKING base (×1.1),
//   'lcc' → local charges base (×1.08), null → not a base (CKTM).
const AIR_LOCAL_KEYS = new Set(['hawb', 'ams', 'airthc', 'xray', 'dofee', 'hdlcharge', 'docamend']);
function cpcnBucket(mode, line) {
  const key = line.key;
  if (key === 'cktm') return null;
  if (mode === 'air') {
    if (line.src === 'overseas' || line.src === 'custom' && !key) return 'lcc';
    if (key === 'overseas' || key === 'af') return 'freight';
    if (key === 'truck' || key === 'cus') return 'cus';
    if (AIR_LOCAL_KEYS.has(key)) return 'lcc';
    return 'lcc';
  }
  if (mode === 'fcl' && key === 'ofreight') return 'freight';
  return 'lcc';
}

export function calcQuote(quote) {
  const q = migrateQuote(quote);
  const fxRates = q.fxRates || {};
  const rateOf = (item) => fxRateFor(itemCurrency(item), fxRates);
  let GVDV = 0, DTLH = 0, CKTM_BUY = 0, CKTM_SELL = 0;
  let baseCPCN0 = 0, baseLCC = 0, baseCusTruck = 0;
  const byMode = {};

  MODES.forEach(mode => {
    const qty = qtyForMode(mode, q);
    const usd = l => lineTotal(l.item, l.qty, +1) * rateOf(l.item);
    const bLines = [...modeLines(q, 'buying', mode, 'charges'), ...modeLines(q, 'buying', mode, 'overseas')];
    const sLines = [...modeLines(q, 'selling', mode, 'charges'), ...modeLines(q, 'selling', mode, 'overseas')];
    let costSub = 0, revSub = 0;
    bLines.forEach(l => { const v = usd(l); costSub += v; if (l.key === 'cktm') CKTM_BUY += v; });
    sLines.forEach(l => {
      const v = usd(l);
      revSub += v;
      if (l.key === 'cktm') CKTM_SELL += v;
      // Overseas charges are billed to the customer alongside local charges, so they share
      // the same credit-cost bucket/assumption (baseLCC) rather than needing their own field.
      const bucket = l.src === 'overseas' ? 'lcc' : cpcnBucket(mode, l);
      if (bucket === 'freight') baseCPCN0 += v;
      else if (bucket === 'lcc') baseLCC += v * 1.08;
      else if (bucket === 'cus') baseCusTruck += v * 1.1;
    });
    GVDV += costSub; DTLH += revSub;
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
  return {
    draft:          'Nháp',
    pricing_review: 'Chờ Pricing',
    pending:        'Chờ Manager duyệt',
    approved:       'Đã duyệt',
    rejected:       'Từ chối',
  }[s] || s;
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
