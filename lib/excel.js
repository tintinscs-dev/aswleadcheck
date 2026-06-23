// Server-side, byte-fidelity Excel export.
// Ported as-is from the original app's export logic: only input cells in the
// original "Data Input" sheet are touched; every formula cell and style is preserved.
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { MODES, qtyForMode, lineTotal, statusLabel } from './calc';

function customItemsAsOtherRate(items, qty) {
  if (!items || !items.length) return 0;
  const total = items.reduce((sum, ci) => sum + lineTotal(ci, qty, +1), 0);
  return total / (qty || 1);
}

function modeColsBuying(mode, q) {
  const m = q.buying[mode];
  const qty = qtyForMode(mode, { qty20: q.qty20, qty40: q.qty40, lcl: q.lcl, weight: q.weight });
  const otherVal = (m.other.perUnit || 0) + customItemsAsOtherRate(m.customItems, qty);
  return [m.overseas.flat || 0, m.overseas.perUnit || 0, m.ofreight.perUnit || 0, m.dobill.flat || 0, m.thc.perUnit || 0, m.cfs.perUnit || 0, m.cic.perUnit || 0, m.hdl.flat || 0, m.clean.perUnit || 0, otherVal, m.truck.perUnit || 0, m.cus.perUnit || 0, m.comline.perUnit || 0, m.comline.tax || 0];
}
function modeColsSelling(mode, q) {
  const m = q.selling[mode];
  const qty = qtyForMode(mode, { qty20: q.qty20, qty40: q.qty40, lcl: q.lcl, weight: q.weight });
  const otherVal = (m.other.perUnit || 0) + customItemsAsOtherRate(m.customItems, qty);
  return [m.overseas.flat || 0, m.overseas.perUnit || 0, m.ofreight.perUnit || 0, m.dobill.flat || 0, m.thc.perUnit || 0, m.cfs.perUnit || 0, m.cic.perUnit || 0, m.hdl.flat || 0, m.clean.perUnit || 0, otherVal, m.truck.perUnit || 0, m.cus.perUnit || 0, m.com.flat || 0, m.com.perUnit || 0, m.com.tax || 0, m.com10.flat || 0, m.com10.perUnit || 0, m.com10.tax || 0];
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

  let wbXml = await zip.file('xl/workbook.xml').async('string');
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
