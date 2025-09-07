'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, RefreshCw, Eye, Copy } from 'lucide-react';
import { WorkflowBuilderModal } from './WorkflowBuilderModal';
import { useQuery } from '@tanstack/react-query';
import { getWorkflows, viewWorkflow, copyWorkflow, type Workflow } from '@/lib/api';
import { toast } from 'sonner';
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

interface WorkflowCardsProps {
  onSelectWorkflow?: (workflow: Workflow) => void;
  projectId: string;
  onDoubleClickWorkflow?: (workflow: Workflow) => void;
}

export const WorkflowCards = ({ onSelectWorkflow, projectId, onDoubleClickWorkflow }: WorkflowCardsProps) => {
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderWorkflowId, setBuilderWorkflowId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'create' | 'edit' | 'view'>('create');

  // Fetch workflows
  const { data: workflows = [], isLoading, refetch } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => getWorkflows(projectId),
    enabled: !!projectId,
  });

  // Check if current user is admin
  const { data: isAdmin = false } = useIsAdmin();



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

  const handleWorkflowSaved = () => {
    handleCloseBuilderModal();
    refetch(); // Refresh workflows list
  };

  const handleWorkflowClick = (workflow: any) => {
    if (onSelectWorkflow) {
      onSelectWorkflow(workflow);
    }
  };

  const handleWorkflowDoubleClick = (workflow: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDoubleClickWorkflow) {
      toast.success(`Running ${workflow.name}...`);
      onDoubleClickWorkflow(workflow);
    }
  };

  const handleViewWorkflow = async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Open the workflow in view mode
      handleOpenBuilderModal(workflow.id, 'view');
      toast.success('Opening workflow in view mode');
    } catch (error) {
      console.error('Error viewing workflow:', error);
      toast.error('Failed to view workflow');
    }
  };

  const handleCopyWorkflow = async (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const copiedWorkflow = await copyWorkflow(workflow.id, projectId);
      toast.success(`Workflow copied as "${copiedWorkflow.name}"`);
      // Refresh the workflows list
      refetch();
    } catch (error) {
      console.error('Error copying workflow:', error);
      toast.error('Failed to copy workflow');
    }
  };





  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-muted-foreground font-medium">Workflows</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-sidebar animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Separate workflows into pre-built and custom
  const preBuiltWorkflows = workflows.filter(w => w.default_workflow === true);
  const customWorkflows = workflows.filter(w => w.default_workflow !== true);

  const renderWorkflowSection = (workflows: Workflow[], title: string, showAddButton: boolean = false) => {
    if (workflows.length === 0 && !showAddButton) {
      return null;
    }

    return (
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          {showAddButton && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={10} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenBuilderModal(null, 'create')}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus size={10} />
                Add
              </Button>
            </div>
          )}
        </div>

        {workflows.length === 0 ? (
          // Empty state
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card
              className="group cursor-pointer h-full shadow-none transition-all bg-sidebar hover:bg-neutral-100 dark:hover:bg-neutral-800/60 p-0 justify-center border-dashed"
              onClick={() => handleOpenBuilderModal(null, 'create')}
            >
              <CardHeader className="p-4 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Plus size={20} />
                  <span className="text-xs">Create your first workflow</span>
                </div>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workflows.map((workflow, index) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: "easeOut"
                }}
              >
                <Card 
                  className="group cursor-pointer h-34 w-full shadow-none transition-all p-0 justify-center relative bg-sidebar hover:bg-neutral-100 dark:hover:bg-neutral-800/60 rounded-lg overflow-hidden active:scale-95"
                  onClick={() => handleWorkflowClick(workflow)}
                  onDoubleClick={(e) => handleWorkflowDoubleClick(workflow, e)}
                  title="Click to select, double-click to run"
                >
                  {/* Background Image */}
                  {workflow.image_url && (
                    <div className="absolute inset-0">
                      <WorkflowImage 
                        imagePath={workflow.image_url}
                        alt={workflow.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Dark overlay for better text readability */}
                      <div className="absolute inset-0 bg-black/20" />
                    </div>
                  )}
                  
                  {/* Title overlay - positioned in top 1/3 */}
                  <div className="absolute top-0 left-0 right-0 h-11 bg-background/70 backdrop-blur-sm flex items-center justify-center p-2 -mx-0.5">
                    <CardTitle className="font-medium text-foreground text-sm leading-tight line-clamp-2 text-center">
                      {workflow.name}
                    </CardTitle>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* For default workflows: Different buttons for admins vs non-admins */}
                    {workflow.default_workflow ? (
                      isAdmin ? (
                        /* Admin: Edit and Copy buttons */
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBuilderModal(workflow.id, 'edit');
                            }}
                            title="Edit workflow"
                          >
                            <Settings size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => handleCopyWorkflow(workflow, e)}
                            title="Copy workflow"
                          >
                            <Copy size={12} />
                          </Button>
                        </>
                      ) : (
                        /* Non-admin: View and Copy buttons */
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => handleViewWorkflow(workflow, e)}
                            title="View workflow (read-only)"
                          >
                            <Eye size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => handleCopyWorkflow(workflow, e)}
                            title="Copy workflow"
                          >
                            <Copy size={12} />
                          </Button>
                        </>
                      )
                    ) : (
                      /* For custom workflows: Edit button */
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBuilderModal(workflow.id, 'edit');
                        }}
                        title="Edit workflow"
                      >
                        <Settings size={12} />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
            
            {/* Add workflow card - only show for custom workflows section */}
            {showAddButton && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  delay: workflows.length * 0.05,
                  ease: "easeOut"
                }}
              >
                <Card
                  className="group cursor-pointer h-full shadow-none transition-all bg-sidebar hover:bg-neutral-100 dark:hover:bg-neutral-800/60 p-0 justify-center border-dashed"
                  onClick={() => handleOpenBuilderModal(null, 'create')}
                >
                  <CardHeader className="p-2 flex items-center justify-center">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Plus size={14} />
                      <span className="text-xs">Add workflow</span>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Pre-built Workflows Section */}
      {renderWorkflowSection(preBuiltWorkflows, "Pre-built Workflows", false)}
      
      {/* Custom Workflows Section */}
      {renderWorkflowSection(customWorkflows, "Custom Workflows", true)}

      {/* Workflow Builder Modal */}
      {projectId && (
        <WorkflowBuilderModal 
          isOpen={builderModalOpen} 
          workflowId={builderWorkflowId} 
          mode={builderMode} 
          projectId={projectId}
          onClose={handleCloseBuilderModal}
          onWorkflowSaved={handleWorkflowSaved}
        />
      )}
    </div>
  );
};
