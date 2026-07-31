'use client';
import { useState } from 'react';

const ROLE_LABEL = { sales: 'Sales', pricing: 'Pricing', operation: 'Operation', manager: 'Manager', accounting: 'Accounting', admin: 'Admin' };

export default function PermissionsClient({ roles, actions, initialMatrix, canEdit }) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [busy, setBusy] = useState(null); // `${role}:${action}` while saving
  const [err, setErr] = useState('');

  async function toggle(role, action, current) {
    if (!canEdit || role === 'admin') return;
    const key = `${role}:${action}`;
    setErr(''); setBusy(key);
    // optimistic update
    setMatrix(m => ({ ...m, [action]: { ...m[action], [role]: !current } }));
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, action, allowed: !current }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lưu thất bại.');
      const body = await res.json();
      setMatrix(body.matrix);
    } catch (e) {
      setErr(e.message);
      // revert on failure
      setMatrix(m => ({ ...m, [action]: { ...m[action], [role]: current } }));
    } finally {
      setBusy(null);
    }
  }

  async function resetDefaults() {
    if (!canEdit) return;
    if (!window.confirm('Khôi phục toàn bộ quyền về mặc định ban đầu?')) return;
    setErr(''); setBusy('__reset__');
    try {
      const res = await fetch('/api/permissions', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Thất bại.');
      const body = await res.json();
      setMatrix(body.matrix);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {err && <div className="login-err">{err}</div>}

      {canEdit ? (
        <div className="pagesub" style={{ marginBottom: 10 }}>
          Bấm vào ô để bật/tắt quyền cho từng vai trò. Cột <b>Admin</b> luôn bật, không thể tắt (để tránh tự khoá hết quyền quản trị).
        </div>
      ) : (
        <div className="pagesub" style={{ marginBottom: 10 }}>
          Bạn đang xem ở chế độ chỉ đọc — chỉ Admin mới chỉnh được bảng quyền này.
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>Chức năng</th>
              {roles.map(r => <th key={r} style={{ textAlign: 'center' }}>{ROLE_LABEL[r] || r}</th>)}
            </tr>
          </thead>
          <tbody>
            {actions.map(a => (
              <tr key={a.key}>
                <td>{a.label}</td>
                {roles.map(r => {
                  const allowed = !!matrix[a.key]?.[r];
                  const isAdminCol = r === 'admin';
                  const key = `${r}:${a.key}`;
                  const clickable = canEdit && !isAdminCol;
                  return (
                    <td key={r} style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => toggle(r, a.key, allowed)}
                        disabled={!clickable || busy === key}
                        title={isAdminCol ? 'Admin luôn có toàn quyền' : (canEdit ? 'Bấm để bật/tắt' : 'Chỉ Admin chỉnh được')}
                        className={`badge ${allowed ? 'badge-approved' : 'badge-rejected'}`}
                        style={{
                          border: 'none', cursor: clickable ? 'pointer' : 'default',
                          opacity: busy === key ? 0.5 : 1, minWidth: 28,
                        }}
                      >
                        {allowed ? '✓' : '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="actions-row">
          <button className="btn btn-outline" disabled={busy === '__reset__'} onClick={resetDefaults}>
            Khôi phục mặc định
          </button>
        </div>
      )}
    </>
  );
}
