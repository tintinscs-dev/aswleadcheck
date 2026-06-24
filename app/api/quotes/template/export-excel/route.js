import { requireUser } from '../../../../../lib/serverAuth';
import { buildTemplateWorkbook } from '../../../../../lib/templateExcel';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });
  const template = await req.json();
  const buffer = await buildTemplateWorkbook(template);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ASW_Quote_Template_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
