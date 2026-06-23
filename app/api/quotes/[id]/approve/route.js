import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';

export async function POST(req, { params }) {
  const user = await requireUser();
  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { action, comment } = await req.json(); // action: 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  const existing = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Báo giá không ở trạng thái chờ duyệt.' }, { status: 400 });
  }

  const history = Array.isArray(existing.history) ? existing.history : [];
  history.push({ by: user.name, role: user.role, action, comment: comment || '', date: new Date().toISOString() });

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data: { status: action, history },
  });
  return NextResponse.json(quote);
}
