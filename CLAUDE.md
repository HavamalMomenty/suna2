
### suna2 Workflow Enhancement - Ralph Autonomous Development
## Project Context
Full-stack workflow management application requiring two major feature enhancements:
1. Change workflow context file upload to use "workflow_specifications" directory
2. Add "Configure Workflow Run" intermediary interface
## Current Architecture
suna2/
├── frontend/          # React/Next.js frontend
├── backend/           # Python backend with FastAPI/Flask
│   ├── api.py        # Main API endpoints
│   ├── agent/        # Agent system
│   ├── services/     # Workflow services
│   └── config/       # Configuration
└── docker-compose.yml # Backend containerization
## Development Build Process
Frontend: `cd suna2/frontend && npm run dev`
Backend: `cd suna2/backend && docker compose down && docker compose up --build`

## Ralph Grounding Rules
- LINT CHECK: Run linters after each change to ensure code quality
- BUILD VERIFICATION: Test both frontend and backend builds after implementation
- FAST ITERATION: Use build process to verify changes work correctly
- INTEGRATION TESTING: Ensure frontend-backend communication works

## Critical Constraints
- NO database migrations or schema changes (can add data/rows only)
- NO changes to existing .env/.env.local variables (can add new ones)
- NO deletions outside ClaudeCode directory
- NO remote pushes (git commit to local branch upload_ui_cc only)
- Operations limited to /home/momenty2/ClaudeCode/suna2/ directory tree

## Feature Requirements Summary
Feature 1: Redirect workflow context files to "workflow_specifications" directory on Daytona VM
Feature 2: Add "Configure Workflow Run" interface between workflow selection and execution

Ralph has authority to modify frontend UI, backend APIs, and workflow logic within constraints.




