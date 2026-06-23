'use client';
import { useState } from 'react';

const ROLES = [
  { value: 'sales', label: 'Sales' },
  { value: 'operation', label: 'Operation' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export default function UsersClient({ initialUsers, currentUserId }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'sales' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function createUser(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Tạo người dùng thất bại.');
      setUsers(u => [...u, body]);
      setForm({ username: '', password: '', name: '', role: 'sales' });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function changeRole(id, role) {
    const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    if (res.ok) setUsers(u => u.map(x => x.id === id ? { ...x, role } : x));
  }

  async function resetPassword(id) {
    const pw = window.prompt('Mật khẩu mới cho người dùng này:');
    if (!pw) return;
    const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) alert('Đã đặt lại mật khẩu.'); else alert('Thất bại.');
  }

  async function removeUser(id) {
    if (!window.confirm('Xoá người dùng này?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) setUsers(u => u.filter(x => x.id !== id));
    else { const b = await res.json().catch(() => ({})); alert(b.error || 'Thất bại.'); }
  }

  return (
    <>
      <h2>Quản lý người dùng</h2>
      <div className="pagesub">Tạo tài khoản thật cho nhân viên, gán vai trò Sales / Manager / Admin, đặt lại mật khẩu khi cần.</div>

      <div className="card">
        <h3>Thêm người dùng mới</h3>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={createUser} className="grid grid-4">
          <div className="field"><label>Tên đăng nhập</label><input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
          <div className="field"><label>Mật khẩu</label><input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div className="field"><label>Họ tên</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="field"><label>Vai trò</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </form>
        <div className="actions-row"><button className="btn btn-primary" disabled={busy} onClick={createUser}>+ Tạo người dùng</button></div>
      </div>

      <div className="card">
        <h3>Danh sách người dùng</h3>
        {users.map(u => (
          <div className="userlist-row" key={u.id}>
            <div><b>{u.name}</b><div className="meta">@{u.username}</div></div>
            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} disabled={u.id === currentUserId}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" onClick={() => resetPassword(u.id)}>Đặt lại mật khẩu</button>
            <button className="btn btn-danger btn-sm" disabled={u.id === currentUserId} onClick={() => removeUser(u.id)}>Xoá</button>
          </div>
        ))}
      </div>
    </>
  );
}
