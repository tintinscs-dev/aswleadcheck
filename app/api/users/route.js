import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';
import { can } from '../../../lib/permissions';

export async function GET() {
  const user = await requireUser();
  if (!user || !(await can(user.role, 'manage_users'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, notifyEmail: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(req) {
  const user = await requireUser();
  if (!user || !(await can(user.role, 'manage_users'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { username, password, name, role, notifyEmail } = await req.json();
  if (!username || !password || !name || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin.' }, { status: 400 });
  }
  if (!['sales', 'pricing', 'operation', 'manager', 'accounting', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Vai trò không hợp lệ.' }, { status: 400 });
  }
  // Only a real Admin can mint another Admin account — otherwise granting
  // 'manage_users' to another role would let it escalate itself to Admin.
  if (role === 'admin' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ Admin được tạo tài khoản Admin.' }, { status: 403 });
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại.' }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { username, password: hash, name, role, notifyEmail: notifyEmail || null },
  });
  return NextResponse.json({
    id: created.id, username: created.username, name: created.name,
    role: created.role, notifyEmail: created.notifyEmail, active: created.active,
  });
}
