// Read/write the "Quote theo mẫu" template as a simple, fixed-layout .xlsx file
// (mirrors the CUSTOMER & SHIPMENT INFORMATION + FREIGHT&CHARGES / LOCAL CHARGES /
// Customs and Trucking Vietnam side layout used in ASW's "Shipping Quote Checking" sheet).
import * as XLSX from 'xlsx';
import fs from 'fs';
import { TEMPLATE_SECTIONS, blankTemplate, blankChargeRow, TERMS_GENERAL, TERMS_ADDITIONAL_COSTS, formatRateDisplay, rowAmount } from './templateQuote';
import { COMPANY, LOGO_PATH } from './company';
import { embedLogoInXlsx } from './xlsxImage';
import { tLang } from './i18n';

const INFO_FIELDS = [
  ['customer', 'Customer', 'date', 'Date'],
  ['taxCode', 'Tax Code', 'valid', 'Valid'],
  ['commodity', 'Commodity', 'pol', 'POL'],
  ['term', 'Term', 'pod', 'POD'],
  ['pickup', 'Pick-up Add', 'volume', 'Volume'],
  ['dropoff', 'Delivery Add', 'mode', 'Mode'],
];

const CHARGE_HEADER = ['No.', 'Charge Description', 'Unit Rate', 'Currency', 'Unit', 'Amount', 'Notes'];

