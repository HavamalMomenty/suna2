import { agentPlaygroundFlagFrontend } from '@/flags';
import { isFlagEnabled } from '@/lib/feature-flags';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Agent Conversation | Momenty Node',
  description: 'Interactive agent conversation powered by Momenty Node',
  openGraph: {
    title: 'Agent Conversation | Momenty Node',
    description: 'Interactive agent conversation powered by Momenty Node',
    type: 'website',
  },
};

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
