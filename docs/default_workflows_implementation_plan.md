# Default Workflows Implementation Plan

## Overview

This plan outlines the implementation of **Default Workflows** - predefined workflows that every user starts with when they create a new project. These workflows provide immediate value and help users understand the workflow system's capabilities.

## Key Features to Implement

1. **Default Workflows System** - Pre-configured workflows for all users
2. **Workflow Activation UX** - Seamless workflow-to-chat integration
3. **Enhanced File Upload Support** - Support for MD, CSV, Excel, and other file types

---

## 🗄️ DATABASE LAYER

### 1. Minimal Migration: Extend Existing Workflows Table

**File**: `backend/supabase/migrations/20250115000001_default_workflows.sql`

```sql
-- Add default workflow support to existing workflows table
ALTER TABLE workflows 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE,
ADD COLUMN default_category VARCHAR(100),
ADD COLUMN default_priority INTEGER DEFAULT 0;

-- Add index for default workflows
CREATE INDEX idx_workflows_is_default ON workflows(is_default);
CREATE INDEX idx_workflows_default_category ON workflows(default_category);

-- Update RLS policy to allow reading default workflows
DROP POLICY IF EXISTS "Users can view workflows in their projects" ON workflows;
CREATE POLICY "Users can view workflows in their projects or default workflows" ON workflows
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM projects 
            WHERE account_id IN (
                SELECT id FROM basejump.accounts 
                WHERE owner = auth.uid()
            )
        ) OR is_default = TRUE
    );

-- Create a special system account for default workflows
INSERT INTO basejump.accounts (id, name, owner, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'Suna System', 
    '00000000-0000-0000-0000-000000000000',
    NOW(), 
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create a special system project for default workflows
INSERT INTO projects (project_id, name, description, account_id, created_by, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Default Workflows',
    'System project containing default workflows for all users',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    NOW(),
    NOW()
) ON CONFLICT (project_id) DO NOTHING;

-- Create trigger function to automatically create default workflows for new users
CREATE OR REPLACE FUNCTION create_default_workflows_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- This will be called by the application layer when a new user project is created
    -- The actual workflow creation is handled by DefaultWorkflowsService.create_default_workflows_for_user()
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger on projects table (optional - can also be called from application layer)
CREATE TRIGGER trigger_create_default_workflows
    AFTER INSERT ON projects
    FOR EACH ROW
    WHEN (NEW.created_by != '00000000-0000-0000-0000-000000000000') -- Don't trigger for system project
    EXECUTE FUNCTION create_default_workflows_for_new_user();
```

### 2. Enhanced File Upload Support

**Update**: `backend/services/workflow_builder_service.py`

```python
# Expand allowed file types
self.allowed_mime_types = {
    # Text files
    'text/markdown',
    'text/plain',
    'text/csv',
    'text/html',
    'text/xml',
    'text/yaml',
    'text/yml',
    
    # Office documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
    'application/vnd.ms-excel',  # .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
    'application/msword',  # .doc
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',  # .pptx
    'application/vnd.ms-powerpoint',  # .ppt
    
    # Data files
    'application/json',
    'application/xml',
    'application/yaml',
    'application/yml',
    
    # Archive files
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    
    # Images (for documentation)
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
}

# File extensions mapping for better validation
self.allowed_extensions = {
    '.md', '.txt', '.csv', '.html', '.xml', '.yaml', '.yml',
    '.pdf', '.xlsx', '.xls', '.docx', '.doc', '.pptx', '.ppt',
    '.json', '.zip', '.rar', '.7z',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'
}
```

---

## 🔧 BACKEND LAYER

### 3. Default Workflows Service

**File**: `backend/services/default_workflows_service.py`

