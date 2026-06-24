'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/setup').then(r => r.json()).then(d => {
      if (d.needsSetup) router.push('/setup');
    }).catch(() => {});
  }, [router]);

  async function doLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', { username, password, redirect: false });
      if (res?.error) {
        setError('Sai tên đăng nhập hoặc mật khẩu.');
        return;
      }
      if (!res?.ok) {
        setError('Đăng nhập thất bại — không nhận được phản hồi từ server. Vui lòng thử lại.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('Lỗi kết nối tới server — vui lòng kiểm tra mạng và thử lại. (' + (err?.message || 'unknown') + ')');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={doLogin}>
        <h1>ASW Sales Shipment Proposal</h1>
        <p className="sub login-sub">Đăng nhập để tạo / duyệt báo giá lô hàng</p>
        <div className="field">
          <label>Tên đăng nhập</label>
          <input value={username} onChange={e => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="login-err">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
