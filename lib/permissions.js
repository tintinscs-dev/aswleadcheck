// Central, toggleable permission system — backs the "Phân quyền" admin screen.
//
// DEFAULT_PERMISSIONS below reproduces the exact hard-coded behavior the app
// had before this file existed, so installing this system changes nothing
// until an Admin actually edits the matrix at /admin/permissions.
//
// Admin is intentionally never looked up in the DB overrides — can() always
// returns true for role === 'admin'. This is a hard safety net so a bad edit
// in the permissions UI can never lock every admin out of the app.
import { prisma } from './db';

export const ROLES = ['sales', 'pricing', 'operation', 'manager', 'accounting', 'admin'];

export const ACTIONS = [
  { key: 'view_all_quotes',    label: 'Xem toàn bộ báo giá (không chỉ của mình)' },
  { key: 'pricing_review',     label: 'Xác nhận / yêu cầu sửa giá mua (Pricing review)' },
  { key: 'approve_quote',      label: 'Duyệt / từ chối báo giá' },
  { key: 'propose_adjustment', label: 'Đề xuất điều chỉnh phí trên báo giá đã duyệt' },
  { key: 'approve_adjustment', label: 'Duyệt / từ chối đề xuất điều chỉnh phí' },
  { key: 'view_activity_log',  label: 'Xem Nhật ký hoạt động' },
  { key: 'manage_users',       label: 'Quản lý người dùng' },
];

export const DEFAULT_PERMISSIONS = {
  view_all_quotes:    ['pricing', 'operation', 'manager', 'accounting', 'admin'],
  pricing_review:     ['pricing', 'admin'],
  approve_quote:      ['manager', 'admin'],
  propose_adjustment: ['sales', 'operation', 'pricing', 'admin'],
  approve_adjustment: ['manager', 'admin'],
  view_activity_log:  ['manager', 'admin'],
  manage_users:       ['admin'],
};

async function loadOverrides() {
  try {
    return await prisma.rolePermission.findMany();
  } catch (e) {
    // Table not migrated yet (db push not run) — fall back to defaults rather than crash.
    console.error('[permissions] failed to load RolePermission overrides:', e.message);
    return [];
  }
}

// Full matrix: { [actionKey]: { [role]: boolean } }, defaults merged with DB overrides.
export async function getEffectivePermissions() {
  const overrides = await loadOverrides();
  const map = {};
  for (const { key } of ACTIONS) {
    map[key] = {};
    for (const role of ROLES) {
      map[key][role] = (DEFAULT_PERMISSIONS[key] || []).includes(role);
    }
  }
  overrides.forEach(o => {
    if (map[o.action] && o.role in map[o.action] && o.role !== 'admin') {
      map[o.action][o.role] = o.allowed;
    }
  });
  // Hard safety net — never overridable.
  for (const key of Object.keys(map)) map[key].admin = true;
  return map;
}

export async function can(role, action) {
  if (role === 'admin') return true;
  if (!ACTIONS.some(a => a.key === action)) return false;
  const perms = await getEffectivePermissions();
  return !!(perms[action] && perms[action][role]);
}

// Resolved booleans for one role only — handy for API responses (e.g. /api/permissions/me).
export async function permissionsForRole(role) {
  if (role === 'admin') {
    return Object.fromEntries(ACTIONS.map(a => [a.key, true]));
  }
  const perms = await getEffectivePermissions();
  return Object.fromEntries(ACTIONS.map(a => [a.key, !!perms[a.key]?.[role]]));
}
