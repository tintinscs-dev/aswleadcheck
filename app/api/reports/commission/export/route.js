import * as XLSX from 'xlsx';
import { prisma } from '../../../../../lib/db';
import { requireUser } from '../../../../../lib/serverAuth';
import { can } from '../../../../../lib/permissions';
import { statusLabel } from '../../../../../lib/calc';
import { commissionRows, filterCommissionRows, summarizeByMonth, visibleSides, monthLabel, dateLabel } from '../../../../../lib/commission';

export async function GET(req) {
  const user = await requireUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const canViewAll = await can(user.role, 'view_all_quotes');
  const where = canViewAll ? {} : { createdById: user.id };
  const quotes = await prisma.quote.findMany({ where, orderBy: { createdAt: 'desc' } });

  const sp = new URL(req.url).searchParams;
  const filters = { year: sp.get('year') || '', month: sp.get('month') || '', sales: sp.get('sales') || '', status: sp.get('status') || '' };
  const rows = filterCommissionRows(commissionRows(quotes), filters);
  if (!rows.length) return new Response('Không có báo giá nào có CKTM trong bộ lọc này.', { status: 400 });

  const { showBuy, showSell, showTotal, showNote } = visibleSides(rows);
  const money = (obj, row) => {
    if (showBuy) obj['CKTM mua (USD)'] = row.buy || 0;
    if (showSell) obj['CKTM bán (USD)'] = row.sell || 0;
    if (showTotal) obj['Tổng (USD)'] = row.total || 0;
    return obj;
  };

  const summary = summarizeByMonth(rows).map(s => money({ 'Tháng': monthLabel(s.monthKey), 'Sales': s.sales, 'Số job': s.jobs }, s));
  const detail = rows.map(r => {
    const obj = money({
      'No.': r.no, 'Ngày tạo': dateLabel(r.createdAt), 'Tháng': monthLabel(r.monthKey),
      'Shipper': r.shpr, 'Consignee': r.cnee, 'POL': r.pol, 'POD': r.pod,
      'Sales': r.sales, 'Trạng thái': statusLabel(r.status),
    }, r);
    if (showNote) obj['Người nhận com / Ghi chú'] = r.note || '';
    return obj;
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary);
  ws1['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Tong hop thang');
  const ws2 = XLSX.utils.json_to_sheet(detail);
  ws2['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 9 }, { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiet job');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const tag = [filters.year, filters.month && String(filters.month).padStart(2, '0')].filter(Boolean).join('-') || 'all';
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ASW_Commission_${tag}.xlsx"`,
    },
  });
}
