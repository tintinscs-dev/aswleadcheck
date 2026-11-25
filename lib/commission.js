// Commission (CKTM) report helpers — shared by /reports/commission (page) and
// /api/reports/commission/export (Excel).
//
// Commission is NOT entered separately: Sales already enters it as the CKTM
// line (buying and/or selling side) inside each quote. This file just pulls
// those amounts out via calcQuote() (USD, using each quote's own fxRates
// snapshot) and groups them by month.
//
// Month = the quote's createdAt, read in Vietnam time (UTC+7) so the server
// (UTC on Vercel) and the browser always agree on which month a job falls in.
import { calcQuote, migrateQuote } from './calc';

const VN_OFFSET_MS = 7 * 3600 * 1000;

export function vnYearMonth(date) {
  const d = date ? new Date(date) : null;
  if (!d || isNaN(d)) return null;
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return { year: v.getUTCFullYear(), month: v.getUTCMonth() + 1, day: v.getUTCDate() };
}

export function monthKeyOf(date) {
  const ym = vnYearMonth(date);
  return ym ? `${ym.year}-${String(ym.month).padStart(2, '0')}` : null;
}

export function monthLabel(key) {
  if (!key) return '-';
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

export function dateLabel(date) {
  const ym = vnYearMonth(date);
  return ym ? `${String(ym.day).padStart(2, '0')}/${String(ym.month).padStart(2, '0')}/${ym.year}` : '-';
}

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// Ghi chú typed in the CKTM line's "Ghi chú" box (Sales writes the com recipient
// there). Collected per side across all modes, de-duplicated.
function cktmNotes(q, side) {
  const out = [];
  Object.values(q[side] || {}).forEach(m => {
    const n = (m && m.cktm && Number(m.cktm.price) && m.cktm.note || '').trim();
    if (n && !out.includes(n)) out.push(n);
  });
  return out.join(', ');
}

function combinedNote(buyNote, sellNote) {
  if (buyNote && sellNote) return buyNote === sellNote ? buyNote : `Mua: ${buyNote} · Bán: ${sellNote}`;
  return buyNote || sellNote || '';
}

/** One row per quote that has a non-zero CKTM (buy or sell side). */
export function commissionRows(quotes) {
  const rows = [];
  (quotes || []).forEach(raw => {
    const q = migrateQuote(JSON.parse(JSON.stringify(raw)));
    const r = calcQuote(q);
    const buy = round2(r.CKTM_LINE);
    const sell = round2(r.CKTM_CLIENT);
    if (!buy && !sell) return;
    const ym = vnYearMonth(q.createdAt);
    rows.push({
      id: q.id,
      no: q.no || '',
      createdAt: q.createdAt,
      year: ym?.year || null,
      month: ym?.month || null,
      monthKey: monthKeyOf(q.createdAt),
      shpr: q.shpr || '',
      cnee: q.cnee || '',
      pol: q.pol || '',
      pod: q.pod || '',
      sales: q.sales || '',
      status: q.status,
      buy,
      sell,
      total: round2(buy + sell),
      note: combinedNote(cktmNotes(q, 'buying'), cktmNotes(q, 'selling')),
    });
  });
  return rows.sort((a, b) => (b.createdAt || '').toString().localeCompare((a.createdAt || '').toString()));
}

export function filterCommissionRows(rows, { year, month, sales, status } = {}) {
  return rows.filter(r => {
    if (year && r.year !== Number(year)) return false;
    if (month && r.month !== Number(month)) return false;
    if (sales && r.sales !== sales) return false;
    if (status && r.status !== status) return false;
    return true;
  });
}

/** Group rows by month + sales → [{ monthKey, sales, jobs, buy, sell, total }], newest month first. */
export function summarizeByMonth(rows) {
  const map = {};
  rows.forEach(r => {
    const k = `${r.monthKey}|${r.sales}`;
    if (!map[k]) map[k] = { monthKey: r.monthKey, sales: r.sales || '(chưa gán)', jobs: 0, buy: 0, sell: 0, total: 0 };
    map[k].jobs++;
    map[k].buy += r.buy; map[k].sell += r.sell; map[k].total += r.total;
  });
  return Object.values(map)
    .map(s => ({ ...s, buy: round2(s.buy), sell: round2(s.sell), total: round2(s.total) }))
    .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || '') || a.sales.localeCompare(b.sales));
}

/** Which CKTM sides actually have data in this set — only those columns get shown. */
export function visibleSides(rows) {
  const showBuy = rows.some(r => r.buy);
  const showSell = rows.some(r => r.sell);
  return { showBuy, showSell, showTotal: showBuy && showSell, showNote: rows.some(r => r.note) };
}
