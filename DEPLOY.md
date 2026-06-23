# Hướng dẫn deploy lên Vercel (dùng Supabase làm database Postgres)

## Bước 1 — Tạo project Supabase
1. Vào https://supabase.com → đăng ký/đăng nhập (có free tier).
2. **New Project** → chọn tên project, đặt mật khẩu database (nhớ lưu lại mật khẩu này), chọn region gần người dùng nhất (ví dụ Singapore cho VN) → Create.
3. Đợi vài phút để Supabase khởi tạo xong project.

## Bước 2 — Lấy connection string
1. Vào project vừa tạo → **Project Settings** (icon bánh răng) → **Database**.
2. Phần **Connection string**, chọn tab **URI**.
3. Supabase cung cấp 2 loại connection, nên dùng đúng loại cho đúng việc:
   - **Connection pooling (port 6543, dạng `...pooler.supabase.com:6543/postgres`)** — dùng cho `DATABASE_URL` lúc app chạy thật trên Vercel (serverless, nhiều kết nối ngắn cùng lúc, cần pooling để không bị quá tải số connection).
   - **Direct connection (port 5432)** — dùng khi chạy `prisma db push`/migrate từ máy local, vì Prisma Migrate cần kết nối trực tiếp.
4. Thay `[YOUR-PASSWORD]` trong chuỗi bằng mật khẩu database đã đặt ở Bước 1.

Ví dụ:
```
# Dùng cho DATABASE_URL trên Vercel (pooled)
postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Dùng để chạy prisma db push từ máy local (direct)
postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

> Ghi chú: nếu dùng chuỗi pooled (6543) cho `DATABASE_URL`, thêm `?pgbouncer=true` vào cuối để Prisma hoạt động đúng với PgBouncer.

## Bước 3 — Tạo bảng trong database Supabase
Từ máy local, trong file `.env` của project, tạm điền `DATABASE_URL` bằng **chuỗi direct connection (port 5432)**, sau đó chạy:
```
npx prisma db push
```
Lệnh này tạo toàn bộ bảng (User, Quote, Settings) trong database Supabase. Có thể vào tab **Table Editor** trên Supabase để xem các bảng vừa được tạo.

(Không cần chạy `npm run db:seed` để tạo tài khoản — hệ thống không còn tài khoản mẫu, xem Bước 6.)

## Bước 4 — Đưa code lên Git
1. Tạo repo trên GitHub (hoặc GitLab/Bitbucket).
2. Trong thư mục project: `git init && git add . && git commit -m "init"`.
3. Đẩy lên repo vừa tạo.

## Bước 5 — Import vào Vercel
1. Vào https://vercel.com → New Project → chọn repo vừa đẩy lên.
2. Ở phần Environment Variables, thêm:
   - `DATABASE_URL` = **chuỗi pooled connection (port 6543, có `?pgbouncer=true`)** từ Bước 2.
   - `NEXTAUTH_SECRET` = một chuỗi ngẫu nhiên dài (có thể tạo bằng lệnh `openssl rand -base64 32`).
   - `NEXTAUTH_URL` = URL Vercel sẽ cấp cho project (ví dụ `https://ten-app.vercel.app`) — có thể cập nhật lại sau khi deploy lần đầu nếu chưa biết trước domain.
3. Bấm Deploy.

## Bước 6 — Tạo tài khoản admin đầu tiên
Hệ thống **không có tài khoản mẫu/demo**. Sau khi deploy xong:
1. Mở `https://ten-app.vercel.app/setup` (hoặc mở trang chủ — app sẽ tự chuyển sang `/setup` nếu database chưa có user nào).
2. Điền thông tin, tạo tài khoản **admin** đầu tiên (chỉ tạo được 1 lần, route này tự khoá ngay sau đó).
3. Đăng nhập bằng tài khoản admin vừa tạo → vào **Quản trị > Người dùng** → tạo tài khoản cho Manager và Sales (đặt mật khẩu, gán vai trò).

## Sau khi deploy
- Mỗi lần push code mới lên Git, Vercel sẽ tự build & deploy lại.
- Nếu đổi schema Prisma, chạy lại `npx prisma db push` (với `DATABASE_URL` là chuỗi **direct connection**, port 5432) để đồng bộ database.
- Backup dữ liệu: Supabase có backup tự động hằng ngày kèm point-in-time-restore ở các plan trả phí; ở free tier nên tự export định kỳ (Table Editor → Export, hoặc `pg_dump`) nếu dữ liệu quan trọng.
- Vẫn có thể dùng Neon hoặc Vercel Postgres thay Supabase nếu muốn — chỉ cần đổi `DATABASE_URL`, các bước còn lại giữ nguyên vì đều là Postgres chuẩn.
