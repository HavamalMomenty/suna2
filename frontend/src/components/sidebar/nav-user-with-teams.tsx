'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  Command,
  CreditCard,
  LogOut,
  Plus,
  Settings,
  User,
  AudioWaveform,
  Sun,
  Moon,
  Trash2,
  Key,
} from 'lucide-react';
import { useAccounts } from '@/hooks/use-accounts';
import NewTeamForm from '@/components/basejump/new-team-form';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { useDeleteMultipleThreads, useThreads } from '@/hooks/react-query/sidebar/use-sidebar';
import { useQueryClient } from '@tanstack/react-query';
import { threadKeys } from '@/hooks/react-query/sidebar/keys';
import { toast } from 'sonner';
import { TokenManagementModal } from '@/components/TokenManagementModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function NavUserWithTeams({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { data: accounts } = useAccounts();
  const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = React.useState(false);
  const [showTokenModal, setShowTokenModal] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  
  const { data: threads = [] } = useThreads();
  const { mutate: deleteMultipleThreadsMutation, isPending: isDeletingAll } = useDeleteMultipleThreads();

  // Prepare personal account and team accounts
  const personalAccount = React.useMemo(
    () => accounts?.find((account) => account.personal_account),
    [accounts],
  );
  const teamAccounts = React.useMemo(
    () => accounts?.filter((account) => !account.personal_account),
    [accounts],
  );

  // Create a default list of teams with logos for the UI (will show until real data loads)
  const defaultTeams = [
    {
      name: personalAccount?.name || 'Personal Account',
      logo: Command,
      plan: 'Personal',
      account_id: personalAccount?.account_id,
      slug: personalAccount?.slug,
      personal_account: true,
    },
    ...(teamAccounts?.map((team) => ({
      name: team.name,
      logo: AudioWaveform,
      plan: 'Team',
      account_id: team.account_id,
      slug: team.slug,
      personal_account: false,
    })) || []),
  ];

  // Use the first team or first entry in defaultTeams as activeTeam
  const [activeTeam, setActiveTeam] = React.useState(defaultTeams[0]);

  // Update active team when accounts load
  React.useEffect(() => {
    if (accounts?.length) {
      const currentTeam = accounts.find(
        (account) => account.account_id === activeTeam.account_id,
      );
      if (currentTeam) {
        setActiveTeam({
          name: currentTeam.name,
          logo: currentTeam.personal_account ? Command : AudioWaveform,
          plan: currentTeam.personal_account ? 'Personal' : 'Team',
          account_id: currentTeam.account_id,
          slug: currentTeam.slug,
          personal_account: currentTeam.personal_account,
        });
      } else {
        // If current team not found, set first available account as active
        const firstAccount = accounts[0];
        setActiveTeam({
          name: firstAccount.name,
          logo: firstAccount.personal_account ? Command : AudioWaveform,
          plan: firstAccount.personal_account ? 'Personal' : 'Team',
          account_id: firstAccount.account_id,
          slug: firstAccount.slug,
          personal_account: firstAccount.personal_account,
        });
      }
    }
  }, [accounts, activeTeam.account_id]);

  // Handle team selection
  const handleTeamSelect = (team) => {
    setActiveTeam(team);

    // Navigate to the appropriate dashboard
    if (team.personal_account) {
      router.push('/dashboard');
    } else {
      router.push(`/${team.slug}`);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleDeleteAllConversations = () => {
    if (threads.length === 0) {
      toast.info('No conversations to delete');
      return;
    }
    setShowDeleteAllDialog(true);
  };

  const confirmDeleteAllConversations = () => {
    if (threads.length === 0) return;

    const threadIds = threads.map(thread => thread.thread_id);
    
    deleteMultipleThreadsMutation(
      {
        threadIds,
        threadSandboxMap: Object.fromEntries(
          threads.map(thread => [thread.thread_id, ''])
        ),
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
          toast.success(`Successfully deleted ${data.successful.length} conversations`);
          setShowDeleteAllDialog(false);
        },
        onError: (error) => {
          console.error('Error deleting all conversations:', error);
          toast.error('Error deleting conversations');
        },
      }
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (!activeTeam) {
    return null;
  }

  return (
    <>
      <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'top'}
                align="start"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-lg">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Teams Section */}
                {personalAccount && (
                  <>
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Personal Account
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      key={personalAccount.account_id}
                      onClick={() =>
                        handleTeamSelect({
                          name: personalAccount.name,
                          logo: Command,
                          plan: 'Personal',
                          account_id: personalAccount.account_id,
                          slug: personalAccount.slug,
                          personal_account: true,
                        })
                      }
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-xs border">
                        <Command className="size-4 shrink-0" />
                      </div>
                      {personalAccount.name}
                      <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </>
                )}

                {teamAccounts?.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-muted-foreground text-xs mt-2">
                      Teams
                    </DropdownMenuLabel>
                    {teamAccounts.map((team, index) => (
                      <DropdownMenuItem
                        key={team.account_id}
                        onClick={() =>
                          handleTeamSelect({
                            name: team.name,
                            logo: AudioWaveform,
                            plan: 'Team',
                            account_id: team.account_id,
                            slug: team.slug,
                            personal_account: false,
                          })
                        }
                        className="gap-2 p-2"
                      >
                        <div className="flex size-6 items-center justify-center rounded-xs border">
                          <AudioWaveform className="size-4 shrink-0" />
                        </div>
                        {team.name}
                        <DropdownMenuShortcut>⌘{index + 2}</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}

                {/* <DropdownMenuSeparator />
                <DialogTrigger asChild>
                  <DropdownMenuItem 
                    className="gap-2 p-2"
                    onClick={() => {
                      setShowNewTeamDialog(true)
                    }}
                  >
                    <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                      <Plus className="size-4" />
                    </div>
                    <div className="text-muted-foreground font-medium">Add team</div>
                  </DropdownMenuItem>
                </DialogTrigger> */}
                <DropdownMenuSeparator />

                {/* User Settings Section */}
                <DropdownMenuGroup>
                  {/* <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    onClick={() => setShowTokenModal(true)}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Connect to Resights/Redata
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span>Theme</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {/* Delete All Conversations Button - only show for personal account */}
                {personalAccount && threads.length > 0 && (
                  <DropdownMenuItem
                    onClick={handleDeleteAllConversations}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    Delete All Conversations
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className='text-destructive focus:text-destructive focus:bg-destructive/10' onClick={handleLogout}>
                  <LogOut className="h-4 w-4 text-destructive" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <DialogContent className="sm:max-w-[425px] border-subtle dark:border-white/10 bg-card-bg dark:bg-background-secondary rounded-2xl shadow-custom">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Create a new team
            </DialogTitle>
            <DialogDescription className="text-foreground/70">
              Create a team to collaborate with others.
            </DialogDescription>
          </DialogHeader>
          <NewTeamForm />
        </DialogContent>
      </Dialog>

      {/* Delete All Conversations Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent className="bg-white dark:bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete All Conversations</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {threads.length} conversations? This action cannot be undone and will permanently remove all your chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAllConversations}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Token Management Modal */}
      <TokenManagementModal
        open={showTokenModal}
        onOpenChange={setShowTokenModal}
      />
    </>
  );
}
