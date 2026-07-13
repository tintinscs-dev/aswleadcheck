/**
 * Telegram notification service.
 * Requires env vars:
 *   TELEGRAM_BOT_TOKEN — token from @BotFather
 *   TELEGRAM_CHAT_ID   — group/channel ID (negative number for groups)
 *
 * To get TELEGRAM_CHAT_ID:
 *   1. Add @aswlead_bot to your Telegram group
 *   2. Send any message in the group
 *   3. Visit: https://api.telegram.org/bot<TOKEN>/getUpdates
 *   4. Find "chat":{"id": -XXXXXXXXX} — that negative number is the chat_id
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

/**
 * Send a plain-text / HTML message to the configured group.
 * Silently no-ops if env vars are not set.
 */
export async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    // Never let a notification failure crash the main flow
    console.error('[Telegram] Notification failed:', err.message);
  }
}

const ACTION_LABEL = {
  pricing_review:   'Chờ Pricing kiểm tra giá mua',
  pricing_approved: 'Pricing xác nhận — chờ Manager duyệt',
  pricing_rejected: 'Pricing yêu cầu chỉnh sửa giá mua',
  approved:         'Manager đã duyệt',
  rejected:         'Manager từ chối',
};

/**
 * Build a notification message for a quote workflow event.
 * @param {object} quote  - the Quote record (must have id, no, pol, pod, sales)
 * @param {string} action - one of the ACTION_LABEL keys
 * @param {string} actor  - display name of the person who triggered the action
 * @param {string} comment - optional comment
 */
export function quoteNotifyText(quote, action, actor, comment) {
  const base  = process.env.NEXT_PUBLIC_BASE_URL || 'https://aswleadcheck.vercel.app';
  const link  = `${base}/quotes/${quote.id}/view`;
  const route = [quote.pol, quote.pod].filter(Boolean).join(' → ') || '-';
  const label = ACTION_LABEL[action] || action;

  const lines = [
    '<b>[ASW Sales Proposal]</b>',
    `Báo giá : <b>${quote.no || quote.id}</b>`,
    `Tuyến   : ${route}`,
    `Sales   : ${quote.sales || '-'}`,
    `Tình trạng: ${label}`,
    comment ? `Ghi chú : ${comment}` : null,
    `Bởi     : ${actor}`,
    `Xem     : ${link}`,
  ].filter(Boolean);

  return lines.join('\n');
}
