'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApproveBox({ quoteId }) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function act(action) {
    setErr(''); setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Thao tác thất bại.');
      }
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {err && <div className="login-err">{err}</div>}
      <div className="grid">
        <textarea className="note" value={comment} onChange={e => setComment(e.target.value)} placeholder="Ghi chú duyệt / từ chối (tuỳ chọn)"></textarea>
      </div>
      <div className="actions-row">
        <button className="btn btn-ok" disabled={busy} onClick={() => act('approved')}>✓ Duyệt báo giá</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => act('rejected')}>✕ Từ chối</button>
      </div>
    </>
  );
}
