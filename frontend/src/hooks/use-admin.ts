import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// Load admin user IDs from backend API
async function _loadAdminUserIds(): Promise<Set<string>> {
  try {
    console.log('Loading admin users from API...');
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/admin-users`);
    console.log('API response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('API response data:', data);
      const adminIds = new Set<string>(data.admin_user_ids || []);
      console.log('Admin IDs set:', adminIds);
      return adminIds;
    } else {
      console.error('API response not ok:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Failed to load admin users from API:', error);
  }
  
  // Return empty set if API fails - no hardcoded fallback
  console.log('Returning empty admin set');
  return new Set();
}

// Admin user IDs - will be loaded dynamically
let ADMIN_USER_IDS: Set<string> = new Set();

export function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      console.log('useIsAdmin: Starting admin check...');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('useIsAdmin: Current user:', user?.id);
      
      if (!user?.id) {
        console.log('useIsAdmin: No user ID, returning false');
        return false;
      }
      
      // Load admin user IDs if not already loaded
      if (ADMIN_USER_IDS.size === 0) {
        console.log('useIsAdmin: Loading admin user IDs...');
        ADMIN_USER_IDS = await _loadAdminUserIds();
        console.log('useIsAdmin: Loaded admin IDs:', ADMIN_USER_IDS);
      } else {
        console.log('useIsAdmin: Using cached admin IDs:', ADMIN_USER_IDS);
      }
      
      const isAdmin = ADMIN_USER_IDS.has(user.id);
      console.log(`useIsAdmin: Is ${user.id} admin? ${isAdmin}`);
      return isAdmin;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
