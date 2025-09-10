
## specs/ Directory Content

### specs/workflow-specifications-directory.md
```markdown
# Workflow Specifications Directory Feature

## Current Implementation
Workflow context files are uploaded to standard directory on Daytona VM during workflow execution.

## Required Changes
1. Create "workflow_specifications" subdirectory on Daytona VM
2. Redirect all workflow context files to this subdirectory
3. Maintain existing workflow functionality and file access patterns

## Technical Requirements
- Backend API modification to create workflow_specifications/ directory
- File upload logic changes to target new directory
- Preserve file permissions and access patterns
- No breaking changes to existing workflows

## API Changes Needed
- Modify file upload endpoints
- Update Daytona VM directory creation logic
- Maintain backward compatibility


# Configure Workflow Run Interface Specification

## User Flow
1. User clicks workflow → Configure Workflow Run page (NEW)
2. User configures options → Clicks "Run Workflow"
3. Workflow launches with configurations → Normal execution

## UI Components Required

### Layout
- Partial screen overlay (not full page)
- Minimalistic, pleasant design
- Single page with all elements
- Consistent with existing UI styling

### Elements
1. **Workflow Input Description**
   - Display workflow description (rename from "description" in UI only)
   - Read-only text explaining required files and context

2. **Additional Prompt Specifications**
   - Text area/field for user input
   - Appended to master prompt with clear header
   - Does NOT modify workflow permanently

3. **File Upload Component**
   - Upload workflow-specific files
   - Injected into conversation context
   - Similar to existing file upload patterns

4. **Action Buttons**
   - "Cancel" - Exit without running workflow
   - "Run Workflow" - Launch with configurations
   - Optional: "Run in Background" functionality

## Technical Implementation
- React component with state management
- API integration for file uploads and prompt specifications
- Temporary configuration (non-persistent)
- Integration with existing workflow launch logic

## Design Requirements
- Aesthetic consistency with current UI
- Intuitive user experience
- Responsive design
- Clear visual hierarchy




