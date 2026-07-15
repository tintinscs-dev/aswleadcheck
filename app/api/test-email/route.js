/**
 * GET /api/test-email?to=your@email.com
 * Chỉ dùng để test — XOÁ file này sau khi xác nhận email hoạt động.
 * Chỉ Admin mới gọi được.
 */
import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/serverAuth';
import { sendEmailNotification } from '../../../lib/email';

export async function GET(req) {
  const user = await requireUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to');

  // Kiểm tra env vars
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      ok: false,
      error: 'Thiếu env vars',
      GMAIL_USER: gmailUser ? 'OK' : 'MISSING',
      GMAIL_APP_PASSWORD: gmailPass ? 'OK' : 'MISSING',
    });
  }

  // Gửi email test đến địa chỉ chỉ định (hoặc chính GMAIL_USER nếu không truyền)
  const target = to || gmailUser;

  try {
    // Tạo quote giả để test template
    const fakeQuote = {
      id:         'test-123',
      no:         'TEST-001',
      pol:        'HCM',
      pod:        'JPTYO',
      cnee:       'Test Customer',
      createdById: user.id,
    };

    // Gửi thẳng qua transporter thay vì qua getRecipients
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from:    `"ASW Sales Proposal" <${gmailUser}>`,
      to:      target,
      subject: '[ASW] Test email — he thong dang hoat dong',
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#f4f6f9;">
          <div style="background:#0B2545;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;font-size:16px;font-weight:700;">
            ASW Sales Proposal · Test Email
          </div>
          <div style="background:#fff;padding:20px 24px;border-radius:0 0 8px 8px;border:1px solid #e1e6ee;">
            <p>Email nay duoc gui tu dong de xac nhan he thong email thong bao dang hoat dong.</p>
            <p><b>GMAIL_USER:</b> ${gmailUser}</p>
            <p><b>Gui den:</b> ${target}</p>
            <p><b>Thoi gian:</b> ${new Date().toISOString()}</p>
            <hr style="border:none;border-top:1px solid #e1e6ee;margin:16px 0;">
            <p style="color:#6B7787;font-size:12px;">Neu ban nhan duoc email nay, cau hinh Nodemailer + Gmail da chinh xac.<br>
            Xoa file app/api/test-email/route.js sau khi xac nhan.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      ok:      true,
      message: `Da gui email test den: ${target}`,
      from:    gmailUser,
    });
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      error: err.message,
      code:  err.code,
    });
  }
}
