'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ quoteId, quoteNo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteQuote() {
    if (!confirm(`Xoá báo giá ${quoteNo || ''} (bản nháp)? Hành động này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Xoá thất bại.');
      router.push('/dashboard');
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-outline" style={{ color: 'var(--danger)' }} disabled={busy} onClick={deleteQuote} title="Xoá báo giá nháp này">
      {busy ? 'Đang xoá…' : '🗑 Xoá báo giá này'}
    </button>
  );
}
