import { isFlagEnabled } from '@/lib/feature-flags';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Credentials | Momenty Node',
  description: 'Create and manage credentials to your services',
  openGraph: {
    title: 'Credentials | Momenty Node',
    description: 'Create and manage credentials to your services',
    type: 'website',
  },
};

export default async function CredentialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customAgentsEnabled = await isFlagEnabled('custom_agents');
  if (!customAgentsEnabled) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
