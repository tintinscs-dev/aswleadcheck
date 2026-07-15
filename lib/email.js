/**
 * Email notification service — dùng Nodemailer + Gmail SMTP
 *
 * Env vars cần cài trong Vercel:
 *   GMAIL_USER         — địa chỉ Gmail gửi đi, vd: asw.notify@gmail.com
 *   GMAIL_APP_PASSWORD — App Password của Gmail (không phải mật khẩu đăng nhập)
 *
 * Cách lấy App Password:
 *   1. Vào myaccount.google.com → Security → Bật xác minh 2 bước
 *   2. Tìm "App passwords" → chọn app "Mail" → tạo → copy 16 ký tự
 */

import nodemailer from 'nodemailer';
import { prisma } from './db';

const ACTION_LABEL = {
  pricing_review:   'Cho Pricing kiem tra gia mua',
  pricing_approved: 'Pricing xac nhan — cho Manager duyet',
  pricing_rejected: 'Pricing yeu cau chinh sua gia mua',
  approved:         'Manager da duyet',
  rejected:         'Manager tu choi',
};

const ACTION_COLOR = {
  pricing_review:   '#C98A1F',
  pricing_approved: '#1D7A6F',
  pricing_rejected: '#C0392B',
  approved:         '#1D7A4F',
  rejected:         '#C0392B',
};

// ─── Tạo transporter (lazy) ────────────────────────────────────────────────
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// ─── Lấy danh sách email người nhận theo action ────────────────────────────
async function getRecipients(quote, action) {
  const emails = [];

  if (action === 'pricing_review') {
    // Pricing + Admin
    const users = await prisma.user.findMany({
      where: { role: { in: ['pricing', 'admin'] }, notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    users.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  if (action === 'pricing_approved') {
    // Manager + Admin
    const users = await prisma.user.findMany({
      where: { role: { in: ['manager', 'admin'] }, notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    users.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  if (['pricing_rejected', 'approved', 'rejected'].includes(action)) {
    // Sales người tạo báo giá
    const creator = await prisma.user.findUnique({
      where: { id: quote.createdById },
      select: { notifyEmail: true },
    });
    if (creator?.notifyEmail) emails.push(creator.notifyEmail);

    // Admin
    const admins = await prisma.user.findMany({
      where: { role: 'admin', notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    admins.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  return [...new Set(emails.filter(Boolean))];
}

// ─── HTML template ──────────────────────────────────────────────────────────
function buildHtml(quote, action, actor, comment) {
  const base  = process.env.NEXT_PUBLIC_BASE_URL || 'https://aswleadcheck.vercel.app';
  const link  = `${base}/quotes/${quote.id}/view`;
  const route = [quote.pol, quote.pod].filter(Boolean).join(' > ') || '-';
  const label = ACTION_LABEL[action] || action;
  const color = ACTION_COLOR[action]  || '#0B2545';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">

        <tr>
          <td style="background:#0B2545;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">ASW Sales Proposal</span>
            <span style="color:#2E9C8C;font-size:13px;margin-left:10px;">· Thong bao tu dong</span>
          </td>
        </tr>

        <tr>
          <td style="background:${color};padding:14px 28px;">
            <span style="color:#ffffff;font-size:14px;font-weight:700;">${label}</span>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;width:120px;">Bao gia</td>
                <td style="padding:6px 0;color:#0B2545;font-size:14px;font-weight:700;">${quote.no || quote.id}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Tuyen duong</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${route}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Khach hang</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${quote.cnee || quote.shpr || '-'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Thuc hien boi</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${actor}</td>
              </tr>
              ${comment ? `
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Ghi chu</td>
                <td style="padding:6px 0;color:#C0392B;font-size:13px;">${comment}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px 28px;">
            <a href="${link}"
               style="display:inline-block;background:#1D7A6F;color:#ffffff;padding:12px 24px;
                      border-radius:7px;text-decoration:none;font-size:13px;font-weight:700;">
              Xem bao gia
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#f4f6f9;padding:14px 28px;border-top:1px solid #e1e6ee;">
            <span style="color:#9BA5B1;font-size:11px;">
              Email nay duoc gui tu dong tu he thong ASW Sales Proposal. Vui long khong reply.
            </span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Hàm chính: gửi thông báo workflow ─────────────────────────────────────
export async function sendEmailNotification(quote, action, actor, comment) {
  const transporter = createTransporter();
  if (!transporter) return; // Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD → bỏ qua

  try {
    const recipients = await getRecipients(quote, action);
    if (recipients.length === 0) return;

    const label   = ACTION_LABEL[action] || action;
    const subject = `[ASW] ${label} — BG ${quote.no || quote.id}`;
    const html    = buildHtml(quote, action, actor, comment);

    await Promise.all(
      recipients.map(to =>
        transporter.sendMail({
          from: `"ASW Sales Proposal" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        })
      )
    );
  } catch (err) {
    console.error('[Email] Notification failed:', err.message);
  }
}
