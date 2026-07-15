/**
 * Email notification service — dùng Resend API (https://resend.com)
 *
 * Env vars cần cài trong Vercel:
 *   RESEND_API_KEY   — lấy từ resend.com/api-keys
 *   NOTIFY_FROM_EMAIL — ví dụ: notify@yourdomain.com (phải verify domain trên Resend)
 *                        Nếu chưa verify domain, dùng: onboarding@resend.dev (chỉ gửi được cho email đã đăng ký Resend)
 */

import { prisma } from './db';

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || 'onboarding@resend.dev';

const ACTION_LABEL = {
  pricing_review:   'Chờ Pricing kiểm tra giá mua',
  pricing_approved: 'Pricing xác nhận — chờ Manager duyệt',
  pricing_rejected: 'Pricing yêu cầu chỉnh sửa giá mua',
  approved:         'Manager đã duyệt',
  rejected:         'Manager từ chối',
};

const ACTION_COLOR = {
  pricing_review:   '#C98A1F',
  pricing_approved: '#1D7A6F',
  pricing_rejected: '#C0392B',
  approved:         '#1D7A4F',
  rejected:         '#C0392B',
};

// ─── Lấy danh sách email người nhận dựa theo action ────────────────────────
async function getRecipients(quote, action) {
  const emails = [];

  if (action === 'pricing_review') {
    // Notify: tất cả Pricing + Admin có notifyEmail
    const users = await prisma.user.findMany({
      where: { role: { in: ['pricing', 'admin'] }, notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    users.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  if (action === 'pricing_approved') {
    // Notify: tất cả Manager + Admin có notifyEmail
    const users = await prisma.user.findMany({
      where: { role: { in: ['manager', 'admin'] }, notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    users.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  if (['pricing_rejected', 'approved', 'rejected'].includes(action)) {
    // Notify: Sales người tạo báo giá (nếu có email)
    const creator = await prisma.user.findUnique({
      where: { id: quote.createdById },
      select: { notifyEmail: true },
    });
    if (creator?.notifyEmail) emails.push(creator.notifyEmail);

    // Và Admin có email
    const admins = await prisma.user.findMany({
      where: { role: 'admin', notifyEmail: { not: null } },
      select: { notifyEmail: true },
    });
    admins.forEach(u => u.notifyEmail && emails.push(u.notifyEmail));
  }

  // Dedup
  return [...new Set(emails.filter(Boolean))];
}

// ─── HTML template ──────────────────────────────────────────────────────────
function buildHtml(quote, action, actor, comment) {
  const base   = process.env.NEXT_PUBLIC_BASE_URL || 'https://aswleadcheck.vercel.app';
  const link   = `${base}/quotes/${quote.id}/view`;
  const route  = [quote.pol, quote.pod].filter(Boolean).join(' → ') || '-';
  const label  = ACTION_LABEL[action] || action;
  const color  = ACTION_COLOR[action]  || '#0B2545';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0B2545;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.3px;">
              ASW Sales Proposal
            </span>
            <span style="color:#2E9C8C;font-size:13px;margin-left:10px;">· Thông báo tự động</span>
          </td>
        </tr>

        <!-- Status badge -->
        <tr>
          <td style="background:${color};padding:14px 28px;">
            <span style="color:#ffffff;font-size:14px;font-weight:700;">${label}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;width:120px;">Báo giá</td>
                <td style="padding:6px 0;color:#0B2545;font-size:14px;font-weight:700;">${quote.no || quote.id}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Tuyến đường</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${route}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Khách hàng</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${quote.cnee || quote.shpr || '-'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Thực hiện bởi</td>
                <td style="padding:6px 0;color:#1C2733;font-size:13px;">${actor}</td>
              </tr>
              ${comment ? `
              <tr>
                <td style="padding:6px 0;color:#6B7787;font-size:12px;">Ghi chú</td>
                <td style="padding:6px 0;color:#C0392B;font-size:13px;">${comment}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 28px;">
            <a href="${link}"
               style="display:inline-block;background:#1D7A6F;color:#ffffff;padding:12px 24px;
                      border-radius:7px;text-decoration:none;font-size:13px;font-weight:700;">
              Xem báo giá
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f6f9;padding:14px 28px;border-top:1px solid #e1e6ee;">
            <span style="color:#9BA5B1;font-size:11px;">
              Email này được gửi tự động từ hệ thống ASW Sales Proposal.
              Vui lòng không reply trực tiếp email này.
            </span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Hàm gửi email đơn lẻ ──────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) return;
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Email] Resend error:', err);
    }
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
  }
}

// ─── Hàm chính: gửi thông báo workflow ─────────────────────────────────────
export async function sendEmailNotification(quote, action, actor, comment) {
  if (!RESEND_KEY) return; // Chưa cấu hình → bỏ qua

  try {
    const recipients = await getRecipients(quote, action);
    if (recipients.length === 0) return;

    const label   = ACTION_LABEL[action] || action;
    const subject = `[ASW] ${label} — BG ${quote.no || quote.id}`;
    const html    = buildHtml(quote, action, actor, comment);

    await sendEmail({ to: recipients, subject, html });
  } catch (err) {
    console.error('[Email] Notification failed:', err.message);
  }
}
