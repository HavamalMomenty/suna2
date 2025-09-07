"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Trash2, AlertTriangle, Star } from 'lucide-react';
import { useIsAdmin } from '@/hooks/use-admin';
import { toggleWorkflowDefaultStatus } from '@/lib/api';
import { toast } from 'sonner';
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
  mode: 'create' | 'edit' | 'view';
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
  const [displayImageUrl, setDisplayImageUrl] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { createWorkflow, updateWorkflow } = useWorkflowBuilder();
  const deleteWorkflow = useDeleteWorkflow();
  
  // Load existing data for edit and view modes
  const { data: existingData, isLoading: loadingData } = useWorkflowBuilderData(
    (mode === 'edit' || mode === 'view') ? workflowId : undefined
  );
  
  // Load all workflows for name validation
  const { data: allWorkflows } = useWorkflows();
  
  // Check if current user is admin
  const { data: isAdmin = false } = useIsAdmin();
  
  const [formData, setFormData] = useState<WorkflowBuilderData>({
    title: '',
    description: '',
    master_prompt: '',
    login_template: '',
    files: [],
    image_url: ''
  });
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Update display URL when image path changes
  useEffect(() => {
    const updateDisplayUrl = async () => {
      if (formData.image_url) {
        const url = await getImageUrl(formData.image_url);
        setDisplayImageUrl(url);
      } else {
        setDisplayImageUrl('');
      }
    };
    updateDisplayUrl();
  }, [formData.image_url]);

  // Load existing data when available
  useEffect(() => {
    if (existingData && (mode === 'edit' || mode === 'view')) {
      console.log('Loading existing data:', existingData);
      console.log('Image URL in existing data:', existingData.image_url);
      setFormData(existingData);
      // Set the selected file name if there's an image
      if (existingData.image_url) {
        const fileName = existingData.image_url.split('/').pop() || 'Image';
        setSelectedFileName(fileName);
        console.log('Loading existing image:', existingData.image_url);
        console.log('Set selectedFileName to:', fileName);
        // Generate display URL for existing image
        getImageUrl(existingData.image_url).then(url => {
          console.log('Generated display URL:', url);
          setDisplayImageUrl(url);
        }).catch(error => {
          console.error('Error loading existing image:', error);
        });
      } else {
        console.log('No image_url found in existing data');
        setSelectedFileName('');
        setDisplayImageUrl('');
      }
    }
  }, [existingData, mode]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('basic');
      setPendingFiles([]);
      setDeleteConfirmation('');
      setShowDeleteDialog(false);
      setDisplayImageUrl('');
      setIsUploadingImage(false);
      if (mode === 'create') {
        setFormData({
          title: '',
          description: '',
          master_prompt: '',
          login_template: '',
          files: [],
          image_url: ''
        });
        setSelectedFileName('');
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName('');
      return;
    }

    // Set file name
    setSelectedFileName(file.name);

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast.error('Please upload a JPEG or PNG image');
      setSelectedFileName('');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      setSelectedFileName('');
      return;
    }

    try {
      setIsUploadingImage(true);
      // Upload to Supabase Storage
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `workflow-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('workflow-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Store the file path instead of signed URL for better reliability
      setFormData(prev => ({ ...prev, image_url: filePath }));
      console.log('Image uploaded, stored path:', filePath);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      setSelectedFileName('');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    // If there's an existing image URL, try to delete it from storage
    if (formData.image_url && formData.image_url.includes('workflow-images/')) {
      try {
        const supabase = createClient();
        const fileName = formData.image_url.split('workflow-images/')[1];
        await supabase.storage
          .from('workflow-images')
          .remove([`workflow-images/${fileName}`]);
      } catch (error) {
        console.error('Error deleting image from storage:', error);
        // Continue anyway - the main goal is to clear the form
      }
    }
    
    setFormData(prev => ({ ...prev, image_url: '' }));
    setSelectedFileName('');
  };

  const handleToggleDefaultStatus = async () => {
    if (!workflowId) return;
    
    try {
      const updatedWorkflow = await toggleWorkflowDefaultStatus(workflowId);
      const isNowDefault = updatedWorkflow.name.endsWith(' (Default)');
      
      if (isNowDefault) {
        toast.success('Workflow promoted to default!');
      } else {
        toast.success('Workflow de-promoted from default!');
      }
      
      onWorkflowSaved?.(); // Refresh the workflow list
    } catch (error) {
      toast.error('Failed to toggle workflow default status');
      console.error('Error toggling workflow default status:', error);
    }
  };

  // Check if workflow name already exists in the project
  const isDuplicateName = mode === 'create' && allWorkflows?.some(
    workflow => workflow.name.toLowerCase() === formData.title.trim().toLowerCase() && 
                workflow.project_id === projectId
  );

  const isLoading = createWorkflow.isPending || updateWorkflow.isPending || isUploadingImage;
  const canSave = formData.title.trim() && formData.master_prompt.trim() && !isDuplicateName && !isUploadingImage;
  const canDelete = deleteConfirmation.trim() === formData.title.trim();

  if (loadingData && (mode === 'edit' || mode === 'view')) {
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
              {mode === 'create' ? 'Create New Workflow' : mode === 'edit' ? 'Edit Workflow' : 'View Workflow'}
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
                  readOnly={mode === 'view'}
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
                  readOnly={mode === 'view'}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflow-image">Workflow Image</Label>
                <p className="text-xs text-muted-foreground">
                  Upload a JPEG or PNG image to customize your workflow card appearance
                </p>
                <div className="flex items-center gap-4 py-3">
                  {mode !== 'view' && (
                    <div className="relative flex-1">
                      <div className="relative">
                        <Input
                          id="workflow-image"
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleImageUpload}
                          className="h-12 cursor-pointer opacity-0 absolute inset-0 z-10"
                        />
                        <div className="h-12 border border-input bg-background rounded-md flex items-center px-3 hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="h-8 px-4 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium">
                              {formData.image_url ? 'Change Image' : 'Choose File'}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {selectedFileName || (formData.image_url ? '' : 'No file chosen')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {displayImageUrl && (
                    <div className="relative">
                      <img 
                        src={displayImageUrl} 
                        alt="Workflow preview" 
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                      {mode !== 'view' && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/90"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin-only promote to default option */}
              {isAdmin && mode === 'edit' && workflowId && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-medium">Admin Options</Label>
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Promote to Default Workflow</p>
                        <p className="text-xs text-muted-foreground">
                          Make this workflow available to all users as a default template
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleDefaultStatus}
                      className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {formData.title.endsWith(' (Default)') ? 'De-promote' : 'Promote'}
                    </Button>
                  </div>
                </div>
              )}
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
                  readOnly={mode === 'view'}
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
              {mode === 'view' ? (
                <Button onClick={onClose}>
                  Close
                </Button>
              ) : (
                <>
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
                </>
              )}
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
              <div>
                This action cannot be undone. This will permanently delete the workflow 
                <strong> "{formData.title}"</strong> and all associated files.
              </div>
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
                  <div className="text-sm text-red-500">
                    The name doesn't match. Please type the exact workflow name.
                  </div>
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
