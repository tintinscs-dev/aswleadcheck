'use client';
import { useState } from 'react';

const ROLES = [
  { value: 'sales',    label: 'Sales' },
  { value: 'pricing',  label: 'Pricing' },
  { value: 'operation',label: 'Operation' },
  { value: 'manager',  label: 'Manager' },
  { value: 'admin',    label: 'Admin' },
];

export default function UsersClient({ initialUsers, currentUserId }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'sales', notifyEmail: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Track inline email edits per user row
  const [editingEmail, setEditingEmail] = useState({}); // { [userId]: string }

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
      setForm({ username: '', password: '', name: '', role: 'sales', notifyEmail: '' });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function changeRole(id, role) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const body = await res.json();
      setUsers(u => u.map(x => x.id === id ? { ...x, ...body } : x));
    }
  }

  async function saveEmail(id) {
    const notifyEmail = editingEmail[id] ?? '';
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyEmail }),
    });
    if (res.ok) {
      const body = await res.json();
      setUsers(u => u.map(x => x.id === id ? { ...x, notifyEmail: body.notifyEmail } : x));
      setEditingEmail(ev => { const n = { ...ev }; delete n[id]; return n; });
    } else {
      alert('Lưu email thất bại.');
    }
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
      <div className="pagesub">Tạo tài khoản, gán vai trò và cài email nhận thông báo workflow cho từng nhân viên.</div>

      <div className="card">
        <h3>Thêm người dùng mới</h3>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={createUser}>
          <div className="grid grid-4" style={{ marginBottom: 10 }}>
            <div className="field"><label>Tên đăng nhập</label><input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div className="field"><label>Mật khẩu</label><input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="field"><label>Họ tên</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="field"><label>Vai trò</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>
              Email thông báo&nbsp;
              <span style={{ color: '#6B7787', fontWeight: 400, fontSize: 11 }}>
                (tuỳ chọn — nhận email khi có thay đổi trạng thái báo giá)
              </span>
            </label>
            <input
              type="email"
              placeholder="vd: nguyen@company.com"
              value={form.notifyEmail}
              onChange={e => setForm(f => ({ ...f, notifyEmail: e.target.value }))}
              style={{ maxWidth: 340 }}
            />
          </div>
        </form>
        <div className="actions-row">
          <button className="btn btn-primary" disabled={busy} onClick={createUser}>+ Tạo người dùng</button>
        </div>
      </div>

      <div className="card">
        <h3>Danh sách người dùng</h3>
        <div style={{
          background: '#f0f7ff', border: '1px solid #c5dff8', borderRadius: 7,
          padding: '9px 14px', marginBottom: 14, fontSize: 12, color: '#004080',
        }}>
          <b>Email thông báo:</b> Điền email để nhân viên nhận thông báo tự động khi báo giá thay đổi trạng thái.
          Vai trò nào nhận thông báo gì:
          <br />
          Pricing/Admin → nhận khi Sales gửi báo giá lên kiểm tra.&nbsp;·&nbsp;
          Manager/Admin → nhận khi Pricing xác nhận.&nbsp;·&nbsp;
          Sales (người tạo) → nhận khi Pricing từ chối hoặc Manager duyệt/từ chối.
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eef2f8' }}>
              <th style={thStyle}>Nhân viên</th>
              <th style={{ ...thStyle, width: 130 }}>Vai trò</th>
              <th style={thStyle}>Email thông báo</th>
              <th style={{ ...thStyle, width: 180 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const currentEmail = u.notifyEmail || '';
              const editVal = editingEmail[u.id] !== undefined ? editingEmail[u.id] : currentEmail;
              const isDirty = editingEmail[u.id] !== undefined && editingEmail[u.id] !== currentEmail;

              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #e1e6ee' }}>
                  <td style={tdStyle}>
                    <b>{u.name}</b>
                    <div style={{ fontSize: 11, color: '#6B7787' }}>@{u.username}</div>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value)}
                      disabled={u.id === currentUserId}
                      style={{ width: '100%', padding: '6px 7px', border: '1px solid #e1e6ee', borderRadius: 6, fontSize: 12 }}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="email"
                        placeholder="Chưa cài đặt"
                        value={editVal}
                        onChange={e => setEditingEmail(ev => ({ ...ev, [u.id]: e.target.value }))}
                        style={{
                          flex: 1, padding: '6px 9px', fontSize: 12, borderRadius: 6,
                          border: `1px solid ${isDirty ? '#1D7A6F' : '#e1e6ee'}`,
                          background: isDirty ? '#f0faf7' : '#fff',
                          outline: 'none',
                        }}
                      />
                      {isDirty && (
                        <button className="btn btn-ok btn-sm" onClick={() => saveEmail(u.id)}>
                          Lưu
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => resetPassword(u.id)}>Đặt lại MK</button>
                      <button className="btn btn-danger btn-sm" disabled={u.id === currentUserId} onClick={() => removeUser(u.id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const thStyle = {
  textAlign: 'left', padding: '9px 10px', color: '#13315C',
  borderBottom: '2px solid #e1e6ee', fontWeight: 700,
};
const tdStyle = { padding: '10px 10px', verticalAlign: 'middle' };
