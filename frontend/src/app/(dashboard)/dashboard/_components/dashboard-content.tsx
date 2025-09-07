'use client';

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import {
  ChatInput,
  ChatInputHandles,
} from '@/components/thread/chat-input/chat-input';
import {
  BillingError,
} from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBillingError } from '@/hooks/useBillingError';
import { BillingErrorAlert } from '@/components/billing/usage-limit-alert';
import { useAccounts } from '@/hooks/use-accounts';
import { config } from '@/lib/config';
import { useInitiateAgentWithInvalidation } from '@/hooks/react-query/dashboard/use-initiate-agent';
import { ModalProviders } from '@/providers/modal-providers';
import { AgentSelector } from '@/components/dashboard/agent-selector';
import { cn } from '@/lib/utils';
import { useModal } from '@/hooks/use-modal-store';
import { Examples } from './suggestions/examples';
import { useThreadQuery } from '@/hooks/react-query/threads/use-threads';
import { normalizeFilenameToNFC } from '@/lib/utils/unicode';
import { useWorkflowFiles } from '@/hooks/react-query/workflows/use-workflow-builder';
import { downloadWorkflowFiles } from '@/lib/workflow-utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

export function DashboardContent() {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [workflowLoadingMessage, setWorkflowLoadingMessage] = useState('');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [initiatedThreadId, setInitiatedThreadId] = useState<string | null>(null);
  const { billingError, handleBillingError, clearBillingError } =
    useBillingError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find((account) => account.personal_account);
  const chatInputRef = useRef<ChatInputHandles>(null);
  const initiateAgentMutation = useInitiateAgentWithInvalidation();
  const { onOpen } = useModal();

  const threadQuery = useThreadQuery(initiatedThreadId || '');

  useEffect(() => {
    const agentIdFromUrl = searchParams.get('agent_id');
    if (agentIdFromUrl && agentIdFromUrl !== selectedAgentId) {
      setSelectedAgentId(agentIdFromUrl);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('agent_id');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, selectedAgentId, router]);

  useEffect(() => {
    if (threadQuery.data && initiatedThreadId) {
      const thread = threadQuery.data;
      console.log('Thread data received:', thread);
      if (thread.project_id) {
        router.push(`/projects/${thread.project_id}/thread/${initiatedThreadId}`);
      } else {
        router.push(`/agents/${initiatedThreadId}`);
      }
      setInitiatedThreadId(null);
    }
  }, [threadQuery.data, initiatedThreadId, router]);

  const secondaryGradient =
    'bg-gradient-to-r from-blue-500 to-blue-500 bg-clip-text text-transparent';

  const handleSubmit = async (
    message: string,
    options?: {
      model_name?: string;
      enable_thinking?: boolean;
      reasoning_effort?: string;
      stream?: boolean;
      enable_context_manager?: boolean;
    },
  ) => {
    if (
      (!message.trim() && !chatInputRef.current?.getPendingFiles().length) ||
      isSubmitting
    )
      return;

    setIsSubmitting(true);

    try {
      const files = chatInputRef.current?.getPendingFiles() || [];
      localStorage.removeItem(PENDING_PROMPT_KEY);

      const formData = new FormData();
      formData.append('prompt', message);

      // Add selected agent if one is chosen
      if (selectedAgentId) {
        formData.append('agent_id', selectedAgentId);
      }

      files.forEach((file, index) => {
        const normalizedName = normalizeFilenameToNFC(file.name);
        formData.append('files', file, normalizedName);
      });

      if (options?.model_name) formData.append('model_name', options.model_name);
      formData.append('enable_thinking', String(options?.enable_thinking ?? false));
      formData.append('reasoning_effort', options?.reasoning_effort ?? 'low');
      formData.append('stream', String(options?.stream ?? true));
      formData.append('enable_context_manager', String(options?.enable_context_manager ?? false));

      console.log('FormData content:', Array.from(formData.entries()));

      const result = await initiateAgentMutation.mutateAsync(formData);
      console.log('Agent initiated:', result);

      if (result.thread_id) {
        setInitiatedThreadId(result.thread_id);
      } else {
        throw new Error('Agent initiation did not return a thread_id.');
      }
      chatInputRef.current?.clearPendingFiles();
    } catch (error: any) {
      console.error('Error during submission process:', error);
      if (error instanceof BillingError) {
        console.log('Handling BillingError:', error.detail);
        onOpen("paymentRequiredDialog");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkflowExecution = async (workflow: any) => {
    try {
      console.log('🔄 Workflow execution started:', workflow);
      console.log('📝 Master prompt:', workflow.master_prompt);
      
      // Show loading overlay with spinner
      setIsWorkflowLoading(true);
      setWorkflowLoadingMessage(`Starting ${workflow.name}...`);
      
      // Fetch workflow files from the API first
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      setWorkflowLoadingMessage('Loading workflow files...');
      const filesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/workflows/${workflow.id}/files`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (filesResponse.ok) {
        const workflowFiles = await filesResponse.json();
        console.log('📄 Workflow files found:', workflowFiles);
        
        if (workflowFiles && workflowFiles.length > 0) {
          setWorkflowLoadingMessage(`Downloading ${workflowFiles.length} file(s)...`);
          // Download workflow files
          const downloadedFiles = await downloadWorkflowFiles(workflow.id, workflowFiles);
          
          // Add files to the chat input
          downloadedFiles.forEach(file => {
            chatInputRef.current?.addFile(file);
          });
          
          console.log('✅ Added', downloadedFiles.length, 'files to chat input');
          toast.success(`Loaded ${downloadedFiles.length} file(s) from workflow`);
          
          // Wait a moment for files to be properly added to the chat input
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Directly trigger the conversation with the master prompt
      console.log('🚀 Calling handleSubmit with master prompt:', workflow.master_prompt);
      setWorkflowLoadingMessage('Launching workflow...');
      
      // Debug: Check if files are in chat input before submission
      const pendingFiles = chatInputRef.current?.getPendingFiles() || [];
      console.log('📋 Files in chat input before submission:', pendingFiles.length, pendingFiles.map(f => f.name));
      
      await handleSubmit(workflow.master_prompt || '');
      
    } catch (error) {
      console.error('❌ Error executing workflow:', error);
      toast.error('Failed to execute workflow. Please try again.');
    } finally {
      // Hide loading overlay
      setIsWorkflowLoading(false);
      setWorkflowLoadingMessage('');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);

      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting]);

  return (
    <>
      <ModalProviders />
      <LoadingOverlay 
        isVisible={isWorkflowLoading} 
        message={workflowLoadingMessage}
      />
      <div className="flex flex-col min-h-screen w-full">
        {isMobile && (
          <div className="absolute top-4 left-4 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOpenMobile(true)}
                >
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open menu</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-50 w-full">
          <div className="w-[650px] max-w-[90%]">
          <div className="flex flex-col items-center text-center w-full">
            <div className="flex items-center gap-1">
              <h1 className="tracking-tight text-4xl text-muted-foreground leading-tight">
                Hey, I am
              </h1>
              <AgentSelector
                selectedAgentId={selectedAgentId}
                onAgentSelect={setSelectedAgentId}
                variant="heading"
              />
            </div>
            <p className="tracking-tight text-3xl font-normal text-muted-foreground/80 mt-2">
              What would you like to do today?
            </p>
          </div>

          <div className={cn(
            "w-full mb-2",
            "max-w-full",
            "sm:max-w-3xl"
          )}>
            <ChatInput
              ref={chatInputRef}
              onSubmit={handleSubmit}
              loading={isSubmitting}
              placeholder="Describe what you need help with..."
              value={inputValue}
              onChange={setInputValue}
              hideAttachments={false}
            />
          </div>

          <Examples 
            onSelectPrompt={setInputValue} 
            onSelectWorkflow={handleWorkflowExecution}
            onDoubleClickWorkflow={handleWorkflowExecution}
          />
          </div>
        </div>

        <BillingErrorAlert
          message={billingError?.message}
          currentUsage={billingError?.currentUsage}
          limit={billingError?.limit}
          accountId={personalAccount?.account_id}
          onDismiss={clearBillingError}
          isOpen={!!billingError}
        />
      </div>
    </>
  );
}
