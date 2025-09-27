Implement feature parralelizable data extraction:
    In the todo.md:
        Identify the things that can be done in parralel! Mark which things can be done in paralel in the todo itself!
    
    Launch subagents:
        Launch subagents that 



Implement feature: API tokens from user!
    
    For now have 2 possible tokens the user can set. 1. RESIGHTS_API_TOKEN 2. REDATA_API_TOKEN 

    UI:
        Beneath personal account should be a popup menu that appears when pressing the button. It should be called "Add tokens".

        The menu should only fill part of the screen and be in the same overall style as the menu for creating new workflows

        The menu should contain a single page with a description and 2 fields, 1. ReData token 2. Resights token 

        The user should be able to fill either or both or none. Use approprate good looking UI for this making it clear where the user should input the value, etc. (basic common sense)
        
        There should be a close button and a "save and continue" button. Close should not save the content you have inputtet. 

        When None of these tokens are added, there should be a yellow warning sign (just a yellow exclamation point) in the top right corner of every workflow (both prebuilt and personal). 
        
        When hovering over this yellow warning sign (exclamation mark) it should tell "for optimal performance please add  resights/redata token". 

    Use the guide for implementing here!
        Add at most 1 extra sql file, make it the last sql file thats triggered!
        I will manually run this sql to create any new table after the migrations sql file has been created.
        
    The Redata token is currently not used anywhere, so while it should be stored, it should not currently be used in any context!

    Start by not implementing the security protocol, but make room for it such that it can be added by you later!

    After implementation i will manually remove the RESIGHTS_TOKEN from the .env file. 

    Dont implement unit tests
## Implementation Recommendation:

**Database Schema:**
```sql
CREATE TABLE user_api_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    resights_token TEXT,
    redata_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend Changes:**
1. Add `UserTokenService` in `backend/services/` for CRUD operations
2. Modify `ResightsProvider` constructor to accept `user_id` parameter
3. Add `/api/user/tokens` endpoints (GET/PUT) with JWT auth
4. Encrypt tokens at rest using Fernet encryption
5. Update data provider instantiation to pass `user_id` from request context

**Frontend Changes:**
1. Add token management modal component in `frontend/src/components/`
2. Create API hooks for token operations in `frontend/src/hooks/`
3. Add warning indicator component for workflows
4. Integrate with user account dropdown menu

**Security:**
- Encrypt tokens using `cryptography.fernet`
- Implement proper RLS policies
- Add audit logging for token access

## Additional Implementation Considerations:

**Critical Flow Update:**
The user_id must be passed through the entire execution chain:
1. API layer (has user_id from JWT) → Background worker → Agent execution → Tools → Data providers
2. Remove all environment variable fallbacks - user tokens are mandatory
3. Update ResightsProvider to require user_id parameter and fail if no user token found

**Database Migration Strategy:**
```sql
-- Remove RESIGHTS_TOKEN from config.py after migration
-- Add user_api_tokens table with proper encryption
-- Migrate existing global tokens to first admin user if needed
```

**Error Handling:**
- If user has no tokens configured, show clear error message
- Disable data_providers_tool when no user tokens available
- Add validation in ResightsProvider constructor to fail fast

**Performance Considerations:**
- Cache decrypted tokens in memory with TTL to avoid repeated DB queries
- Use Redis for token caching with user_id as key
- Implement token refresh mechanism for expired tokens

