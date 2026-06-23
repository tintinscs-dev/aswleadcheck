import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/db';
import Topbar from '../../components/Topbar';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;

  const where = user.role === 'sales' ? { createdById: user.id } : {};
  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: { select: { name: true, username: true } } },
  });

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <DashboardClient quotes={JSON.parse(JSON.stringify(quotes))} user={user} />
      </div>
    </div>
  );
}
