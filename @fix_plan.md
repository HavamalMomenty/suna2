## Fix Plan - suna2 Workflow Enhancement Project

## Phase 1: Feature 1 - Workflow Specifications Directory (Priority 1-5) ✅ COMPLETED
- [x] 1. Analyze current workflow file upload implementation in backend
- [x] 2. Modify backend API to create "workflow_specifications" directory on Daytona VM
- [x] 3. Update file upload logic to place workflow context files in workflow_specifications/
- [x] 4. Test backend changes with docker compose build verification
- [x] 5. Verify existing workflow functionality remains intact

## Phase 2: Feature 2 Foundation - Configure Workflow Run UI (Priority 6-10) ✅ COMPLETED
- [x] 6. Analyze current workflow launch flow in frontend
- [x] 7. Design "Configure Workflow Run" UI component structure
- [x] 8. Create intermediary route/page between workflow selection and execution
- [x] 9. Implement base UI layout with minimalistic, pleasant design
- [x] 10. Add navigation flow: workflow click → configure page → launch

## Phase 3: Configure Workflow Run - Core Features (Priority 11-15)
- [ ] 11. Implement "Workflow input description" display (renamed from description)
- [ ] 12. Add "additional prompt specifications" text field with backend integration
- [ ] 13. Implement file upload component for workflow-specific files
- [ ] 14. Create "Cancel" button functionality to exit without running workflow
- [ ] 15. Implement "Run Workflow" button to launch with configurations

## Phase 4: Backend Integration - Configure Workflow Run (Priority 16-20)
- [ ] 16. Modify backend to accept additional prompt specifications
- [ ] 17. Update workflow execution to append additional prompts under header
- [ ] 18. Integrate uploaded files into workflow context (non-permanent)
- [ ] 19. Ensure configuration doesn't modify workflow permanently
- [ ] 20. Test complete configure → run workflow flow

## Phase 5: Testing & Polish (Priority 21-25)
- [ ] 21. Comprehensive frontend linting and build verification
- [ ] 22. Backend linting and docker compose build testing
- [ ] 23. End-to-end testing of both features
- [ ] 24. UI/UX refinements for Configure Workflow Run interface
- [ ] 25. Performance optimization and error handling

## Completed Items
- [x] Ralph technique setup for suna2 workflow enhancement
- [x] Feature 1: Workflow Specifications Directory - Complete implementation
  - Added _transfer_workflow_files_to_sandbox() method to both WorkflowExecutor and DeterministicWorkflowExecutor
  - Automatically creates /workspace/workflow_specifications/ directory on Daytona VM during workflow execution
  - Downloads workflow files from Supabase Storage and transfers them to sandbox
  - Updated system prompts to inform agents about available workflow context files
  - Maintains backward compatibility with existing workflow functionality
  - Successfully tested backend build and frontend build without errors

- [x] Feature 2 Foundation: Configure Workflow Run UI - Complete implementation
  - Created new intermediary route `/workflows/configure/[workflowId]` between workflow selection and execution
  - Implemented minimalistic, pleasant UI design with workflow information display
  - Added "Additional Prompt Specifications" text field with backend integration
  - Modified workflow cards to redirect to configure page instead of direct execution
  - Created custom executeWorkflowWithAdditionalPrompt function to append additional prompts
  - Added proper navigation flow: workflow click → configure page → workflow launch
  - Successfully tested frontend build, backend build, and basic integration
  - All lint checks pass with no errors

