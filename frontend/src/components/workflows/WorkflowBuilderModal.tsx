"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { FileUploadZone } from './FileUploadZone';
import { 
  useWorkflowBuilder,
  useDeleteWorkflow,
  useWorkflowBuilderData,
  type WorkflowBuilderData,
  type WorkflowFile
} from '@/hooks/react-query/workflows/use-workflow-builder';
import { 
  useCreateWorkflow, 
  useUpdateWorkflow,
  useWorkflows 
} from '@/hooks/react-query/workflows/use-workflows';

interface WorkflowBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkflowSaved?: () => void;
  workflowId?: string;
  mode: 'create' | 'edit';
  projectId: string;
}

export function WorkflowBuilderModal({ 
  isOpen, 
  onClose, 
  onWorkflowSaved,
  workflowId, 
  mode, 
  projectId 
}: WorkflowBuilderModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { createWorkflow, updateWorkflow } = useWorkflowBuilder();
  const deleteWorkflow = useDeleteWorkflow();
  
  // Load existing data for edit mode
  const { data: existingData, isLoading: loadingData } = useWorkflowBuilderData(
    mode === 'edit' ? workflowId : undefined
  );
  
  // Load all workflows for name validation
  const { data: allWorkflows } = useWorkflows();
  
  const [formData, setFormData] = useState<WorkflowBuilderData>({
    title: '',
    description: '',
    master_prompt: '',
    login_template: '',
    files: []
  });

  // Load existing data when available
  useEffect(() => {
    if (existingData && mode === 'edit') {
      setFormData(existingData);
    }
  }, [existingData, mode]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('basic');
      setPendingFiles([]);
      setDeleteConfirmation('');
      setShowDeleteDialog(false);
      if (mode === 'create') {
        setFormData({
          title: '',
          description: '',
          master_prompt: '',
          login_template: '',
          files: []
        });
      }
    }
  }, [isOpen, mode]);

  const handleSave = async () => {
    try {
      if (mode === 'create') {
        await createWorkflow.mutateAsync({
          workflow_data: formData,
          project_id: projectId,
          files: pendingFiles
        });
      } else if (workflowId) {
        await updateWorkflow.mutateAsync({
          workflowId,
          request: {
            workflow_id: workflowId,
            workflow_data: formData
          }
        });
      }
      onWorkflowSaved?.();
      onClose();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error saving workflow:', error);
    }
  };

  const handleDelete = async () => {
    if (!workflowId) return;
    try {
      await deleteWorkflow.mutateAsync(workflowId);
      onWorkflowSaved?.(); // Refresh the workflow list
      onClose();
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
  };

  const handleFilesChange = (files: WorkflowFile[]) => {
    setFormData(prev => ({ ...prev, files }));
  };

  // Check if workflow name already exists in the project
  const isDuplicateName = mode === 'create' && allWorkflows?.some(
    workflow => workflow.name.toLowerCase() === formData.title.trim().toLowerCase() && 
                workflow.project_id === projectId
  );

  const isLoading = createWorkflow.isPending || updateWorkflow.isPending;
  const canSave = formData.title.trim() && formData.master_prompt.trim() && !isDuplicateName;
  const canDelete = deleteConfirmation.trim() === formData.title.trim();

  if (loadingData && mode === 'edit') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading workflow data...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create New Workflow' : 'Edit Workflow'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="prompt">Master Prompt</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter workflow title..."
                  maxLength={255}
                  className={isDuplicateName ? 'border-red-500 focus:border-red-500' : ''}
                />
                {isDuplicateName && (
                  <p className="text-sm text-red-500">
                    A workflow with this name already exists in this project. Please choose a different name.
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="prompt" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="master_prompt">
                  Master Prompt (Markdown) <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="master_prompt"
                  value={formData.master_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, master_prompt: e.target.value }))}
                  placeholder="Enter your workflow prompt in markdown..."
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Use markdown formatting to organize your workflow instructions.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="files" className="space-y-4">
              <FileUploadZone
                workflowId={workflowId}
                files={formData.files}
                onFilesChange={handleFilesChange}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                mode={mode}
              />
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-between items-center pt-4 border-t">
            {/* Delete button - only show in edit mode */}
            {mode === 'edit' && workflowId && (
              <Button 
                variant="destructive" 
                size="sm"
                disabled={isLoading || deleteWorkflow.isPending}
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workflow
              </Button>
            )}
            
            {/* Right side buttons */}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!canSave || isLoading}
                title={isDuplicateName ? 'Please choose a different workflow name' : (!formData.title.trim() ? 'Title is required' : (!formData.master_prompt.trim() ? 'Master prompt is required' : ''))}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create Workflow' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4">
              <p>
                This action cannot be undone. This will permanently delete the workflow 
                <strong> "{formData.title}"</strong> and all associated files.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation" className="text-sm font-medium">
                  Please type <strong>"{formData.title}"</strong> to confirm.
                </Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Enter workflow name to confirm..."
                  className={deleteConfirmation && !canDelete ? 'border-red-500 focus:border-red-500' : ''}
                />
                {deleteConfirmation && !canDelete && (
                  <p className="text-sm text-red-500">
                    The name doesn't match. Please type the exact workflow name.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteWorkflow.isPending}
              onClick={() => {
                setDeleteConfirmation('');
                setShowDeleteDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={!canDelete || deleteWorkflow.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteWorkflow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
