# Workflow Builder Design Document

## Overview

This document outlines the design and implementation plan for the Workflow Builder feature in Suna. The feature enables users to create, manage, and customize persistent workflows that are specific to each user and persist between sessions.

## Feature Requirements

### Core Functionality
- **Persistent Workflows**: Workflows persist between user sessions and are user-specific
- **Workflow Components**: Each workflow consists of 4 core information types:
  1. **Title/Description**: Separate text fields for workflow identification
  2. **Master Prompt**: Markdown-based prompt organizing the workflow flow
  3. **Login Information**: Encrypted credentials (e.g., `RESIGHTS_TOKEN=`) for API keys
  4. **Supplementary Files**: Referenced files in master prompt (markdown, excel, docx, etc.)

### User Interface Requirements
- **Workflow Display**: Each workflow displayed as a card using shadcn/ui components
- **Customize Workflow**: "+" button in lower right corner of each workflow card
- **Build Workflow**: "Add workflow" button to the far right for creating new workflows
- **Workflow Builder UI**: Unified interface for both building and customizing workflows

## Current Architecture Analysis

### Existing Database Schema
Based on the current Supabase migration (`20250417000001_workflow_system.sql`), we have:

```sql
-- Workflows table (existing)
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    status workflow_status DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    definition JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Existing Backend Components
- **Models**: `backend/workflows/models.py` with `WorkflowDefinition`, `WorkflowNode`, `WorkflowEdge`
- **API**: `backend/workflows/api.py` with workflow CRUD operations
- **Executor**: `backend/workflows/executor.py` for workflow execution
- **Tool System**: Uses `AgentBuilderBaseTool` with dual schema decorators

### Existing Frontend Components
- **Workflow Pages**: `frontend/src/app/(dashboard)/workflows/`
- **Components**: `frontend/src/components/workflows/`
- **Hooks**: `frontend/src/hooks/react-query/workflows/`
- **UI Framework**: shadcn/ui with Radix UI components

## Implementation Plan

### Phase 1: Database Schema Extensions

#### 1.1 New Migration File: `20250728000001_workflow_builder.sql`

```sql
BEGIN;

-- Workflow files table for supplementary files
CREATE TABLE IF NOT EXISTS workflow_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    
    CONSTRAINT workflow_files_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0)
);

-- Workflow credentials table for login information (encrypted)
CREATE TABLE IF NOT EXISTS workflow_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    credential_key VARCHAR(255) NOT NULL,
    encrypted_value TEXT, -- Fernet encrypted
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT workflow_credentials_key_not_empty CHECK (LENGTH(TRIM(credential_key)) > 0)
);

-- Extend existing workflows table
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS master_prompt TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS login_template TEXT; -- Markdown template with placeholders

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_files_workflow_id ON workflow_files(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_files_created_by ON workflow_files(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_credentials_workflow_id ON workflow_credentials(workflow_id);

-- Enable RLS
ALTER TABLE workflow_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflow_files
CREATE POLICY "Users can manage their workflow files" ON workflow_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_files.workflow_id 
            AND workflows.created_by = auth.uid()
        )
    );

-- RLS policies for workflow_credentials
CREATE POLICY "Users can manage their workflow credentials" ON workflow_credentials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_credentials.workflow_id 
            AND workflows.created_by = auth.uid()
        )
    );

-- Create trigger for updated_at on workflow_credentials
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_workflow_credentials_updated_at ON workflow_credentials;
CREATE TRIGGER update_workflow_credentials_updated_at
    BEFORE UPDATE ON workflow_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Phase 2: Backend API Extensions

#### 2.1 Enhanced Pydantic Models

```python
# Add to backend/workflows/models.py

from typing import Optional, List
from pydantic import BaseModel, Field, validator
from datetime import datetime

class WorkflowFile(BaseModel):
    id: Optional[str] = None
    workflow_id: str
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str
    file_size: Optional[int] = None
    file_path: str
    mime_type: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    created_by: str

class WorkflowCredential(BaseModel):
    id: Optional[str] = None
    workflow_id: str
    credential_key: str = Field(..., min_length=1, max_length=255)
    credential_value: Optional[str] = None  # Decrypted value for frontend
    description: Optional[str] = None

class WorkflowBuilderData(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    master_prompt: str = Field(..., min_length=1)
    login_template: str = ""
    credentials: List[WorkflowCredential] = []
    files: List[WorkflowFile] = []

class WorkflowBuilderRequest(BaseModel):
    workflow_data: WorkflowBuilderData
    project_id: str

    @validator('project_id')
    def validate_project_id(cls, v):
        # Add UUID validation
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError('Invalid project_id format')
        return v

class WorkflowBuilderUpdateRequest(BaseModel):
    workflow_id: str
    workflow_data: WorkflowBuilderData
```