```python
"""
Default Workflows Service

Manages default workflows that are available to all users.
Automatically creates default workflows for new users.
Uses existing workflow system with special flags.
"""

import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from supabase import create_client, Client
from datetime import datetime

from workflows.models import WorkflowDefinition, WorkflowBuilderData
from utils.logger import logger


class DefaultWorkflowsService:
    """Service for managing default workflows using existing workflow system."""
    
    def __init__(self):
        """Initialize with Supabase client."""
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        self.system_project_id = "00000000-0000-0000-0000-000000000000"
    
    async def get_default_workflows(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all active default workflows, optionally filtered by category."""
        try:
            query = self.supabase.table("workflows").select("*").eq("is_default", True)
            
            if category:
                query = query.eq("default_category", category)
            
            query = query.order("default_priority", desc=True).order("name")
            result = query.execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Failed to get default workflows: {e}")
            raise HTTPException(status_code=500, detail="Failed to get default workflows")
    
    async def create_default_workflows_for_user(self, user_id: str, project_id: str) -> List[WorkflowDefinition]:
        """Automatically create default workflows for a new user."""
        try:
            # Get all default workflows
            default_workflows = await self.get_default_workflows()
            
            # Get user's account ID
            account_result = self.supabase.table("basejump.accounts").select("id").eq("owner", user_id).single().execute()
            account_id = account_result.data["id"]
            
            created_workflows = []
            
            for default_workflow in default_workflows:
                # Create user workflow (copy without default flags)
                workflow_data = {
                    "name": default_workflow["name"],
                    "description": default_workflow["description"],
                    "project_id": project_id,
                    "account_id": account_id,
                    "created_by": user_id,
                    "definition": default_workflow["definition"],
                    "master_prompt": default_workflow.get("master_prompt"),
                    "login_template": default_workflow.get("login_template"),
                    "is_default": False,  # User's copy is not a default
                    "default_category": None,
                    "default_priority": 0
                }
                
                workflow_result = self.supabase.table("workflows").insert(workflow_data).execute()
                workflow_id = workflow_result.data[0]["id"]
                
                # Copy associated files from default workflow
                await self._copy_workflow_files(default_workflow["id"], workflow_id)
                
                # Copy associated credentials from default workflow
                await self._copy_workflow_credentials(default_workflow["id"], workflow_id)
                
                created_workflows.append(WorkflowDefinition(**workflow_result.data[0]))
                
                logger.info(f"Created default workflow '{default_workflow['name']}' for user {user_id}")
            
            return created_workflows
            
        except Exception as e:
            logger.error(f"Failed to create default workflows for user {user_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to create default workflows for user")
    
    async def _copy_workflow_files(self, source_workflow_id: str, target_workflow_id: str):
        """Copy files from source workflow to target workflow."""
        try:
            # Get source workflow files
            files_result = self.supabase.table("workflow_files").select("*").eq("workflow_id", source_workflow_id).execute()
            
            for file_data in files_result.data:
                # Copy file metadata to target workflow
                self.supabase.table("workflow_files").insert({
                    "workflow_id": target_workflow_id,
                    "file_name": file_data["file_name"],
                    "file_path": file_data["file_path"],
                    "file_size": file_data["file_size"],
                    "mime_type": file_data["mime_type"],
                    "storage_bucket": file_data["storage_bucket"]
                }).execute()
                
        except Exception as e:
            logger.error(f"Failed to copy workflow files: {e}")
            # Don't fail the entire operation if file copying fails
    
    async def _copy_workflow_credentials(self, source_workflow_id: str, target_workflow_id: str):
        """Copy credentials from source workflow to target workflow."""
        try:
            # Get source workflow credentials
            credentials_result = self.supabase.table("workflow_credentials").select("*").eq("workflow_id", source_workflow_id).execute()
            
            for cred_data in credentials_result.data:
                # Copy credential to target workflow
                self.supabase.table("workflow_credentials").insert({
                    "workflow_id": target_workflow_id,
                    "key": cred_data["key"],
                    "value": cred_data["value"],  # Already encrypted
                    "description": cred_data.get("description")
                }).execute()
                
        except Exception as e:
            logger.error(f"Failed to copy workflow credentials: {e}")
            # Don't fail the entire operation if credential copying fails
    
    async def create_default_workflow(self, workflow_data: Dict[str, Any]) -> WorkflowDefinition:
        """Create a new default workflow (admin only)."""
        try:
            # Ensure it's created in the system project
            workflow_data.update({
                "project_id": self.system_project_id,
                "account_id": self.system_project_id,
                "created_by": self.system_project_id,
                "is_default": True
            })
            
            result = self.supabase.table("workflows").insert(workflow_data).execute()
            return WorkflowDefinition(**workflow_result.data[0])
            
        except Exception as e:
            logger.error(f"Failed to create default workflow: {e}")
            raise HTTPException(status_code=500, detail="Failed to create default workflow")
```

### 4. Workflow Activation Service

**File**: `backend/services/workflow_activation_service.py`

