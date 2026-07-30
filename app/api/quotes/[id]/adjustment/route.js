import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { DEFAULT_FX_RATES, usdVndRateFromFx } from '../../../../../lib/calc';
import { sendTelegram, quoteNotifyText } from '../../../../../lib/telegram';
import { sendEmailNotification } from '../../../../../lib/email';

async function currentFxRates() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {
    return DEFAULT_FX_RATES;
  }
}

/**
 * POST /api/quotes/[id]/adjustment
 * Body: { action: 'approve' | 'reject', comment?: string }
 *
 * Resolves the fee-adjustment proposal (Operation/Pricing) sitting in
 * quote.pendingAdjustment on an already-approved quote:
 *   approve → merges the proposed data into the quote, clears the proposal
 *   reject  → discards the proposal, quote's live data is untouched
 *
 * Allowed roles: manager, admin
 */
export async function POST(req, { params }) {
  const user = await requireUser();
  if (!user || !['manager', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Chỉ Manager hoặc Admin được duyệt điều chỉnh.' }, { status: 403 });
  }

  const { action, comment } = await req.json();
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  }

  const existing = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy báo giá.' }, { status: 404 });
  if (existing.status !== 'approved' || !existing.pendingAdjustment) {
    return NextResponse.json({ error: 'Báo giá không có đề xuất điều chỉnh nào đang chờ duyệt.' }, { status: 400 });
  }

  const history = Array.isArray(existing.history) ? existing.history : [];
  const proposal = existing.pendingAdjustment;
  const notifyAction = action === 'approve' ? 'adjustment_approved' : 'adjustment_rejected';

  history.push({
    by: user.name, byId: user.id, role: user.role, action: notifyAction,
    comment: comment || '', changes: proposal.changes || [], date: new Date().toISOString(),
  });

  let data;
  if (action === 'approve') {
    const fxRates = await currentFxRates();
    const exchangeRate = usdVndRateFromFx(fxRates);
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, createdById: _cbi, ...rest } = proposal.data || {};
    data = { ...rest, fxRates, exchangeRate, status: 'approved', history, pendingAdjustment: null };
  } else {
    data = { history, pendingAdjustment: null };
  }

  try {
    const quote = await prisma.quote.update({ where: { id: params.id }, data });
    sendTelegram(quoteNotifyText(existing, notifyAction, user.name, comment || '')).catch(() => {});
    sendEmailNotification(existing, notifyAction, user.name, comment || '').catch(() => {});
    return NextResponse.json(quote);
  } catch (e) {
    console.error('POST /api/quotes/[id]/adjustment failed:', e);
    return NextResponse.json({ error: 'Xử lý thất bại — lỗi hệ thống khi cập nhật dữ liệu.' }, { status: 500 });
  }
}
