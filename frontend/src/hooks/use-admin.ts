import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// Load admin user IDs from backend API
async function _loadAdminUserIds(): Promise<Set<string>> {
  try {
    const response = await fetch('/api/workflows/admin-users');
    if (response.ok) {
      const data = await response.json();
      return new Set(data.admin_user_ids || []);
    }
  } catch (error) {
    console.warn('Failed to load admin users from API, using fallback');
  }
  
  // Fallback to hardcoded values if API fails
  return new Set([
    "00af93e6-1dd3-4fc2-baf0-558b24634a5d", // Your user ID
  ]);
}

// Admin user IDs - will be loaded dynamically
let ADMIN_USER_IDS: Set<string> = new Set();

export function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        return false;
      }
      
      // Load admin user IDs if not already loaded
      if (ADMIN_USER_IDS.size === 0) {
        ADMIN_USER_IDS = await _loadAdminUserIds();
      }
      
      return ADMIN_USER_IDS.has(user.id);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
