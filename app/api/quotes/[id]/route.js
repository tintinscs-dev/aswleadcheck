import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/serverAuth';
import { diffQuoteCosts } from '../../../../lib/diff';

async function loadQuote(id, user) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, username: true } } },
  });
  if (!quote) return null;
  if (user.role === 'sales' && quote.createdById !== user.id) return 'forbidden';
  return quote;
}

export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const quote = await loadQuote(params.id, user);
  if (!quote) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (quote === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(quote);
}

export async function PUT(req, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await loadQuote(params.id, user);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (existing === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (existing.status === 'approved' && !['admin', 'manager', 'operation'].includes(user.role)) {
    return NextResponse.json({ error: 'Báo giá đã duyệt — chỉ Admin/Manager/Operation được điều chỉnh phí.' }, { status: 403 });
  }

  const body = await req.json();
  const history = Array.isArray(existing.history) ? existing.history : [];
  const { id, createdAt, updatedAt, createdBy, createdById, adjustmentComment, ...rest } = body;

  let targetStatus;
  if (existing.status === 'approved') {
    // Adjusting fees on an already-approved quote: status stays "approved",
    // changes are diffed and logged instead of going through re-approval.
    targetStatus = 'approved';
    const changes = diffQuoteCosts(existing, rest);
    if (changes.length > 0) {
      history.push({
        by: user.name, role: user.role, action: 'adjusted',
        comment: adjustmentComment || '', changes, date: new Date().toISOString(),
      });
    }
  } else {
    targetStatus = body.targetStatus || existing.status;
    if (targetStatus === 'pending' && existing.status !== 'pending') {
      history.push({ by: user.name, role: user.role, action: 'submitted', comment: 'Gửi duyệt', date: new Date().toISOString() });
    }
  }

  const data = { ...rest, status: targetStatus, history };

  const quote = await prisma.quote.update({ where: { id: params.id }, data });
  return NextResponse.json(quote);
}

export async function DELETE(req, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await loadQuote(params.id, user);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (existing === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (user.role === 'sales' && existing.status !== 'draft') {
    return NextResponse.json({ error: 'Chỉ được xoá báo giá ở trạng thái nháp.' }, { status: 403 });
  }
  await prisma.quote.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
