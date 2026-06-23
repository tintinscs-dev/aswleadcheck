const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Không còn tạo tài khoản demo nữa.
// Tài khoản admin đầu tiên được tạo qua trang /setup khi hệ thống chưa có người dùng nào.
// Sau đó admin vào "Quản trị > Người dùng" để tạo tài khoản cho Manager/Sales.
async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, exchangeRate: 23300, interestRatePct: 7.5, cpqlPct: 3 },
  });
  console.log('Seed hoàn tất (chỉ khởi tạo Settings, không tạo tài khoản demo).');
  console.log('Mở /setup trên trình duyệt để tạo tài khoản admin đầu tiên.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
