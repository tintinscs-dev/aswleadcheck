// Server-side, byte-fidelity Excel export.
// Ported as-is from the original app's export logic: only input cells in the
// original "Data Input" sheet are touched; every formula cell and style is preserved.
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { MODES, qtyForMode, lineTotal, statusLabel, calcQuote, fmt, itemDefsForMode } from './calc';

// NOTE: this legacy byte-fidelity export writes into a fixed-layout binary
// template (data/template.xlsx) built around the OLD charge-item model
// (OVERSEAS/O-F/DOBILL/THC/CFS/CIC/HDL/CLEAN/OTHER/TRUCK/CUS/COMLINE/COM/COM10).
// The item list has since been redesigned (EX-/IM- charges, single CKTM line,
// price+unit model) and the template's own in-sheet formulas were not rebuilt
// to match — that would require rewriting the template's internal formulas,
// which is out of scope here. To keep this export from crashing and to keep
// its grand-total numbers meaningful, every current charge (minus the still-
// present 'ofreight' line and CKTM) is folded into the old "OTHER" per-unit
// slot as an equivalent rate (total ÷ qty), and CKTM is folded into the old
// COMLINE/COM slots. Per-item breakdown in this specific sheet is therefore
// approximate — use "In báo giá (Excel)" / "In báo giá (PDF)" for accurate,
// itemized output; those were rebuilt for the new item list.
function otherRateForMode(side, mode, q) {
  const m = q[side][mode];
  const qty = qtyForMode(mode, q);
  const defs = itemDefsForMode(mode);
  let total = 0;
  defs.forEach(d => { if (d.key !== 'ofreight' && d.key !== 'cktm') total += lineTotal(m[d.key] || {}, qty, +1); });
  (m.customItems || []).forEach(ci => { total += lineTotal(ci, qty, +1); });
  return total / (qty || 1);
}
function cktmOf(side, mode, q) {
  const m = q[side][mode];
  const qty = qtyForMode(mode, q);
  const item = m.cktm || {};
  const total = lineTotal(item, qty, +1);
  return { rate: total / (qty || 1), tax: item.tax || 0, flat: 0 };
}

function modeColsBuying(mode, q) {
  const m = q.buying[mode] || {};
  const of = m.ofreight || {};
  const cktm = cktmOf('buying', mode, q);
  const otherVal = otherRateForMode('buying', mode, q);
  return [0, 0, of.price || 0, 0, 0, 0, 0, 0, 0, otherVal, 0, 0, cktm.rate, cktm.tax];
}
function modeColsSelling(mode, q) {
  const m = q.selling[mode] || {};
  const of = m.ofreight || {};
  const cktm = cktmOf('selling', mode, q);
  const otherVal = otherRateForMode('selling', mode, q);
  return [0, 0, of.price || 0, 0, 0, 0, 0, 0, 0, otherVal, 0, 0, cktm.flat, cktm.rate, cktm.tax, 0, 0, 0];
}

const FORMULA_COL_LETTERS = new Set(['EB', 'EC', 'ED', 'EE', 'EG', 'EI', 'EK', 'EQ']);
const DATA_INPUT_MAX_COL = 149; // A..ES

