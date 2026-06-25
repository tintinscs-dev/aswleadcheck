import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';
import { newQuoteData, DEFAULT_FX_RATES } from '../../../lib/calc';

// Pull the current shared FX rate table to snapshot into a quote at save time —
// so KQKD always reflects the rate in effect when the quote was last saved, even
// if someone edits the shared table afterwards.
async function currentFxRates() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {
    return DEFAULT_FX_RATES;
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const where = user.role === 'sales' ? { createdById: user.id } : {};
  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: { select: { name: true, username: true } } },
  });
  return NextResponse.json(quotes);
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const base = newQuoteData();
  const fxRates = await currentFxRates();
  const data = { ...base, ...body, fxRates, createdById: user.id, status: 'draft', history: [] };
  delete data.id;

  const quote = await prisma.quote.create({ data });
  return NextResponse.json(quote);
}
