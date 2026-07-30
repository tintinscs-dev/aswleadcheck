import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/serverAuth';
import { diffQuoteCosts } from '../../../../lib/diff';
import { DEFAULT_FX_RATES, usdVndRateFromFx } from '../../../../lib/calc';
import { sendTelegram, quoteNotifyText } from '../../../../lib/telegram';
import { sendEmailNotification } from '../../../../lib/email';

// Snapshot the current shared FX rate table into the quote on every save — see
// the matching helper/comment in app/api/quotes/route.js.
async function currentFxRates() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {
    return DEFAULT_FX_RATES;
  }
}

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

// Roles allowed to touch fee tables on an already-approved quote at all.
// (Sales is further restricted to their own quotes by loadQuote() above.)
const FEE_EDITOR_ROLES = ['admin', 'operation', 'pricing', 'sales'];
// Of those, which ones apply their change immediately vs. only propose it.
const IMMEDIATE_FEE_EDITOR_ROLES = ['admin'];

export async function PUT(req, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const existing = await loadQuote(params.id, user);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (existing === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (existing.status === 'approved' && !FEE_EDITOR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Báo giá đã duyệt — chỉ Admin/Operation/Pricing/Sales (báo giá của mình) được điều chỉnh phí.' }, { status: 403 });
  }

  const body = await req.json();
  const history = Array.isArray(existing.history) ? existing.history : [];
  const { id, createdAt, updatedAt, createdBy, createdById, adjustmentComment, targetStatus: _targetStatus, ...rest } = body;

  let targetStatus;
  let pendingAdjustment = existing.pendingAdjustment || null;
  if (existing.status === 'approved') {
    targetStatus = 'approved';
    const changes = diffQuoteCosts(existing, rest);

    if (IMMEDIATE_FEE_EDITOR_ROLES.includes(user.role)) {
      // Admin: applies immediately, and supersedes/clears any proposal still
      // awaiting Manager approval (admin's direct edit is authoritative).
      if (changes.length > 0) {
        history.push({
          by: user.name, byId: user.id, role: user.role, action: 'adjusted',
          comment: adjustmentComment || '', changes, date: new Date().toISOString(),
        });
      }
      pendingAdjustment = null;
    } else {
      // Operation / Pricing: cannot edit approved fees directly anymore —
      // their change is saved as a proposal that Manager/Admin must approve
      // before it takes effect. The quote's live data is left untouched.
      if (existing.pendingAdjustment) {
        return NextResponse.json({ error: 'Đã có một đề xuất điều chỉnh khác đang chờ Manager duyệt cho báo giá này.' }, { status: 409 });
      }
      if (changes.length === 0) {
        return NextResponse.json(existing);
      }
      pendingAdjustment = {
        proposedById: user.id, proposedBy: user.name, proposedByRole: user.role,
        comment: adjustmentComment || '', changes, data: rest, date: new Date().toISOString(),
      };
      history.push({
        by: user.name, byId: user.id, role: user.role, action: 'adjustment_proposed',
        comment: adjustmentComment || '', changes, date: new Date().toISOString(),
      });

      const fxRates = await currentFxRates();
      const exchangeRate = usdVndRateFromFx(fxRates);
      try {
        const quote = await prisma.quote.update({
          where: { id: params.id },
          data: { fxRates, exchangeRate, history, pendingAdjustment },
        });
        sendTelegram(quoteNotifyText(existing, 'adjustment_proposed', user.name, adjustmentComment || '')).catch(() => {});
        sendEmailNotification(existing, 'adjustment_proposed', user.name, adjustmentComment || '').catch(() => {});
        return NextResponse.json(quote);
      } catch (e) {
        console.error('PUT /api/quotes/[id] (propose adjustment) failed:', e);
        return NextResponse.json({ error: 'Gửi đề xuất thất bại — lỗi hệ thống khi cập nhật dữ liệu.' }, { status: 500 });
      }
    }
  } else {
    // Allowed self-service transitions:
    //   draft  → pricing_review  (Sales submits for cost check)
    //   pricing_review → draft   (Sales recalls before Pricing acts)
    // The quote moves to 'pending' only via the /pricing-review route,
    // and to 'approved'/'rejected' only via the /approve route.
    const requested = _targetStatus;
    // Map legacy 'pending' submit calls → pricing_review so old clients still work
    const mapped = requested === 'pending' ? 'pricing_review' : requested;
    targetStatus = ['draft', 'pricing_review'].includes(mapped) ? mapped : existing.status;
    if (targetStatus === 'pricing_review' && existing.status === 'draft') {
      history.push({ by: user.name, byId: user.id, role: user.role, action: 'submitted', comment: 'Gửi kiểm tra giá mua', date: new Date().toISOString() });
      // Notify — fire-and-forget
      const notifyQuote = { ...existing, ...rest };
      sendTelegram(quoteNotifyText(notifyQuote, 'pricing_review', user.name, '')).catch(() => {});
      sendEmailNotification(notifyQuote, 'pricing_review', user.name, '').catch(() => {});
    }
  }

  const fxRates = await currentFxRates();
  const exchangeRate = usdVndRateFromFx(fxRates);
  const data = { ...rest, fxRates, exchangeRate, status: targetStatus, history, pendingAdjustment };

  try {
    const quote = await prisma.quote.update({ where: { id: params.id }, data });
    return NextResponse.json(quote);
  } catch (e) {
    console.error('PUT /api/quotes/[id] failed:', e);
    return NextResponse.json({ error: 'Lưu thất bại — lỗi hệ thống khi cập nhật dữ liệu.' }, { status: 500 });
  }
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
