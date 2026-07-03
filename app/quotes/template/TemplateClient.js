'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATE_SECTIONS, blankTemplate, blankChargeRow } from '../../../lib/templateQuote';

const INFO_FIELDS = [
  ['customer', 'Customer', 'date', 'Date'],
  ['taxCode', 'Tax Code', 'valid', 'Valid'],
  ['commodity', 'Commodity', 'pol', 'POL'],
  ['term', 'Term', 'pod', 'POD'],
  ['pickup', 'Pick-up Add', 'volume', 'Volume'],
  ['dropoff', 'Delivery Add', 'mode', 'Mode'],
];

async function downloadBlob(url, body, filename) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Xuất file thất bại.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function TemplateClient() {
  const router = useRouter();
  const [t, setT] = useState(blankTemplate());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  function setField(key, val) { setT(prev => ({ ...prev, [key]: val })); }
  function setRow(sectionKey, idx, field, val) {
    setT(prev => {
      const next = { ...prev, [sectionKey]: prev[sectionKey].map((r, i) => i === idx ? { ...r, [field]: val } : r) };
      return next;
    });
  }
  function addRow(sectionKey) { setT(prev => ({ ...prev, [sectionKey]: [...prev[sectionKey], blankChargeRow()] })); }
  function removeRow(sectionKey, idx) { setT(prev => ({ ...prev, [sectionKey]: prev[sectionKey].filter((_, i) => i !== idx) })); }

  async function importFile(kind, file) {
    if (!file) return;
    setErr(''); setInfo(''); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/quotes/template/import-${kind}`, { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Import thất bại.');
      setT(prev => ({ ...prev, ...body }));
      setInfo(kind === 'pdf'
        ? 'Đã import từ PDF (chỉ mang tính tham khảo) — vui lòng kiểm tra lại toàn bộ số liệu trước khi dùng.'
        : 'Đã import từ Excel.');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function exportFile(kind) {
    setErr(''); setBusy(true);
    try {
      const ext = kind === 'pdf' ? 'pdf' : 'xlsx';
      await downloadBlob(`/api/quotes/template/export-${kind}`, t, `ASW_Quote_Template.${ext}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function createQuote() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/quotes/template/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Tạo báo giá thất bại.');
      router.push(`/quotes/${body.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <h2>Quote theo mẫu</h2>
      <div className="pagesub">
        Nhập tay hoặc import Excel/PDF theo mẫu &quot;CUSTOMER &amp; SHIPMENT INFORMATION / FREIGHT &amp; CHARGES / LOCAL CHARGES / Customs and Trucking&quot;.
        Sau khi xong, bấm &quot;Tạo báo giá&quot; để hệ thống tự tạo 1 báo giá nháp từ dữ liệu này — bạn kiểm tra/sửa số liệu trong màn hình báo giá như bình thường rồi gửi duyệt.
      </div>
      {err && <div className="login-err">{err}</div>}
      {info && <div className="lock-note">{info}</div>}

      <div className="card">
        <h3>Import / Export</h3>
        <div className="actions-row">
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => importFile('excel', e.target.files[0])} />
          <button className="btn btn-outline" disabled={busy} onClick={() => excelInputRef.current.click()}>⬆ Nhập từ Excel</button>
          <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => importFile('pdf', e.target.files[0])} />
          <button className="btn btn-outline" disabled={busy} onClick={() => pdfInputRef.current.click()}>⬆ Nhập từ PDF</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => exportFile('excel')}>⬇ Xuất Excel</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => exportFile('pdf')}>⬇ Xuất PDF</button>
        </div>
        <p className="helptext">Import Excel chính xác nhất khi dùng đúng file do công cụ này xuất ra. Import PDF chỉ đọc được khi PDF có chữ (không phải ảnh scan), và là tham khảo — luôn kiểm tra lại số liệu.</p>
      </div>

      <div className="card">
        <h3>Customer &amp; Shipment Information</h3>
        {INFO_FIELDS.map(([k1, l1, k2, l2]) => (
          <div className="grid grid-4" key={k1}>
            <div className="field"><label>{l1}</label><input value={t[k1] || ''} onChange={e => setField(k1, e.target.value)} /></div>
            <div className="field"><label>{l2}</label><input value={t[k2] || ''} onChange={e => setField(k2, e.target.value)} /></div>
          </div>
        ))}
        <div className="field"><label>Notes / Consignee</label><textarea className="note" value={t.notes || ''} onChange={e => setField('notes', e.target.value)}></textarea></div>
        <div className="field">
          <label>Lưu ý riêng cho lô hàng này (mỗi dòng 1 ý, sẽ thêm vào cuối mục &quot;Điều khoản &amp; Lưu ý&quot; khi in)</label>
          <textarea className="note" value={(t.extraTerms || []).join('\n')} onChange={e => setField('extraTerms', e.target.value.split('\n'))}></textarea>
        </div>
      </div>

      {TEMPLATE_SECTIONS.map(sec => (
        <div className="card" key={sec.key}>
          <h3>{sec.title}</h3>
          <table className="item-table">
            <thead><tr><th style={{ width: 30 }}>No.</th><th>Charge Description</th><th>Unit Rate</th><th>Currency</th><th>Unit</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {t[sec.key].map((r, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input value={r.desc} onChange={e => setRow(sec.key, idx, 'desc', e.target.value)} /></td>
                  <td><input value={r.rate} onChange={e => setRow(sec.key, idx, 'rate', e.target.value)} placeholder="vd: 230.00" /></td>
                  <td>
                    <select value={r.currency} onChange={e => setRow(sec.key, idx, 'currency', e.target.value)}>
                      <option value="USD">USD</option><option value="VND">VND</option><option value="EUR">EUR</option>
                    </select>
                  </td>
                  <td><input value={r.unit} onChange={e => setRow(sec.key, idx, 'unit', e.target.value)} placeholder="vd: 40HC, Bill of Lading" /></td>
                  <td><input value={r.notes} onChange={e => setRow(sec.key, idx, 'notes', e.target.value)} /></td>
                  <td><button type="button" title="Xóa dòng" onClick={() => removeRow(sec.key, idx)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-add-item" onClick={() => addRow(sec.key)}>+ Thêm dòng</button>
        </div>
      ))}

      <div className="actions-row">
        <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>Hủy / Quay lại</button>
        <button className="btn btn-primary" disabled={busy} onClick={createQuote}>+ Tạo báo giá từ mẫu này</button>
      </div>
    </div>
  );
}
