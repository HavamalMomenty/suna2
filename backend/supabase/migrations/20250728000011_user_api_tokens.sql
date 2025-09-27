BEGIN;

-- Create user_api_tokens table for storing encrypted user API tokens
CREATE TABLE IF NOT EXISTS user_api_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    resights_token_encrypted TEXT,
    redata_token_encrypted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_tokens_user_id ON user_api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_tokens_created_at ON user_api_tokens(created_at);

-- Enable RLS
ALTER TABLE user_api_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own API tokens" ON user_api_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_api_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_api_tokens_updated_at ON user_api_tokens;
CREATE TRIGGER update_user_api_tokens_updated_at
    BEFORE UPDATE ON user_api_tokens
    FOR EACH ROW EXECUTE FUNCTION update_user_api_tokens_updated_at();

COMMIT;
