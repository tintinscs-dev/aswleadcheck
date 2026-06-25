import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/serverAuth';

export async function PUT(req, { params }) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();

  // An admin can rename/reset password for themselves, but must not be able
  // to change their own role — otherwise a single-admin system could lock
  // itself out with no one left who can grant admin back.
  if (params.id === user.id && body.role && body.role !== user.role) {
    return NextResponse.json({ error: 'Không thể tự đổi quyền của chính mình.' }, { status: 400 });
  }

  if (body.password && body.password.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, { status: 400 });
  }

  const data = {};
  if (body.name) data.name = body.name;
  if (body.role && ['sales', 'manager', 'admin', 'operation'].includes(body.role)) data.role = body.role;
  if (body.password) data.password = await bcrypt.hash(body.password, 10);

  try {
    const updated = await prisma.user.update({ where: { id: params.id }, data });
    return NextResponse.json({ id: updated.id, username: updated.username, name: updated.name, role: updated.role });
  } catch (e) {
    return NextResponse.json({ error: 'Không tìm thấy người dùng.' }, { status: 404 });
  }
}

export async function DELETE(req, { params }) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (params.id === user.id) return NextResponse.json({ error: 'Không thể tự xoá chính mình.' }, { status: 400 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
