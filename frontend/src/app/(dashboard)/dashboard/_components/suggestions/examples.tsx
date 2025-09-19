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

  // Always show workflows, even without projectId (for default workflows)
  // The WorkflowCards component will handle loading default workflows

  return (
    <WorkflowCards 
      onSelectWorkflow={handleWorkflowSelect}
      onDoubleClickWorkflow={onDoubleClickWorkflow}
      projectId={projectId}
    />
  );
};