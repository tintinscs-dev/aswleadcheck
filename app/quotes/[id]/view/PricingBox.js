'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingBox({ quoteId }) {
  const router   = useRouter();
  const [comment, setComment] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');

  async function act(action) {
    setErr(''); setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pricing-review`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, comment }),
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
        <textarea
          className="note"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Ghi chú kiểm tra giá mua (tuỳ chọn)"
        />
      </div>
      <div className="actions-row">
        <button className="btn btn-ok"     disabled={busy} onClick={() => act('pricing_approved')}>Xác nhận giá mua</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => act('pricing_rejected')}>Yêu cầu chỉnh sửa</button>
      </div>
    </>
  );
}
