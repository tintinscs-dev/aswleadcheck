import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';

export async function GET() {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(req) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { username, password, name, role } = await req.json();
  if (!username || !password || !name || !role) {
    return NextResponse.json({ error: 'Thiếu thông tin.' }, { status: 400 });
  }
  if (!['sales', 'pricing', 'operation', 'manager', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Vai trò không hợp lệ.' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại.' }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({ data: { username, password: hash, name, role } });
  return NextResponse.json({ id: created.id, username: created.username, name: created.name, role: created.role });
}
