import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/db';

// Chỉ hoạt động khi hệ thống CHƯA có người dùng nào — dùng để tạo tài khoản admin đầu tiên.
// Sau khi đã có ít nhất 1 user, route này luôn trả về forbidden, không cho tạo thêm qua đây nữa
// (tài khoản tiếp theo phải được tạo bởi admin trong trang Quản trị > Người dùng).
export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req) {
  const count = await prisma.user.count();
  if (count > 0) {
    return NextResponse.json({ error: 'Hệ thống đã có người dùng. Không thể tạo tài khoản admin đầu tiên qua đây nữa.' }, { status: 403 });
  }

  const { username, password, name } = await req.json();
  if (!username || !password || !name) {
    return NextResponse.json({ error: 'Thiếu thông tin.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { username, password: hash, name, role: 'admin' },
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 },
  });

  return NextResponse.json({ id: created.id, username: created.username, name: created.name, role: created.role });
}
