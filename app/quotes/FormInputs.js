'use client';
// Shared inputs for the quote form and the FCL matrix (split out of QuoteForm.js).
import { useState } from 'react';
import { CURRENCIES, DEFAULT_CURRENCY, fmt } from '../../lib/calc';

export function CurrencySelect({ value, onChange }) {
  return (
    <select className="currency-select" value={value || DEFAULT_CURRENCY} onChange={e => onChange(e.target.value)} title="Đơn vị tiền tệ của dòng này">
      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// Parses a number typed with either "." or "," as the decimal point.
// iPhones set to Vietnam's region show a numeric keypad whose decimal key is
// "," (not "."), so a comma must be accepted as a real decimal separator —
// but the app's own formatted display (and desktop typing habits) also use
// "," to group thousands (e.g. "6,500,000"), which must still parse as a
// whole number. Disambiguate the same way spreadsheets do: a lone comma
// followed by exactly 3 digits (and nothing else after it) is a thousands
// group ("1,200" → 1200); anything else — a lone comma with 1-2 or 4+
// trailing digits ("12,5" → 12.5), or multiple commas ("6,500,000") — is
// handled accordingly. When both "." and "," appear, whichever comes last
// is the real decimal point and the other is thousands-grouping.
export function parseFlexibleNumber(s) {
  let str = String(s ?? '').trim();
  if (!str) return 0;
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    str = lastComma > lastDot
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '');
  } else if (lastComma > -1) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // multiple commas — always thousands grouping, e.g. "6,500,000"
      str = str.replace(/,/g, '');
    } else {
      // exactly one comma — thousands group only if followed by exactly 3
      // digits ("1,200" → 1200); otherwise it's the decimal point ("12,5" → 12.5)
      str = parts[1].length === 3 ? str.replace(',', '') : str.replace(',', '.');
    }
  }
  const n = Number(str);
  return isNaN(n) ? 0 : n;
}

// Plain number while focused (easy to type), comma-separated thousands once
// you click away — used for every money field (giá cả/chi phí) for readability.
function formatMoney(v) {
  const n = Number(v) || 0;
  return n === 0 ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
function parseMoney(s) {
  return parseFlexibleNumber(s);
}
export function MoneyInput({ value, onChange, disabled }) {
  // raw = null means "not focused" — display formatted value.
  // When focused, raw holds exactly what the user is typing (including
  // trailing dots like "11."), so we never strip the decimal mid-entry.
  // We only parse → number on blur, avoiding the cursor-jump / dot-loss bug.
  const [raw, setRaw] = useState(null);
  const display = raw !== null ? raw : formatMoney(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      disabled={disabled}
      onFocus={() => setRaw(value || value === 0 ? String(value) : '')}
      onBlur={() => { onChange(parseMoney(raw ?? '')); setRaw(null); }}
      onChange={e => setRaw(e.target.value)}
    />
  );
}

// Plain decimal number, no thousand separators shown on screen — for
// C.W / G.W / CBM / VAT% / lãi suất and any other plain quantity that must
// accept a decimal point. A native <input type="number"> bound straight to a
// numeric value re-renders on every keystroke as Number(text), which
// silently drops a trailing "." the instant it's typed (e.g. typing "12."
// becomes "12" before you can add the fractional digits) — making decimal
// entry feel impossible. Same focus/blur raw-string technique as MoneyInput
// avoids that, and parseFlexibleNumber handles a comma typed as either a
// decimal point (VN-locale phone keypads) or thousands grouping (e.g. G.W
// entered as "1,200" kg).
function formatDecimal(v) {
  const n = Number(v) || 0;
  return n === 0 ? '' : String(n);
}
function parseDecimal(s) {
  return parseFlexibleNumber(s);
}
export function DecimalInput({ value, onChange, disabled, placeholder }) {
  const [raw, setRaw] = useState(null);
  const display = raw !== null ? raw : formatDecimal(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={display}
      disabled={disabled}
      onFocus={() => setRaw(value || value === 0 ? String(value) : '')}
      onBlur={() => { onChange(parseDecimal(raw ?? '')); setRaw(null); }}
      onChange={e => setRaw(e.target.value)}
    />
  );
}

export function PriceNote({ note }) {
  if (!note) return null;
  const text = note.direction === 'higher'
    ? `Cao hơn giá đề xuất ${fmt(note.suggestedPrice)} (+${fmt(note.diff)})`
    : `Thấp hơn giá đề xuất ${fmt(note.suggestedPrice)} (-${fmt(note.diff)})`;
  return <div className={`price-note ${note.direction === 'higher' ? 'note-up' : 'note-down'}`} title="So với Dữ liệu nội bộ (giá đề xuất)">{text}</div>;
}
