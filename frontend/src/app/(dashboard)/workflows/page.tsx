"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Check, X, Workflow as WorkflowIcon, Power, PowerOff, Loader2, Settings, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getWorkflows, executeWorkflow, deleteWorkflow, getProjects, createWorkflow, updateWorkflow, type Workflow } from "@/lib/api";
import { useUpdateWorkflowStatus } from "@/hooks/react-query/workflows/use-workflows";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { useFeatureFlag } from "@/lib/feature-flags";
import { DocumentUploadDialog, type UploadedDocument } from "@/components/workflows/DocumentUploadDialog";

export default function WorkflowsPage() {
  const { enabled: workflowsEnabled, loading: flagLoading } = useFeatureFlag("workflows");
  const router = useRouter();
  useEffect(() => {
    if (!flagLoading && !workflowsEnabled) {
      router.replace("/dashboard");
    }
  }, [flagLoading, workflowsEnabled, router]);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executingWorkflows, setExecutingWorkflows] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [updatingWorkflows, setUpdatingWorkflows] = useState<Set<string>>(new Set());
  const [deletingWorkflows, setDeletingWorkflows] = useState<Set<string>>(new Set());
  const [togglingWorkflows, setTogglingWorkflows] = useState<Set<string>>(new Set());
  
  // Document upload dialog state
  const [documentUploadDialogOpen, setDocumentUploadDialogOpen] = useState(false);
  const [selectedWorkflowForDocuments, setSelectedWorkflowForDocuments] = useState<Workflow | null>(null);
  const [workflowDocuments, setWorkflowDocuments] = useState<Record<string, UploadedDocument[]>>({});

  const { state, setOpen, setOpenMobile } = useSidebar();
  const updateWorkflowStatusMutation = useUpdateWorkflowStatus();

  const initialLayoutAppliedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const projects = await getProjects();
        if (projects.length === 0) {
          setError("No projects found. Please create a project first.");
          return;
        }
        const firstProject = projects[0];
        setProjectId(firstProject.id);
        const workflowsData = await getWorkflows(firstProject.id);
        setWorkflows(workflowsData);
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleRunWorkflow = async (workflowId: string) => {
    // Find the workflow to get its name
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) {
      toast.error("Workflow not found");
      return;
    }
    
    // Open the document upload dialog
    setSelectedWorkflowForDocuments(workflow);
    setDocumentUploadDialogOpen(true);
  };

  const handleExecuteWorkflowWithDocuments = async (workflowId: string, documents: UploadedDocument[]) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    
    try {
      setExecutingWorkflows(prev => new Set(prev).add(workflowId));
      
      // Store the documents for this workflow
      setWorkflowDocuments(prev => ({
        ...prev,
        [workflowId]: documents
      }));
      
      // Execute the workflow with documents
      const result = await executeWorkflow(workflowId, undefined, documents);
      toast.success("Workflow execution started! Redirecting to chat...");
      console.log('Workflow execution started:', result);
      if (result.thread_id) {
        router.push(`/projects/${projectId}/thread/${result.thread_id}`);
      }
    } catch (err) {
      console.error('Error executing workflow:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to execute workflow');
    } finally {
      setExecutingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const handleDocumentsUploaded = (workflowId: string, documents: UploadedDocument[]) => {
    console.log(`Documents uploaded for workflow ${workflowId}:`, documents);
    // Store the uploaded documents for this workflow
    setWorkflowDocuments(prev => ({
      ...prev,
      [workflowId]: documents
    }));
  };

  const handleCreateWorkflow = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    try {
      setCreating(true);
      const existingNames = workflows.map(w => w.name.toLowerCase());
      let workflowName = "Untitled Workflow";
      let counter = 1;
      while (existingNames.includes(workflowName.toLowerCase())) {
        workflowName = `Untitled Workflow ${counter}`;
        counter++;
      }
      const newWorkflow = await createWorkflow({
        name: workflowName,
        description: "A new workflow",
        project_id: projectId,
        nodes: [],
        edges: [],
        variables: {}
      });
      toast.success("Workflow created successfully!");
      router.push(`/workflows/builder/${newWorkflow.id}`);
    } catch (err) {
      console.error('Error creating workflow:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEditName = (workflow: Workflow) => {
    setEditingWorkflowId(workflow.id);
    setEditingName(workflow.name);
  };

  const handleCancelEditName = () => {
    setEditingWorkflowId(null);
    setEditingName("");
  };

  const handleSaveEditName = async (workflowId: string) => {
    if (!editingName.trim()) {
      toast.error("Workflow name cannot be empty");
      return;
    }
    const existingNames = workflows
      .filter(w => w.id !== workflowId)
      .map(w => w.name.toLowerCase());
    
    if (existingNames.includes(editingName.toLowerCase())) {
      toast.error("A workflow with this name already exists");
      return;
    }

    try {
      setUpdatingWorkflows(prev => new Set(prev).add(workflowId));
      
      await updateWorkflow(workflowId, {
        name: editingName.trim()
      });

      // Update local state
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId 
          ? { ...w, name: editingName.trim(), definition: { ...w.definition, name: editingName.trim() } }
          : w
      ));

      setEditingWorkflowId(null);
      setEditingName("");
      toast.success('Workflow name updated successfully');
    } catch (err) {
      console.error('Error updating workflow name:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update workflow name');
    } finally {
      setUpdatingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      setDeletingWorkflows(prev => new Set(prev).add(workflowId));
      
      await deleteWorkflow(workflowId);
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      toast.success('Workflow deleted successfully');
    } catch (err) {
      console.error('Error deleting workflow:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete workflow');
    } finally {
      setDeletingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const handleToggleWorkflowStatus = async (workflowId: string, currentStatus: string) => {
    try {
      setTogglingWorkflows(prev => new Set(prev).add(workflowId));
      const newStatus = currentStatus === 'active' ? 'draft' : 'active';
      await updateWorkflowStatusMutation.mutateAsync({
        id: workflowId,
        status: newStatus
      });
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId 
          ? { ...w, status: newStatus }
          : w
      ));
    } catch (err) {
      console.error('Error updating workflow status:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update workflow status');
    } finally {
      setTogglingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "draft":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "paused":
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case "disabled":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "archived":
        return <XCircle className="h-4 w-4 text-gray-300" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "disabled":
        return <Badge variant="destructive">Disabled</Badge>;
      case "archived":
        return <Badge variant="secondary" className="opacity-60">Archived</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getWorkflowColor = (status: string) => {
    switch (status) {
      case "active":
        return "#10b981";
      case "draft":
        return "#f59e0b";
      case "paused":
        return "#6b7280";
      case "disabled":
        return "#ef4444";
      case "archived":
        return "#9ca3af";
      default:
        return "#8b5cf6";
    }
  };
  if (flagLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage automated agent workflows
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="p-2 bg-neutral-100 dark:bg-sidebar rounded-2xl overflow-hidden group">
              <div className="h-24 flex items-center justify-center relative bg-gradient-to-br from-opacity-90 to-opacity-100">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
              <div className="space-y-2 mt-4 mb-4">
                <Skeleton className="h-6 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!workflowsEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage automated agent workflows
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="p-2 bg-neutral-100 dark:bg-sidebar rounded-2xl overflow-hidden group">
              <div className="h-24 flex items-center justify-center relative bg-gradient-to-br from-opacity-90 to-opacity-100">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
              <div className="space-y-2 mt-4 mb-4">
                <Skeleton className="h-6 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage automated agent workflows
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Workflows</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage automated agent workflows
          </p>
        </div>
        <Button onClick={handleCreateWorkflow} disabled={loading || creating}>
          {creating ? (
            <Loader2 className="animate-spin rounded-full h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {creating ? "Creating..." : "New Workflow"}
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="rounded-full bg-muted p-6 mx-auto mb-4 w-fit">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workflow to get started with automation
            </p>
            <Button onClick={handleCreateWorkflow} disabled={creating}>
              {creating ? (
                <Loader2 className="animate-spin rounded-full h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating..." : "Create Your First Workflow"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <div 
              key={workflow.id}
              className="bg-neutral-100 dark:bg-sidebar border border-border rounded-2xl overflow-hidden hover:bg-muted/50 transition-all duration-200 group"
            >
              <div 
                className="h-24 flex items-center justify-center relative bg-gradient-to-br from-opacity-90 to-opacity-100"
                style={{ backgroundColor: getWorkflowColor(workflow.status) }}
              >
                <div className="text-3xl text-white drop-shadow-sm">
                  <WorkflowIcon />
                </div>
                <div className="absolute top-3 right-3">
                  {getStatusIcon(workflow.status)}
                </div>
                {/* Document count badge */}
                {workflowDocuments[workflow.id] && workflowDocuments[workflow.id].length > 0 && (
                  <div className="absolute top-3 left-3">
                    <div className="bg-white/90 dark:bg-black/90 text-blue-600 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {workflowDocuments[workflow.id].length}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {editingWorkflowId === workflow.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="text-lg font-semibold h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditName(workflow.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditName();
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleSaveEditName(workflow.id)}
                              disabled={updatingWorkflows.has(workflow.id)}
                            >
                              {updatingWorkflows.has(workflow.id) ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                              ) : (
                                <Check className="h-3 w-3 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleCancelEditName}
                              disabled={updatingWorkflows.has(workflow.id)}
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <h3 
                          className="text-foreground font-medium text-lg line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleStartEditName(workflow)}
                        >
                          {workflow.definition.name || workflow.name}
                        </h3>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {workflowDocuments[workflow.id] && workflowDocuments[workflow.id].length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {workflowDocuments[workflow.id].length}
                        </Badge>
                      )}
                      {getStatusBadge(workflow.status)}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2 min-h-[2.5rem]">
                    {workflow.definition.description || workflow.description || 'No description provided'}
                  </p>
                  
                  {/* Document indicator */}
                  {workflowDocuments[workflow.id] && workflowDocuments[workflow.id].length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>{workflowDocuments[workflow.id].length} document{workflowDocuments[workflow.id].length !== 1 ? 's' : ''} available</span>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRunWorkflow(workflow.id)}
                      disabled={executingWorkflows.has(workflow.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {executingWorkflows.has(workflow.id) ? (
                        <Loader2 className="animate-spin rounded-full h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      {executingWorkflows.has(workflow.id) ? 'Running...' : 'Run'}
                    </Button>
                    <Link href={`/workflows/builder/${workflow.id}`}>
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3" />
                        Configure
                      </Button>
                    </Link>
                    <Button
                      variant={workflow.status === 'active' ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleWorkflowStatus(workflow.id, workflow.status)}
                      disabled={togglingWorkflows.has(workflow.id)}
                      className={workflow.status === 'active' ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {togglingWorkflows.has(workflow.id) ? (
                        <Loader2 className="animate-spin rounded-full h-3 w-3" />
                      ) : workflow.status === 'active' ? (
                        <PowerOff className="h-3 w-3" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                      {workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingWorkflows.has(workflow.id)}
                        >
                          {deletingWorkflows.has(workflow.id) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{workflow.definition.name || workflow.name}"? 
                            This action cannot be undone and will permanently remove the workflow and all its data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete Workflow
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Upload Dialog */}
      {selectedWorkflowForDocuments && (
        <DocumentUploadDialog
          isOpen={documentUploadDialogOpen}
          onClose={() => {
            setDocumentUploadDialogOpen(false);
            setSelectedWorkflowForDocuments(null);
          }}
          workflowId={selectedWorkflowForDocuments.id}
          workflowName={selectedWorkflowForDocuments.definition.name || selectedWorkflowForDocuments.name}
          onDocumentsUploaded={(documents) => handleDocumentsUploaded(selectedWorkflowForDocuments.id, documents)}
          onExecute={(documents) => handleExecuteWorkflowWithDocuments(selectedWorkflowForDocuments.id, documents)}
        />
      )}
    </div>
  );
} 