import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import Topbar from '../../../components/Topbar';
import { can } from '../../../lib/permissions';
import { commissionRows } from '../../../lib/commission';
import CommissionClient from './CommissionClient';

export default async function CommissionReportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;

  // Same visibility rule as the Dashboard: roles without 'view_all_quotes' only see their own.
  const canViewAll = await can(user.role, 'view_all_quotes');
  const where = canViewAll ? {} : { createdById: user.id };
  const quotes = await prisma.quote.findMany({ where, orderBy: { createdAt: 'desc' } });

  const rows = commissionRows(quotes);

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <CommissionClient rows={JSON.parse(JSON.stringify(rows))} />
      </div>
    </div>
  );
}
