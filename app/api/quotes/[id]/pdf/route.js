import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { buildQuotePdf } from '../../../../../lib/pdf';

export async function GET(req, { params }) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) return new Response('not found', { status: 404 });
  if (user.role === 'sales' && quote.createdById !== user.id) return new Response('forbidden', { status: 403 });

  const buffer = await buildQuotePdf(quote, user.name);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ASW_Costing_Selling_${quote.no || quote.id}.pdf"`,
    },
  });
}
