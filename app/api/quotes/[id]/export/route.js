import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { buildExportWorkbook } from '../../../../../lib/excel';

export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return new Response('not found', { status: 404 });
  if (user.role === 'sales' && quote.createdById !== user.id) return new Response('forbidden', { status: 403 });

  const settings = (await prisma.settings.findUnique({ where: { id: 1 } })) || { exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 };
  const buffer = await buildExportWorkbook([quote], settings, user.name);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ASW_Sales_Proposal_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
