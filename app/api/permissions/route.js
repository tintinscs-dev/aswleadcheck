import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';
import { ROLES, ACTIONS, getEffectivePermissions } from '../../../lib/permissions';

export async function GET() {
  const user = await requireUser();
  if (!user || !['admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const matrix = await getEffectivePermissions();
  return NextResponse.json({ roles: ROLES, actions: ACTIONS, matrix, canEdit: user.role === 'admin' });
}

// Toggle a single (role, action) cell. Admin-only — Manager can view the
// matrix (GET above) but never edit it, so permissions-that-control-permissions
// can't be reconfigured by anyone other than Admin.
export async function PUT(req) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { role, action, allowed } = await req.json();
  if (!ROLES.includes(role) || role === 'admin') {
    return NextResponse.json({ error: 'Vai trò không hợp lệ.' }, { status: 400 });
  }
  if (!ACTIONS.some(a => a.key === action)) {
    return NextResponse.json({ error: 'Quyền không hợp lệ.' }, { status: 400 });
  }
  if (typeof allowed !== 'boolean') {
    return NextResponse.json({ error: 'Thiếu giá trị allowed.' }, { status: 400 });
  }

  await prisma.rolePermission.upsert({
    where: { role_action: { role, action } },
    update: { allowed },
    create: { role, action, allowed },
  });

  const matrix = await getEffectivePermissions();
  return NextResponse.json({ matrix });
}

// Reset every override back to the hard-coded defaults.
export async function DELETE() {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await prisma.rolePermission.deleteMany({});
  const matrix = await getEffectivePermissions();
  return NextResponse.json({ matrix });
}
