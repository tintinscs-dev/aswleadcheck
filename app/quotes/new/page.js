import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import Topbar from '../../../components/Topbar';
import QuoteForm from '../QuoteForm';
import { DEFAULT_FX_RATES } from '../../../lib/calc';

export default async function NewQuotePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  let systemFxRates = DEFAULT_FX_RATES;
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    systemFxRates = { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {}
  return (
    <div>
      <Topbar user={session.user} />
      <div className="page">
        <QuoteForm initialQuote={null} quoteId={null} currentUser={session.user} systemFxRates={systemFxRates} />
      </div>
    </div>
  );
}
