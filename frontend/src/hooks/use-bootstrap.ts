'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface BootstrapStatus {
  status: string;
  project_created: boolean;
  project_id: string | null;
  workflows_copied: number;
  workflows_skipped: number;
  total_templates: number;
  copying_in_progress: boolean;
}

export function useBootstrap() {
  const { user, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Setting up your workspace...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Don't run if user is not authenticated or auth is still loading
    if (authLoading || !user) {
      if (!authLoading && !user) {
        setIsChecking(false);
        setIsCopying(false);
      }
      return;
    }

    let mounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let checkCount = 0;
    const maxChecks = 30; // 30 seconds max (30 checks at 1s interval)
    const checkInterval = 1000; // Check every 1 second
    let workflowsComplete = false;

    const checkBootstrap = async () => {
      if (!mounted) return;

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || !mounted) {
          if (mounted) {
            setIsCopying(false);
            setIsChecking(false);
          }
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/bootstrap`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!mounted) return;

        if (response.ok) {
          const data: BootstrapStatus = await response.json();

          // Check if workflows need to be copied
          const needsCopying = data.total_templates > 0 && data.workflows_copied < data.total_templates;

          if (needsCopying || data.copying_in_progress) {
            setIsCopying(true);
            
            // Update message based on progress
            if (data.workflows_copied === 0 && data.total_templates > 0) {
              setLoadingMessage('Copying workflow templates...');
              setProgress(0);
            } else if (data.workflows_copied > 0 && data.total_templates > 0) {
              const percentage = Math.round((data.workflows_copied / data.total_templates) * 100);
              setLoadingMessage(`Copying workflows (${data.workflows_copied}/${data.total_templates})...`);
              setProgress(Math.min(percentage, 95)); // Cap at 95% until fully complete
            } else {
              setLoadingMessage('Setting up workflows...');
              setProgress(50);
            }
          } else {
            // All workflows are copied or no templates to copy
            if (mounted && isCopying) {
              // Give it a brief moment for workflows to appear in the UI
              setLoadingMessage('Finalizing setup...');
              setProgress(100);
              
              setTimeout(() => {
                if (mounted) {
                  setIsCopying(false);
                  setIsChecking(false);
                  workflowsComplete = true;
                }
              }, 800);
            } else if (mounted && !workflowsComplete) {
              setIsCopying(false);
              setIsChecking(false);
              workflowsComplete = true;
            }
            return;
          }
        } else {
          // Error or unauthorized - assume done
          if (mounted) {
            setIsCopying(false);
            setIsChecking(false);
          }
          return;
        }

        checkCount++;
        if (checkCount >= maxChecks) {
          // Timeout - assume done to not block user indefinitely
          if (mounted) {
            setIsCopying(false);
            setIsChecking(false);
          }
          return;
        }
      } catch (error) {
        console.error('Bootstrap check error:', error);
        // On error, assume done to not block the user
        if (mounted) {
          setIsCopying(false);
          setIsChecking(false);
        }
      }
    };

    // Initial check
    checkBootstrap();

    // Set up polling interval
    intervalId = setInterval(() => {
      if (!workflowsComplete && mounted) {
        checkBootstrap();
      }
    }, checkInterval);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, authLoading, isCopying]);

  return {
    isChecking,
    isCopying,
    loadingMessage,
    progress,
  };
}

