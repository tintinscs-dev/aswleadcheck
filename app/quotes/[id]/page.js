import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import Topbar from '../../../components/Topbar';
import QuoteForm from '../QuoteForm';
import { DEFAULT_FX_RATES } from '../../../lib/calc';

export default async function EditQuotePage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user;

  const quote = await prisma.quote.findUnique({ where: { id: params.id } });
  if (!quote) notFound();
  if (user.role === 'sales' && quote.createdById !== user.id) {
    redirect('/dashboard');
  }

  let systemFxRates = DEFAULT_FX_RATES;
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    systemFxRates = { ...DEFAULT_FX_RATES, ...(settings?.fxRates || {}) };
  } catch (e) {}

  return (
    <div>
      <Topbar user={user} />
      <div className="page">
        <QuoteForm initialQuote={JSON.parse(JSON.stringify(quote))} quoteId={quote.id} currentUser={user} systemFxRates={systemFxRates} />
      </div>
    </div>
  );
}