#### 2.2 New API Endpoints with FastAPI Patterns

```python
# Add to backend/workflows/api.py

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from fastapi.security import HTTPBearer
from typing import List
from utils.auth_utils import get_current_user, UserClaims
from utils.logger import logger
from services.workflow_builder_service import WorkflowBuilderService
from services.credential_encryption_service import CredentialEncryptionService

router = APIRouter(prefix="/workflows", tags=["workflow-builder"])
security = HTTPBearer()

@router.post("/builder", response_model=WorkflowDefinition)
async def create_workflow_from_builder(
    request: WorkflowBuilderRequest,
    current_user: UserClaims = Depends(get_current_user),
    service: WorkflowBuilderService = Depends()
):
    """Create a new workflow using the workflow builder."""
    try:
        logger.info(
            "Creating workflow from builder",
            user_id=current_user.id,
            project_id=request.project_id
        )
        
        workflow = await service.create_workflow_from_builder(
            request.workflow_data, 
            request.project_id, 
            current_user.id
        )
        
        return workflow
    except ValueError as e:
        logger.error(f"Validation error creating workflow: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create workflow")

@router.put("/{workflow_id}/builder", response_model=WorkflowDefinition)
async def update_workflow_from_builder(
    workflow_id: str,
    request: WorkflowBuilderUpdateRequest,
    current_user: UserClaims = Depends(get_current_user),
    service: WorkflowBuilderService = Depends()
):
    """Update an existing workflow using the workflow builder."""
    try:
        workflow = await service.update_workflow_from_builder(
            workflow_id,
            request.workflow_data,
            current_user.id
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")

@router.get("/{workflow_id}/builder", response_model=WorkflowBuilderData)
async def get_workflow_builder_data(
    workflow_id: str,
    current_user: UserClaims = Depends(get_current_user),
    service: WorkflowBuilderService = Depends()
):
    """Get workflow data for the builder interface."""
    try:
        data = await service.get_workflow_builder_data(workflow_id, current_user.id)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{workflow_id}/files")
async def upload_workflow_file(
    workflow_id: str,
    file: UploadFile = File(...),
    current_user: UserClaims = Depends(get_current_user),
    service: WorkflowBuilderService = Depends()
):
    """Upload a supplementary file for a workflow."""
    try:
        # Validate file type and size
        allowed_types = {'text/markdown', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'}
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="File type not allowed")
        
        if file.size > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=400, detail="File too large")
        
        workflow_file = await service.upload_file(workflow_id, file, current_user.id)
        return {"message": "File uploaded successfully", "file": workflow_file}
    except Exception as e:
        logger.error(f"Error uploading file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload file")

@router.delete("/{workflow_id}/files/{file_id}")
async def delete_workflow_file(
    workflow_id: str,
    file_id: str,
    current_user: UserClaims = Depends(get_current_user),
    service: WorkflowBuilderService = Depends()
):
    """Delete a workflow file."""
    try:
        await service.delete_file(file_id, current_user.id)
        return {"message": "File deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### Phase 3: File Storage Integration with Supabase

#### 3.1 Workflow Builder Service

```python
# Create backend/services/workflow_builder_service.py

from typing import List, Optional
from fastapi import UploadFile
from supabase import create_client
from services.credential_encryption_service import CredentialEncryptionService
from utils.logger import logger
import uuid
import os

