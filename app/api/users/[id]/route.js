import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/serverAuth';

export async function PUT(req, { params }) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const data = {};
  if (body.name) data.name = body.name;
  if (body.role && ['sales', 'manager', 'admin'].includes(body.role)) data.role = body.role;
  if (body.password) data.password = await bcrypt.hash(body.password, 10);
  const updated = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: updated.id, username: updated.username, name: updated.name, role: updated.role });
}

export async function DELETE(req, { params }) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (params.id === user.id) return NextResponse.json({ error: 'Không thể tự xoá chính mình.' }, { status: 400 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
