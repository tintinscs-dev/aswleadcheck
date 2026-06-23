import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/serverAuth';
import { parseTemplateWorkbook } from '../../../../../lib/templateExcel';

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const template = parseTemplateWorkbook(buffer);
    return NextResponse.json(template);
  } catch (e) {
    return NextResponse.json({ error: 'Không đọc được file Excel. Vui lòng dùng file xuất từ chính công cụ này, hoặc nhập tay.' }, { status: 400 });
  }
}