class WorkflowBuilderService:
    def __init__(self):
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        self.bucket_name = "workflow-files"
        self.encryption_service = CredentialEncryptionService()
    
    async def create_workflow_from_builder(
        self, 
        workflow_data: WorkflowBuilderData, 
        project_id: str, 
        user_id: str
    ) -> WorkflowDefinition:
        """Create a new workflow with builder data."""
        try:
            # Create base workflow
            workflow_result = self.supabase.table("workflows").insert({
                "name": workflow_data.title,
                "description": workflow_data.description,
                "project_id": project_id,
                "account_id": await self._get_user_account_id(user_id),
                "created_by": user_id,
                "master_prompt": workflow_data.master_prompt,
                "login_template": workflow_data.login_template,
                "definition": {"type": "builder_workflow", "version": "1.0"}
            }).execute()
            
            workflow_id = workflow_result.data[0]["id"]
            
            # Save encrypted credentials
            await self._save_credentials(workflow_id, workflow_data.credentials)
            
            return WorkflowDefinition.from_dict(workflow_result.data[0])
            
        except Exception as e:
            logger.error(f"Error creating workflow: {e}", exc_info=True)
            raise
    
    async def upload_file(
        self, 
        workflow_id: str, 
        file: UploadFile, 
        user_id: str
    ) -> WorkflowFile:
        """Upload file to Supabase Storage and create database record."""
        try:
            # Verify workflow ownership
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Generate unique file path
            file_id = str(uuid.uuid4())
            file_path = f"{workflow_id}/{file_id}_{file.filename}"
            
            # Upload to Supabase Storage
            file_content = await file.read()
            upload_result = self.supabase.storage.from_(self.bucket_name).upload(
                file_path, file_content, {"content-type": file.content_type}
            )
            
            if upload_result.error:
                raise Exception(f"Storage upload failed: {upload_result.error}")
            
            # Create database record
            file_record = {
                "id": file_id,
                "workflow_id": workflow_id,
                "filename": file.filename,
                "file_type": file.content_type.split('/')[1] if file.content_type else "unknown",
                "file_size": len(file_content),
                "file_path": file_path,
                "mime_type": file.content_type,
                "created_by": user_id
            }
            
            result = self.supabase.table("workflow_files").insert(file_record).execute()
            
            # Trigger LlamaParse if it's a supported document type
            if file.content_type in ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
                await self._trigger_document_parsing(file_id, file_path)
            
            return WorkflowFile.from_dict(result.data[0])
            
        except Exception as e:
            logger.error(f"Error uploading file: {e}", exc_info=True)
            raise
    
    async def _save_credentials(self, workflow_id: str, credentials: List[WorkflowCredential]):
        """Save encrypted credentials to database."""
        for cred in credentials:
            if cred.credential_value:
                encrypted_value = self.encryption_service.encrypt(cred.credential_value)
                
                self.supabase.table("workflow_credentials").insert({
                    "workflow_id": workflow_id,
                    "credential_key": cred.credential_key,
                    "encrypted_value": encrypted_value,
                    "description": cred.description
                }).execute()
    
    async def _trigger_document_parsing(self, file_id: str, file_path: str):
        """Trigger LlamaParse document processing via Dramatiq."""
        from tasks.document_parsing import parse_workflow_document
        parse_workflow_document.send(file_id, file_path)
```

### Phase 4: Frontend Implementation with shadcn/ui

#### 4.1 New Components

```typescript
// frontend/src/components/workflows/WorkflowBuilderModal.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploadZone } from './FileUploadZone';
import { CredentialManager } from './CredentialManager';
import { useWorkflowBuilder } from '@/hooks/react-query/workflows/use-workflow-builder';

interface WorkflowBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: string;
  mode: 'create' | 'edit';
  projectId: string;
}

export function WorkflowBuilderModal({ 
  isOpen, 
  onClose, 
  workflowId, 
  mode, 
  projectId 
}: WorkflowBuilderModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const { createWorkflow, updateWorkflow, getWorkflowData } = useWorkflowBuilder();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    master_prompt: '',
    login_template: '',
    credentials: [],
    files: []
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Workflow' : 'Edit Workflow'}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="prompt">Master Prompt</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter workflow title..."
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this workflow does..."
                rows={3}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="prompt" className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="master_prompt" className="text-sm font-medium">
                Master Prompt (Markdown)
              </label>
              <Textarea
                id="master_prompt"
                value={formData.master_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, master_prompt: e.target.value }))}
                placeholder="Enter your workflow prompt in markdown..."
                rows={15}
                className="font-mono"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="credentials">
            <CredentialManager
              credentials={formData.credentials}
              template={formData.login_template}
              onCredentialsUpdate={(credentials) => 
                setFormData(prev => ({ ...prev, credentials }))
              }
              onTemplateUpdate={(template) =>
                setFormData(prev => ({ ...prev, login_template: template }))
              }
            />
          </TabsContent>
          
          <TabsContent value="files">
            <FileUploadZone
              workflowId={workflowId}
              files={formData.files}
              onFileUploaded={(file) =>
                setFormData(prev => ({ ...prev, files: [...prev.files, file] }))
              }
              onFileDeleted={(fileId) =>
                setFormData(prev => ({
                  ...prev,
                  files: prev.files.filter(f => f.id !== fileId)
                }))
              }
            />
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Workflow' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 4.2 Enhanced React Query Hooks

```typescript
// frontend/src/hooks/react-query/workflows/use-workflow-builder.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowBuilderService } from '@/lib/services/workflow-builder-service';
import { toast } from '@/hooks/use-toast';

export function useWorkflowBuilder() {
  const queryClient = useQueryClient();

  const createWorkflow = useMutation({
    mutationFn: workflowBuilderService.createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive',
      });
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: workflowBuilderService.updateWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow updated successfully',
      });
    },
  });

  const uploadFile = useMutation({
    mutationFn: workflowBuilderService.uploadFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-files'] });
    },
  });

  return {
    createWorkflow,
    updateWorkflow,
    uploadFile,
  };
}

export function useWorkflowFiles(workflowId: string) {
  return useQuery({
    queryKey: ['workflow-files', workflowId],
    queryFn: () => workflowBuilderService.getWorkflowFiles(workflowId),
    enabled: !!workflowId,
  });
}
```

