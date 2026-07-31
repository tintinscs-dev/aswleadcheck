import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/db';
import Topbar from '../../components/Topbar';
import DashboardClient from './DashboardClient';
import { can } from '../../lib/permissions';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;

  // Roles with 'view_all_quotes' see everything; others only their own — see /admin/permissions.
  const canViewAll = await can(user.role, 'view_all_quotes');
  const canProposeAdjustment = await can(user.role, 'propose_adjustment');
  const where = canViewAll ? {} : { createdById: user.id };
  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { createdBy: { select: { name: true, username: true } } },
  });

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <DashboardClient quotes={JSON.parse(JSON.stringify(quotes))} user={user} canProposeAdjustment={canProposeAdjustment} />
      </div>
    </div>
  );
}
