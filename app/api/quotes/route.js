import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/serverAuth';
import { newQuoteData } from '../../../lib/calc';

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
  const data = { ...base, ...body, createdById: user.id, status: 'draft', history: [] };
  delete data.id;

  const quote = await prisma.quote.create({ data });
  return NextResponse.json(quote);
}
