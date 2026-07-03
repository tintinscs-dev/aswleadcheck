// Export the "Quote theo mẫu" template to a PDF that mirrors ASW's "Shipping Quote
// Checking" layout, and a best-effort text parser to import data back from a PDF.
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { TEMPLATE_SECTIONS, blankTemplate, blankChargeRow, TERMS_GENERAL, TERMS_ADDITIONAL_COSTS, formatRateDisplay, rowAmount } from './templateQuote';
import { COMPANY, LOGO_PATH } from './company';
import { tLang } from './i18n';

const PAGE_MARGIN = 36;
const FONT_DIR = path.join(process.cwd(), 'data', 'fonts');

// pdfkit's built-in `ellipsis: true` is unreliable with `lineBreak: false` on long
// strings (can silently wrap and overlap the row below) — truncate manually instead.
function truncateToWidth(doc, text, maxWidth) {
  text = String(text ?? '');
  if (!text) return '';
  if (doc.widthOfString(text) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && doc.widthOfString(result + '…') > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + '…';
}

function row(doc, x, y, cols, opts = {}) {
  const { bold = false, fill = null, fontSize = 8.5, color = '#1c2733' } = opts;
  doc.font(bold ? 'RobotoBold' : 'Roboto').fontSize(fontSize);
  if (fill) {
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    doc.save().rect(x, y - 2, totalW, 15).fill(fill).restore();
  }
  let cx = x;
  cols.forEach(c => {
    const txt = truncateToWidth(doc, c.text, c.width - 6);
    doc.fillColor(color).text(txt, cx + 3, y, { width: c.width - 6, align: c.align || 'left', lineBreak: false });
    cx += c.width;
  });
  return y + 15;
}

function numFrom(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Read width/height straight from the PNG IHDR chunk so we can scale the
// logo to a target height and know its *actual* rendered width — avoids the
// company name being drawn at a hardcoded x-offset that may overlap a wide logo.
function pngSize(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch (e) {
    return null;
  }
}

export async function buildTemplatePdf(template, opts = {}) {
  const { formal = false, salesName = '', lang = 'vi' } = opts;
  const T = (key) => tLang(lang, key);
  const t = { ...blankTemplate(), ...template };
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont('Roboto', path.join(FONT_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('RobotoBold', path.join(FONT_DIR, 'Roboto-Bold.ttf'));

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', resolve));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  let logoH = 0;
  let textX = 0;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      logoH = 30;
      const dims = pngSize(LOGO_PATH);
      const logoW = dims ? (dims.width / dims.height) * logoH : 120;
      doc.image(LOGO_PATH, PAGE_MARGIN, y, { height: logoH });
      textX = logoW + 12; // small gap after the logo so text never overlaps it
    }
  } catch (e) { /* logo optional */ }
  doc.font('RobotoBold').fontSize(12).fillColor('#0b2545').text(COMPANY.name, PAGE_MARGIN + textX, y + 2, { width: pageWidth - textX });
  doc.font('Roboto').fontSize(7.5).fillColor('#5a6675').text(COMPANY.address, PAGE_MARGIN + textX, doc.y + 1, { width: pageWidth - textX });
  y = Math.max(doc.y, y + logoH) + 6;
  doc.font('RobotoBold').fontSize(13).fillColor('#3a5a8a').text(formal ? T('pdf.title') : T('pdf.titleShort'), PAGE_MARGIN, y, { width: pageWidth, align: 'center' });
  y = doc.y + 8;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).strokeColor('#e1e6ee').stroke();
  y += 10;

  if (formal) {
    doc.font('Roboto').fontSize(9.5).fillColor('#1c2733')
      .text(`${T('pdf.greeting')}${t.customer || (lang === 'en' ? 'Valued Customer' : 'Quý khách hàng')}`, PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 3;
    doc.text(T('pdf.intro'), PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 10;
  }

  doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(T('pdf.shipInfo'), PAGE_MARGIN, y);
  y = doc.y + 6;
  const pairs = [
    ['Customer:', t.customer, 'Date:', t.date],
    ['Tax Code:', t.taxCode, 'Valid:', t.valid],
    ['Commodity:', t.commodity, 'POL:', t.pol],
    ['Term:', t.term, 'POD:', t.pod],
    ['Pick-up Add:', t.pickup, 'Volume:', t.volume],
    ['Delivery Add:', t.dropoff, 'Mode:', t.mode],
  ];
  const halfW = pageWidth / 2;
  pairs.forEach(([l1, v1, l2, v2]) => {
    y = row(doc, PAGE_MARGIN, y, [
      { text: l1, width: halfW * 0.32 }, { text: v1 || '', width: halfW * 0.68 },
      { text: l2, width: halfW * 0.32 }, { text: v2 || '', width: halfW * 0.68 },
    ]);
  });
  // Notes/Consignee can be long (commodity details, dimensions, weight...) — render
  // with full text wrapping (no truncation) and reserve the real rendered height,
  // instead of the fixed 15px single-line row used above, so it never overlaps the
  // "FREIGHT & CHARGES" section that follows.
  {
    const notesLabelW = halfW * 0.32;
    const notesW = pageWidth - notesLabelW;
    const notesText = t.notes || '-';
    const notesH = doc.font('Roboto').fontSize(8.5).heightOfString(notesText, { width: notesW });
    if (y + Math.max(notesH, 14) > doc.page.height - PAGE_MARGIN - 20) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font('RobotoBold').fontSize(8.5).fillColor('#1c2733').text('Notes / Consignee:', PAGE_MARGIN, y, { width: notesLabelW });
    doc.font('Roboto').fontSize(8.5).fillColor('#1c2733').text(notesText, PAGE_MARGIN + notesLabelW, y, { width: notesW });
    y += Math.max(notesH, 14) + 4;
  }
  y += 8;

  // Charge Description gets the most room (full item names shouldn't truncate);
  // Notes stays compact since it's usually short (VAT% / a short custom remark).
  const colWidths = [pageWidth * 0.04, pageWidth * 0.35, pageWidth * 0.09, pageWidth * 0.07, pageWidth * 0.09, pageWidth * 0.12, pageWidth * 0.24];
  const headers = ['No.', 'Charge Description', 'Unit Rate', 'Currency', 'Unit', 'Amount', 'Notes'];

  const grandTotals = {}; // currency -> sum across every section, for the overall total below
  TEMPLATE_SECTIONS.forEach(sec => {
    if (y > doc.page.height - PAGE_MARGIN - 80) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(sec.title, PAGE_MARGIN, y);
    y = doc.y + 5;
    y = row(doc, PAGE_MARGIN, y, headers.map((h, i) => ({ text: h, width: colWidths[i] })), { bold: true, fill: '#1b3a63', color: '#ffffff' });
    const items = (t[sec.key] && t[sec.key].length) ? t[sec.key] : [blankChargeRow()];
    let zebra = false;
    const totals = {}; // currency -> sum
    items.forEach((r, i) => {
      if (y > doc.page.height - PAGE_MARGIN - 20) { doc.addPage(); y = PAGE_MARGIN; }
      y = row(doc, PAGE_MARGIN, y, [
        { text: i + 1, width: colWidths[0] }, { text: r.desc || '', width: colWidths[1] },
        { text: formatRateDisplay(r.rate), width: colWidths[2], align: 'right' }, { text: r.currency || '', width: colWidths[3] },
        { text: r.unit || '', width: colWidths[4] }, { text: formatRateDisplay(rowAmount(r)), width: colWidths[5], align: 'right' },
        { text: r.notes || '', width: colWidths[6] },
      ], { fill: zebra ? '#f7faff' : null });
      zebra = !zebra;
      // Sum the line's real total (rate × quantity for per-container/CBM/CW rows),
      // not the raw unit rate — otherwise e.g. "OF x 8 containers" only counted once.
      const n = numFrom(rowAmount(r));
      if (n !== null && r.desc) {
        const cur = (r.currency || 'USD').toUpperCase();
        totals[cur] = (totals[cur] || 0) + n;
        grandTotals[cur] = (grandTotals[cur] || 0) + n;
      }
    });
    if (formal) {
      const totalText = Object.entries(totals).filter(([, v]) => v).map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`).join('  +  ');
      if (totalText) {
        if (y > doc.page.height - PAGE_MARGIN - 20) { doc.addPage(); y = PAGE_MARGIN; }
        y = row(doc, PAGE_MARGIN, y, [
          { text: '', width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] },
          { text: 'ESTIMATED TOTAL', width: colWidths[5], align: 'right' },
          { text: totalText, width: colWidths[6], align: 'right' },
        ], { bold: true, fill: '#eef2f8' });
      }
    }
    y += 14;
  });

  // Grand total across every section — the app previously showed only per-section
  // subtotals, so the printed quote never auto-summed to a single bottom-line figure.
  if (formal) {
    const grandText = Object.entries(grandTotals).filter(([, v]) => v)
      .map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`).join('  +  ');
    if (grandText) {
      if (y > doc.page.height - PAGE_MARGIN - 40) { doc.addPage(); y = PAGE_MARGIN; }
      doc.save().rect(PAGE_MARGIN, y - 3, pageWidth, 22).fill('#0b2545').restore();
      doc.font('RobotoBold').fontSize(10).fillColor('#ffffff').text('TỔNG CỘNG BÁO GIÁ (ước tính) / GRAND TOTAL', PAGE_MARGIN + 8, y + 3, { width: pageWidth * 0.6 });
      doc.font('RobotoBold').fontSize(10).fillColor('#ffffff').text(grandText, PAGE_MARGIN, y + 3, { width: pageWidth - 8, align: 'right' });
      y += 26;
    }
  }

  if (formal) {
    if (y > doc.page.height - PAGE_MARGIN - 140) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(T('pdf.terms'), PAGE_MARGIN, y);
    y = doc.y + 3;
    doc.font('Roboto').fontSize(7.5).fillColor('#6b7787')
      .text(`${T('pdf.term2valid')} ${t.valid || (lang === 'en' ? '30 days from issue date' : '30 ngày kể từ ngày phát hành')}.`, PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 6;

    // Two columns: general terms of service (left) / costs that may apply on top (right).
    const colGap = 16;
    const colW = (pageWidth - colGap) / 2;
    const col2X = PAGE_MARGIN + colW + colGap;
    doc.font('RobotoBold').fontSize(8.5).fillColor('#0b2545').text('Terms of service', PAGE_MARGIN, y, { width: colW });
    doc.font('RobotoBold').fontSize(8.5).fillColor('#0b2545').text('Costs that may apply', col2X, y, { width: colW });
    let y1 = doc.y + 4, y2 = doc.y + 4;
    doc.font('Roboto').fontSize(7.8).fillColor('#1c2733');
    TERMS_GENERAL.forEach(line => {
      doc.text(`•  ${line}`, PAGE_MARGIN, y1, { width: colW });
      y1 = doc.y + 3;
    });
    TERMS_ADDITIONAL_COSTS.forEach(line => {
      doc.text(`•  ${line}`, col2X, y2, { width: colW });
      y2 = doc.y + 3;
    });
    y = Math.max(y1, y2) + 4;

    // Extra, per-shipment notes entered on this quote (if any) — appended below the
    // fixed terms so sales can call out shipment-specific conditions.
    if (Array.isArray(t.extraTerms) && t.extraTerms.length) {
      if (y > doc.page.height - PAGE_MARGIN - 40) { doc.addPage(); y = PAGE_MARGIN; }
      doc.font('RobotoBold').fontSize(8.5).fillColor('#0b2545').text('Lưu ý riêng cho lô hàng này / Shipment-specific notes', PAGE_MARGIN, y, { width: pageWidth });
      y = doc.y + 3;
      doc.font('Roboto').fontSize(7.8).fillColor('#1c2733');
      t.extraTerms.forEach(line => {
        if (!line) return;
        if (y > doc.page.height - PAGE_MARGIN - 20) { doc.addPage(); y = PAGE_MARGIN; }
        doc.text(`•  ${line}`, PAGE_MARGIN, y, { width: pageWidth });
        y = doc.y + 3;
      });
    }
    y += 10;

    if (y > doc.page.height - PAGE_MARGIN - 60) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font('Roboto').fontSize(9.5).fillColor('#1c2733').text(T('pdf.closing'), PAGE_MARGIN, y);
    y = doc.y + 14;
    doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(COMPANY.name, PAGE_MARGIN, y);
    y = doc.y + 2;
    doc.font('Roboto').fontSize(8).fillColor('#5a6675').text(COMPANY.address, PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 2;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - PAGE_MARGIN - 12;
    doc.font('Roboto').fontSize(8).fillColor('#8a8f98')
      .text(`${T('pdf.page')} ${i + 1} ${T('pdf.of')} ${range.count}`, PAGE_MARGIN, footerY, { width: pageWidth, align: 'right', lineBreak: false });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

// --- best-effort PDF -> template parsing ----------------------------------

const LABELS = [
  ['customer', /customer\s*:/i], ['taxCode', /(tax code|mst)\s*:/i], ['commodity', /commodity\s*:/i],
  ['term', /term\s*:/i], ['pickup', /pick[\s-]?up add\s*:/i], ['dropoff', /(dro?ff?[\s-]?off add|delivery add)\s*:/i],
  ['date', /date\s*:/i], ['valid', /valid\s*:/i], ['pol', /pol\s*:/i], ['pod', /pod\s*:/i],
  ['volume', /(volume|vol)\s*:/i], ['mode', /mode\s*:/i],
];

function extractField(text, regex) {
  const m = text.match(new RegExp(regex.source + '\\s*([^\\n]*?)(?=\\s{2,}\\S+\\s*:|$)', regex.flags));
  return m ? m[1].trim() : '';
}

function parseChargeLines(block) {
  const rows = [];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/estimated total/i.test(line)) continue;
    const m = line.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const rest = m[2];
    const curMatch = rest.match(/\b(USD|VND|EUR)\b/i);
    if (!curMatch) { rows.push({ desc: rest.trim(), rate: '', currency: '', unit: '', notes: '' }); continue; }
    const currency = curMatch[1].toUpperCase();
    const before = rest.slice(0, curMatch.index).trim();
    const after = rest.slice(curMatch.index + curMatch[0].length).trim();
    const rateMatch = before.match(/([\d,]+(?:\.\d+)?(?:\/[\d,]+(?:\.\d+)?)*)\s*$/);
    const rate = rateMatch ? rateMatch[1] : '';
    const desc = rateMatch ? before.slice(0, rateMatch.index).trim() : before;
    const unitMatch = after.match(/^([^\s]+(?:\s*\/\s*[^\s]+)?)/);
    const unit = unitMatch ? unitMatch[1] : '';
    const notes = unitMatch ? after.slice(unitMatch[0].length).trim() : after;
    rows.push({ desc, rate, currency, unit, notes });
  }
  return rows.length ? rows : [blankChargeRow()];
}

export async function parseTemplatePdf(buffer) {
  const { text } = await pdfParse(buffer);
  const t = blankTemplate();

  LABELS.forEach(([key, regex]) => { t[key] = extractField(text, regex); });

  const sectionAnchors = TEMPLATE_SECTIONS.map(sec => {
    const re = new RegExp(sec.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const m = text.match(re);
    return { key: sec.key, index: m ? m.index + m[0].length : -1 };
  }).filter(a => a.index >= 0).sort((a, b) => a.index - b.index);

  sectionAnchors.forEach((a, i) => {
    const end = i + 1 < sectionAnchors.length ? sectionAnchors[i + 1].index : text.length;
    t[a.key] = parseChargeLines(text.slice(a.index, end));
  });
  TEMPLATE_SECTIONS.forEach(sec => { if (!t[sec.key] || !t[sec.key].length) t[sec.key] = [blankChargeRow()]; });

  return t;
}
