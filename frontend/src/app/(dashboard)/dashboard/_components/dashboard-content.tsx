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
import { toast } from 'sonner';

const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

export function DashboardContent() {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [initiatedThreadId, setInitiatedThreadId] = useState<string | null>(null);

  const { billingError, handleBillingError, clearBillingError } =
    useBillingError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { onOpen } = useModal();
  const { setOpen: setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const chatInputRef = useRef<ChatInputHandles>(null);
  const initiateAgentMutation = useInitiateAgentWithInvalidation();

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
      if (thread.project_id) {
        router.push(`/projects/${thread.project_id}/thread/${initiatedThreadId}`);
      } else {
        router.push(`/agents/${initiatedThreadId}`);
      }
      setInitiatedThreadId(null);
    }
  }, [threadQuery.data, initiatedThreadId, router]);

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

      if (selectedAgentId) {
        formData.append('agent_id', selectedAgentId);
      }

      files.forEach((file) => {
        formData.append(`files`, file);
      });

      if (options?.model_name) formData.append('model_name', options.model_name);
      formData.append('enable_thinking', String(options?.enable_thinking ?? false));
      formData.append('reasoning_effort', options?.reasoning_effort ?? 'low');
      formData.append('stream', String(options?.stream ?? true));
      formData.append('enable_context_manager', String(options?.enable_context_manager ?? false));

      const result = await initiateAgentMutation.mutateAsync(formData);

      if (result.thread_id) {
        setInitiatedThreadId(result.thread_id);
      } else {
        throw new Error('Agent initiation did not return a thread_id.');
      }
      chatInputRef.current?.clearPendingFiles();
    } catch (error: any) {
      if (error instanceof BillingError) {
        onOpen("paymentRequiredDialog");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkflowSelection = async (workflow: { query?: string; files?: string[], queryFromFile?: string }) => {
    // Clear previous state before loading new workflow
    chatInputRef.current?.clear();
    setInputValue('');

    setIsWorkflowLoading(true);
    let promptText = workflow.query || '';

    if (workflow.queryFromFile) {
      try {
        const response = await fetch(workflow.queryFromFile);
        if (response.ok) {
          promptText = await response.text();
        } else {
          toast.error('Failed to load workflow prompt.');
          setIsWorkflowLoading(false);
          return;
        }
      } catch (error) {
        toast.error('Error loading workflow prompt.');
        setIsWorkflowLoading(false);
        return;
      }
    }

    setInputValue(promptText);
    
    if (workflow.files && workflow.files.length > 0 && chatInputRef.current) {
      try {
        const filePromises = workflow.files.map(async (filePath) => {
          const response = await fetch(filePath);
          if (response.ok) {
            const blob = await response.blob();
            const fileName = normalizeFilenameToNFC(filePath.split('/').pop() || 'document');
            return new File([blob], fileName, { type: blob.type });
          }
          return null;
        });

        const files = (await Promise.all(filePromises)).filter(Boolean) as File[];
        
        if (files.length > 0) {
          chatInputRef.current?.addFiles?.(files);
        }

        toast.success('Workflow ready. Please upload the Investment Memorandum to proceed.');

      } catch (error) {
        console.error('Error loading workflow files:', error);
        toast.error('Error attaching workflow files.');
      }
    }
    setIsWorkflowLoading(false);
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
      <div className="flex flex-col h-screen w-full">
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

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[650px] max-w-[90%]">
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

          <Examples onSelectPrompt={setInputValue} onSelectWorkflow={handleWorkflowSelection} isLoading={isWorkflowLoading} />
        </div>

        <BillingErrorAlert
          message={billingError?.message}
          currentUsage={billingError?.currentUsage}
          limit={billingError?.limit}
          accountId={billingError?.accountId}
          onDismiss={clearBillingError}
          isOpen={!!billingError}
        />
      </div>
    </>
  );
}
