BEGIN;

-- Workflow files table for supplementary files
CREATE TABLE IF NOT EXISTS workflow_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    
    CONSTRAINT workflow_files_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0),
    CONSTRAINT workflow_files_file_size_positive CHECK (file_size IS NULL OR file_size > 0)
);

-- Workflow credentials table for login information (encrypted)
-- Drop existing table if it has old structure and recreate with new structure
DROP TABLE IF EXISTS workflow_credentials CASCADE;

CREATE TABLE workflow_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    service VARCHAR(255) NOT NULL, -- e.g., "Gmail", "Slack", "GitHub", etc.
    username VARCHAR(255) NOT NULL, -- Username or email for the service
    encrypted_password TEXT, -- Fernet encrypted password
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT workflow_credentials_service_not_empty CHECK (LENGTH(TRIM(service)) > 0),
    CONSTRAINT workflow_credentials_username_not_empty CHECK (LENGTH(TRIM(username)) > 0),
    CONSTRAINT workflow_credentials_unique_service_username_per_workflow 
        UNIQUE (workflow_id, service, username)
);

-- Extend existing workflows table
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS master_prompt TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS login_template TEXT; -- Markdown template with placeholders

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_files_workflow_id ON workflow_files(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_files_created_by ON workflow_files(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_files_uploaded_at ON workflow_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_workflow_credentials_workflow_id ON workflow_credentials(workflow_id);

-- Enable RLS
ALTER TABLE workflow_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflow_files
DROP POLICY IF EXISTS "Users can manage their workflow files" ON workflow_files;
CREATE POLICY "Users can manage their workflow files" ON workflow_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_files.workflow_id 
            AND workflows.created_by = auth.uid()
        )
    );

-- RLS policies for workflow_credentials
DROP POLICY IF EXISTS "Users can manage their workflow credentials" ON workflow_credentials;
CREATE POLICY "Users can manage their workflow credentials" ON workflow_credentials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_credentials.workflow_id 
            AND workflows.created_by = auth.uid()
        )
    );

-- Create trigger function for updated_at (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at on workflow_credentials
DROP TRIGGER IF EXISTS update_workflow_credentials_updated_at ON workflow_credentials;
CREATE TRIGGER update_workflow_credentials_updated_at
    BEFORE UPDATE ON workflow_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for workflow files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workflow-files', 'workflow-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Users can upload workflow files" ON storage.objects;
CREATE POLICY "Users can upload workflow files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'workflow-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can view their workflow files" ON storage.objects;
CREATE POLICY "Users can view their workflow files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'workflow-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete their workflow files" ON storage.objects;
CREATE POLICY "Users can delete their workflow files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'workflow-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

COMMIT;
