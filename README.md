# ASW Sales Quote App — phiên bản hệ thống thật (Next.js + PostgreSQL)

Bản nâng cấp từ file HTML đơn (demo, lưu localStorage) thành web app nhiều người dùng,
dữ liệu lưu trong database thật, đăng nhập có mã hoá mật khẩu, sẵn sàng deploy lên Vercel.

## Công nghệ
- Next.js 14 (App Router)
- PostgreSQL qua Prisma ORM (khuyến nghị dùng Neon — có free tier, tích hợp sẵn với Vercel)
- NextAuth.js (đăng nhập bằng tài khoản/mật khẩu, mật khẩu mã hoá bằng bcrypt)
- Xuất Excel giữ nguyên 100% công thức/định dạng file mẫu gốc (vá trực tiếp XML trong file .xlsx)
- Xuất PDF costing/selling đẹp, có dấu tiếng Việt đầy đủ (font Roboto nhúng sẵn), dùng để bộ phận Docs đối chiếu khi nhập hệ thống
- Điều chỉnh phí sau khi đã duyệt (Admin/Manager), mọi thay đổi được ghi log chi tiết vào lịch sử báo giá

## Chạy ở máy local
1. `npm install`
2. Copy `.env.example` → `.env`, điền `DATABASE_URL` (chuỗi kết nối Postgres), `NEXTAUTH_SECRET` (chuỗi ngẫu nhiên), `NEXTAUTH_URL=http://localhost:3000`
3. `npx prisma db push` — tạo bảng trong database
4. `npm run dev` — mở http://localhost:3000

## Tạo tài khoản đầu tiên (không còn tài khoản demo)
Hệ thống **không có tài khoản mẫu/demo nào nữa**. Lần đầu mở app khi database còn trống, truy cập `/setup` (hoặc app sẽ tự chuyển từ trang đăng nhập sang `/setup`) để tự đăng ký **một tài khoản admin đầu tiên**. Trang này chỉ hoạt động khi hệ thống chưa có người dùng nào — sau khi đã tạo admin đầu tiên, `/setup` sẽ tự khoá lại.

Sau khi có admin, đăng nhập và vào **Quản trị > Người dùng** để tạo tài khoản cho Manager và Sales (gán vai trò, đặt mật khẩu). Không có chức năng tự đăng ký công khai cho người dùng thường — mọi tài khoản (trừ admin đầu tiên) đều do admin tạo.

## Deploy lên Vercel
Xem chi tiết trong `DEPLOY.md`.

## Cấu trúc chính
- `lib/calc.js` — toàn bộ công thức tính giá mua/bán/lợi nhuận, port nguyên vẹn từ file HTML gốc.
- `lib/excel.js` — xuất Excel bằng cách vá trực tiếp file mẫu gốc (`data/template.xlsx`), không tạo lại từ đầu, nên giữ đúng 100% style/công thức Excel.
- `lib/pdf.js` — xuất PDF costing/selling (dùng pdfkit + font Roboto nhúng trong `data/fonts/` để hiển thị đúng tiếng Việt).
- `lib/diff.js` — tính sự khác biệt giữa phí cũ/mới khi điều chỉnh báo giá đã duyệt, để ghi vào lịch sử.
- `prisma/schema.prisma` — mô hình dữ liệu (User, Quote, Settings).
- `app/api/**` — toàn bộ API: quotes (CRUD, duyệt, xuất Excel/PDF), users (quản trị).
- `app/**` — các trang: đăng nhập, dashboard, tạo/sửa báo giá, xem & duyệt, danh sách chờ duyệt, quản trị người dùng.

## Điều chỉnh phí sau duyệt
Sau khi báo giá đã được duyệt, Admin hoặc Manager có thể vào lại báo giá đó (nút "Điều chỉnh phí" ở Dashboard hoặc trang Xem chi tiết) để sửa các bảng giá mua/giá bán/công nợ. Báo giá vẫn giữ trạng thái "Đã duyệt" — không cần duyệt lại — nhưng mọi thay đổi (hạng mục nào, giá trị cũ → mới) được ghi đầy đủ vào mục Lịch sử để truy vết. Sales không có quyền sửa báo giá đã duyệt.

## Xuất PDF Costing/Selling
Ở trang xem chi tiết từng báo giá có nút "Xuất PDF Costing/Selling" — tạo file PDF trình bày rõ ràng từng hạng mục giá mua/giá bán theo loại hàng (FCL20/FCL40/LCL-Air), công nợ/chi phí khác và kết quả KQKD, để bộ phận Docs in ra hoặc đối chiếu khi nhập vào hệ thống khác.
