"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, X, Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getWorkflow, executeWorkflowWithBuilderData, getProjects, type Workflow } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { FileUploadZone } from "@/components/workflows/FileUploadZone";
import { type WorkflowFile } from "@/hooks/react-query/workflows/use-workflow-builder";

// Custom function to execute workflow with additional prompt and files
const executeWorkflowWithAdditionalPrompt = async (
  workflowId: string,
  projectId: string,
  additionalPrompt: string,
  uploadedFiles: WorkflowFile[] = []
): Promise<{ thread_id: string; agent_run_id: string }> => {
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No access token available');
    }

    // Step 1: Get workflow builder data (master prompt and files)
    const workflowDataResponse = await fetch(`${API_URL}/workflows/${workflowId}/builder`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!workflowDataResponse.ok) {
      throw new Error(`Error getting workflow data: ${workflowDataResponse.statusText}`);
    }

    const workflowData = await workflowDataResponse.json();
    let { master_prompt } = workflowData;
    const { files } = workflowData;

    // Step 2: Append additional prompt if provided
    if (additionalPrompt && additionalPrompt.trim()) {
      master_prompt = master_prompt + '\n\n--- Additional Instructions ---\n' + additionalPrompt.trim();
    }

    // Step 3: Prepare files for upload (workflow files + uploaded files)
    const formData = new FormData();
    formData.append('prompt', master_prompt || '');
    formData.append('stream', 'false');

    // Add workflow files
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Get the file content from Supabase Storage
          const fileContentResponse = await fetch(`${API_URL}/workflows/${workflowId}/files/${file.id}/content`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (fileContentResponse.ok) {
            const fileBlob = await fileContentResponse.blob();
            formData.append('files', fileBlob, file.filename);
          }
        } catch (fileError) {
          console.warn(`Failed to fetch file ${file.filename}:`, fileError);
        }
      }
    }

    // Add uploaded files from the configure page
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const uploadedFile of uploadedFiles) {
        try {
          // Get the uploaded file content from Supabase Storage
          const fileContentResponse = await fetch(`${API_URL}/workflows/${workflowId}/files/${uploadedFile.id}/content`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (fileContentResponse.ok) {
            const fileBlob = await fileContentResponse.blob();
            formData.append('files', fileBlob, uploadedFile.filename);
          }
        } catch (fileError) {
          console.warn(`Failed to fetch uploaded file ${uploadedFile.filename}:`, fileError);
        }
      }
    }

    // Step 4: Execute agent with the prepared data
    const agentResponse = await fetch(`${API_URL}/projects/${projectId}/agents/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text().catch(() => 'No error details available');
      throw new Error(`Failed to execute workflow: ${agentResponse.statusText}`);
    }

    const result = await agentResponse.json();
    return result;
  } catch (error) {
    console.error('Error executing workflow with additional prompt:', error);
    throw error;
  }
};

export default function ConfigureWorkflowRunPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params?.workflowId as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<WorkflowFile[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!workflowId) {
        toast.error("Workflow ID is required");
        router.back();
        return;
      }

      try {
        setLoading(true);
        
        // Get project ID first
        const projects = await getProjects();
        if (projects.length === 0) {
          toast.error("No projects found");
          router.back();
          return;
        }
        const firstProject = projects[0];
        setProjectId(firstProject.id);

        // Get workflow data
        const workflowData = await getWorkflow(workflowId);
        setWorkflow(workflowData);
      } catch (error) {
        console.error('Error loading workflow:', error);
        toast.error('Failed to load workflow');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workflowId, router]);

  const handleCancel = () => {
    router.back();
  };

  const handleRunWorkflow = async () => {
    if (!projectId || !workflowId) {
      toast.error("Missing required data");
      return;
    }

    try {
      setExecuting(true);
      
      // Execute workflow with additional prompt and uploaded files if provided
      const result = await executeWorkflowWithAdditionalPrompt(workflowId, projectId, additionalPrompt.trim(), uploadedFiles);
      
      toast.success("Workflow execution started! Redirecting to chat...");
      
      if (result.thread_id) {
        router.push(`/projects/${projectId}/thread/${result.thread_id}`);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute workflow');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Workflow not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configure Workflow Run</h1>
            <p className="text-muted-foreground">
              Configure options before running "{workflow.name}"
            </p>
          </div>
        </div>

        {/* Workflow Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Workflow Input Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {workflow.description || workflow.definition?.description || "No description available for this workflow."}
            </p>
          </CardContent>
        </Card>

        {/* Additional Prompt Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Prompt Specifications</CardTitle>
            <CardDescription>
              Add custom instructions or context that will be appended to the workflow prompt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="additional-prompt">Additional Instructions (Optional)</Label>
              <Textarea
                id="additional-prompt"
                placeholder="Enter any additional instructions or context for this workflow run..."
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* File Upload Component */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Workflow Files
            </CardTitle>
            <CardDescription>
              Upload files specific to this workflow run. These files will be available to the workflow during execution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadZone
              workflowId={workflowId}
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              mode="edit"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} disabled={executing}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleRunWorkflow} 
            disabled={executing || workflow.status !== 'active'}
          >
            {executing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {executing ? 'Starting Workflow...' : 'Run Workflow'}
          </Button>
        </div>
      </div>
    </div>
  );
}