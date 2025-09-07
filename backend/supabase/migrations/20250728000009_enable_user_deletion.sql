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