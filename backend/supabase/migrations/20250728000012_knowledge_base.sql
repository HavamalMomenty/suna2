BEGIN;

-- =============================================
-- Extend knowledge_base_entries for organization
-- =============================================
ALTER TABLE knowledge_base_entries
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE;

-- Enforce valid content_format values
-- (removed content_format constraint to keep schema minimal)

-- Allow entry to be scoped to thread or project (at least one)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'kb_entries_scope_check'
    ) THEN
        ALTER TABLE knowledge_base_entries
        DROP CONSTRAINT kb_entries_scope_check;
    END IF;
END $$;

-- Make thread_id nullable to support project-scoped entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base_entries' AND column_name = 'thread_id' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE knowledge_base_entries ALTER COLUMN thread_id DROP NOT NULL;
    END IF;
END $$;

-- (removed FTS and embedding columns for a simpler minimal schema)

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_kb_entries_project_id ON knowledge_base_entries(project_id);

-- =============================================
-- Triggers to maintain FTS and versioning
-- =============================================
-- (removed FTS triggers for minimal schema)

-- Versioning support: snapshot table
-- (removed versioning table and triggers for minimal schema)

-- =============================================
-- RLS updates to include project_scoped entries
-- =============================================
DROP POLICY IF EXISTS kb_entries_user_access ON knowledge_base_entries;
CREATE POLICY kb_entries_user_access ON knowledge_base_entries
    FOR ALL
    USING (
        (
            thread_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM threads t
                LEFT JOIN projects p ON t.project_id = p.project_id
                WHERE t.thread_id = knowledge_base_entries.thread_id
                AND (
                    basejump.has_role_on_account(t.account_id) = true OR 
                    basejump.has_role_on_account(p.account_id) = true OR
                    basejump.has_role_on_account(knowledge_base_entries.account_id) = true
                )
            )
        )
        OR
        (
            project_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM projects p
                WHERE p.project_id = knowledge_base_entries.project_id
                AND basejump.has_role_on_account(p.account_id) = true
            )
        )
        OR
        (
            thread_id IS NULL AND project_id IS NULL AND basejump.has_role_on_account(knowledge_base_entries.account_id) = true
        )
    );

-- =============================================
-- RPCs: include user-global entries in listings and context
-- =============================================
CREATE OR REPLACE FUNCTION get_thread_knowledge_base(
  p_thread_id UUID,
  p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  entry_id UUID,
  name VARCHAR(255),
  description TEXT,
  content TEXT,
  usage_context VARCHAR(100),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE v_account_id UUID;
BEGIN
  SELECT account_id INTO v_account_id FROM threads WHERE thread_id = p_thread_id;

  RETURN QUERY
  SELECT k.entry_id, k.name, k.description, k.content,
         k.usage_context, k.is_active, k.created_at
  FROM knowledge_base_entries k
  WHERE (
          k.thread_id = p_thread_id
          OR (k.thread_id IS NULL AND k.project_id IS NULL AND k.account_id = v_account_id)
        )
    AND (p_include_inactive OR k.is_active = TRUE)
  ORDER BY k.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_knowledge_base_context(
  p_thread_id UUID,
  p_max_tokens INTEGER DEFAULT 4000
)
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id UUID;
  context_text TEXT := '';
  r RECORD;
  used_tokens INTEGER := 0;
  est INTEGER;
BEGIN
  SELECT account_id INTO v_account_id FROM threads WHERE thread_id = p_thread_id;

  FOR r IN
    SELECT name, description, content, content_tokens
    FROM knowledge_base_entries k
    WHERE (
            k.thread_id = p_thread_id
            OR (k.thread_id IS NULL AND k.project_id IS NULL AND k.account_id = v_account_id)
          )
      AND k.is_active = TRUE
      AND k.usage_context IN ('always','contextual')
    ORDER BY k.created_at DESC
  LOOP
    est := COALESCE(r.content_tokens, LENGTH(r.content)/4);
    IF used_tokens + est > p_max_tokens THEN EXIT; END IF;

    context_text := context_text || E'\n\n## Knowledge Base: ' || r.name || E'\n';
    IF r.description IS NOT NULL AND r.description <> '' THEN
      context_text := context_text || r.description || E'\n\n';
    END IF;

    context_text := context_text || r.content;
    used_tokens := used_tokens + est;
  END LOOP;

  RETURN CASE WHEN context_text = '' THEN NULL
              ELSE E'# KNOWLEDGE BASE CONTEXT\n\n' || context_text END;
END;
$$;

-- Strengthen usage log RLS (unchanged logic, index exists)
DROP POLICY IF EXISTS kb_usage_log_user_access ON knowledge_base_usage_log;
CREATE POLICY kb_usage_log_user_access ON knowledge_base_usage_log
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM threads t
            LEFT JOIN projects p ON t.project_id = p.project_id
            WHERE t.thread_id = knowledge_base_usage_log.thread_id
            AND (
                basejump.has_role_on_account(t.account_id) = true OR 
                basejump.has_role_on_account(p.account_id) = true
            )
        )
    );

COMMIT;


