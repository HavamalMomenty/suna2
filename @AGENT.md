
Backend Development
bashcd suna2/backend
docker compose down && docker compose up --build  # Full rebuild and start
docker compose logs -f                           # Monitor logs
python -m pytest                                 # Run tests if available
python -m flake8 . || python -m pylint .        # Python linting
Git Operations
bashgit status                                       # Check changes
git add -A && git commit -m "feature: message"  # Commit locally only
git log --oneline -10                           # Recent commits
# NO git push - stay on upload_ui_cc branch locally
Architecture Patterns to Maintain
Frontend (React/Next.js)

Component-based architecture with modular design
State management patterns (Redux/Context/useState)
Consistent UI/UX patterns and styling
API integration patterns for backend communication

Backend (Python FastAPI/Flask)

RESTful API design principles
Service layer architecture
Workflow orchestration patterns
File handling and Daytona VM integration

Critical Constraints Enforcement

Database: NO schema changes, data additions only
Environment: NO modifications to existing .env variables
Scope: NO changes outside ClaudeCode/suna2/ directory
Git: NO remote pushes, local commits to upload_ui_cc only

Testing & Verification Strategy

Lint checks after each code modification
Build verification for both frontend and backend
Integration testing between components
Workflow functionality preservation verification
UI/UX testing for new Configure Workflow Run interface

Key Implementation Notes

Workflow file handling: transition to workflow_specifications directory
UI state management: temporary configuration, non-persistent
API integration: additional prompts appended with clear headers
Error handling: graceful failures with user feedback

## Completed Implementation: Feature 1 - Workflow Specifications Directory

✅ **Status**: COMPLETE - Successfully implemented workflow_specifications directory feature

### Implementation Details:

**Backend Changes:**
- Modified `workflows/executor.py` and `workflows/deterministic_executor.py`
- Added `_transfer_workflow_files_to_sandbox()` method to both executors
- Integrated file transfer call after `_ensure_project_has_sandbox()`
- Creates `/workspace/workflow_specifications/` directory on Daytona VM
- Downloads workflow files from Supabase Storage and uploads to sandbox
- Updated system prompts to inform agents about available context files

**Technical Implementation:**
- File transfer happens during workflow execution initialization
- Uses existing Supabase Storage and Daytona SDK integrations
- Graceful error handling - file transfer failures don't break workflows
- Maintains backward compatibility with existing workflow functionality

**Verification Completed:**
- ✅ Python syntax validation passed
- ✅ Backend Docker build successful
- ✅ Frontend build successful (with warnings only)
- ✅ No breaking changes to existing workflow execution

**Files Modified:**
- `/backend/workflows/executor.py` - Added file transfer method and integration
- `/backend/workflows/deterministic_executor.py` - Added file transfer method and integration

### Next Priority: Feature 2 - Configure Workflow Run UI Interface
The foundation is now ready for implementing the Configure Workflow Run interface with the workflow_specifications directory available for context files.





