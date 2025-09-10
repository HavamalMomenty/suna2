"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Play, X, Upload, FileText, Loader2, Clock, CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";
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
  const [isFormValid, setIsFormValid] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

    if (!isFormValid) {
      toast.error("Please fix validation errors before proceeding");
      return;
    }

    try {
      setExecuting(true);
      
      // Show progress feedback
      const toastId = toast.loading("Preparing workflow execution...");
      
      // Execute workflow with additional prompt and uploaded files if provided
      const result = await executeWorkflowWithAdditionalPrompt(workflowId, projectId, additionalPrompt.trim(), uploadedFiles);
      
      toast.dismiss(toastId);
      toast.success("Workflow started successfully! Redirecting to chat...", {
        description: "Your workflow is now running with the specified configuration."
      });
      
      if (result.thread_id) {
        router.push(`/projects/${projectId}/thread/${result.thread_id}`);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute workflow', {
        description: "Please check your configuration and try again."
      });
    } finally {
      setExecuting(false);
    }
  };

  // Validate form inputs
  useEffect(() => {
    const hasValidWorkflow = workflow && workflow.status === 'active';
    const hasValidProject = !!projectId;
    setIsFormValid(hasValidWorkflow && hasValidProject);
  }, [workflow, projectId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workflow configuration...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Workflow Not Found</h2>
            <p className="text-muted-foreground">The requested workflow could not be loaded.</p>
            <Button variant="outline" onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Configure Workflow Run</h1>
                <Badge variant="secondary" className="px-3 py-1">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Enhanced
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Configure options and provide additional context before running "{workflow.name}"
              </p>
            </div>
          </div>
          
          {/* Workflow Status */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{workflow.name}</span>
                  </div>
                  <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                    {workflow.status === 'active' ? 'Ready' : workflow.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last updated: {new Date(workflow.updated_at || workflow.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {workflow.status !== 'active' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This workflow is not currently active and cannot be executed. Please contact your administrator.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Workflow Information */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Workflow Input Description
            </CardTitle>
            <CardDescription>
              Understanding what this workflow requires for optimal performance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {workflow.description || workflow.definition?.description ? (
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="leading-relaxed">
                  {workflow.description || workflow.definition?.description}
                </p>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No description is available for this workflow. You may still proceed with the default configuration.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Additional Prompt Specifications */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center justify-between">
              <span>Additional Prompt Specifications</span>
              <Badge variant="outline" className="text-xs">
                {additionalPrompt.length} characters
              </Badge>
            </CardTitle>
            <CardDescription>
              Provide custom instructions that will be appended to the workflow prompt with clear headers
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="additional-prompt" className="text-sm font-medium">
                  Additional Instructions <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="additional-prompt"
                  placeholder="e.g., Focus on security best practices, include error handling, use TypeScript, etc."
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  rows={5}
                  className="resize-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {additionalPrompt.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your additional instructions will be appended to the workflow prompt under the header "--- Additional Instructions ---"
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File Upload Component */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Workflow Files
              </div>
              <Badge variant="outline" className="text-xs">
                {uploadedFiles.length} files
              </Badge>
            </CardTitle>
            <CardDescription>
              Upload supplementary files for this specific workflow run. Files provide additional context and won't modify the workflow permanently.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FileUploadZone
              workflowId={workflowId}
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              mode="edit"
            />
          </CardContent>
        </Card>

        <Separator className="my-8" />
        
        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Configuration Summary */}
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Configuration Summary</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Workflow:</span>
                  <p className="font-medium truncate">{workflow.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Additional Instructions:</span>
                  <p className="font-medium">{additionalPrompt.length > 0 ? 'Yes' : 'None'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploaded Files:</span>
                  <p className="font-medium">{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              disabled={executing}
              className="sm:w-auto w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleRunWorkflow} 
              disabled={executing || !isFormValid}
              size="lg"
              className="sm:w-auto w-full bg-primary hover:bg-primary/90"
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Workflow...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Workflow
                </>
              )}
            </Button>
          </div>
          
          {!isFormValid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please ensure the workflow is active and all required data is available before proceeding.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}