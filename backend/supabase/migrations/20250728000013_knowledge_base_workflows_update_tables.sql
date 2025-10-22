-- Make knowledge base and workflows user-specific only
-- Remove thread_id and project_id requirements

BEGIN;

-- Make thread_id optional in knowledge_base_entries
ALTER TABLE knowledge_base_entries 
ALTER COLUMN thread_id DROP NOT NULL;

-- Make project_id optional in workflows  
ALTER TABLE workflows 
ALTER COLUMN project_id DROP NOT NULL;

-- No unique constraints needed for knowledge base entries - users can have multiple entries with same name

-- Fix the unique constraint on workflows to handle NULL project_id
ALTER TABLE workflows 
DROP CONSTRAINT IF EXISTS workflows_name_project_unique;
-- The following changes where first added then removed, see dorp index. 
-- Create new unique constraint that works with NULL project_id
--  CREATE UNIQUE INDEX workflows_name_account_unique ON workflows(name, account_id) 
-- WHERE project_id IS NULL;

-- Create unique constraint for workflows with project_id (only when project_id exists)
-- CREATE UNIQUE INDEX workflows_name_project_account_unique ON workflows(name, project_id, account_id) 
--  WHERE project_id IS NOT NULL;
-- DROP INDEX IF EXISTS workflows_name_account_unique;
-- DROP INDEX IF EXISTS workflows_name_project_account_unique;

COMMIT;
