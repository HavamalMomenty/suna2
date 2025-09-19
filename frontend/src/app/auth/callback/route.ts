import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createProject } from '@/lib/api';

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const returnUrl = requestUrl.searchParams.get('returnUrl');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    
    // Ensure user has a default project after successful authentication
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if user has any projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('account_id', user.id)
          .limit(1);
        
        // If no projects exist, create a default one
        if (!projects || projects.length === 0) {
          await createProject({
            name: 'My First Project',
            description: 'Your default project to get started with workflows and conversations'
          }, user.id);
        }
      }
    } catch (error) {
      console.error('Error ensuring default project:', error);
      // Don't fail the auth flow if project creation fails
    }
  }

  // URL to redirect to after sign up process completes
  // Handle the case where returnUrl is 'null' (string) or actual null
  const redirectPath =
    returnUrl && returnUrl !== 'null' ? returnUrl : '/dashboard';
  // Make sure to include a slash between origin and path if needed
  return NextResponse.redirect(
    `${origin}${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`,
  );
}
