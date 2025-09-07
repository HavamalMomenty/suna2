'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowCards } from '@/components/workflows/WorkflowCards';
import { getProjects } from '@/lib/api';

export const Examples = ({
  onSelectPrompt,
  onSelectWorkflow,
  onDoubleClickWorkflow,
}: {
  onSelectPrompt?: (query: string) => void;
  onSelectWorkflow?: (workflow: any) => void;
  onDoubleClickWorkflow?: (workflow: any) => void;
}) => {
  const [projectId, setProjectId] = useState<string | null>(null);

  // Get the first project ID for workflows
  useEffect(() => {
    const loadProjectId = async () => {
      try {
        const projects = await getProjects();
        if (projects.length > 0) {
          setProjectId(projects[0].id);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    };
    loadProjectId();
  }, []);

  const handleWorkflowSelect = (workflow: any) => {
    if (onSelectWorkflow) {
      onSelectWorkflow(workflow);
    } else if (onSelectPrompt && workflow.master_prompt) {
      // Fallback: if no workflow handler, just use the master prompt
      onSelectPrompt(workflow.master_prompt);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-muted-foreground font-medium">Workflows</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-sidebar animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <WorkflowCards 
      onSelectWorkflow={handleWorkflowSelect}
      onDoubleClickWorkflow={onDoubleClickWorkflow}
      projectId={projectId}
    />
  );
};