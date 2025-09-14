# Daytona VM Privacy Implementation

## Overview
This document describes the implementation of private Daytona VMs to ensure that only the user who launched a VM can access it, preventing unauthorized access to sandbox environments.

## Problem Statement
Previously, all Daytona sandboxes were created with `public=True`, which meant that anyone with the sandbox ID could potentially access the VM directly through Daytona's interface, bypassing the application's access control system.

## Solution Implemented

### 1. Private Sandbox Creation
- **Changed**: `public=True` → `public=False` in `CreateSandboxFromImageParams`
- **Location**: `/home/momenty2/suna2/backend/sandbox/sandbox.py`
- **Impact**: All new sandboxes are now private by default

### 2. User-Specific Labeling
- **Added**: `user_id` parameter to `create_sandbox()` function
- **Added**: User ID labeling in sandbox metadata for tracking and auditing
- **Location**: `/home/momenty2/suna2/backend/sandbox/sandbox.py`

### 3. Updated All Sandbox Creation Points
The following files were updated to pass `user_id` when creating sandboxes:

#### Agent API (`/home/momenty2/suna2/backend/agent/api.py`)
- **Function**: `create_sandbox(sandbox_pass, project_id, user_id)`
- **Context**: When users create new projects through the agent interface

#### Workflow Executors
- **Files**: 
  - `/home/momenty2/suna2/backend/workflows/executor.py`
  - `/home/momenty2/suna2/backend/workflows/deterministic_executor.py`
- **Function**: `_create_new_sandbox_for_project()`
- **Context**: When workflows need sandboxes for execution
- **Implementation**: Extracts `user_id` from project's `account_id`

#### Utility Scripts
- **Files**:
  - `/home/momenty2/suna2/backend/utils/scripts/export_import_project.py`
  - `/home/momenty2/suna2/backend/utils/scripts/copy_project.py`
- **Context**: When importing/copying projects between users

## Security Architecture

### Multi-Layer Access Control
1. **Daytona Level**: Sandboxes are private (`public=False`)
2. **Application Level**: API endpoints verify user permissions via `verify_sandbox_access()`
3. **Database Level**: Row Level Security (RLS) policies enforce account-based access

### Access Control Flow
```
User Request → API Endpoint → verify_sandbox_access() → Database RLS → Daytona Sandbox
```

### Permission Verification
The `verify_sandbox_access()` function in `/home/momenty2/suna2/backend/sandbox/api.py`:
1. Finds the project that owns the sandbox
2. Checks if the project is public (allows anonymous access)
3. For private projects, verifies the user is a member of the account
4. Uses `basejump.has_role_on_account()` for role-based access control

## Safety Measures

### 1. Backward Compatibility
- All existing API endpoints continue to work
- No breaking changes to the user interface
- Existing sandboxes remain functional (though they may still be public)

### 2. Graceful Degradation
- If `user_id` is not available, sandboxes are still created (with `user_id=None`)
- The system logs warnings but doesn't fail
- Access control still works at the API level

### 3. Audit Trail
- User IDs are stored in sandbox labels for tracking
- All sandbox creation is logged with user context
- Project-sandbox relationships are maintained in the database

### 4. Error Handling
- Database queries are wrapped in try-catch blocks
- Sandbox creation failures are properly logged
- Cleanup procedures exist for failed sandbox creation

## Implementation Safety

### 1. No Data Loss Risk
- No existing data is modified
- Only new sandboxes are affected
- Existing projects continue to work

### 2. Minimal Code Changes
- Changes are isolated to sandbox creation functions
- No changes to core business logic
- No changes to database schema

### 3. Testing Considerations
- All existing tests should continue to pass
- New sandboxes will be private by default
- API access control remains unchanged

## Deployment Safety

### 1. Zero-Downtime Deployment
- Changes are backward compatible
- No database migrations required
- No service restarts needed

### 2. Rollback Plan
- Revert `public=False` to `public=True` if needed
- Remove `user_id` parameter from function calls
- No data corruption risk

### 3. Monitoring
- Monitor sandbox creation logs for errors
- Verify new sandboxes are private
- Check API access control is working

## Verification Steps

### 1. Test Private Sandbox Creation
```bash
# Create a new project through the API
# Verify the sandbox is created with public=False
# Verify user_id is stored in sandbox labels
```

### 2. Test Access Control
```bash
# Try to access a sandbox with a different user
# Verify access is denied
# Verify proper error messages are returned
```

### 3. Test Existing Functionality
```bash
# Run existing test suite
# Verify all workflows still work
# Verify agent creation still works
```

## Future Enhancements

### 1. Sandbox Ownership Transfer
- Implement functionality to transfer sandbox ownership
- Add admin tools for sandbox management

### 2. Enhanced Auditing
- Add detailed audit logs for sandbox access
- Implement sandbox usage analytics

### 3. Advanced Access Control
- Implement time-based access controls
- Add IP-based restrictions
- Implement session-based access tokens

## Conclusion

This implementation provides a secure, multi-layered approach to Daytona VM privacy while maintaining backward compatibility and system stability. The changes are minimal, safe, and provide immediate security benefits without disrupting existing functionality.
