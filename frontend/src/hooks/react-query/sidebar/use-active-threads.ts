import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';
import { threadKeys } from './keys';

const supabase = createClient();

export function useActiveThreadStatuses() {
  const queryClient = useQueryClient();

  const { data: activeThreads = {}, ...queryResult } = useQuery({
    queryKey: threadKeys.activeStatuses(),
    queryFn: async () => {
      // Get all agent runs that are currently running
      const { data: agentRuns, error: agentRunsError } = await supabase
        .from('agent_runs')
        .select('thread_id, status')
        .eq('status', 'running');

      if (agentRunsError) {
        console.error('Error fetching active agent runs:', agentRunsError);
        throw agentRunsError;
      }

      // Create a map of thread_id -> is_active based on running agent runs
      const result = agentRuns.reduce((acc, run) => {
        acc[run.thread_id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      
      console.log('🔍 Active agent runs:', { agentRuns, result });
      return result;
    },
    refetchInterval: 2000, // Refetch every 2 seconds for more responsive updates
  });

  useEffect(() => {
    const channel = supabase
      .channel('active_agent_runs_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'agent_runs',
        },
        (payload) => {
          console.log('🔍 Agent run change detected:', payload);
          queryClient.invalidateQueries({ queryKey: threadKeys.activeStatuses() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { activeThreads, ...queryResult };
}
