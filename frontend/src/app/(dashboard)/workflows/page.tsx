"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Check, X, Power, PowerOff, Loader2, Settings, Play, Eye, Copy } from "lucide-react";
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
import { getWorkflows, deleteWorkflow, getProjects, createWorkflow, updateWorkflow, executeWorkflowWithBuilderData, viewWorkflow, copyWorkflow, type Workflow } from "@/lib/api";
import { useUpdateWorkflowStatus } from "@/hooks/react-query/workflows/use-workflows";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { useFeatureFlag } from "@/lib/feature-flags";
import { WorkflowBuilderModal } from "@/components/workflows/WorkflowBuilderModal";
import { WorkflowCreationChoiceDialog } from "@/components/workflows/WorkflowCreationChoiceDialog";
import { TemplateSelectionDialog } from "@/components/workflows/TemplateSelectionDialog";
import { useIsAdmin } from '@/hooks/use-admin';
import { createClient } from '@/lib/supabase/client';

// Helper function to get signed URL for image display
const getImageUrl = async (imagePath: string): Promise<string> => {
  if (!imagePath) return '';
  
  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Generate signed URL for private bucket
  const supabase = createClient();
  const { data: signedUrlData } = await supabase.storage
    .from('workflow-images')
    .createSignedUrl(imagePath, 60 * 60 * 24 * 7); // 7 days expiry
  
  return signedUrlData?.signedUrl || '';
};

// Component to handle image display with signed URLs
const WorkflowImage = ({ imagePath, alt, className }: { imagePath: string; alt: string; className: string }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      if (imagePath) {
        setLoading(true);
        const url = await getImageUrl(imagePath);
        setImageUrl(url);
        setLoading(false);
      } else {
        setImageUrl('');
        setLoading(false);
      }
    };
    loadImage();
  }, [imagePath]);

  if (loading) {
    return <div className={`${className} bg-muted animate-pulse`} />;
  }

  if (!imageUrl) {
    return null;
  }

  return <img src={imageUrl} alt={alt} className={className} />;
};

