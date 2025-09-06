'use client';
import { HeroVideoSection } from '@/components/home/sections/hero-video-section';
import { siteConfig } from '@/lib/home';
import { ArrowRight, Github, X, AlertCircle } from 'lucide-react';
import { FlickeringGrid } from '@/components/home/ui/flickering-grid';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useScroll } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  BillingError,
} from '@/lib/api';
import { useInitiateAgentMutation } from '@/hooks/react-query/dashboard/use-initiate-agent';
import { useThreadQuery } from '@/hooks/react-query/threads/use-threads';
import { generateThreadName } from '@/lib/actions/threads';
import GoogleSignIn from '@/components/GoogleSignIn';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { BillingErrorAlert } from '@/components/billing/usage-limit-alert';
import { useBillingError } from '@/hooks/useBillingError';
import { useAccounts } from '@/hooks/use-accounts';
import { isLocalMode, config } from '@/lib/config';
import { toast } from 'sonner';
import { useModal } from '@/hooks/use-modal-store';

// Custom dialog overlay with blur effect
const BlurredDialogOverlay = () => (
  <DialogOverlay className="bg-background/40 backdrop-blur-md" />
);

// Constant for localStorage key to ensure consistency
const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

export function HeroSection() {
  const { hero } = siteConfig;
  const tablet = useMediaQuery('(max-width: 1024px)');
  const [mounted, setMounted] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();
  const [inputValue, setInputValue] = useState('');
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { billingError, handleBillingError, clearBillingError } =
    useBillingError();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find((account) => account.personal_account);
  const { onOpen } = useModal();
  const initiateAgentMutation = useInitiateAgentMutation();
  const [initiatedThreadId, setInitiatedThreadId] = useState<string | null>(null);
  const threadQuery = useThreadQuery(initiatedThreadId || '');

  // Auth dialog state
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect when scrolling is active to reduce animation complexity
  useEffect(() => {
    const unsubscribe = scrollY.on('change', () => {
      setIsScrolling(true);

      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Set a new timeout
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300); // Wait 300ms after scroll stops
    });

    return () => {
      unsubscribe();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [scrollY]);

  useEffect(() => {
    if (authDialogOpen && inputValue.trim()) {
      localStorage.setItem(PENDING_PROMPT_KEY, inputValue.trim());
    }
  }, [authDialogOpen, inputValue]);

  useEffect(() => {
    if (authDialogOpen && user && !isLoading) {
      setAuthDialogOpen(false);
      router.push('/dashboard');
    }
  }, [user, isLoading, authDialogOpen, router]);

  useEffect(() => {
    if (threadQuery.data && initiatedThreadId) {
      const thread = threadQuery.data;
      if (thread.project_id) {
        router.push(`/projects/${thread.project_id}/thread/${initiatedThreadId}`);
      } else {
        router.push(`/thread/${initiatedThreadId}`);
      }
      setInitiatedThreadId(null);
    }
  }, [threadQuery.data, initiatedThreadId, router]);

  const createAgentWithPrompt = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('prompt', inputValue.trim());
      formData.append('model_name', 'openrouter/deepseek/deepseek-chat'); 
      formData.append('enable_thinking', 'false');
      formData.append('reasoning_effort', 'low');
      formData.append('stream', 'true');
      formData.append('enable_context_manager', 'false');

      const result = await initiateAgentMutation.mutateAsync(formData);

      setInitiatedThreadId(result.thread_id);
      setInputValue('');
    } catch (error: any) {
      if (error instanceof BillingError) {
        console.log('Billing error:');
      } else {
        const isConnectionError =
          error instanceof TypeError &&
          error.message.includes('Failed to fetch');
        if (!isLocalMode() || isConnectionError) {
          toast.error(
            error.message || 'Failed to create agent. Please try again.',
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation(); // Stop event propagation to prevent dialog closing
    }

    if (!inputValue.trim() || isSubmitting) return;

    // If user is not logged in, save prompt and show auth dialog
    if (!user && !isLoading) {
      // Save prompt to localStorage BEFORE showing the dialog
      localStorage.setItem(PENDING_PROMPT_KEY, inputValue.trim());
      setAuthDialogOpen(true);
      return;
    }

    // User is logged in, create the agent
    createAgentWithPrompt();
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default form submission
      e.stopPropagation(); // Stop event propagation
      handleSubmit();
    }
  };

  // Handle auth form submission
  const handleSignIn = async (prevState: any, formData: FormData) => {
    setAuthError(null);
    try {
      // Implement sign in logic here
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      // Add the returnUrl to the form data for proper redirection
      formData.append('returnUrl', '/dashboard');

      // Call your authentication function here

      // Return any error state
      return { message: 'Invalid credentials' };
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthError(
        error instanceof Error ? error.message : 'An error occurred',
      );
      return { message: 'An error occurred during sign in' };
    }
  };

  return (
    <section id="hero" className="w-full relative overflow-visible">
      <div className="relative flex flex-col items-center w-full px-6">
        {/* Background container that extends beyond hero section */}
        <div className="fixed inset-0 w-full h-screen -z-30">
          {/* Left side flickering grid with gradient fades */}
          <div className="absolute left-0 top-0 bottom-0 w-1/3 -z-10 overflow-hidden">
            {/* Horizontal fade from left to right */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background z-10" />

            {/* Vertical fade from top */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/90 to-transparent z-10" />

            {/* No bottom fade to allow extension */}

            <FlickeringGrid
              className="h-full w-full"
              squareSize={mounted && tablet ? 2 : 2.5}
              gridGap={mounted && tablet ? 2 : 2.5}
              color="var(--secondary)"
              maxOpacity={0.4}
              flickerChance={isScrolling ? 0.01 : 0.03} // Low flickering when not scrolling
            />
          </div>

          {/* Right side flickering grid with gradient fades */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 -z-10 overflow-hidden">
            {/* Horizontal fade from right to left */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background z-10" />

            {/* Vertical fade from top */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/90 to-transparent z-10" />

            {/* No bottom fade to allow extension */}

            <FlickeringGrid
              className="h-full w-full"
              squareSize={mounted && tablet ? 2 : 2.5}
              gridGap={mounted && tablet ? 2 : 2.5}
              color="var(--secondary)"
              maxOpacity={0.4}
              flickerChance={isScrolling ? 0.01 : 0.03} // Low flickering when not scrolling
            />
          </div>

          {/* Center content background with rounded bottom */}
          <div className="absolute inset-x-1/4 top-0 bottom-0 -z-20 bg-background rounded-b-[100px]"></div>
        </div>

        <div className="relative z-10 pt-32 pb-32 max-w-3xl mx-auto h-full w-full flex flex-col gap-10 items-center justify-center">
          <h1 className="text-4xl md:text-7xl font-bold tracking-tighter text-center">
            <span className="text-secondary">Node</span>
            <span className="text-primary">, the AI-enabled system for real estate investment Analysis</span>
          </h1>
          <p className="text-base md:text-xl text-center text-muted-foreground font-medium text-balance leading-relaxed tracking-tight max-w-2xl">
            {hero.description}
          </p>
          <div className="flex items-center justify-center mt-4">
            {user ? (
              <Link 
                href="/dashboard" 
                className="px-8 py-4 rounded-full bg-secondary text-secondary-foreground font-medium text-lg hover:bg-secondary/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-secondary/20 transform hover:-translate-y-1 flex items-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="size-5" />
              </Link>
            ) : (
              <Link 
                href="/auth" 
                className="px-8 py-4 rounded-full bg-secondary text-secondary-foreground font-medium text-lg hover:bg-secondary/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-secondary/20 transform hover:-translate-y-1 flex items-center gap-2"
              >
                Get Started
                <ArrowRight className="size-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* Video section (commented out) */}
      {/* <div className="mb-10 max-w-4xl mx-auto">
        <HeroVideoSection />
      </div> */}

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <BlurredDialogOverlay />
        <DialogContent className="sm:max-w-md rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-medium">
                Sign in to continue
              </DialogTitle>
              {/* <button 
                onClick={() => setAuthDialogOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button> */}
            </div>
            <DialogDescription className="text-muted-foreground">
              Sign in or create an account to talk with Node
            </DialogDescription>
          </DialogHeader>

          {/* Auth error message */}
          {authError && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-3 bg-secondary/10 border border-secondary/20 text-secondary">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-secondary" />
              <span className="text-sm font-medium">{authError}</span>
            </div>
          )}

          {/* Google Sign In */}
          <div className="w-full">
            <GoogleSignIn returnUrl="/dashboard" />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          {/* Sign in form */}
          <form className="space-y-4">
            <div>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email address"
                className="h-12 rounded-full bg-background border-border"
                required
              />
            </div>

            <div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                className="h-12 rounded-full bg-background border-border"
                required
              />
            </div>

            <div className="space-y-4 pt-4">
              <SubmitButton
                formAction={handleSignIn}
                className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                pendingText="Signing in..."
              >
                Sign in
              </SubmitButton>

              <Link
                href={`/auth?mode=signup&returnUrl=${encodeURIComponent('/dashboard')}`}
                className="flex h-12 items-center justify-center w-full text-center rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
                onClick={() => setAuthDialogOpen(false)}
              >
                Create new account
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link
                href={`/auth?returnUrl=${encodeURIComponent('/dashboard')}`}
                className="text-sm text-primary hover:underline"
                onClick={() => setAuthDialogOpen(false)}
              >
                More sign in options
              </Link>
            </div>
          </form>

        </DialogContent>
      </Dialog>

      {/* Add Billing Error Alert here */}
      <BillingErrorAlert
        message={billingError?.message}
        currentUsage={billingError?.currentUsage}
        limit={billingError?.limit}
        accountId={personalAccount?.account_id}
        onDismiss={clearBillingError}
        isOpen={!!billingError}
      />
    </section>
  );
}
