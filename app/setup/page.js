'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(d => { setNeedsSetup(!!d.needsSetup); setChecking(false); })
      .catch(() => setChecking(false));
  }, []);

  async function doSetup(e) {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError('Hai mật khẩu không khớp.'); return; }
    if (!name || !username || !password) { setError('Vui lòng điền đầy đủ thông tin.'); return; }
    setLoading(true);
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Có lỗi xảy ra.');
      setLoading(false);
      return;
    }
    const signinRes = await signIn('credentials', { username, password, redirect: false });
    setLoading(false);
    if (signinRes?.error) {
      router.push('/login');
      return;
    }
    router.push('/admin/users');
    router.refresh();
  }

  if (checking) {
    return <div className="login-wrap"><div className="login-box">Đang kiểm tra hệ thống…</div></div>;
  }

  if (!needsSetup) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <h1>Hệ thống đã được khởi tạo</h1>
          <p className="sub login-sub">Tài khoản admin đầu tiên đã tồn tại. Vui lòng đăng nhập, hoặc liên hệ admin để được tạo tài khoản.</p>
          <a className="btn btn-primary btn-block" href="/login" style={{ textAlign: 'center', textDecoration: 'none' }}>Đến trang đăng nhập</a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={doSetup}>
        <h1>Khởi tạo hệ thống</h1>
        <p className="sub login-sub">Đây là lần đầu hệ thống chưa có tài khoản nào. Tạo tài khoản <b>admin</b> đầu tiên — sau đó admin sẽ tạo tài khoản cho Manager/Sales trong trang Quản trị &gt; Người dùng.</p>
        <div className="field">
          <label>Họ tên</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Tên đăng nhập</label>
          <input value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Nhập lại mật khẩu</label>
          <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} />
        </div>
        {error && <div className="login-err">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Đang tạo…' : 'Tạo tài khoản admin'}
        </button>
      </form>
    </div>
  );
}
