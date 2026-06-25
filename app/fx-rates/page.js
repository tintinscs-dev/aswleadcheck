import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/db';
import Topbar from '../../components/Topbar';
import FxRatesClient from './FxRatesClient';
import { DEFAULT_FX_RATES } from '../../lib/calc';

export default async function FxRatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return (
    <div>
      <Topbar user={session.user} />
      <div className="page">
        <FxRatesClient
          initialRates={{ ...DEFAULT_FX_RATES, ...(settings.fxRates || {}) }}
          fxUpdatedAt={settings.fxUpdatedAt}
          fxUpdatedBy={settings.fxUpdatedBy}
        />
      </div>
    </div>
  );
}
