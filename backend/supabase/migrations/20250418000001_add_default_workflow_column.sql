-- Add default_workflow column to workflows table
-- This migration adds a boolean column to properly identify default workflows
-- instead of relying on name-based detection

BEGIN;

-- Add the default_workflow column only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflows' 
        AND column_name = 'default_workflow'
    ) THEN
        ALTER TABLE workflows ADD COLUMN default_workflow BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Create index for performance when filtering default workflows
CREATE INDEX IF NOT EXISTS idx_workflows_default_workflow ON workflows(default_workflow);

-- Update existing workflows that have "(Default)" in their name
-- Set default_workflow = true and remove the "(Default)" suffix from name
UPDATE workflows 
SET 
    default_workflow = TRUE,
    name = TRIM(REPLACE(name, ' (Default)', ''))
WHERE name LIKE '% (Default)';

-- Update RLS policies to allow access to default workflows
-- Users should be able to view and edit default workflows even if they don't own them

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view workflows in their accounts" ON workflows;
DROP POLICY IF EXISTS "Users can update workflows in their accounts" ON workflows;

-- Create updated policies that include default workflows
DROP POLICY IF EXISTS "Users can view workflows in their accounts or default workflows" ON workflows;
CREATE POLICY "Users can view workflows in their accounts or default workflows" ON workflows
    FOR SELECT USING (
        basejump.has_role_on_account(account_id) = true OR
        default_workflow = true OR
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.project_id = workflows.project_id
            AND projects.is_public = TRUE
        )
    );

DROP POLICY IF EXISTS "Users can update workflows in their accounts or default workflows" ON workflows;
CREATE POLICY "Users can update workflows in their accounts or default workflows" ON workflows
    FOR UPDATE USING (
        basejump.has_role_on_account(account_id) = true OR
        default_workflow = true
    );

-- Add comment for documentation
COMMENT ON COLUMN workflows.default_workflow IS 'Indicates whether this workflow is a default/pre-built workflow available to all users';

COMMIT;