function numFrom(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export async function buildTemplateWorkbook(template, opts = {}) {
  const { formal = false, salesName = '', lang = 'vi' } = opts;
  const T = (key) => tLang(lang, key);
  const t = { ...blankTemplate(), ...template };
  const aoa = [];
  aoa.push([COMPANY.name]);
  aoa.push([COMPANY.address]);
  aoa.push([]);
  aoa.push([formal ? T('pdf.title') : T('pdf.titleShort')]);
  aoa.push([]);
  if (formal) {
    aoa.push([`${T('pdf.greeting')}${t.customer || (lang === 'en' ? 'Valued Customer' : 'Quý khách hàng')}`]);
    aoa.push([T('pdf.intro')]);
    aoa.push([]);
  }
  aoa.push([T('pdf.shipInfo')]);
  INFO_FIELDS.forEach(([k1, l1, k2, l2]) => {
    aoa.push([`${l1}:`, t[k1] || '', `${l2}:`, t[k2] || '']);
  });
  aoa.push(['Notes / Consignee:', t.notes || '']);
  aoa.push([]);

  const grandTotals = {}; // currency -> sum across every section
  TEMPLATE_SECTIONS.forEach(sec => {
    aoa.push([sec.title]);
    aoa.push(CHARGE_HEADER);
    const rows = t[sec.key] && t[sec.key].length ? t[sec.key] : [blankChargeRow()];
    const totals = {};
    rows.forEach((row, i) => {
      aoa.push([i + 1, row.desc || '', formatRateDisplay(row.rate), row.currency || '', row.unit || '', formatRateDisplay(rowAmount(row)), row.notes || '']);
      // Sum the line's real total (rate × quantity), not the raw unit rate — otherwise
      // e.g. "OF x 8 containers" only counted the per-container rate once.
      const n = numFrom(rowAmount(row));
      if (n !== null && row.desc) {
        const cur = (row.currency || 'USD').toUpperCase();
        totals[cur] = (totals[cur] || 0) + n;
        grandTotals[cur] = (grandTotals[cur] || 0) + n;
      }
    });
    if (formal) {
      const totalText = Object.entries(totals).filter(([, v]) => v).map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`).join(' + ');
      if (totalText) aoa.push(['', '', '', '', '', 'ESTIMATED TOTAL', totalText]);
    }
    aoa.push([]);
  });

  // Grand total across every section — sums Freight + Local Charges into one bottom-line figure.
  if (formal) {
    const grandText = Object.entries(grandTotals).filter(([, v]) => v)
      .map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`).join(' + ');
    if (grandText) {
      aoa.push(['', '', '', '', '', 'TỔNG CỘNG BÁO GIÁ / GRAND TOTAL', grandText]);
      aoa.push([]);
    }
  }

  if (formal) {
    aoa.push([T('pdf.terms')]);
    aoa.push([`${T('pdf.term2valid')} ${t.valid || (lang === 'en' ? '30 days from issue date' : '30 ngày kể từ ngày phát hành')}.`]);
    aoa.push([]);
    aoa.push(['Terms of service', '', '', 'Costs that may apply']);
    const maxRows = Math.max(TERMS_GENERAL.length, TERMS_ADDITIONAL_COSTS.length);
    for (let i = 0; i < maxRows; i++) {
      aoa.push([TERMS_GENERAL[i] ? `• ${TERMS_GENERAL[i]}` : '', '', '', TERMS_ADDITIONAL_COSTS[i] ? `• ${TERMS_ADDITIONAL_COSTS[i]}` : '']);
    }
    if (Array.isArray(t.extraTerms) && t.extraTerms.filter(Boolean).length) {
      aoa.push([]);
      aoa.push(['Lưu ý riêng cho lô hàng này / Shipment-specific notes']);
      t.extraTerms.filter(Boolean).forEach(line => aoa.push([`• ${line}`]));
    }
    aoa.push([]);
    aoa.push([T('pdf.closing')]);
    aoa.push([COMPANY.name]);
    aoa.push([COMPANY.address]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
  ws['!rows'] = [{ hpt: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
  let buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      buffer = await embedLogoInXlsx(buffer, logoBuffer);
    }
  } catch (e) { /* logo embedding is best-effort; never break the export */ }
  return buffer;
}

function norm(s) { return String(s ?? '').trim().toLowerCase().replace(/:$/, ''); }

export function parseTemplateWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

  const t = blankTemplate();
  TEMPLATE_SECTIONS.forEach(sec => (t[sec.key] = []));

  const infoLabelMap = {};
  INFO_FIELDS.forEach(([k1, l1, k2, l2]) => { infoLabelMap[norm(l1)] = k1; infoLabelMap[norm(l2)] = k2; });

  let i = 0;
  let currentSection = null;
  let inHeaderRow = false;
  while (i < rows.length) {
    const row = rows[i] || [];
    const c0 = norm(row[0]);

    const sectionMatch = TEMPLATE_SECTIONS.find(sec => norm(sec.title) === c0 || c0.includes(norm(sec.title)));
    if (sectionMatch) {
      currentSection = sectionMatch.key;
      inHeaderRow = true;
      i++;
      continue;
    }
    if (inHeaderRow) { inHeaderRow = false; i++; continue; } // skip the column-header row itself

    if (c0 === norm('Notes / Consignee')) {
      t.notes = String(row[1] ?? '');
      i++;
      continue;
    }

    // Info pair row: "Label:" value "Label2:" value2
    if (infoLabelMap[c0] && !currentSection) {
      t[infoLabelMap[c0]] = String(row[1] ?? '');
      const c2 = norm(row[2]);
      if (c2 && infoLabelMap[c2]) t[infoLabelMap[c2]] = String(row[3] ?? '');
      i++;
      continue;
    }

    if (currentSection) {
      const isBlank = row.every(c => String(c ?? '').trim() === '');
      const isTotal = c0.includes('estimated total');
      if (isBlank || isTotal) {
        if (isBlank) currentSection = null;
        i++;
        continue;
      }
      t[currentSection].push({
        desc: String(row[1] ?? ''), rate: String(row[2] ?? ''),
        currency: String(row[3] ?? ''), unit: String(row[4] ?? ''),
        amount: String(row[5] ?? ''), notes: String(row[6] ?? ''),
      });
    }
    i++;
  }

  TEMPLATE_SECTIONS.forEach(sec => { if (!t[sec.key].length) t[sec.key] = [blankChargeRow()]; });
  return t;
}