```python
"""
Workflow Activation Service

Handles workflow activation and integration with chat system.
"""

import os
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException
from supabase import create_client, Client

from workflows.models import WorkflowDefinition
from utils.logger import logger


class WorkflowActivationService:
    """Service for activating workflows and integrating with chat."""
    
    def __init__(self):
        """Initialize with Supabase client."""
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
    
    async def activate_workflow_for_chat(
        self, 
        workflow_id: str, 
        project_id: str, 
        user_id: str,
        chat_session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Activate a workflow and prepare it for chat integration."""
        try:
            # Get workflow details
            workflow_result = self.supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
            
            if not workflow_result.data:
                raise HTTPException(status_code=404, detail="Workflow not found")
            
            workflow = workflow_result.data
            
            # Get workflow files
            files_result = self.supabase.table("workflow_files").select("*").eq("workflow_id", workflow_id).execute()
            files = files_result.data
            
            # Get workflow credentials (decrypted)
            credentials_result = self.supabase.table("workflow_credentials").select("*").eq("workflow_id", workflow_id).execute()
            credentials = credentials_result.data
            
            # Create activation context
            activation_context = {
                "workflow_id": workflow_id,
                "workflow_name": workflow["name"],
                "master_prompt": workflow.get("master_prompt"),
                "login_template": workflow.get("login_template"),
                "files": files,
                "credentials": credentials,
                "definition": workflow["definition"],
                "activated_at": datetime.utcnow().isoformat(),
                "chat_session_id": chat_session_id
            }
            
            # Store activation context for chat integration
            if chat_session_id:
                await self._store_chat_context(chat_session_id, activation_context)
            
            return activation_context
            
        except Exception as e:
            logger.error(f"Failed to activate workflow: {e}")
            raise HTTPException(status_code=500, detail="Failed to activate workflow")
    
    async def _store_chat_context(self, chat_session_id: str, context: Dict[str, Any]):
        """Store workflow context for chat session."""
        try:
            # Store in Redis or database for chat integration
            # This will be used by the chat system to load workflow context
            pass
        except Exception as e:
            logger.error(f"Failed to store chat context: {e}")
```

### 5. Enhanced File Upload Service

**Update**: `backend/services/workflow_builder_service.py`

```python
# Add to WorkflowBuilderService class

def _validate_file_type(self, file: UploadFile) -> bool:
    """Enhanced file type validation with extension checking."""
    # Check MIME type
    if file.content_type in self.allowed_mime_types:
        return True
    
    # Check file extension as fallback
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension in self.allowed_extensions:
        return True
    
    return False

async def upload_file(self, file: UploadFile, workflow_id: str) -> WorkflowFileUploadResponse:
    """Enhanced file upload with better type support."""
    try:
        # Validate file type
        if not self._validate_file_type(file):
            allowed_types = ", ".join(sorted(self.allowed_extensions))
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed types: {allowed_types}"
            )
        
        # Validate file size
        if file.size > self.max_file_size:
            max_size_mb = self.max_file_size // (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size_mb}MB"
            )
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = f"workflows/{workflow_id}/{unique_filename}"
        
        # Upload to storage
        file_content = await file.read()
        self.supabase.storage.from_(self.bucket_name).upload(
            file_path, 
            file_content,
            {"content-type": file.content_type}
        )
        
        # Store file metadata
        file_data = {
            "workflow_id": workflow_id,
            "file_name": file.filename,
            "file_path": file_path,
            "file_size": len(file_content),
            "mime_type": file.content_type,
            "storage_bucket": self.bucket_name
        }
        
        result = self.supabase.table("workflow_files").insert(file_data).execute()
        
        return WorkflowFileUploadResponse(
            id=result.data[0]["id"],
            file_name=file.filename,
            file_size=len(file_content),
            mime_type=file.content_type,
            uploaded_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail="File upload failed")
```

### 6. API Endpoints

**Update**: `backend/workflows/api.py`

```python
# Add new endpoints

@router.get("/default-workflows")
async def get_default_workflows(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: UserClaims = Depends(get_current_user)
):
    """Get available default workflows."""
    service = DefaultWorkflowsService()
    workflows = await service.get_default_workflows(category)
    return {"workflows": workflows}

@router.post("/workflows/{workflow_id}/activate")
async def activate_workflow(
    workflow_id: str,
    chat_session_id: Optional[str] = Body(None, embed=True),
    current_user: UserClaims = Depends(get_current_user)
):
    """Activate a workflow for chat integration."""
    service = WorkflowActivationService()
    context = await service.activate_workflow_for_chat(
        workflow_id, current_user.project_id, current_user.id, chat_session_id
    )
    return {"activation_context": context}

# Admin endpoint for creating default workflows
@router.post("/admin/default-workflows")
async def create_default_workflow(
    workflow_data: WorkflowBuilderData,
    current_user: UserClaims = Depends(get_current_user)
):
    """Create a new default workflow (admin only)."""
    # TODO: Add admin role check
    service = DefaultWorkflowsService()
    workflow = await service.create_default_workflow(workflow_data.dict())
    return {"workflow": workflow}
```

