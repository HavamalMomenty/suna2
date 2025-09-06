import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workflowKeys } from './keys';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// Error class for missing auth token
export class NoAccessTokenAvailableError extends Error {
  constructor(message = 'No access token available') {
    super(message);
    this.name = 'NoAccessTokenAvailableError';
  }
}

// Types for workflow builder
export interface WorkflowFile {
  id?: string;
  workflow_id: string;
  filename: string;
  file_type: string;
  file_size?: number;
  file_path: string;
  mime_type?: string;
  uploaded_at?: string;
  created_by: string;
}

export interface WorkflowCredential {
  workflow_id: string;
  credential_key: string;
  credential_value: string;
  description: string;
}

export interface WorkflowBuilderData {
  title: string;
  description?: string;
  master_prompt: string;
  login_template: string;
  files: WorkflowFile[];
  image_url?: string;
}

export interface WorkflowBuilderRequest {
  workflow_data: WorkflowBuilderData;
  project_id: string;
}

export interface WorkflowBuilderRequestWithFiles {
  workflow_data: WorkflowBuilderData;
  project_id: string;
  files?: File[];
}

export interface WorkflowBuilderUpdateRequest {
  workflow_id: string;
  workflow_data: WorkflowBuilderData;
}

export interface WorkflowFileUploadResponse {
  file_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  parsing_status: string;
  message: string;
}

// API functions
async function createWorkflowFromBuilder(request: WorkflowBuilderRequestWithFiles) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  // Check if files are present - use multipart endpoint if so
  if (request.files && request.files.length > 0) {
    const formData = new FormData();
    formData.append('workflow_data', JSON.stringify(request.workflow_data));
    formData.append('project_id', request.project_id);
    
    // Add files to form data
    request.files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_URL}/workflows/builder/with-files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create workflow with files';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } else {
    // No files - use regular JSON endpoint
    const response = await fetch(`${API_URL}/workflows/builder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        workflow_data: request.workflow_data,
        project_id: request.project_id
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create workflow';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}

async function updateWorkflowFromBuilder(workflowId: string, request: WorkflowBuilderUpdateRequest) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}/builder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to update workflow';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function getWorkflowBuilderData(workflowId: string): Promise<WorkflowBuilderData> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}/builder`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to get workflow data';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function uploadWorkflowFile(workflowId: string, file: File): Promise<WorkflowFileUploadResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/workflows/${workflowId}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to upload file';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function deleteWorkflow(workflowId: string) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to delete workflow';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function deleteWorkflowFile(workflowId: string, fileId: string) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to delete file';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function getWorkflowFiles(workflowId: string): Promise<WorkflowFile[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new NoAccessTokenAvailableError();
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}/files`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Failed to get workflow files';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// React Query hooks
export function useWorkflowBuilder() {
  const queryClient = useQueryClient();

  const createWorkflow = useMutation({
    mutationFn: createWorkflowFromBuilder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      toast.success('Workflow created successfully');
    },
    onError: (error: Error) => {
      let errorMessage = error.message || 'Failed to create workflow';
      
      // Handle specific error cases
      if (errorMessage.includes('duplicate key value violates unique constraint') && 
          errorMessage.includes('workflows_name_project_unique')) {
        errorMessage = 'A workflow with this name already exists in this project. Please choose a different name.';
      } else if (errorMessage.includes('23505')) {
        errorMessage = 'A workflow with this name already exists. Please choose a different name.';
      }
      
      toast.error(errorMessage);
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: ({ workflowId, request }: { workflowId: string; request: WorkflowBuilderUpdateRequest }) =>
      updateWorkflowFromBuilder(workflowId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      toast.success('Workflow updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update workflow');
    },
  });

  const uploadFile = useMutation({
    mutationFn: ({ workflowId, file }: { workflowId: string; file: File }) =>
      uploadWorkflowFile(workflowId, file),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.files(variables.workflowId) });
      toast.success('File uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });

  const deleteFile = useMutation({
    mutationFn: ({ workflowId, fileId }: { workflowId: string; fileId: string }) =>
      deleteWorkflowFile(workflowId, fileId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.files(variables.workflowId) });
      toast.success('File deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete file');
    },
  });

  return {
    createWorkflow,
    updateWorkflow,
    uploadFile,
    deleteFile,
  };
}

export function useWorkflowBuilderData(workflowId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.builderData(workflowId!),
    queryFn: () => getWorkflowBuilderData(workflowId!),
    enabled: !!workflowId,
  });
}

export function useWorkflowFiles(workflowId: string | undefined) {
  return useQuery({
    queryKey: workflowKeys.files(workflowId!),
    queryFn: () => getWorkflowFiles(workflowId!),
    enabled: !!workflowId,
  });
}

// Individual hooks for file operations
export function useUploadWorkflowFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ workflowId, file }: { workflowId: string; file: File }) =>
      uploadWorkflowFile(workflowId, file),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.files(variables.workflowId) });
      toast.success('File uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      toast.success('Workflow deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete workflow');
    },
  });
}

export function useDeleteWorkflowFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ workflowId, fileId }: { workflowId: string; fileId: string }) =>
      deleteWorkflowFile(workflowId, fileId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.files(variables.workflowId) });
      toast.success('File deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete file');
    },
  });
}
