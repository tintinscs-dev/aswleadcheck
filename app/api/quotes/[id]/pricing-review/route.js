import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { sendTelegram, quoteNotifyText } from '../../../../../lib/telegram';
import { sendEmailNotification } from '../../../../../lib/email';

/**
 * POST /api/quotes/[id]/pricing-review
 * Body: { action: 'pricing_approved' | 'pricing_rejected', comment?: string }
 *
 * pricing_approved → status becomes 'pending' (goes to Manager)
 * pricing_rejected → status returns to 'draft'  (Sales must revise)
 *
 * Allowed roles: pricing, admin
 */
export async function POST(req, { params }) {
  const user = await requireUser();
  if (!user || !['pricing', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Chỉ Pricing hoặc Admin được thực hiện thao tác này.' }, { status: 403 });
  }

  const { action, comment } = await req.json();
  if (!['pricing_approved', 'pricing_rejected'].includes(action)) {
    return NextResponse.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  }

  const existing = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy báo giá.' }, { status: 404 });
  if (existing.status !== 'pricing_review') {
    return NextResponse.json({ error: 'Báo giá không ở trạng thái chờ Pricing kiểm tra.' }, { status: 400 });
  }

  const newStatus = action === 'pricing_approved' ? 'pending' : 'draft';
  const history   = Array.isArray(existing.history) ? existing.history : [];
  history.push({
    by: user.name, role: user.role, action,
    comment: comment || '', date: new Date().toISOString(),
  });

  const quote = await prisma.quote.update({
    where: { id: params.id },
    data:  { status: newStatus, history },
  });

  // Notify — fire-and-forget
  sendTelegram(quoteNotifyText(existing, action, user.name, comment || '')).catch(() => {});
  sendEmailNotification(existing, action, user.name, comment || '').catch(() => {});

  return NextResponse.json(quote);
}
