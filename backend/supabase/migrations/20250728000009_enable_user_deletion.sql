-- Remove the existing constraint
ALTER TABLE workflows DROP CONSTRAINT workflows_created_by_fkey;

-- Add the new constraint with CASCADE DELETE
ALTER TABLE workflows 
ADD CONSTRAINT workflows_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Fix basejump.invitations constraint
ALTER TABLE basejump.invitations DROP CONSTRAINT invitations_invited_by_user_id_fkey;
ALTER TABLE basejump.invitations 
ADD CONSTRAINT invitations_invited_by_user_id_fkey 
FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix basejump.accounts primary_owner_user_id constraint
ALTER TABLE basejump.accounts DROP CONSTRAINT accounts_primary_owner_user_id_fkey;
ALTER TABLE basejump.accounts 
ADD CONSTRAINT accounts_primary_owner_user_id_fkey 
FOREIGN KEY (primary_owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix workflow_files constraint to allow user deletion
ALTER TABLE workflow_files DROP CONSTRAINT workflow_files_created_by_fkey;
ALTER TABLE workflow_files 
ADD CONSTRAINT workflow_files_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix agent_runs.thread_id constraint
ALTER TABLE agent_runs DROP CONSTRAINT agent_runs_thread_id_fkey;
ALTER TABLE agent_runs 
ADD CONSTRAINT agent_runs_thread_id_fkey 
FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE;

-- Fix the specific constraint in the basejump schema
ALTER TABLE basejump.accounts 
DROP CONSTRAINT accounts_primary_owner_user_id_fkey;

ALTER TABLE basejump.accounts 
ADD CONSTRAINT accounts_primary_owner_user_id_fkey 
FOREIGN KEY (primary_owner_user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;