import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { mapTemplateToQuoteData } from '../../../../../lib/templateQuote';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const template = await req.json();
  const settings = (await prisma.settings.findUnique({ where: { id: 1 } })) || { exchangeRate: 23300 };
  const data = mapTemplateToQuoteData(template, settings.exchangeRate);
  data.sales = data.sales || user.name;
  data.createdById = user.id;
  data.status = 'draft';
  data.history = [{ by: user.name, role: user.role, action: 'created_from_template', comment: 'Tạo từ Quote theo mẫu', date: new Date().toISOString() }];

  const quote = await prisma.quote.create({ data });
  return NextResponse.json({ id: quote.id });
}
