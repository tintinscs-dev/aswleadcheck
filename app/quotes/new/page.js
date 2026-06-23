import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import Topbar from '../../../components/Topbar';
import QuoteForm from '../QuoteForm';

export default async function NewQuotePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return (
    <div>
      <Topbar user={session.user} />
      <div className="page">
        <QuoteForm initialQuote={null} quoteId={null} currentUser={session.user} />
      </div>
    </div>
  );
}
