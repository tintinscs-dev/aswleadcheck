import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/serverAuth';
import { buildExportWorkbook } from '../../../../lib/excel';

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const where = user.role === 'sales' ? { createdById: user.id } : {};
  const quotes = await prisma.quote.findMany({ where, orderBy: { updatedAt: 'desc' } });
  if (!quotes.length) return new Response('Không có báo giá để xuất.', { status: 400 });

  const settings = (await prisma.settings.findUnique({ where: { id: 1 } })) || { exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 };
  const buffer = await buildExportWorkbook(quotes, settings, user.name);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ASW_Sales_Proposal_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