---

## 🎨 FRONTEND LAYER

### 7. Default Workflows Components

**File**: `frontend/src/components/workflows/DefaultWorkflowsGrid.tsx`

```typescript
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useDefaultWorkflows, 
  useCopyDefaultWorkflow,
  useUserCopiedWorkflows 
} from '@/hooks/react-query/workflows/use-default-workflows';
import { toast } from 'sonner';
import { 
  Copy, 
  Check, 
  Zap, 
  BarChart3, 
  Settings, 
  FileText,
  Play
} from 'lucide-react';

interface DefaultWorkflowsGridProps {
  projectId: string;
  onWorkflowCopied?: (workflowId: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'productivity', label: 'Productivity', icon: Zap },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'automation', label: 'Automation', icon: Settings }
];

export function DefaultWorkflowsGrid({ projectId, onWorkflowCopied }: DefaultWorkflowsGridProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: workflows, isLoading } = useDefaultWorkflows(selectedCategory === 'all' ? undefined : selectedCategory);
  const { data: copiedWorkflows = [] } = useUserCopiedWorkflows();
  const copyWorkflow = useCopyDefaultWorkflow();

  const handleCopyWorkflow = async (defaultWorkflowId: string) => {
    try {
      const result = await copyWorkflow.mutateAsync({
        defaultWorkflowId,
        projectId
      });
      
      toast.success('Workflow copied successfully!');
      onWorkflowCopied?.(result.workflow.id);
    } catch (error) {
      toast.error('Failed to copy workflow');
    }
  };

  const isWorkflowCopied = (workflowId: string) => {
    return copiedWorkflows.includes(workflowId);
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </CardHeader>
          <CardContent>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </CardContent>
        </Card>
      ))}
    </div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-4">
          {CATEGORIES.map(category => (
            <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
              <category.icon className="w-4 h-4" />
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows?.map(workflow => (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <Badge variant="secondary">{workflow.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {workflow.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Play className="w-4 h-4" />
                      Ready to use
                    </div>
                    
                    {isWorkflowCopied(workflow.id) ? (
                      <Button variant="outline" size="sm" disabled>
                        <Check className="w-4 h-4 mr-2" />
                        Copied
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => handleCopyWorkflow(workflow.id)}
                        disabled={copyWorkflow.isPending}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {copyWorkflow.isPending ? 'Copying...' : 'Copy Workflow'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 8. Workflow Activation Component

**File**: `frontend/src/components/workflows/WorkflowActivator.tsx`

```typescript
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  useActivateWorkflow,
  useWorkflowBuilderData 
} from '@/hooks/react-query/workflows/use-workflow-builder';
import { toast } from 'sonner';
import { Play, FileText, Key, Settings } from 'lucide-react';

interface WorkflowActivatorProps {
  workflowId: string;
  projectId: string;
  onActivated?: (context: any) => void;
}

