import { requireUser } from '../../../../../lib/serverAuth';
import { buildTemplatePdf } from '../../../../../lib/templatePdf';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });
  const template = await req.json();
  const buffer = await buildTemplatePdf(template);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ASW_Quote_Template_${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
