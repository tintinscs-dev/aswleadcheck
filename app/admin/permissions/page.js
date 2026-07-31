import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import Topbar from '../../../components/Topbar';
import PermissionsClient from './PermissionsClient';
import { ROLES, ACTIONS, getEffectivePermissions } from '../../../lib/permissions';

export default async function PermissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;
  if (!['admin', 'manager'].includes(user.role)) redirect('/dashboard');

  const matrix = await getEffectivePermissions();

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <h2>Phân quyền</h2>
        <div className="pagesub">Bật/tắt quyền cho từng vai trò trong hệ thống. Thay đổi có hiệu lực ngay, không cần khởi động lại.</div>
        <PermissionsClient
          roles={ROLES}
          actions={ACTIONS}
          initialMatrix={matrix}
          canEdit={user.role === 'admin'}
        />
      </div>
    </div>
  );
}
