import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/serverAuth';
import { parseTemplatePdf } from '../../../../../lib/templatePdf';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const template = await parseTemplatePdf(buffer);
    return NextResponse.json(template);
  } catch (e) {
    return NextResponse.json({ error: 'Không đọc được file PDF này. Việc đọc PDF chỉ mang tính tham khảo — vui lòng kiểm tra lại số liệu sau khi import, hoặc dùng file Excel để chính xác hơn.' }, { status: 400 });
  }
}
