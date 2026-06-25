import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { mapTemplateToQuoteData } from '../../../../../lib/templateQuote';
import { DEFAULT_FX_RATES, usdVndRateFromFx } from '../../../../../lib/calc';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const template = await req.json();
  let settings;
  try { settings = await prisma.settings.findUnique({ where: { id: 1 } }); } catch (e) { settings = null; }
  // Tỷ giá VND/USD dùng để quy đổi các dòng VND trong template luôn lấy theo
  // bảng tỷ giá chung (Settings.fxRates), không còn dùng Settings.exchangeRate cũ.
  const fxRates = { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  const exchangeRate = usdVndRateFromFx(fxRates);
  const data = mapTemplateToQuoteData(template, exchangeRate);
  data.fxRates = fxRates;
  data.exchangeRate = exchangeRate;
  data.sales = data.sales || user.name;
  data.createdById = user.id;
  data.status = 'draft';
  data.history = [{ by: user.name, role: user.role, action: 'created_from_template', comment: 'Tạo từ Quote theo mẫu', date: new Date().toISOString() }];

  const quote = await prisma.quote.create({ data });
  return NextResponse.json({ id: quote.id });
}