function colNumToLetters(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function xmlEscape(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function buildCellXml(letters, rowNum, styleIdx, value) {
  const ref = letters + rowNum;
  const sAttr = styleIdx != null ? ` s="${styleIdx}"` : '';
  if (value === '' || value === null || value === undefined) return `<c r="${ref}"${sAttr}/>`;
  if (typeof value === 'number') return `<c r="${ref}"${sAttr}><v>${value}</v></c>`;
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function parseRowStyles(rowInner) {
  const styles = {};
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
  let m;
  while ((m = re.exec(rowInner))) {
    const sMatch = m[3].match(/\bs="(\d+)"/);
    styles[m[1]] = sMatch ? sMatch[1] : null;
  }
  return styles;
}

function patchDataInputXml(sheetXml, rowsData) {
  const rowRe = /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g;
  return sheetXml.replace(rowRe, (full, rowNumStr, rowAttrs, rowInner) => {
    const rowNum = Number(rowNumStr);
    const wanted = rowsData[rowNum];
    if (!wanted) return full;
    const styles = parseRowStyles(rowInner);
    const cellsOut = [];
    for (let c = 1; c <= DATA_INPUT_MAX_COL; c++) {
      const letters = colNumToLetters(c);
      if (FORMULA_COL_LETTERS.has(letters)) {
        const origMatch = rowInner.match(new RegExp(`<c r="${letters}${rowNum}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`));
        if (origMatch) cellsOut.push(origMatch[0]);
        continue;
      }
      const hasExisting = Object.prototype.hasOwnProperty.call(styles, letters);
      const val = Object.prototype.hasOwnProperty.call(wanted, letters) ? wanted[letters] : '';
      if (!hasExisting && (val === '' || val == null)) continue;
      cellsOut.push(buildCellXml(letters, rowNum, styles[letters], val));
    }
    return `<row r="${rowNum}"${rowAttrs}>${cellsOut.join('')}</row>`;
  });
}

function buildStatusSheetXml(aoa) {
  let rows = '';
  aoa.forEach((rowArr, i) => {
    const rowNum = i + 1;
    let cells = '';
    rowArr.forEach((val, ci) => {
      const letters = colNumToLetters(ci + 1);
      if (val === '' || val == null) cells += `<c r="${letters}${rowNum}"/>`;
      else if (typeof val === 'number') cells += `<c r="${letters}${rowNum}"><v>${val}</v></c>`;
      else cells += `<c r="${letters}${rowNum}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
    });
    rows += `<row r="${rowNum}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rows}</sheetData></worksheet>`;
}

// The original "Shipment Proposal" sheet only ever reads from 'Data Input'
// row 6 (every cell reference in it is hardcoded to row 6 in the source
// template), so it only ever renders the FIRST quote correctly. When the
// dashboard exports more than one quote, that sheet is misleading — it looks
// like a formula/format bug because rows 2+ never show up there even though
// they're present (and correct) in Data Input. For multi-quote exports we
// replace it with a clean, JS-computed summary table (built straight from the
// same calcQuote() used by the live dashboard/UI, so the numbers are
// guaranteed to match what the user already sees on screen).
function buildSummarySheetXml(quotes, settings) {
  const headers = ['No.', 'Khách hàng', 'Sales', 'POL', 'POD', 'Trạng thái', 'GVDV (USD)', 'DTLH (USD)', 'CPLH (USD)', 'KQKD (USD)', 'TSLN (%)'];
  const aoa = [headers];
  let totGVDV = 0, totDTLH = 0, totCPLH = 0, totKQKD = 0;
  quotes.forEach(q => {
    const r = calcQuote(q);
    totGVDV += r.GVDV; totDTLH += r.DTLH; totCPLH += r.CPLH; totKQKD += r.KQKD;
    aoa.push([
      q.no || '', q.shpr || q.cnee || '', q.sales || '', q.pol || '', q.pod || '',
      statusLabel(q.status), Number(r.GVDV.toFixed(2)), Number(r.DTLH.toFixed(2)),
      Number(r.CPLH.toFixed(2)), Number(r.KQKD.toFixed(2)), Number((r.TSLN * 100).toFixed(2)),
    ]);
  });
  aoa.push(['', '', '', '', '', 'TỔNG', Number(totGVDV.toFixed(2)), Number(totDTLH.toFixed(2)), Number(totCPLH.toFixed(2)), Number(totKQKD.toFixed(2)), '']);
  return buildStatusSheetXml(aoa);
}

function buildQuoteRowMap(q, settings) {
  const m = {};
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'];
  const generalVals = [q.no, q.dep, q.keys, q.shpr, q.cnee, q.agent, q.pol, q.pod, q.pickup, q.delivery, q.qty20 || 0, q.qty40 || 0, q.lcl || 0, q.weight || 0, q.sales, q.attn, q.executor, q.lineCoLoader, q.line, '', q.etd, q.eta, '', '', '', q.term, q.vv];
  cols.forEach((letters, idx) => { m[letters] = generalVals[idx]; });

  let colNum = 28; // AB
  const ratesFlat = [];
  MODES.forEach(mode => { modeColsBuying(mode, q).forEach(v => ratesFlat.push(v)); });
  MODES.forEach(mode => { modeColsSelling(mode, q).forEach(v => ratesFlat.push(v)); });
  ratesFlat.forEach(v => { m[colNumToLetters(colNum)] = v; colNum++; });
  colNum += 8;

  colNum += 4;
  m[colNumToLetters(colNum)] = q.creditDays0 || 0; colNum += 2;
  m[colNumToLetters(colNum)] = q.creditDaysLCC || 0; colNum += 2;
  m[colNumToLetters(colNum)] = q.creditDaysCusTruck || 0; colNum += 2;
  m[colNumToLetters(colNum++)] = q.cpKhac || 0;
  m[colNumToLetters(colNum++)] = q.cuocCont || 0;
  m[colNumToLetters(colNum++)] = q.creditDaysCuocCont || 0;
  m[colNumToLetters(colNum++)] = q.chiHoKhac || 0;
  m[colNumToLetters(colNum++)] = q.creditDaysChiHoKhac || 0;
  colNum++;
  m[colNumToLetters(colNum++)] = q.exchangeRate || settings.exchangeRate || 0;
  m[colNumToLetters(colNum++)] = q.interestRatePct || settings.interestRatePct || 0;
  return m;
}

export async function buildExportWorkbook(quotes, settings, exportedByName) {
  const templatePath = path.join(process.cwd(), 'data', 'template.xlsx');
  const templateBuf = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuf);

  let sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const rowsData = {};
  quotes.forEach((q, idx) => { rowsData[6 + idx] = buildQuoteRowMap(q, settings); });
  rowsData[1] = Object.assign(rowsData[1] || {}, { D: settings.exchangeRate, F: settings.interestRatePct, H: settings.cpqlPct });
  sheetXml = patchDataInputXml(sheetXml, rowsData);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  // "Shipment Proposal" (sheet2) only renders Data Input row 6, so it only
  // ever shows the first quote. With >1 quote, swap it for a clean summary
  // table instead of leaving a sheet that silently ignores rows 2+.
  if (quotes.length > 1) {
    zip.file('xl/worksheets/sheet2.xml', buildSummarySheetXml(quotes, settings));
    zip.file('xl/worksheets/_rels/sheet2.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  }

  let wbXml = await zip.file('xl/workbook.xml').async('string');
  if (quotes.length > 1) {
    wbXml = wbXml.replace(/<sheet name="Shipment Proposal"([^/]*)\/>/, '<sheet name="Tong hop nhieu lo"$1/>');
  }
  wbXml = wbXml.replace(/<calcPr([^>]*)\/>/, (m, attrs) => {
    if (/fullCalcOnLoad/.test(attrs)) return `<calcPr${attrs.replace(/fullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"')}/>`;
    return `<calcPr${attrs} fullCalcOnLoad="1"/>`;
  });

  zip.file('xl/worksheets/sheet4.xml', buildStatusSheetXml([
    ['NO.', 'Trạng thái phê duyệt (app)', 'Người xuất', 'Ngày xuất'],
    ...quotes.map(q => [q.no, statusLabel(q.status), exportedByName || '', new Date().toLocaleString('vi-VN')]),
  ]));
  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!ct.includes('worksheets/sheet4.xml')) {
    ct = ct.replace('</Types>', '<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  }
  let rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const usedIds = [...rels.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]));
  const newRid = 'rId' + (Math.max(...usedIds, 0) + 1);
  if (!rels.includes('worksheets/sheet4.xml')) {
    rels = rels.replace('</Relationships>', `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/></Relationships>`);
  }
  if (!wbXml.includes('App Status')) {
    const usedSheetIds = [...wbXml.matchAll(/sheetId="(\d+)"/g)].map(m => Number(m[1]));
    const newSheetId = Math.max(...usedSheetIds, 0) + 1;
    wbXml = wbXml.replace('</sheets>', `<sheet name="App Status" sheetId="${newSheetId}" r:id="${newRid}"/></sheets>`);
  }
  zip.file('[Content_Types].xml', ct);
  zip.file('xl/_rels/workbook.xml.rels', rels);
  zip.file('xl/workbook.xml', wbXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
