import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import CRMDashboard from '@/components/CRMDashboard';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.isAuthenticated) {
    redirect('/login');
  }
  return <CRMDashboard firstName={session.firstName || 'User'} />;
}
