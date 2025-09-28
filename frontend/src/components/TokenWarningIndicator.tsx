'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createClient } from '@/lib/supabase/client';

// Get backend URL from environment variables (same pattern as api.ts)
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface TokenWarningIndicatorProps {
  className?: string;
  onRefresh?: () => void;
}

export function TokenWarningIndicator({ className, onRefresh }: TokenWarningIndicatorProps) {
  const [hasTokens, setHasTokens] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  // Listen for token updates from other components
  useEffect(() => {
    const handleTokenUpdate = () => {
      checkTokenStatus();
    };

    // Listen for custom events that indicate token changes
    window.addEventListener('tokensUpdated', handleTokenUpdate);
    
    // Expose refresh function to parent if needed
    if (onRefresh) {
      onRefresh();
    }
    
    return () => {
      window.removeEventListener('tokensUpdated', handleTokenUpdate);
    };
  }, [onRefresh]);

  const checkTokenStatus = async () => {
    try {
      if (!API_URL) {
        throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured');
      }
      
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setHasTokens(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/user/tokens/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasTokens(data.has_any_tokens);
      } else {
        setHasTokens(false);
      }
    } catch (error) {
      console.error('Failed to check token status:', error);
      setHasTokens(false);
    } finally {
      setLoading(false);
    }
  };

  // Don't show warning if loading or if user has tokens
  if (loading || hasTokens === true) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center ${className}`}>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>For optimal performance please add resights/redata token</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
