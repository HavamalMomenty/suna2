# Default Workflows Implementation Summary

## Overview
Implemented a default workflows system where specific admin users can promote workflows to default status, making them available to all users. Default workflows are identified by "(Default)" suffix and can be directly edited by any user.

## Files Modified/Added

### Backend Files

**`suna2/backend/workflows/api.py`**
- Modified `list_workflows()` to fetch user workflows + default workflows (name LIKE '% (Default)')
- Added `toggle_workflow_default_status()` endpoint to add/remove "(Default)" suffix
- Updated `update_workflow()` to allow editing if user owns workflow OR workflow name ends with "(Default)"
- Added `get_admin_users()` endpoint to serve admin user IDs from JSON file

**`suna2/backend/config/admin_users.py`**
- Added JSON file loading logic to read admin user IDs from `admin_users_list.json`
- Includes fallback to hardcoded admin user ID if JSON file missing

**`suna2/backend/admin_users_list.json` (NEW)**
- Single source of truth for admin user IDs
- Contains JSON array of user IDs with admin privileges

### Frontend Files

**`suna2/frontend/src/lib/api.ts`**
- Added `created_by: string` to `Workflow` type
- Added `toggleWorkflowDefaultStatus()` function for backend API calls
- Updated workflow mapping to include `created_by` field

**`suna2/frontend/src/hooks/use-admin.ts`**
- Modified to fetch admin user IDs from backend API endpoint `/api/workflows/admin-users`
- Includes fallback to hardcoded admin user ID if API fails

**`suna2/frontend/src/components/workflows/WorkflowCards.tsx`**
- Fixed icon naming conflict (renamed `Workflow` icon to `WorkflowIcon`)
- Edit button now works for all workflows (user-owned and default)
- Default workflows show blue gradient styling and star icon

**`suna2/frontend/src/components/workflows/WorkflowBuilderModal.tsx`**
- Added admin check using `useIsAdmin()` hook
- Added "Admin Options" section with toggle button for promote/de-promote
- Button text changes based on current default status

## Key Implementation Details

### Default Workflow Identification
- Uses name-based identification: workflows ending with "(Default)" are considered default
- No database schema changes required
- Simple string manipulation for promotion/demotion

### Admin Access Control
- Admin user IDs stored in shared JSON file (`admin_users_list.json`)
- Backend serves admin list via API endpoint
- Frontend fetches admin list and caches it
- Fallback to hardcoded admin user ID if configuration fails

### User Experience
- Default workflows are directly editable (no copy-first requirement)
- Admin users see promote/demote toggle in workflow builder
- Visual distinction: default workflows have blue styling and star icons
- Edit button works consistently for all workflow types

## Important Learnings

1. **Database Constraints**: Avoided foreign key issues by using existing admin user IDs instead of creating system users
2. **Name-Based vs Schema-Based**: Name-based identification proved simpler than adding new database fields
3. **Configuration Management**: Shared JSON file approach provides flexibility without environment variable complexity
4. **User Experience**: Direct editing of default workflows provides better UX than copy-first approach
5. **API Design**: Single toggle endpoint handles both promote and demote operations efficiently