### Phase 5: Security and Integration Enhancements

#### 5.1 Credential Encryption Service

```python
# backend/services/credential_encryption_service.py

from cryptography.fernet import Fernet
import os
import base64

class CredentialEncryptionService:
    def __init__(self):
        # Use the same encryption key as MCP credentials for consistency
        encryption_key = os.getenv("MCP_ENCRYPTION_KEY")
        if not encryption_key:
            raise ValueError("MCP_ENCRYPTION_KEY environment variable is required")
        
        self.fernet = Fernet(encryption_key.encode())
    
    def encrypt(self, value: str) -> str:
        """Encrypt a credential value."""
        if not value:
            return ""
        
        encrypted_bytes = self.fernet.encrypt(value.encode())
        return base64.b64encode(encrypted_bytes).decode()
    
    def decrypt(self, encrypted_value: str) -> str:
        """Decrypt a credential value."""
        if not encrypted_value:
            return ""
        
        try:
            encrypted_bytes = base64.b64decode(encrypted_value.encode())
            decrypted_bytes = self.fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt credential: {e}")
            raise ValueError("Invalid encrypted credential")
```

#### 5.2 Integration with Existing Document Parsing

```python
# backend/tasks/document_parsing.py

import dramatiq
from services.llama_parse_service import LlamaParseService
from utils.logger import logger

@dramatiq.actor
def parse_workflow_document(file_id: str, file_path: str):
    """Parse uploaded workflow document using LlamaParse."""
    try:
        logger.info(f"Starting document parsing for file {file_id}")
        
        # Use existing LlamaParse integration
        parse_service = LlamaParseService()
        parsed_content = parse_service.parse_document(file_path)
        
        # Store parsed content alongside original file
        # This integrates with the existing document parsing pipeline
        
        logger.info(f"Document parsing completed for file {file_id}")
        
    except Exception as e:
        logger.error(f"Document parsing failed for file {file_id}: {e}", exc_info=True)
```

## Architecture Improvements Based on Suna Infrastructure

### 1. **Leverage Existing Patterns**
- Use `AgentBuilderBaseTool` inheritance for workflow builder tools
- Follow established JWT validation patterns without signature verification
- Integrate with existing Dramatiq background job system
- Use established logging patterns with structured logging

### 2. **Database Best Practices**
- Follow idempotent migration patterns with proper error handling
- Use `gen_random_uuid()` for UUID generation (Supabase standard)
- Implement proper RLS policies for multi-tenant security
- Use established trigger patterns for `updated_at` columns

### 3. **Frontend Integration**
- Use shadcn/ui components consistently with existing design system
- Follow React Query patterns for server state management
- Integrate with existing authentication context
- Use established error handling and toast notification patterns

### 4. **Security Enhancements**
- Reuse existing Fernet encryption key for credential security
- Follow established input validation patterns with Pydantic
- Implement proper file type and size validation
- Use time-limited signed URLs for file access

### 5. **Performance Optimizations**
- Integrate with existing LlamaParse document processing pipeline
- Use Supabase Storage for seamless file management
- Implement proper caching strategies with React Query
- Follow established async/await patterns for I/O operations

## Implementation Timeline (Revised)

### Week 1-2: Database and Backend Foundation
- Create idempotent migration following Suna patterns
- Implement Pydantic models with proper validation
- Set up Supabase Storage bucket with RLS policies

### Week 3-4: API Development
- Implement FastAPI endpoints following established patterns
- Integrate credential encryption service with existing MCP system
- Add file upload/management with proper validation

### Week 5-6: Frontend Components
- Create workflow builder modal using shadcn/ui
- Implement file upload components with drag-and-drop
- Build credential management UI with secure handling

### Week 7-8: Integration and Testing
- Integrate with existing workflow execution system
- Add LlamaParse document processing for uploaded files
- Implement end-to-end testing with existing test patterns

### Week 9-10: Polish and Documentation
- UI/UX improvements following Suna design system
- Performance optimization and caching strategies
- Security audit and documentation updates

## Success Metrics

1. **User Adoption**: Number of workflows created using the builder
2. **File Usage**: Number and types of files uploaded to workflows
3. **Security**: Zero credential exposure incidents
4. **Performance**: File upload/download times under 5 seconds
5. **Integration**: Seamless workflow execution with existing agent system

This revised design document now properly aligns with Suna's actual infrastructure, leveraging existing patterns and technologies while maintaining security and performance standards.
