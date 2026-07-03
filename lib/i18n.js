// Bilingual (VI / EN) translation table for the ASW Sales Shipment Proposal app.
// Usage in React components:
//   const { t } = useLang();          // see components/LangContext.js
//   <label>{t('field.shipper')}</label>
// Usage in server-side code (PDF/Excel builders):
//   import { tLang } from '../lib/i18n';
//   tLang('en', 'pdf.greeting')

export const TRANSLATIONS = {
  vi: {
    // ── App / navigation ──────────────────────────────────────────────────────
    'app.name': 'Sales Shipment Proposal',
    'nav.dashboard': 'Dashboard',
    'nav.newQuote': 'Tạo báo giá',
    'nav.fxRates': 'Tỷ giá',
    'nav.approvals': 'Duyệt báo giá',
    'nav.users': 'Người dùng',
    'nav.logout': 'Đăng xuất',
    'nav.lang': 'EN',           // label on the toggle button (shows what you'll switch TO)

    // ── Dashboard ─────────────────────────────────────────────────────────────
    'dashboard.title': 'Dashboard',
    'dashboard.noData': 'Không có dữ liệu.',
    'dashboard.filter.all': 'Tất cả',
    'dashboard.filter.mode': 'Loại hàng',
    'dashboard.filter.status': 'Trạng thái',
    'dashboard.filter.sales': 'Sales',
    'dashboard.col.no': 'Số BG',
    'dashboard.col.shpr': 'Shipper',
    'dashboard.col.cnee': 'Consignee',
    'dashboard.col.pol': 'POL',
    'dashboard.col.pod': 'POD',
    'dashboard.col.mode': 'Loại',
    'dashboard.col.sales': 'Sales',
    'dashboard.col.status': 'Trạng thái',
    'dashboard.col.kqkd': 'KQKD',
    'dashboard.col.tsln': 'TSLN%',
    'dashboard.col.date': 'Ngày',

    // ── Quote form — general ──────────────────────────────────────────────────
    'form.title.new': 'Tạo báo giá mới',
    'form.title.edit': 'Chi tiết báo giá',
    'form.subtitle': 'Nhập thông tin chung, giá mua (cost) và giá bán (sell) — kết quả tính ngay bên phải.',
    'form.locked': 'Báo giá đã được duyệt — chỉ Admin/Manager có thể điều chỉnh phí.',
    'form.adjusting': 'Báo giá đã duyệt — bạn chỉ đang điều chỉnh các bảng phí (giá mua/bán/công nợ). Mọi thay đổi sẽ được ghi vào lịch sử.',

    // ── Section I ─────────────────────────────────────────────────────────────
    'sec1.title': '1. Thông tin chung',
    'field.no': 'Số booking (No.)',
    'field.dep': 'Loại dịch vụ (DEP.)',
    'field.dep.other': 'Nhập loại dịch vụ',
    'field.keys': 'Commodity',
    'field.sales': 'Sales',
    'field.shipper': 'Shipper',
    'field.consignee': 'Consignee',
    'field.agent': 'Agent',
    'field.pol': 'POL',
    'field.pod': 'POD',
    'field.pickup': 'Pick up',
    'field.delivery': 'Delivery',
    'field.term': 'Term',
    'field.etd': 'ETD',
    'field.eta': 'ETA',
    'field.lineCoLoader': 'Line / Co-loader',
    'field.validUntil': 'Hết hiệu lực',
    'field.qty20': "Số lượng 20'",
    'field.qty40': "Số lượng 40'",
    'field.lcl': 'LCL (CBM)',
    'field.weight': 'Khối lượng (KG)',
    'field.pieces': 'Số kiện (PCS)',
    'field.notes': 'Ghi chú',

    // ── Section II/III ────────────────────────────────────────────────────────
    'sec2.title': 'II. GIÁ MUA (COST)',
    'sec3.title': 'III. GIÁ BÁN (SELL)',
    'table.col.item': 'Hạng mục',
    'table.col.flat': 'Flat (/SHPT)',
    'table.col.perUnit': 'Đơn giá',
    'table.col.vat': 'VAT %',
    'table.col.vatDisc': 'VAT% / Chiết khấu%',
    'table.col.currency': 'Tiền',
    'table.addItem': '+ Thêm hạng mục',
    'table.customNote': 'Hạng mục tự thêm sẽ được cộng gộp vào cột OTHER khi xuất Excel (file mẫu gốc không có cột riêng cho hạng mục mới).',

    // ── Section IV ────────────────────────────────────────────────────────────
    'sec4.title': 'IV. CÔNG NỢ / CHI PHÍ KHÁC',
    'field.fxRate': 'Tỷ giá (VND/USD)',
    'field.fxRate.help': 'Lấy theo bảng tỷ giá chung (trang Tỷ giá) — không nhập tay.',
    'field.interestRate': 'Lãi suất NH (%/năm)',
    'field.creditDays0': 'Số ngày nợ — CPCN 0% (OVERSEAS/O/F)',
    'field.creditDaysLCC': 'Số ngày nợ — CPCN LCC 8%',
    'field.creditDaysCusTruck': 'Số ngày nợ — CPCN CUS+TRUCKING',
    'field.cuocCont': 'Cược container (USD)',
    'field.creditDaysCuocCont': 'Số ngày nợ cược cont',
    'field.chiHoKhac': 'Chi hộ khác (USD)',
    'field.creditDaysChiHoKhac': 'Số ngày nợ chi hộ khác',
    'field.cpKhac': 'CP Khác (USD)',
    'sec4.help': 'CPCN = doanh thu liên quan × lãi suất NH × số ngày nợ / 365. Cược cont & Chi hộ khác chỉ tính phần lãi tài chính, không trừ phần gốc (đã thu lại từ khách).',

    // ── Adjustment section ────────────────────────────────────────────────────
    'adjust.title': 'Ghi chú điều chỉnh',
    'adjust.placeholder': 'Lý do điều chỉnh phí (tuỳ chọn, sẽ lưu vào lịch sử)...',

    // ── Buttons ───────────────────────────────────────────────────────────────
    'btn.cancel': 'Hủy / Quay lại',
    'btn.saveDraft': 'Lưu nháp',
    'btn.submit': 'Gửi duyệt (Submit)',
    'btn.saveAdjust': '💾 Lưu điều chỉnh phí',

    // ── Summary panel ─────────────────────────────────────────────────────────
    'sum.title': 'Kết quả tính toán (live)',
    'sum.cost': 'Cost & Revenue',
    'sum.gvdv': 'GVDV (Giá vốn dịch vụ)',
    'sum.dtlh': 'DTLH (Doanh thu lô hàng)',
    'sum.cktm': 'Commission (CKTM)',
    'sum.cktmLine': 'CKTM - LINE',
    'sum.cktmClient': 'CKTM - CLIENT (COM+COM10%)',
    'sum.cktmTotal': 'Tổng CKTM',
    'sum.cpcn': 'Chi phí công nợ (CPCN)',
    'sum.cpcn0': 'CPCN 0% (OVS/O/F)',
    'sum.cpcnLcc': 'CPCN LCC 8%',
    'sum.cpcnCus': 'CPCN CUS+TRUCKING',
    'sum.cpcnTotal': 'Tổng CPCN',
    'sum.other': 'Chi hộ & Chi khác',
    'sum.cuocCont': 'Lãi cược cont',
    'sum.chiHo': 'Lãi chi hộ khác',
    'sum.cpKhac': 'CP Khác',
    'sum.cplh': 'CPLH (Chi phí lô hàng)',
    'sum.kqkd': 'KQKD',
    'sum.tsln': 'Tỷ suất lợi nhuận (TSLN)',
    'sum.tslnNote': '% trên CPLH',

    // ── PDF formal quote ──────────────────────────────────────────────────────
    'pdf.title': 'BÁO GIÁ DỊCH VỤ VẬN CHUYỂN — QUOTATION',
    'pdf.titleShort': 'QUOTATION',
    'pdf.greeting': 'Kính gửi: ',
    'pdf.intro': 'Cảm ơn Quý khách đã quan tâm đến dịch vụ của ASW. Chúng tôi xin gửi báo giá chi tiết như sau:',
    'pdf.shipInfo': 'CUSTOMER & SHIPMENT INFORMATION',
    'pdf.terms': 'Điều khoản & Lưu ý',
    'pdf.closing': 'Trân trọng,',
    'pdf.page': 'Trang',
    'pdf.of': '/',
    'pdf.term1': 'Báo giá trên chưa bao gồm VAT (nếu có) trừ khi có ghi chú khác trong bảng phí.',
    'pdf.term2valid': 'Hiệu lực báo giá:',
    'pdf.term3': 'Giá có thể thay đổi theo phụ phí phát sinh từ hãng tàu / hãng bay / cảng tại thời điểm thực hiện thực tế.',
    'pdf.term4': 'Vui lòng phản hồi xác nhận để ASW tiến hành đặt chỗ và sắp xếp lịch vận chuyển.',
  },

  en: {
    // ── App / navigation ──────────────────────────────────────────────────────
    'app.name': 'Sales Shipment Proposal',
    'nav.dashboard': 'Dashboard',
    'nav.newQuote': 'New Quote',
    'nav.fxRates': 'FX Rates',
    'nav.approvals': 'Approvals',
    'nav.users': 'Users',
    'nav.logout': 'Sign out',
    'nav.lang': 'VI',           // label on the toggle button (shows what you'll switch TO)

    // ── Dashboard ─────────────────────────────────────────────────────────────
    'dashboard.title': 'Dashboard',
    'dashboard.noData': 'No data found.',
    'dashboard.filter.all': 'All',
    'dashboard.filter.mode': 'Mode',
    'dashboard.filter.status': 'Status',
    'dashboard.filter.sales': 'Sales',
    'dashboard.col.no': 'Quote No.',
    'dashboard.col.shpr': 'Shipper',
    'dashboard.col.cnee': 'Consignee',
    'dashboard.col.pol': 'POL',
    'dashboard.col.pod': 'POD',
    'dashboard.col.mode': 'Mode',
    'dashboard.col.sales': 'Sales',
    'dashboard.col.status': 'Status',
    'dashboard.col.kqkd': 'P&L',
    'dashboard.col.tsln': 'Margin%',
    'dashboard.col.date': 'Date',

    // ── Quote form — general ──────────────────────────────────────────────────
    'form.title.new': 'New Quote',
    'form.title.edit': 'Quote Detail',
    'form.subtitle': 'Enter shipment info, cost and selling rates — live calculation shown on the right.',
    'form.locked': 'This quote is approved — only Admin/Manager can adjust fees.',
    'form.adjusting': 'Approved quote — you are only adjusting fee tables. All changes will be logged to history.',

    // ── Section I ─────────────────────────────────────────────────────────────
    'sec1.title': '1. General Information',
    'field.no': 'Booking No.',
    'field.dep': 'Service Type (DEP.)',
    'field.dep.other': 'Enter service type',
    'field.keys': 'Commodity',
    'field.sales': 'Sales',
    'field.shipper': 'Shipper',
    'field.consignee': 'Consignee',
    'field.agent': 'Agent',
    'field.pol': 'POL',
    'field.pod': 'POD',
    'field.pickup': 'Pick up',
    'field.delivery': 'Delivery',
    'field.term': 'Term',
    'field.etd': 'ETD',
    'field.eta': 'ETA',
    'field.lineCoLoader': 'Line / Co-loader',
    'field.validUntil': 'Valid Until',
    'field.qty20': "Qty 20'",
    'field.qty40': "Qty 40'",
    'field.lcl': 'LCL (CBM)',
    'field.weight': 'Weight (KG)',
    'field.pieces': 'Pieces (PCS)',
    'field.notes': 'Notes',

    // ── Section II/III ────────────────────────────────────────────────────────
    'sec2.title': 'II. BUYING RATE (COST)',
    'sec3.title': 'III. SELLING RATE',
    'table.col.item': 'Charge',
    'table.col.flat': 'Flat (/SHPT)',
    'table.col.perUnit': 'Unit Rate',
    'table.col.vat': 'VAT %',
    'table.col.vatDisc': 'VAT% / Discount%',
    'table.col.currency': 'Ccy',
    'table.addItem': '+ Add charge',
    'table.customNote': 'Custom charges will be merged into the OTHER column on Excel export.',

    // ── Section IV ────────────────────────────────────────────────────────────
    'sec4.title': 'IV. PAYABLES / OTHER COSTS',
    'field.fxRate': 'FX Rate (VND/USD)',
    'field.fxRate.help': 'Auto-derived from the shared FX rate table — read only.',
    'field.interestRate': 'Bank Interest Rate (%/year)',
    'field.creditDays0': 'Credit days — OVERSEAS/O/F (0%)',
    'field.creditDaysLCC': 'Credit days — LCC 8%',
    'field.creditDaysCusTruck': 'Credit days — CUS+TRUCKING',
    'field.cuocCont': 'Container Deposit (USD)',
    'field.creditDaysCuocCont': 'Credit days — container deposit',
    'field.chiHoKhac': 'Other Advances (USD)',
    'field.creditDaysChiHoKhac': 'Credit days — other advances',
    'field.cpKhac': 'Other Costs (USD)',
    'sec4.help': 'Finance cost = related revenue × interest rate × credit days / 365. Container deposit & advances: only the interest cost is calculated (principal is recovered from the customer).',

    // ── Adjustment section ────────────────────────────────────────────────────
    'adjust.title': 'Adjustment Note',
    'adjust.placeholder': 'Reason for fee adjustment (optional, will be saved to history)...',

    // ── Buttons ───────────────────────────────────────────────────────────────
    'btn.cancel': 'Cancel / Back',
    'btn.saveDraft': 'Save Draft',
    'btn.submit': 'Submit for Approval',
    'btn.saveAdjust': '💾 Save Adjustments',

    // ── Summary panel ─────────────────────────────────────────────────────────
    'sum.title': 'Live Calculation',
    'sum.cost': 'Cost & Revenue',
    'sum.gvdv': 'COGS (Cost of Service)',
    'sum.dtlh': 'Revenue',
    'sum.cktm': 'Commission (CKTM)',
    'sum.cktmLine': 'CKTM - LINE',
    'sum.cktmClient': 'CKTM - CLIENT (COM+COM10%)',
    'sum.cktmTotal': 'Total CKTM',
    'sum.cpcn': 'Receivable Finance Cost',
    'sum.cpcn0': 'Finance Cost 0% (OVS/O/F)',
    'sum.cpcnLcc': 'Finance Cost LCC 8%',
    'sum.cpcnCus': 'Finance Cost CUS+TRUCKING',
    'sum.cpcnTotal': 'Total Finance Cost',
    'sum.other': 'Advances & Other',
    'sum.cuocCont': 'Interest — Container Dep.',
    'sum.chiHo': 'Interest — Advances',
    'sum.cpKhac': 'Other Costs',
    'sum.cplh': 'Total Shipment Cost',
    'sum.kqkd': 'P&L',
    'sum.tsln': 'Profit Margin (TSLN)',
    'sum.tslnNote': '% of shipment cost',

    // ── PDF formal quote ──────────────────────────────────────────────────────
    'pdf.title': 'FREIGHT & LOGISTICS QUOTATION',
    'pdf.titleShort': 'QUOTATION',
    'pdf.greeting': 'To: ',
    'pdf.intro': 'Thank you for your interest in ASW\'s services. Please find our detailed quotation below:',
    'pdf.shipInfo': 'CUSTOMER & SHIPMENT INFORMATION',
    'pdf.terms': 'Terms & Notes',
    'pdf.closing': 'Sincerely,',
    'pdf.page': 'Page',
    'pdf.of': 'of',
    'pdf.term1': 'All rates are exclusive of VAT unless otherwise noted in the charge table.',
    'pdf.term2valid': 'Quotation validity:',
    'pdf.term3': 'Rates are subject to change based on surcharges from shipping lines / airlines / ports at the time of actual execution.',
    'pdf.term4': 'Please confirm your acceptance so ASW can proceed with booking and arrange the shipment schedule.',
  },
};

/** Look up a translation key for a given lang ('vi' | 'en'). Falls back to VI. */
export function tLang(lang, key) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['vi']?.[key] ?? key;
}
