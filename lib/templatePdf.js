// Export the "Quote theo mẫu" template to a PDF that mirrors ASW's "Shipping Quote
// Checking" layout, and a best-effort text parser to import data back from a PDF.
import PDFDocument from 'pdfkit';
import path from 'path';
import pdfParse from 'pdf-parse';
import { TEMPLATE_SECTIONS, blankTemplate, blankChargeRow } from './templateQuote';

const PAGE_MARGIN = 36;
const FONT_DIR = path.join(process.cwd(), 'data', 'fonts');

function row(doc, x, y, cols, opts = {}) {
  const { bold = false, fill = null, fontSize = 8.5, color = '#1c2733' } = opts;
  doc.font(bold ? 'RobotoBold' : 'Roboto').fontSize(fontSize);
  if (fill) {
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    doc.save().rect(x, y - 2, totalW, 15).fill(fill).restore();
  }
  let cx = x;
  cols.forEach(c => {
    doc.fillColor(color).text(String(c.text ?? ''), cx + 3, y, { width: c.width - 6, align: c.align || 'left', lineBreak: false, ellipsis: true });
    cx += c.width;
  });
  return y + 15;
}

export async function buildTemplatePdf(template) {
  const t = { ...blankTemplate(), ...template };
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont('Roboto', path.join(FONT_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('RobotoBold', path.join(FONT_DIR, 'Roboto-Bold.ttf'));

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', resolve));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  doc.font('RobotoBold').fontSize(16).fillColor('#0b2545').text('QUOTATION', PAGE_MARGIN, y, { width: pageWidth, align: 'center' });
  y = doc.y + 10;

  doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text('CUSTOMER & SHIPMENT INFORMATION', PAGE_MARGIN, y);
  y = doc.y + 6;
  const pairs = [
    ['Customer:', t.customer, 'Date:', t.date],
    ['Tax Code:', t.taxCode, 'Valid:', t.valid],
    ['Commodity:', t.commodity, 'POL:', t.pol],
    ['Term:', t.term, 'POD:', t.pod],
    ['Pick-up Add:', t.pickup, 'Volume:', t.volume],
    ['Drop-off Add:', t.dropoff, 'Mode:', t.mode],
  ];
  const halfW = pageWidth / 2;
  pairs.forEach(([l1, v1, l2, v2]) => {
    y = row(doc, PAGE_MARGIN, y, [
      { text: l1, width: halfW * 0.32 }, { text: v1 || '', width: halfW * 0.68 },
      { text: l2, width: halfW * 0.32 }, { text: v2 || '', width: halfW * 0.68 },
    ]);
  });
  y = row(doc, PAGE_MARGIN, y, [{ text: 'Notes / Consignee:', width: halfW * 0.32 }, { text: t.notes || '', width: pageWidth - halfW * 0.32 }]);
  y += 10;

  const colWidths = [pageWidth * 0.06, pageWidth * 0.30, pageWidth * 0.13, pageWidth * 0.1, pageWidth * 0.16, pageWidth * 0.25];
  const headers = ['No.', 'Charge Description', 'Unit Rate', 'Currency', 'Unit', 'Notes'];

  TEMPLATE_SECTIONS.forEach(sec => {
    if (y > doc.page.height - PAGE_MARGIN - 80) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(sec.title, PAGE_MARGIN, y);
    y = doc.y + 5;
    y = row(doc, PAGE_MARGIN, y, headers.map((h, i) => ({ text: h, width: colWidths[i] })), { bold: true, fill: '#1b3a63', color: '#ffffff' });
    const items = (t[sec.key] && t[sec.key].length) ? t[sec.key] : [blankChargeRow()];
    let zebra = false;
    items.forEach((r, i) => {
      if (y > doc.page.height - PAGE_MARGIN - 20) { doc.addPage(); y = PAGE_MARGIN; }
      y = row(doc, PAGE_MARGIN, y, [
        { text: i + 1, width: colWidths[0] }, { text: r.desc || '', width: colWidths[1] },
        { text: r.rate ?? '', width: colWidths[2], align: 'right' }, { text: r.currency || '', width: colWidths[3] },
        { text: r.unit || '', width: colWidths[4] }, { text: r.notes || '', width: colWidths[5] },
      ], { fill: zebra ? '#f7faff' : null });
      zebra = !zebra;
    });
    y += 14;
  });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - PAGE_MARGIN - 12;
    doc.font('Roboto').fontSize(8).fillColor('#8a8f98')
      .text(`Trang ${i + 1}/${range.count}`, PAGE_MARGIN, footerY, { width: pageWidth, align: 'right', lineBreak: false });
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

// --- best-effort PDF -> template parsing ----------------------------------

const LABELS = [
  ['customer', /customer\s*:/i], ['taxCode', /(tax code|mst)\s*:/i], ['commodity', /commodity\s*:/i],
  ['term', /term\s*:/i], ['pickup', /pick[\s-]?up add\s*:/i], ['dropoff', /dro?ff?[\s-]?off add\s*:/i],
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