export function WorkflowActivator({ workflowId, projectId, onActivated }: WorkflowActivatorProps) {
  const [isActivating, setIsActivating] = useState(false);
  const { data: workflowData } = useWorkflowBuilderData(workflowId);
  const activateWorkflow = useActivateWorkflow();

  const handleActivate = async () => {
    try {
      setIsActivating(true);
      
      const result = await activateWorkflow.mutateAsync({
        workflowId,
        projectId
      });
      
      toast.success('Workflow activated! Ready for chat.');
      onActivated?.(result.activation_context);
    } catch (error) {
      toast.error('Failed to activate workflow');
    } finally {
      setIsActivating(false);
    }
  };

  if (!workflowData) {
    return <div>Loading workflow...</div>;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Activate Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">{workflowData.title}</h3>
          <p className="text-sm text-gray-600">{workflowData.description}</p>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText className="w-4 h-4" />
          {workflowData.files?.length || 0} files
          {workflowData.login_template && (
            <>
              <Key className="w-4 h-4" />
              Credentials configured
            </>
          )}
        </div>
        
        <Button 
          onClick={handleActivate}
          disabled={isActivating}
          className="w-full"
        >
          {isActivating ? (
            <>
              <Settings className="w-4 h-4 mr-2 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Activate & Open Chat
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### 9. Enhanced File Upload Component

**Update**: `frontend/src/components/workflows/FileUploadZone.tsx`

```typescript
// Add to existing component

const ALLOWED_FILE_TYPES = {
  // Text files
  'text/markdown': { label: 'Markdown', icon: '📝' },
  'text/plain': { label: 'Text', icon: '📄' },
  'text/csv': { label: 'CSV', icon: '📊' },
  'text/html': { label: 'HTML', icon: '🌐' },
  'text/xml': { label: 'XML', icon: '📋' },
  'text/yaml': { label: 'YAML', icon: '⚙️' },
  'text/yml': { label: 'YAML', icon: '⚙️' },
  
  // Office documents
  'application/pdf': { label: 'PDF', icon: '📕' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel', icon: '📊' },
  'application/vnd.ms-excel': { label: 'Excel', icon: '📊' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word', icon: '📝' },
  'application/msword': { label: 'Word', icon: '📝' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PowerPoint', icon: '📽️' },
  'application/vnd.ms-powerpoint': { label: 'PowerPoint', icon: '📽️' },
  
  // Data files
  'application/json': { label: 'JSON', icon: '📋' },
  'application/xml': { label: 'XML', icon: '📋' },
  'application/yaml': { label: 'YAML', icon: '⚙️' },
  'application/yml': { label: 'YAML', icon: '⚙️' },
  
  // Archive files
  'application/zip': { label: 'ZIP', icon: '📦' },
  'application/x-rar-compressed': { label: 'RAR', icon: '📦' },
  'application/x-7z-compressed': { label: '7Z', icon: '📦' },
  
  // Images
  'image/png': { label: 'PNG', icon: '🖼️' },
  'image/jpeg': { label: 'JPEG', icon: '🖼️' },
  'image/gif': { label: 'GIF', icon: '🖼️' },
  'image/webp': { label: 'WebP', icon: '🖼️' },
  'image/svg+xml': { label: 'SVG', icon: '🖼️' }
};

// Update the file type validation
const validateFileType = (file: File): boolean => {
  // Check MIME type first
  if (file.type && ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
    return true;
  }
  
  // Check file extension as fallback
  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = [
    'md', 'txt', 'csv', 'html', 'xml', 'yaml', 'yml',
    'pdf', 'xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt',
    'json', 'zip', 'rar', '7z',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'
  ];
  
  return allowedExtensions.includes(extension || '');
};

// Update the file icon display
const getFileIcon = (file: File | WorkflowFile): string => {
  const mimeType = 'type' in file ? file.type : file.mime_type;
  const fileInfo = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];
  return fileInfo?.icon || '📄';
};
```

### 10. React Query Hooks

**File**: `frontend/src/hooks/react-query/workflows/use-default-workflows.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Get default workflows
export function useDefaultWorkflows(category?: string) {
  return useQuery({
    queryKey: ['default-workflows', category],
    queryFn: async () => {
      const params = category ? `?category=${category}` : '';
      const response = await fetch(`/api/workflows/default-workflows${params}`);
      if (!response.ok) throw new Error('Failed to fetch default workflows');
      const data = await response.json();
      return data.workflows;
    }
  });
}

// Activate workflow
export function useActivateWorkflow() {
  return useMutation({
    mutationFn: async ({ workflowId, projectId }: { workflowId: string; projectId: string }) => {
      const response = await fetch(`/api/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (!response.ok) throw new Error('Failed to activate workflow');
      return response.json();
    }
  });
}

// Create default workflow (admin only)
export function useCreateDefaultWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workflowData: any) => {
      const response = await fetch('/api/workflows/admin/default-workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      });
      if (!response.ok) throw new Error('Failed to create default workflow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-workflows'] });
    }
  });
}
```

---

## 🚀 INTEGRATION & DEPLOYMENT

### 11. Workflows Page Integration

**Update**: `frontend/src/app/(dashboard)/workflows/page.tsx`

```typescript
// Add to existing page

import { DefaultWorkflowsGrid } from '@/components/workflows/DefaultWorkflowsGrid';

// Add state for showing default workflows
const [showDefaultWorkflows, setShowDefaultWorkflows] = useState(false);

// Add button to show default workflows
<Button 
  onClick={() => setShowDefaultWorkflows(true)}
  variant="outline"
  className="mb-4"
>
  <Plus className="w-4 h-4 mr-2" />
  View Default Workflows
</Button>

// Add default workflows modal
<Dialog open={showDefaultWorkflows} onOpenChange={setShowDefaultWorkflows}>
  <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Default Workflows</DialogTitle>
    </DialogHeader>
    <DefaultWorkflowsGrid projectId={projectId} />
  </DialogContent>
