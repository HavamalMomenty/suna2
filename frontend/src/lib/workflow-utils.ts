import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

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

/**
 * Downloads a workflow file and converts it to a File object
 */
export async function downloadWorkflowFile(workflowId: string, file: WorkflowFile): Promise<File> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${API_URL}/workflows/${workflowId}/files/${file.id}/content`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const blob = await response.blob();
  
  // Create a File object from the blob
  return new File([blob], file.filename, {
    type: file.mime_type || 'application/octet-stream',
  });
}

/**
 * Downloads all files for a workflow and converts them to File objects
 */
export async function downloadWorkflowFiles(workflowId: string, files: WorkflowFile[]): Promise<File[]> {
  const downloadedFiles: File[] = [];
  
  for (const file of files) {
    try {
      const downloadedFile = await downloadWorkflowFile(workflowId, file);
      downloadedFiles.push(downloadedFile);
    } catch (error) {
      console.error(`Failed to download file ${file.filename}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return downloadedFiles;
} 