export default function WorkflowsPage() {
  const { enabled: workflowsEnabled, loading: flagLoading } = useFeatureFlag("workflows");
  const router = useRouter();
  useEffect(() => {
    if (!flagLoading && !workflowsEnabled) {
      router.replace("/dashboard");
    }
  }, [flagLoading, workflowsEnabled, router]);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templateWorkflows, setTemplateWorkflows] = useState<Workflow[]>([]); // Templates (default_workflow=true), hidden from UI
  const [userWorkflows, setUserWorkflows] = useState<Workflow[]>([]); // User's workflows
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

  // Workflow Builder Modal State
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderWorkflowId, setBuilderWorkflowId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | 'view'>('create');

  // New Workflow Creation Flow State
  const [creationChoiceOpen, setCreationChoiceOpen] = useState(false);
  const [templateSelectionOpen, setTemplateSelectionOpen] = useState(false);
  const [copyingTemplate, setCopyingTemplate] = useState(false);

  const { state, setOpen, setOpenMobile } = useSidebar();
  const updateWorkflowStatusMutation = useUpdateWorkflowStatus();
  
  // Check if current user is admin
  const { data: isAdmin = false } = useIsAdmin();

  // Handle workflow click - open in view mode
  const handleWorkflowClick = (workflow: Workflow) => {
    setBuilderWorkflowId(workflow.id);
    setBuilderMode('view');
    setBuilderModalOpen(true);
  };



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
        
        // Separate workflows into templates (default_workflow=true) and user workflows
        const templates = workflowsData.filter(w => w.default_workflow === true);
        const userWf = workflowsData.filter(w => w.default_workflow !== true);
        setTemplateWorkflows(templates); // Store for template selection dialog
        setUserWorkflows(userWf); // Display in main UI
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Refetch workflows when the page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && projectId) {
        console.log('Page became visible, refetching workflows...');
        fetchWorkflows();
      }
    };

    const handleFocus = () => {
      if (projectId) {
        console.log('Window focused, refetching workflows...');
        fetchWorkflows();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [projectId]);

  // Refetch workflows when component mounts (user navigates to workflows page)
  useEffect(() => {
    if (projectId) {
      console.log('Workflows page mounted, refetching workflows...');
      fetchWorkflows();
    }
  }, [projectId]);


  const handleRunWorkflow = async (workflowId: string) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    try {
      setExecutingWorkflows(prev => new Set(prev).add(workflowId));
      
      // Use the new workflow execution function that includes master prompt and files
      const result = await executeWorkflowWithBuilderData(workflowId, projectId);
      
      toast.success("Workflow execution started! Redirecting to chat...");
      
      if (result.thread_id) {
        // Don't clear the executing state when redirecting - user won't see the workflows page anyway
        router.push(`/projects/${projectId}/thread/${result.thread_id}`);
      } else {
        // Only clear if no redirect happened
        setExecutingWorkflows(prev => {
          const newSet = new Set(prev);
          newSet.delete(workflowId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error executing workflow:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to execute workflow');
      // Clear executing state on error
      setExecutingWorkflows(prev => {
        const newSet = new Set(prev);
        newSet.delete(workflowId);
        return newSet;
      });
    }
  };

  const handleViewWorkflow = async (workflow: Workflow) => {
    try {
      // Open the workflow in view mode
      handleOpenBuilderModal(workflow.id, 'view');
      toast.success('Opening workflow in view mode');
    } catch (error) {
      console.error('Error viewing workflow:', error);
      toast.error('Failed to view workflow');
    }
  };

  const handleCopyWorkflow = async (workflow: Workflow) => {
    try {
      const copiedWorkflow = await copyWorkflow(workflow.id, projectId);
      toast.success(`Workflow copied as "${copiedWorkflow.name}"`);
      // Refresh the workflows list
      fetchWorkflows();
    } catch (error) {
      console.error('Error copying workflow:', error);
      toast.error('Failed to copy workflow');
    }
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

  const renderWorkflowCards = (workflows: Workflow[], sectionTitle: string, showAddButton: boolean = false) => {

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">{sectionTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Your workflows and automations
            </p>
          </div>
          {showAddButton && (
            <Button onClick={handleNewWorkflowClick} disabled={loading || creating}>
              {creating ? (
                <Loader2 className="animate-spin rounded-full h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating..." : "New Workflow"}
            </Button>
          )}
        </div>

        {workflows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="rounded-full bg-muted p-6 mx-auto mb-4 w-fit">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                No workflows yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Create your first workflow to get started with automation
              </p>
              {showAddButton && (
                <Button onClick={handleNewWorkflowClick} disabled={creating}>
                  {creating ? (
                    <Loader2 className="animate-spin rounded-full h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {creating ? "Creating..." : "Create Your First Workflow"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {workflows.map((workflow, index) => (
              <div 
                key={workflow.id}
                className="bg-neutral-100 dark:bg-sidebar border border-border rounded-lg overflow-hidden hover:bg-muted/50 transition-all duration-200 group h-20 relative cursor-pointer hover:shadow-md"
                onClick={() => handleWorkflowClick(workflow)}
              >
                {/* Background Image, Striped Pattern, or Color */}
                {workflow.image_url ? (
                  <div className="absolute inset-0">
                    <WorkflowImage 
                      imagePath={workflow.image_url}
                      alt={workflow.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Dark overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                ) : (
                  <div 
                    className="absolute inset-0"
                    style={{ 
                      background: `repeating-linear-gradient(
                        45deg,
                        #e5e7eb20,
                        #e5e7eb20 2px,
                        #93c5fd40 2px,
                        #93c5fd40 4px
                      )`
                    }}
                  />
                )}

                {/* Title overlay - positioned in top 1/3 */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-background/80 backdrop-blur-sm flex items-center justify-center p-1.5 -mx-0.5">
                  <h3 className="font-medium text-foreground text-xs leading-tight line-clamp-2 text-center">
                    {workflow.name}
                  </h3>
                </div>

                {/* Status and Run button overlays */}
                <div className="absolute top-1 right-1">
                  <div className="scale-75">
                    {getStatusIcon(workflow.status)}
                  </div>
                </div>
                <div className="absolute top-1 left-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-white/20 hover:text-white text-white/70 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={executingWorkflows.has(workflow.id) || workflow.status !== 'active'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunWorkflow(workflow.id);
                    }}
                  >
                    {executingWorkflows.has(workflow.id) ? (
                      <Loader2 className="animate-spin rounded-full h-2.5 w-2.5" />
                    ) : (
                      <Play className="h-2.5 w-2.5" />
                    )}
                  </Button>
                </div>
                {/* Action buttons positioned at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-background/85 backdrop-blur-sm">
                  <div className="flex gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunWorkflow(workflow.id);
                      }}
                      disabled={executingWorkflows.has(workflow.id) || workflow.status !== 'active'}
                      className="flex-1 h-7 text-xs px-2"
                    >
                      {executingWorkflows.has(workflow.id) ? (
                        <Loader2 className="animate-spin rounded-full h-2.5 w-2.5" />
                      ) : (
                        <Play className="h-2.5 w-2.5" />
                      )}
                      <span className="ml-1">{executingWorkflows.has(workflow.id) ? 'Running...' : 'Run'}</span>
                    </Button>

                    {/* For default workflows: Different buttons for admins vs non-admins */}
                    {workflow.default_workflow ? (
                      isAdmin ? (
                        /* Admin: Configure and Copy buttons */
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBuilderModal(workflow.id, 'edit');
                            }}
                            className="flex-1 h-7 text-xs px-2"
                          >
                            <Settings className="h-2.5 w-2.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyWorkflow(workflow);
                            }}
                            className="flex-1 h-7 text-xs px-2"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </>
                      ) : (
                        /* Non-admin: View and Copy buttons */
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewWorkflow(workflow);
                            }}
                            className="flex-1 h-7 text-xs px-2"
                          >
                            <Eye className="h-2.5 w-2.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyWorkflow(workflow);
                            }}
                            className="flex-1 h-7 text-xs px-2"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </>
                      )
                    ) : (
                      /* For custom workflows: Configure and Toggle buttons */
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBuilderModal(workflow.id, 'edit');
                          }}
                          className="flex-1 h-7 text-xs px-2"
                        >
                          <Settings className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          variant={workflow.status === 'active' ? "default" : "outline"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleWorkflowStatus(workflow.id, workflow.status);
                          }}
                          disabled={togglingWorkflows.has(workflow.id)}
                          className={`flex-1 h-7 text-xs px-2 ${workflow.status === 'active' ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {togglingWorkflows.has(workflow.id) ? (
                            <Loader2 className="animate-spin rounded-full h-2.5 w-2.5" />
                          ) : workflow.status === 'active' ? (
                            <PowerOff className="h-2.5 w-2.5" />
                          ) : (
                            <Power className="h-2.5 w-2.5" />
                          )}
                        </Button>
                      </>
                    )}
                    
                    {/* Delete button - only show for custom workflows */}
                    {!workflow.default_workflow && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={deletingWorkflows.has(workflow.id)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {deletingWorkflows.has(workflow.id) ? (
                              <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-current" />
                            ) : (
                              <Trash2 className="h-2.5 w-2.5" />
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
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Workflow
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleOpenBuilderModal = (workflowId: string | null, mode: 'create' | 'edit' | 'view') => {
    setBuilderModalOpen(true);
    setBuilderWorkflowId(workflowId);
    setBuilderMode(mode);
  };

  const handleCloseBuilderModal = () => {
    setBuilderModalOpen(false);
    setBuilderWorkflowId(null);
    setBuilderMode('create');
  };

  // New Workflow Creation Flow Handlers
  const handleNewWorkflowClick = () => {
    setCreationChoiceOpen(true);
  };

  const handleUseTemplate = () => {
    setCreationChoiceOpen(false);
    setTemplateSelectionOpen(true);
  };

  const handleDesignFromScratch = () => {
    setCreationChoiceOpen(false);
    handleOpenBuilderModal(null, 'create');
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    
    try {
      setCopyingTemplate(true);
      const copiedWorkflow = await copyWorkflow(templateId, projectId);
      toast.success(`Workflow created from template: "${copiedWorkflow.name}"`);
      setTemplateSelectionOpen(false);
      
      // Refresh workflows list
      await fetchWorkflows();
      
      // Optionally open the copied workflow in edit mode
      // handleOpenBuilderModal(copiedWorkflow.id, 'edit');
    } catch (error) {
      console.error('Error copying template:', error);
      toast.error('Failed to create workflow from template');
    } finally {
      setCopyingTemplate(false);
    }
  };

  const handleTemplateSelectionClose = () => {
    setTemplateSelectionOpen(false);
    // Optionally reopen the choice dialog
    setCreationChoiceOpen(true);
  };


  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const workflowsData = await getWorkflows(projectId);
      setWorkflows(workflowsData);
      
      // Separate workflows into templates (default_workflow=true) and user workflows
      const templates = workflowsData.filter(w => w.default_workflow === true);
      const userWf = workflowsData.filter(w => w.default_workflow !== true);
      setTemplateWorkflows(templates); // Store for template selection dialog
      setUserWorkflows(userWf); // Display in main UI
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
            // Workflows state updated
  }, [workflows]);

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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 grid-flow-row auto-rows-auto w-full">
          {Array.from({ length: 6 }).map((_, index) => (
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 grid-flow-row auto-rows-auto w-full">
          {Array.from({ length: 6 }).map((_, index) => (
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
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* DEBUG: Test element at the very top */}
      <div style={{ height: '200px', backgroundColor: 'red', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        DEBUG: This should be visible at the top
      </div>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workflows</h1>
            <p className="text-md text-muted-foreground max-w-2xl">
              Create and manage automated agent workflows
            </p>
          </div>
        </div>

          {/* Workflows Section - only show user workflows, templates are for selection dialog */}
          {renderWorkflowCards(userWorkflows, "Workflows", true)}
          
          {/* DEBUG: Test element to verify height growth */}
          <div style={{ height: '500px', backgroundColor: 'red', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
            DEBUG: This should make the page 500px taller
          </div>
      </div>

      {/* Workflow Creation Choice Dialog */}
      <WorkflowCreationChoiceDialog
        isOpen={creationChoiceOpen}
        onClose={() => setCreationChoiceOpen(false)}
        onUseTemplate={handleUseTemplate}
        onDesignFromScratch={handleDesignFromScratch}
      />

      {/* Template Selection Dialog */}
      <TemplateSelectionDialog
        isOpen={templateSelectionOpen}
        onClose={handleTemplateSelectionClose}
        templates={templateWorkflows}
        onTemplateSelect={handleTemplateSelect}
        isLoading={copyingTemplate}
      />

      {/* Workflow Builder Modal */}
      {projectId && (
        <WorkflowBuilderModal 
          isOpen={builderModalOpen} 
          workflowId={builderWorkflowId} 
          mode={builderMode} 
          projectId={projectId}
          onClose={handleCloseBuilderModal}
          onWorkflowSaved={() => {
            handleCloseBuilderModal();
            fetchWorkflows(); // Refresh workflows list
          }}
        />
      )}
    </div>
  );
} 