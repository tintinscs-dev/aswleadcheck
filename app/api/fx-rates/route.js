import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';
import { FX_CURRENCIES, DEFAULT_FX_RATES } from '../../../lib/calc';

// Shared system FX rate table — any logged-in role (Sales/Operation/Manager/Admin)
// can view and edit this, since rates change often and shouldn't be gated behind
// an admin. Quotes snapshot whatever this table holds at the moment they're saved
// (see app/api/quotes routes), so editing it never retroactively changes a quote
// that was already saved/approved.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const settings = await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return NextResponse.json({
    fxRates: { ...DEFAULT_FX_RATES, ...(settings.fxRates || {}) },
    fxUpdatedAt: settings.fxUpdatedAt,
    fxUpdatedBy: settings.fxUpdatedBy,
  });
}

export async function PUT(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const incoming = body?.fxRates || {};
  const fxRates = {};
  FX_CURRENCIES.forEach(ccy => {
    const v = Number(incoming[ccy]);
    fxRates[ccy] = v > 0 ? v : (DEFAULT_FX_RATES[ccy] || 0);
  });
  const updated = await prisma.settings.upsert({
    where: { id: 1 },
    update: { fxRates, fxUpdatedAt: new Date(), fxUpdatedBy: user.name },
    create: { id: 1, fxRates, fxUpdatedAt: new Date(), fxUpdatedBy: user.name },
  });
  return NextResponse.json({ fxRates: updated.fxRates, fxUpdatedAt: updated.fxUpdatedAt, fxUpdatedBy: updated.fxUpdatedBy });
}
