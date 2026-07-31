import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import Topbar from '../../../components/Topbar';

// Static reference matrix — mirrors the role checks actually enforced in the
// API routes / pages. Kept here as one place to look up "who can do what"
// instead of hunting through code. Update this alongside any permission change.
const ROLES = ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'];

const ROWS = [
  { action: 'Tạo báo giá mới',                              allowed: ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'] },
  { action: 'Xem báo giá',                                  allowed: ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'], note: 'Sales chỉ xem được báo giá do chính mình tạo — các vai trò khác xem toàn bộ.' },
  { action: 'Gửi báo giá đi kiểm tra giá mua',               allowed: ['Sales', 'Admin'], note: 'Sales chỉ gửi được báo giá của chính mình.' },
  { action: 'Xác nhận / yêu cầu sửa giá mua (Pricing review)', allowed: ['Pricing', 'Admin'] },
  { action: 'Duyệt / từ chối báo giá',                       allowed: ['Manager', 'Admin'] },
  { action: 'Đề xuất điều chỉnh phí trên báo giá đã duyệt',  allowed: ['Sales', 'Operation', 'Pricing', 'Admin'], note: 'Sales chỉ trên báo giá của mình. Admin có hiệu lực ngay lập tức, các vai trò khác phải chờ Manager duyệt đề xuất.' },
  { action: 'Duyệt / từ chối đề xuất điều chỉnh phí',        allowed: ['Manager', 'Admin'] },
  { action: 'Xoá báo giá nháp',                              allowed: ['Sales', 'Admin'], note: 'Sales chỉ xoá được báo giá nháp của chính mình.' },
  { action: 'Sao chép báo giá',                              allowed: ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'] },
  { action: 'Xem Dashboard & xuất Excel tổng hợp',           allowed: ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'], note: 'Sales chỉ thấy số liệu của báo giá do mình tạo.' },
  { action: 'Xem Nhật ký hoạt động (toàn hệ thống)',         allowed: ['Manager', 'Admin'] },
  { action: 'Quản lý người dùng (tạo, đổi vai trò, khoá/mở khoá)', allowed: ['Admin'] },
  { action: 'Cập nhật tỷ giá hệ thống',                      allowed: ['Sales', 'Pricing', 'Operation', 'Manager', 'Accounting', 'Admin'] },
];

export default async function PermissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;
  if (!['admin', 'manager'].includes(user.role)) redirect('/dashboard');

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Phân quyền</h2>
        <div className="pagesub">Tra cứu nhanh: mỗi vai trò được làm những gì trong hệ thống. Trang tham chiếu, không chỉnh sửa được — muốn đổi quyền hạn cần sửa trong code.</div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Chức năng</th>
                {ROLES.map(r => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.action}>
                  <td>
                    {row.action}
                    {row.note && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{row.note}</div>}
                  </td>
                  {ROLES.map(r => (
                    <td key={r} style={{ textAlign: 'center' }}>
                      {row.allowed.includes(r)
                        ? <span className="badge badge-approved">✓</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
