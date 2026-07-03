import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { quoteToFormalTemplate } from '../../../../../lib/quotePrint';
import { buildTemplatePdf } from '../../../../../lib/templatePdf';

// Formal, customer-facing "In báo giá" PDF — built from the real saved
// Quote's selling data (not the manual "Quote theo mẫu" tool).
export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return new Response('not found', { status: 404 });
  if (user.role === 'sales' && quote.createdById !== user.id) return new Response('forbidden', { status: 403 });

  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'vi';
  const t = quoteToFormalTemplate(quote);
  const buffer = await buildTemplatePdf(t, { formal: true, salesName: quote.sales || user.name, lang });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ASW_Bao_Gia_${quote.no || quote.id}.pdf"`,
    },
  });
}
