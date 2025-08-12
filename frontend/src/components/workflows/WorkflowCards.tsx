'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, RefreshCw, Workflow } from 'lucide-react';
import { WorkflowBuilderModal } from './WorkflowBuilderModal';
import { useQuery } from '@tanstack/react-query';
import { getWorkflows } from '@/lib/api';

interface WorkflowCardsProps {
  onSelectWorkflow?: (workflow: any) => void;
  projectId: string;
}

export const WorkflowCards = ({ onSelectWorkflow, projectId }: WorkflowCardsProps) => {
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderWorkflowId, setBuilderWorkflowId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'create' | 'edit'>('create');

  // Fetch workflows
  const { data: workflows = [], isLoading, refetch } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => getWorkflows(projectId),
    enabled: !!projectId,
  });

  const handleOpenBuilderModal = (workflowId: string | null, mode: 'create' | 'edit') => {
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

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-muted-foreground font-medium">Workflows</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-sidebar animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Show all workflows, not just first 3
  const displayedWorkflows = workflows;

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-muted-foreground font-medium">Workflows</span>
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
      </div>

      {displayedWorkflows.length === 0 ? (
        // Empty state
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayedWorkflows.map((workflow, index) => (
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
              <Card className="group cursor-pointer h-full shadow-none transition-all bg-sidebar hover:bg-neutral-100 dark:hover:bg-neutral-800/60 p-0 justify-center relative">
                <CardHeader 
                  className="p-2 grid-rows-1"
                  onClick={() => handleWorkflowClick(workflow)}
                >
                  <div className="flex items-start justify-center gap-1.5">
                    <div className="flex-shrink-0 mt-0.5">
                      <Workflow size={14} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="font-normal group-hover:text-foreground transition-all text-muted-foreground text-xs leading-relaxed line-clamp-3">
                      {workflow.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                
                {/* Customize button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBuilderModal(workflow.id, 'edit');
                  }}
                >
                  <Settings size={12} />
                </Button>
              </Card>
            </motion.div>
          ))}
          
          {/* Add workflow card - always show if there's space */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.3,
              delay: displayedWorkflows.length * 0.05,
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
        </div>
      )}

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
