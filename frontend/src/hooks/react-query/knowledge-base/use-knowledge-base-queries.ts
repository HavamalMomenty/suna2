import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { knowledgeBaseKeys } from './keys';
import { CreateKnowledgeBaseEntryRequest, KnowledgeBaseEntry, KnowledgeBaseListResponse, UpdateKnowledgeBaseEntryRequest } from './types';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const useAuthHeaders = () => {
  const getHeaders = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No access token available');
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };
  
  return { getHeaders };
};

export function useUserKnowledgeBaseEntries(includeInactive = false) {
  const { getHeaders } = useAuthHeaders();
  
  return useQuery({
    queryKey: knowledgeBaseKeys.user(),
    queryFn: async (): Promise<KnowledgeBaseListResponse> => {
      const headers = await getHeaders();
      const url = new URL(`${API_URL}/knowledge-base/`);
      url.searchParams.set('include_inactive', includeInactive.toString());
      
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch knowledge base entries');
      }
      
      return await response.json();
    },
  });
}

export function useKnowledgeBaseEntries(includeInactive = false) {
  const { getHeaders } = useAuthHeaders();
  
  return useQuery({
    queryKey: knowledgeBaseKeys.user(),
    queryFn: async (): Promise<KnowledgeBaseListResponse> => {
      const headers = await getHeaders();
      const url = new URL(`${API_URL}/knowledge-base/`);
      url.searchParams.set('include_inactive', includeInactive.toString());
      
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch knowledge base entries');
      }
      
      return await response.json();
    },
  });
}

export function useKnowledgeBaseEntry(entryId: string) {
  const { getHeaders } = useAuthHeaders();
  
  return useQuery({
    queryKey: knowledgeBaseKeys.entry(entryId),
    queryFn: async (): Promise<KnowledgeBaseEntry> => {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/knowledge-base/${entryId}`, { headers });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch knowledge base entry');
      }
      
      return await response.json();
    },
    enabled: !!entryId,
  });
}

export function useKnowledgeBaseContext(maxTokens = 4000) {
  const { getHeaders } = useAuthHeaders();
  
  return useQuery({
    queryKey: knowledgeBaseKeys.user(),
    queryFn: async () => {
      const headers = await getHeaders();
      const url = new URL(`${API_URL}/knowledge-base/context`);
      url.searchParams.set('max_tokens', maxTokens.toString());
      
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch knowledge base context');
      }
      
      return await response.json();
    },
  });
}

export function useCreateUserKnowledgeBaseEntry() {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuthHeaders();
  
  return useMutation({
    mutationFn: async (data: CreateKnowledgeBaseEntryRequest): Promise<KnowledgeBaseEntry> => {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/knowledge-base/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create knowledge base entry');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.user() });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('Knowledge base entry created successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create knowledge base entry: ${message}`);
    },
  });
}

export function useCreateKnowledgeBaseEntry() {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuthHeaders();
  
  return useMutation({
    mutationFn: async (data: CreateKnowledgeBaseEntryRequest): Promise<KnowledgeBaseEntry> => {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/knowledge-base/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create knowledge base entry');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.user() });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('Knowledge base entry created successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create knowledge base entry: ${message}`);
    },
  });
}

export function useUpdateKnowledgeBaseEntry() {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuthHeaders();
  
  return useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: UpdateKnowledgeBaseEntryRequest }): Promise<KnowledgeBaseEntry> => {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/knowledge-base/${entryId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update knowledge base entry');
      }
      
      return await response.json();
    },
    onSuccess: (updatedEntry) => {
      queryClient.setQueryData(knowledgeBaseKeys.entry(updatedEntry.entry_id), updatedEntry);
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.threads() });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('Knowledge base entry updated successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update knowledge base entry: ${message}`);
    },
  });
}

export function useDeleteKnowledgeBaseEntry() {
  const queryClient = useQueryClient();
  const { getHeaders } = useAuthHeaders();
  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      const headers = await getHeaders();
      const response = await fetch(`${API_URL}/knowledge-base/${entryId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete knowledge base entry');
      }
    },
    onSuccess: (_, entryId) => {
      queryClient.removeQueries({ queryKey: knowledgeBaseKeys.entry(entryId) });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.threads() });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('Knowledge base entry deleted successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete knowledge base entry: ${message}`);
    },
  });
} 
