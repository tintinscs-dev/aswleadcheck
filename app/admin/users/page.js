import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import Topbar from '../../../components/Topbar';
import UsersClient from './UsersClient';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div>
      <Topbar user={session.user} />
      <div className="page">
        <UsersClient initialUsers={JSON.parse(JSON.stringify(users))} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
