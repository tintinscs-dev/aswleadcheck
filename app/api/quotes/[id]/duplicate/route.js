import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { DEFAULT_FX_RATES, usdVndRateFromFx } from '../../../../../lib/calc';

// Snapshot the current shared FX rate table — see matching helper in
// app/api/quotes/route.js. A duplicated quote is a brand-new draft, so it
// should pick up today's rates, not the original's possibly-stale ones.
async function currentFxRates() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {
    return DEFAULT_FX_RATES;
  }
}

// Duplicate an existing quote into a brand-new draft, so Sales can quickly
// re-use a similar shipment's data instead of re-typing everything.
export async function POST(req, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const existing = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (user.role === 'sales' && existing.createdById !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const {
    id, createdAt, updatedAt, createdById, createdBy, status, history, no,
    fxRates: _oldFxRates, exchangeRate: _oldExchangeRate, ...rest
  } = existing;

  const fxRates = await currentFxRates();
  const exchangeRate = usdVndRateFromFx(fxRates);

  const data = {
    ...rest,
    fxRates,
    exchangeRate,
    no: no ? `${no} (copy)` : '',
    status: 'draft',
    createdById: user.id,
    sales: existing.sales || user.name,
    history: [{
      by: user.name, role: user.role, action: 'created_from_copy',
      comment: `Sao chép từ báo giá ${no || existing.id}`, date: new Date().toISOString(),
    }],
  };

  const quote = await prisma.quote.create({ data });
  return NextResponse.json({ id: quote.id });
}
