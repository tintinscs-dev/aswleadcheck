// Build a clean, printable PDF of the costing (buying) and selling breakdown for one quote.
// Intended for the Docs team to compare line-by-line against what's entered in the system.
import PDFDocument from 'pdfkit';
import path from 'path';
import {
  ITEM_DEFS, COMLINE_DEF, SELL_COM_DEFS, MODE_LABELS, MODE_UNIT,
  qtyForMode, lineTotal, quoteModes, calcQuote, fmt, statusLabel,
} from './calc';

const PAGE_MARGIN = 36;
const FONT_DIR = path.join(process.cwd(), 'data', 'fonts');

function money(n) {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// pdfkit's built-in `ellipsis: true` option is unreliable when combined with
// `lineBreak: false` on very long strings (it can silently wrap instead of
// truncating, which overlaps the row below). Truncate manually instead.
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

function drawTableRow(doc, x, y, cols, opts = {}) {
  const { bold = false, fill = null, fontSize = 8.5, color = '#1c2733' } = opts;
  doc.font(bold ? 'RobotoBold' : 'Roboto').fontSize(fontSize);
  if (fill) {
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    doc.save().rect(x, y - 2, totalW, 15).fill(fill).restore();
  }
  let cx = x;
  cols.forEach(c => {
    const txt = truncateToWidth(doc, c.text, c.width - 6);
    doc.fillColor(color).text(txt, cx + 3, y, {
      width: c.width - 6, align: c.align || 'left', lineBreak: false,
    });
    cx += c.width;
  });
  return y + 15;
}

function drawCostTable(doc, x, y, title, side, mode, q, maxWidth) {
  const colWidths = [maxWidth * 0.32, maxWidth * 0.17, maxWidth * 0.2, maxWidth * 0.13, maxWidth * 0.18];
  const headers = ['Hạng mục', 'Flat', `Đơn giá ${MODE_UNIT[mode]}`, 'VAT/CK%', 'Thành tiền'];

  doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text(title, x, y);
  y += 16;

  y = drawTableRow(doc, x, y, headers.map((h, i) => ({ text: h, width: colWidths[i], align: i >= 3 ? 'right' : 'left' })), { bold: true, fill: '#eef2f8' });

  const qty = qtyForMode(mode, { qty20: q.qty20, qty40: q.qty40, lcl: q.lcl, weight: q.weight });
  const data = q[side][mode];
  const rows = [];
  ITEM_DEFS.forEach(d => rows.push([d.label, data[d.key], +1]));
  if (side === 'buying') {
    rows.push([COMLINE_DEF.label, { flat: 0, perUnit: data.comline.perUnit, tax: data.comline.tax }, -1]);
  } else {
    SELL_COM_DEFS.forEach(d => rows.push([d.label, data[d.key], -1]));
  }
  (data.customItems || []).forEach(ci => rows.push([ci.label || '(Hạng mục tự thêm)', ci, +1]));

  let zebra = false;
  rows.forEach(([label, item, sign]) => {
    const total = lineTotal(item, qty, sign);
    y = drawTableRow(doc, x, y, [
      { text: label, width: colWidths[0] },
      { text: money(item.flat || 0), width: colWidths[1], align: 'right' },
      { text: money(item.perUnit || 0), width: colWidths[2], align: 'right' },
      { text: `${money(item.tax || 0)}%`, width: colWidths[3], align: 'right' },
      { text: money(total), width: colWidths[4], align: 'right' },
    ], { fill: zebra ? '#f7faff' : null, fontSize: 8 });
    zebra = !zebra;
  });
  return y + 6;
}

function ensureSpace(doc, y, needed, marginBottom) {
  if (y + needed > doc.page.height - marginBottom) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

export async function buildQuotePdf(quote, exportedByName) {
  const q = JSON.parse(JSON.stringify(quote));
  const r = calcQuote(q);
  const modes = quoteModes(q);

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont('Roboto', path.join(FONT_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('RobotoBold', path.join(FONT_DIR, 'Roboto-Bold.ttf'));

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', resolve));

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  // Header
  doc.font('RobotoBold').fontSize(16).fillColor('#0b2545').text('ASW — BẢNG CHI TIẾT GIÁ MUA / GIÁ BÁN (COSTING & SELLING)', PAGE_MARGIN, y, { width: pageWidth });
  y = doc.y + 4;
  doc.font('Roboto').fontSize(9).fillColor('#6b7787')
    .text(`Báo giá: ${q.no || q.id}   ·   Trạng thái: ${statusLabel(q.status)}   ·   Xuất bởi: ${exportedByName || ''}   ·   Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, PAGE_MARGIN, y, { width: pageWidth });
  y = doc.y + 10;

  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).strokeColor('#e1e6ee').stroke();
  y += 12;

  // Info block
  const infoLines = [
    [`Shipper: ${q.shpr || '-'}`, `Consignee: ${q.cnee || '-'}`, `Agent: ${q.agent || '-'}`],
    [`POL: ${q.pol || '-'}`, `POD: ${q.pod || '-'}`, `Term: ${q.term || '-'}`],
    [`ETD: ${q.etd || '-'}`, `ETA: ${q.eta || '-'}`, `Sales: ${q.sales || '-'}`],
    [`20': ${q.qty20 || 0}`, `40': ${q.qty40 || 0}`, `LCL/CBM: ${q.lcl || 0}`, `Weight(kg): ${q.weight || 0}`],
  ];
  doc.font('Roboto').fontSize(9).fillColor('#1c2733');
  infoLines.forEach(line => {
    doc.text(line.join('     '), PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 2;
  });
  y += 8;

  // Per-mode costing/selling tables
  for (const mode of modes) {
    y = ensureSpace(doc, y, 40, PAGE_MARGIN);
    doc.font('RobotoBold').fontSize(12).fillColor('#0b2545').text(MODE_LABELS[mode], PAGE_MARGIN, y);
    y = doc.y + 6;

    y = ensureSpace(doc, y, 200, PAGE_MARGIN);
    y = drawCostTable(doc, PAGE_MARGIN, y, 'Giá mua (Cost / Buying)', 'buying', mode, q, pageWidth);
    y = ensureSpace(doc, y, 200, PAGE_MARGIN);
    y = drawCostTable(doc, PAGE_MARGIN, y, 'Giá bán (Sell / Selling)', 'selling', mode, q, pageWidth);
    y += 6;
  }

  // Công nợ / chi phí khác
  y = ensureSpace(doc, y, 110, PAGE_MARGIN);
  doc.font('RobotoBold').fontSize(11).fillColor('#0b2545').text('Công nợ / Chi phí khác', PAGE_MARGIN, y);
  y = doc.y + 6;
  const debtPairs = [
    ['Tỷ giá (VND/USD)', q.exchangeRate], ['Lãi suất NH (%/năm)', q.interestRatePct],
    ['Số ngày nợ CPCN 0%', q.creditDays0], ['Số ngày nợ CPCN LCC 8%', q.creditDaysLCC],
    ['Số ngày nợ CPCN CUS+TRUCKING', q.creditDaysCusTruck], ['Cược container (USD)', q.cuocCont],
    ['Số ngày nợ cược cont', q.creditDaysCuocCont], ['Chi hộ khác (USD)', q.chiHoKhac],
    ['Số ngày nợ chi hộ khác', q.creditDaysChiHoKhac], ['CP Khác (USD)', q.cpKhac],
  ];
  doc.font('Roboto').fontSize(8.5).fillColor('#1c2733');
  for (let i = 0; i < debtPairs.length; i += 2) {
    const a = debtPairs[i], b = debtPairs[i + 1];
    const line = `${a[0]}: ${money(a[1])}` + (b ? `      ${b[0]}: ${money(b[1])}` : '');
    doc.text(line, PAGE_MARGIN, y, { width: pageWidth });
    y = doc.y + 2;
  }
  y += 10;

  // Summary
  y = ensureSpace(doc, y, 170, PAGE_MARGIN);
  doc.font('RobotoBold').fontSize(11).fillColor('#0b2545').text('Kết quả tính toán', PAGE_MARGIN, y);
  y = doc.y + 6;
  const summaryRows = [
    ['GVDV (Giá vốn dịch vụ)', r.GVDV], ['DTLH (Doanh thu lô hàng)', r.DTLH],
    ['CKTM - LINE', r.CKTM_LINE], ['CKTM - CLIENT (COM+COM10%)', r.CKTM_CLIENT], ['Tổng CKTM', r.CKTM_total],
    ['CPCN 0% (OVS/O&F)', r.CPCN0], ['CPCN LCC 8%', r.CPCNLCC], ['CPCN CUS+TRUCKING', r.CPCNCusTruck], ['Tổng CPCN', r.CPCN_total],
    ['Lãi cược cont', r.interestCuocCont], ['Lãi chi hộ khác', r.interestChiHoKhac], ['CP Khác', r.CPKhac],
  ];
  const colW = pageWidth / 2 - 6;
  summaryRows.forEach(([label, val], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const xx = PAGE_MARGIN + col * (colW + 12);
    const yy = y + row * 14;
    doc.font('Roboto').fontSize(8.5).fillColor('#1c2733').text(label, xx, yy, { width: colW * 0.65, lineBreak: false });
    doc.text(money(val), xx + colW * 0.65, yy, { width: colW * 0.35, align: 'right', lineBreak: false });
  });
  y = y + Math.ceil(summaryRows.length / 2) * 14 + 12;

  y = ensureSpace(doc, y, 70, PAGE_MARGIN);
  doc.save().rect(PAGE_MARGIN, y - 4, pageWidth, 58).fill('#f4f6f9').restore();
  doc.font('RobotoBold').fontSize(10).fillColor('#0b2545').text('CPLH (Chi phí lô hàng)', PAGE_MARGIN + 8, y + 4);
  doc.text(money(r.CPLH), PAGE_MARGIN, y + 4, { width: pageWidth - 8, align: 'right' });
  const kqkdColor = r.KQKD >= 0 ? '#1d7a4f' : '#c0392b';
  doc.fontSize(12).fillColor(kqkdColor).text('KQKD', PAGE_MARGIN + 8, y + 22);
  doc.text(money(r.KQKD), PAGE_MARGIN, y + 22, { width: pageWidth - 8, align: 'right' });
  doc.fontSize(9).fillColor('#0b2545').text(`Tỷ suất lợi nhuận (TSLN): ${money(r.TSLN * 100)}% trên CPLH`, PAGE_MARGIN + 8, y + 40);

  // Footer page numbers (positioned well inside the bottom margin so it never triggers an extra page)
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