</Dialog>

// Note: Users don't need to copy workflows anymore since they're automatically created
// The DefaultWorkflowsGrid now just shows what's available and confirms they exist in user's workflows
```

### 12. Chat Integration

**Update**: Chat system to handle workflow activation

```typescript
// In chat component or context
const handleWorkflowActivation = async (workflowId: string) => {
  try {
    const response = await fetch(`/api/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        project_id: projectId,
        chat_session_id: sessionId 
      })
    });
    
    if (response.ok) {
      const { activation_context } = await response.json();
      
      // Load workflow context into chat
      setWorkflowContext(activation_context);
      
      // Pre-populate chat with workflow prompt
      if (activation_context.master_prompt) {
        setInputValue(activation_context.master_prompt);
      }
      
      toast.success('Workflow activated! Ready to use.');
    }
  } catch (error) {
    toast.error('Failed to activate workflow');
  }
};
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Database & Backend (Week 1)
- [ ] Create migration to extend workflows table with default flags
- [ ] Implement DefaultWorkflowsService with automatic user workflow creation
- [ ] Implement WorkflowActivationService
- [ ] Enhance file upload support with expanded file types
- [ ] Add API endpoints for default workflows and activation
- [ ] Create system account and project for default workflows
- [ ] Manually create initial default workflows in database

### Phase 2: Frontend Components (Week 2)
- [ ] Create DefaultWorkflowsGrid component (read-only display)
- [ ] Enhance FileUploadZone with better file support
- [ ] Add React Query hooks for default workflows
- [ ] Update workflows page with default workflows integration

### Phase 3: Integration & Testing (Week 3)
- [ ] Integrate default workflows into main workflows page
- [ ] Implement chat integration for workflow activation
- [ ] Test automatic workflow creation for new users
- [ ] Test file upload with new file types
- [ ] Test workflow activation flow

### Phase 4: Polish & Deployment (Week 4)
- [ ] Add loading states and error handling
- [ ] Implement proper file type validation
- [ ] Add user feedback and notifications
- [ ] Performance optimization
- [ ] Documentation updates

---

## 🌱 DEFAULT WORKFLOW SETUP

### Option 1: Manual Database Setup (Recommended)

Since you have direct database access, you can manually create the default workflows:

```sql
-- First, ensure the migration has been run to add the new columns
-- Then manually insert default workflows:

INSERT INTO workflows (
    id, name, description, project_id, account_id, created_by, 
    definition, master_prompt, is_default, default_category, default_priority,
    created_at, updated_at
) VALUES 
(
    gen_random_uuid(), 'Email Assistant', 
    'AI-powered email composition and management assistant',
    '00000000-0000-0000-0000-000000000000', -- system project
    '00000000-0000-0000-0000-000000000000', -- system account
    '00000000-0000-0000-0000-000000000000', -- system user
    '{"steps": [{"id": "email_compose", "name": "Compose Email", "type": "TOOL", "config": {"tool": "email_composer"}, "next_steps": ["email_review"]}, {"id": "email_review", "name": "Review Email", "type": "TOOL", "config": {"tool": "email_reviewer"}, "next_steps": []}], "entry_point": "email_compose"}',
    'You are an AI email assistant. Help users compose, edit, and manage emails effectively. Key capabilities: - Compose professional emails - Edit and improve existing emails - Suggest email templates - Help with email etiquette - Organize email responses. Always maintain a professional tone and provide helpful, actionable advice.',
    TRUE, 'productivity', 100,
    NOW(), NOW()
),
(
    gen_random_uuid(), 'Data Analyzer',
    'Analyze and visualize data from various sources',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '{"steps": [{"id": "data_load", "name": "Load Data", "type": "TOOL", "config": {"tool": "data_loader"}, "next_steps": ["data_analyze"]}, {"id": "data_analyze", "name": "Analyze Data", "type": "TOOL", "config": {"tool": "data_analyzer"}, "next_steps": ["data_visualize"]}, {"id": "data_visualize", "name": "Create Visualizations", "type": "TOOL", "config": {"tool": "data_visualizer"}, "next_steps": []}], "entry_point": "data_load"}',
    'You are a data analysis assistant. Help users analyze, interpret, and visualize data. Key capabilities: - Analyze CSV, Excel, and JSON data - Create data visualizations - Generate insights and reports - Perform statistical analysis - Help with data cleaning. Provide clear, actionable insights and recommendations based on the data.',
    TRUE, 'analysis', 90,
    NOW(), NOW()
),
(
    gen_random_uuid(), 'Content Writer',
    'AI-powered content creation and writing assistant',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '{"steps": [{"id": "content_plan", "name": "Plan Content", "type": "TOOL", "config": {"tool": "content_planner"}, "next_steps": ["content_write"]}, {"id": "content_write", "name": "Write Content", "type": "TOOL", "config": {"tool": "content_writer"}, "next_steps": ["content_edit"]}, {"id": "content_edit", "name": "Edit Content", "type": "TOOL", "config": {"tool": "content_editor"}, "next_steps": []}], "entry_point": "content_plan"}',
    'You are a content writing assistant. Help users create high-quality written content. Key capabilities: - Write blog posts, articles, and essays - Create marketing copy and social media content - Edit and improve existing content - Generate content ideas and outlines - Help with SEO optimization. Maintain engaging, well-structured content that matches the user''s tone and style.',
    TRUE, 'productivity', 80,
    NOW(), NOW()
);
```

### Option 2: Seeding Script

Alternatively, create a seeding script to populate initial default workflows:

```python
"""
Seed default workflows for new users.
"""

import asyncio
from services.default_workflows_service import DefaultWorkflowsService

DEFAULT_WORKFLOWS = [
    {
        "name": "Email Assistant",
        "description": "AI-powered email composition and management assistant",
        "default_category": "productivity",
        "default_priority": 100,
        "master_prompt": """You are an AI email assistant. Help users compose, edit, and manage emails effectively.

Key capabilities:
- Compose professional emails
- Edit and improve existing emails
- Suggest email templates
- Help with email etiquette
- Organize email responses

Always maintain a professional tone and provide helpful, actionable advice.""",
        "definition": {
            "steps": [
                {
                    "id": "email_compose",
                    "name": "Compose Email",
                    "type": "TOOL",
                    "config": {"tool": "email_composer"},
                    "next_steps": ["email_review"]
                },
                {
                    "id": "email_review",
                    "name": "Review Email",
                    "type": "TOOL", 
                    "config": {"tool": "email_reviewer"},
                    "next_steps": []
                }
            ],
            "entry_point": "email_compose"
        }
    },
    {
        "name": "Data Analyzer",
        "description": "Analyze and visualize data from various sources",
        "default_category": "analysis",
        "default_priority": 90,
        "master_prompt": """You are a data analysis assistant. Help users analyze, interpret, and visualize data.

Key capabilities:
- Analyze CSV, Excel, and JSON data
- Create data visualizations
- Generate insights and reports
- Perform statistical analysis
- Help with data cleaning

Provide clear, actionable insights and recommendations based on the data.""",
        "definition": {
            "steps": [
                {
                    "id": "data_load",
                    "name": "Load Data",
                    "type": "TOOL",
                    "config": {"tool": "data_loader"},
                    "next_steps": ["data_analyze"]
                },
                {
                    "id": "data_analyze", 
                    "name": "Analyze Data",
                    "type": "TOOL",
                    "config": {"tool": "data_analyzer"},
                    "next_steps": ["data_visualize"]
                },
                {
                    "id": "data_visualize",
                    "name": "Create Visualizations",
                    "type": "TOOL",
                    "config": {"tool": "data_visualizer"},
                    "next_steps": []
                }
            ],
            "entry_point": "data_load"
        }
    },
    {
        "name": "Content Writer",
        "description": "AI-powered content creation and writing assistant",
        "default_category": "productivity", 
        "default_priority": 80,
        "master_prompt": """You are a content writing assistant. Help users create high-quality written content.

Key capabilities:
- Write blog posts, articles, and essays
- Create marketing copy and social media content
- Edit and improve existing content
- Generate content ideas and outlines
- Help with SEO optimization

Maintain engaging, well-structured content that matches the user's tone and style.""",
        "definition": {
            "steps": [
                {
                    "id": "content_plan",
                    "name": "Plan Content",
                    "type": "TOOL",
                    "config": {"tool": "content_planner"},
                    "next_steps": ["content_write"]
                },
                {
                    "id": "content_write",
                    "name": "Write Content", 
                    "type": "TOOL",
                    "config": {"tool": "content_writer"},
                    "next_steps": ["content_edit"]
                },
                {
                    "id": "content_edit",
                    "name": "Edit Content",
                    "type": "TOOL",
                    "config": {"tool": "content_editor"},
                    "next_steps": []
                }
            ],
            "entry_point": "content_plan"
        }
    }
]

async def seed_default_workflows():
    """Seed the database with default workflows."""
    service = DefaultWorkflowsService()
    
    for workflow_data in DEFAULT_WORKFLOWS:
        try:
            await service.create_default_workflow(workflow_data)
            print(f"✅ Created default workflow: {workflow_data['name']}")
        except Exception as e:
            print(f"❌ Failed to create workflow {workflow_data['name']}: {e}")

if __name__ == "__main__":
    asyncio.run(seed_default_workflows())
```

### Running the Seeder

```bash
# Run the seeding script
cd backend
python scripts/seed_default_workflows.py
```

---

## 🔄 USER CREATION INTEGRATION

### Automatic Default Workflow Creation

To automatically create default workflows when new users sign up, integrate the service into your user creation flow:

**File**: `backend/auth/user_creation.py` (or wherever you handle new user creation)

```python
from services.default_workflows_service import DefaultWorkflowsService

async def create_new_user_with_defaults(user_data: dict, project_id: str):
    """Create a new user and automatically create their default workflows."""
    try:
        # Your existing user creation logic here
        user = await create_user(user_data)
        
        # Automatically create default workflows for the new user
        default_workflows_service = DefaultWorkflowsService()
        await default_workflows_service.create_default_workflows_for_user(
            user_id=user.id,
            project_id=project_id
        )
        
        logger.info(f"Created default workflows for new user {user.id}")
        return user
        
    except Exception as e:
        logger.error(f"Failed to create user with defaults: {e}")
        raise
```

### Alternative: Database Trigger Integration

If you prefer to handle this at the database level, you can modify the trigger function:

```sql
-- Update the trigger function to actually create workflows
CREATE OR REPLACE FUNCTION create_default_workflows_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_workflow RECORD;
    new_workflow_id UUID;
BEGIN
    -- Loop through all default workflows and create copies for the new user
    FOR default_workflow IN 
        SELECT * FROM workflows 
        WHERE is_default = TRUE 
        ORDER BY default_priority DESC
    LOOP
        -- Create copy of default workflow for new user
        INSERT INTO workflows (
            name, description, project_id, account_id, created_by,
            definition, master_prompt, login_template, is_default, default_category, default_priority
        ) VALUES (
            default_workflow.name,
            default_workflow.description,
            NEW.project_id,
            NEW.account_id,
            NEW.created_by,
            default_workflow.definition,
            default_workflow.master_prompt,
            default_workflow.login_template,
            FALSE, -- User's copy is not a default
            NULL,   -- No category for user copy
            0       -- No priority for user copy
        ) RETURNING id INTO new_workflow_id;
        
        -- Copy associated files (if any)
        INSERT INTO workflow_files (
            workflow_id, file_name, file_path, file_size, mime_type, storage_bucket
        )
        SELECT 
            new_workflow_id, file_name, file_path, file_size, mime_type, storage_bucket
        FROM workflow_files 
        WHERE workflow_id = default_workflow.id;
        
        -- Copy associated credentials (if any)
        INSERT INTO workflow_credentials (
            workflow_id, key, value, description
        )
        SELECT 
            new_workflow_id, key, value, description
        FROM workflow_credentials 
        WHERE workflow_id = default_workflow.id;
    END LOOP;
    
    RETURN NEW;
END;
$$ language 'plpgsql';
```

**Note**: The database trigger approach is more complex and harder to debug. The application-level approach is recommended for better control and error handling.

---

## 🎯 KEY BENEFITS

1. **Immediate Value**: Users get working workflows from day one
2. **Learning Tool**: Default workflows demonstrate best practices
3. **Reduced Friction**: No need to start from scratch
4. **Enhanced UX**: Seamless workflow-to-chat integration
5. **Better File Support**: Support for common file types users expect
6. **Simplified Architecture**: Uses existing workflow system, no new tables needed
7. **Full Workflow Functionality**: Users can modify default workflows just like regular ones

---

## 🔧 TECHNICAL CONSIDERATIONS

1. **File Type Validation**: Both MIME type and extension checking
2. **Storage Management**: Reuses existing workflow file storage
3. **Performance**: Efficient loading using existing workflow queries
4. **Security**: Leverages existing RLS policies with minimal changes
5. **Scalability**: Easy addition of new default workflows via admin interface
6. **Data Integrity**: Default workflows are immutable, user copies are fully editable
7. **System Isolation**: Default workflows use special system account/project

This plan provides a comprehensive approach to implementing default workflows while solving the file upload limitations and creating a smooth workflow activation experience.
