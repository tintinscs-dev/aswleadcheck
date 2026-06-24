import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { quoteToFormalTemplate } from '../../../../../lib/quotePrint';
import { buildTemplateWorkbook } from '../../../../../lib/templateExcel';

// Formal, customer-facing "In báo giá" Excel — built from the real saved
// Quote's selling data (not the manual "Quote theo mẫu" tool).
export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return new Response('not found', { status: 404 });
  if (user.role === 'sales' && quote.createdById !== user.id) return new Response('forbidden', { status: 403 });

  const t = quoteToFormalTemplate(quote);
  const buffer = buildTemplateWorkbook(t, { formal: true, salesName: quote.sales || user.name });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ASW_Bao_Gia_${quote.no || quote.id}.xlsx"`,
    },
  });
}
