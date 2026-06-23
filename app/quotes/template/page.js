import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import Topbar from '../../../components/Topbar';
import TemplateClient from './TemplateClient';

export default async function QuoteTemplatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return (
    <div>
      <Topbar user={session.user} />
      <div className="page">
        <TemplateClient currentUser={session.user} />
      </div>
    </div>
  );
}
