'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CopyButton({ quoteId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function copyQuote() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/duplicate`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Sao chép thất bại.');
      router.push(`/quotes/${body.id}`);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-outline" disabled={busy} onClick={copyQuote} title="Tạo báo giá mới từ dữ liệu của báo giá này, dùng cho lô hàng tương tự">
      {busy ? 'Đang sao chép…' : '⧉ Copy báo giá này'}
    </button>
  );
}
