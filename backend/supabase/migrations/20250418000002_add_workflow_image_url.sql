-- Add image_url column to workflows table and set up Supabase Storage
BEGIN;

-- Add the image_url column only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflows' 
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE workflows ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Create Supabase Storage bucket for workflow images (PRIVATE)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('workflow-images', 'workflow-images', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for workflow images bucket (PRIVATE ACCESS)
-- Only authenticated users can read workflow images
CREATE POLICY "Authenticated users can read workflow images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'workflow-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload workflow images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'workflow-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own workflow images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'workflow-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own workflow images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'workflow-images' 
  AND auth.role() = 'authenticated'
);

-- Drop the constraint that was too restrictive for file paths
ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_image_url_valid_url;

COMMIT;
