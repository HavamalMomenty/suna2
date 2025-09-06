"""
Workflow Builder Service

Core business logic for workflow builder operations including:
- Workflow creation and updates
- File upload and management
- Credential encryption and storage
- Integration with existing Supabase infrastructure
"""

import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from supabase import create_client, Client
from datetime import datetime

from workflows.models import (
    WorkflowDefinition, WorkflowBuilderData, WorkflowFile, 
    WorkflowFileUploadResponse
)
from utils.logger import logger


class WorkflowBuilderService:
    """Service for managing workflow builder operations."""
    
    def __init__(self):
        """Initialize with Supabase client."""
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        self.bucket_name = "workflow-files"
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
        
        # Allowed file types for workflow files
        self.allowed_mime_types = {
            # Text files
            'text/markdown',
            'text/plain',
            'text/csv',
            'text/html',
            'text/css',
            'text/xml',
            'application/xml',
            'application/octet-stream',  # Generic binary/unknown types
            # Common mislabels
            'application/vnd.ms-excel',  # some browsers send CSV/XLS as this
            'application/msexcel',       # Alternative Excel MIME
            'application/excel',         # Another Excel variant
            # Documents
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/mspowerpoint',  # Legacy PowerPoint
            'application/powerpoint',    # Alternative PowerPoint
            'application/vnd.ms-powerpoint',  # Legacy PowerPoint
            'application/vnd.ms-powerpoint.presentation',  # Another PowerPoint variant
            'application/x-mspowerpoint',  # Another PowerPoint variant
            'application/vnd.oasis.opendocument.text',
            'application/vnd.oasis.opendocument.presentation',
            'application/rtf',
            'application/x-tex',
            'application/vnd.oasis.opendocument.spreadsheet',
            'text/tab-separated-values',
            # Data
            'application/json',
            # Images
            'image/jpeg',
            'image/png',
            'image/svg+xml'
        }
        
        # File size limit (50MB)
        self.max_file_size = 50 * 1024 * 1024
        
    def _ensure_bucket_exists(self):
        """Ensure the storage bucket exists."""
        try:
            # Try to get bucket info
            bucket_info = self.supabase.storage.get_bucket(self.bucket_name)
            if not bucket_info:
                # Create bucket if it doesn't exist
                logger.info(f"Creating storage bucket: {self.bucket_name}")
                self.supabase.storage.create_bucket(self.bucket_name, {"public": False})
        except Exception as e:
            logger.warning(f"Could not ensure bucket exists: {e}")
            # Continue anyway - bucket might exist but API call failed
    
    async def create_workflow_from_builder(
        self, 
        workflow_data: WorkflowBuilderData, 
        project_id: str, 
        user_id: str
    ) -> WorkflowDefinition:
        """
        Create a new workflow from builder data.
        
        Args:
            workflow_data: Complete workflow builder data
            project_id: Project ID to associate workflow with
            user_id: User creating the workflow
            
        Returns:
            Created WorkflowDefinition
        """
        try:
            logger.info(
                "Creating workflow from builder",
                user_id=user_id,
                project_id=project_id,
                title=workflow_data.title
            )
            
            # Get user's account ID for multi-tenant support
            account_id = await self._get_user_account_id(user_id)
            
            # Create base workflow record
            workflow_result = self.supabase.table("workflows").insert({
                "name": workflow_data.title,
                "description": workflow_data.description,
                "project_id": project_id,
                "account_id": account_id,
                "created_by": user_id,
                "master_prompt": workflow_data.master_prompt,
                "login_template": workflow_data.login_template,
                "definition": {
                    "type": "builder_workflow",
                    "version": "1.0",
                    "created_via": "workflow_builder",
                    "steps": [],
                    "entry_point": "",
                    "triggers": [{"type": "MANUAL", "config": {}}]
                },
                "status": "draft"
            }).execute()
            
            if not workflow_result.data:
                raise ValueError("Failed to create workflow")
            
            workflow_id = workflow_result.data[0]["id"]
            
            # Convert to WorkflowDefinition model using the same mapping as the API
            workflow_dict = workflow_result.data[0]
            return self._map_db_to_workflow_definition(workflow_dict)
            
        except Exception as e:
            logger.error(f"Error creating workflow from builder: {str(e)}")
            raise
    
    async def update_workflow_from_builder(
        self,
        workflow_id: str,
        workflow_data: WorkflowBuilderData,
        user_id: str
    ) -> WorkflowDefinition:
        """
        Update an existing workflow with builder data.
        
        Args:
            workflow_id: ID of workflow to update
            workflow_data: Updated workflow data
            user_id: User performing the update
            
        Returns:
            Updated WorkflowDefinition
        """
        try:
            # Verify workflow ownership
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Update workflow record
            workflow_result = self.supabase.table("workflows").update({
                "name": workflow_data.title,
                "description": workflow_data.description,
                "master_prompt": workflow_data.master_prompt,
                "login_template": workflow_data.login_template,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", workflow_id).execute()
            
            if not workflow_result.data:
                raise ValueError("Workflow not found or access denied")
            
            return self._map_db_to_workflow_definition(workflow_result.data[0])
            
        except Exception as e:
            logger.error(f"Error updating workflow: {str(e)}")
            raise
    
    async def get_workflow_builder_data(
        self, 
        workflow_id: str, 
        user_id: str
    ) -> WorkflowBuilderData:
        """
        Get workflow data for the builder interface.
        
        Args:
            workflow_id: ID of workflow to retrieve
            user_id: User requesting the data
            
        Returns:
            WorkflowBuilderData
        """
        try:
            # Verify access and get workflow
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Get workflow data
            workflow_result = self.supabase.table("workflows").select(
                "name, description, master_prompt, login_template"
            ).eq("id", workflow_id).execute()
            
            if not workflow_result.data:
                raise ValueError("Workflow not found")
            
            workflow = workflow_result.data[0]
            
            # Get files
            files = await self._get_workflow_files(workflow_id)
            
            return WorkflowBuilderData(
                title=workflow["name"],
                description=workflow["description"],
                master_prompt=workflow["master_prompt"] or "",
                login_template=workflow["login_template"] or "",
                files=files
            )
            
        except Exception as e:
            logger.error(f"Error getting workflow builder data: {str(e)}")
            raise
    
    async def upload_file(
        self, 
        workflow_id: str, 
        file: UploadFile, 
        user_id: str
    ) -> WorkflowFile:
        """
        Upload a supplementary file for a workflow.
        
        Args:
            workflow_id: ID of workflow to attach file to
            file: File to upload
            user_id: User uploading the file
            
        Returns:
            WorkflowFile record
        """
        try:
            # Verify workflow access
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Validate file
            await self._validate_file(file)
            
            # Generate unique file path
            file_id = str(uuid.uuid4())
            file_extension = self._get_file_extension(file.filename)
            storage_path = f"{user_id}/{workflow_id}/{file_id}{file_extension}"
            
            # Read file content
            file_content = await file.read()
            
            # Upload to Supabase Storage
            logger.info(f"Uploading file to storage: {storage_path}")
            try:
                # First, check if bucket exists
                bucket_list = self.supabase.storage.list_buckets()
                bucket_exists = any(bucket.name == self.bucket_name for bucket in bucket_list if hasattr(bucket, 'name'))
                
                if not bucket_exists:
                    logger.warning(f"Bucket {self.bucket_name} does not exist, creating it")
                    create_result = self.supabase.storage.create_bucket(self.bucket_name, {"public": False})
                    logger.info(f"Bucket creation result: {create_result}")
                
                # Try upload with file options
                upload_result = self.supabase.storage.from_(self.bucket_name).upload(
                    storage_path, 
                    file_content, 
                    {"content-type": file.content_type, "upsert": "true"}
                )
                
                logger.info(f"Upload result type: {type(upload_result)}")
                logger.info(f"Upload result: {upload_result}")
                
                # Check if upload was successful
                if hasattr(upload_result, 'error') and upload_result.error:
                    logger.error(f"Upload error: {upload_result.error}")
                    raise Exception(f"Storage upload failed: {upload_result.error}")
                
                # For successful uploads, the result should have a path or key
                if not upload_result:
                    raise Exception("Storage upload failed: No response from storage")
                        
            except Exception as storage_error:
                logger.error(f"Storage upload error details: {type(storage_error).__name__}: {storage_error}")
                raise Exception(f"Storage upload failed: {str(storage_error)}")
            
            # Create database record
            # Extract a reasonable file type from MIME type or filename
            file_type = "unknown"
            if file.content_type:
                if file.content_type.startswith('application/vnd.openxmlformats-officedocument'):
                    # Handle Office documents with shorter type names
                    if 'presentationml' in file.content_type:
                        file_type = "pptx"
                    elif 'wordprocessingml' in file.content_type:
                        file_type = "docx"
                    elif 'spreadsheetml' in file.content_type:
                        file_type = "xlsx"
                    else:
                        file_type = "office"
                elif file.content_type.startswith('application/vnd.oasis.opendocument'):
                    # Handle OpenDocument files
                    if 'presentation' in file.content_type:
                        file_type = "odp"
                    elif 'text' in file.content_type:
                        file_type = "odt"
                    elif 'spreadsheet' in file.content_type:
                        file_type = "ods"
                    else:
                        file_type = "odf"
                else:
                    # For other types, use the second part of MIME type
                    file_type = file.content_type.split('/')[1]
            elif file.filename:
                # Fallback to file extension
                ext = file.filename.split('.')[-1].lower() if '.' in file.filename else "unknown"
                file_type = ext
            
            file_record = {
                "id": file_id,
                "workflow_id": workflow_id,
                "filename": file.filename,
                "file_type": file_type,
                "file_size": len(file_content),
                "file_path": storage_path,
                "mime_type": file.content_type,
                "created_by": user_id
            }
            
            db_result = self.supabase.table("workflow_files").insert(file_record).execute()
            
            if not db_result.data:
                raise Exception("Failed to create file record")
            
            # Map database result to WorkflowFile model
            db_file = db_result.data[0]
            workflow_file = WorkflowFile(
                id=db_file["id"],
                workflow_id=db_file["workflow_id"],
                filename=db_file["filename"],
                file_path=db_file["file_path"],
                file_size=db_file["file_size"],
                file_type=db_file["file_type"],
                mime_type=db_file["mime_type"],
                parsing_status="pending",
                uploaded_at=db_file.get("uploaded_at"),
                created_by=db_file["created_by"]
            )
            
            return workflow_file
            
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise
    
    async def delete_file(self, file_id: str, user_id: str) -> None:
        """
        Delete a workflow file.
        
        Args:
            file_id: ID of file to delete
            user_id: User requesting deletion
        """
        try:
            # Get file record and verify access
            file_result = self.supabase.table("workflow_files").select(
                "workflow_id, file_path"
            ).eq("id", file_id).execute()
            
            if not file_result.data:
                raise ValueError("File not found")
            
            file_data = file_result.data[0]
            
            # Verify workflow access
            await self._verify_workflow_access(file_data["workflow_id"], user_id)
            
            # Delete from storage (Supabase Python SDK may return a list or an object)
            storage_result = self.supabase.storage.from_(self.bucket_name).remove([file_data["file_path"]])
            
            # Handle different return shapes gracefully
            try:
                possible_error = getattr(storage_result, 'error', None)
            except Exception:
                possible_error = None
            
            if isinstance(storage_result, list):
                for item in storage_result:
                    if isinstance(item, dict) and item.get('error'):
                        logger.warning(f"Failed to delete file from storage: {item.get('error')}")
                        break
            elif possible_error:
                logger.warning(f"Failed to delete file from storage: {possible_error}")
            
            # Delete database record
            self.supabase.table("workflow_files").delete().eq("id", file_id).execute()
            
            logger.info(f"File deleted successfully: {file_id}")
            
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            raise

    async def delete_workflow(self, workflow_id: str, user_id: str) -> None:
        """
        Delete a workflow and all associated files.
        
        Args:
            workflow_id: ID of workflow to delete
            user_id: User deleting the workflow
        """
        try:
            # Verify workflow access
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Get all files associated with the workflow
            files_result = self.supabase.table("workflow_files").select(
                "id, file_path"
            ).eq("workflow_id", workflow_id).execute()
            
            # Delete files from storage
            if files_result.data:
                file_paths = [file_data["file_path"] for file_data in files_result.data]
                storage_result = self.supabase.storage.from_(self.bucket_name).remove(file_paths)
                
                if hasattr(storage_result, 'error') and storage_result.error:
                    logger.warning(f"Failed to delete some files from storage: {storage_result.error}")
            
            # Delete workflow files from database (CASCADE will handle this, but explicit is better)
            self.supabase.table("workflow_files").delete().eq("workflow_id", workflow_id).execute()
            
            # Delete the workflow itself
            workflow_result = self.supabase.table("workflows").delete().eq(
                "id", workflow_id
            ).eq("created_by", user_id).execute()
            
            if not workflow_result.data:
                raise ValueError("Workflow not found or access denied")
            
            logger.info(f"Workflow deleted successfully: {workflow_id}")
            
        except Exception as e:
            logger.error(f"Error deleting workflow: {str(e)}")
            raise
    
    # Private helper methods
    
    async def _get_user_account_id(self, user_id: str) -> str:
        """Get user's account ID for multi-tenant support."""
        try:
            result = self.supabase.table("basejump.account_user").select(
                "account_id"
            ).eq("user_id", user_id).execute()
            
            if result.data:
                return result.data[0]["account_id"]
            else:
                # Fallback: use user_id as account_id
                return user_id
                
        except Exception as e:
            logger.warning(f"Could not get account_id for user {user_id}: {e}")
            return user_id
    
    async def _verify_workflow_access(self, workflow_id: str, user_id: str) -> None:
        """Verify user has access to workflow."""
        # Check if user is the creator OR if it's a default workflow OR if user is admin
        result = self.supabase.table("workflows").select("id, created_by, default_workflow").eq(
            "id", workflow_id
        ).execute()
        
        if not result.data:
            raise PermissionError("Workflow not found")
        
        workflow = result.data[0]
        is_owner = workflow['created_by'] == user_id
        is_default = workflow.get('default_workflow', False)
        
        # Check if user is admin
        from config.admin_users import is_admin_user
        is_admin = is_admin_user(user_id)
        
        # Allow access if user is owner OR if it's a default workflow OR if user is admin
        if not is_owner and not is_default and not is_admin:
            raise PermissionError("Access denied to workflow")
    
    async def _get_workflow_files(self, workflow_id: str) -> List[WorkflowFile]:
        """Get workflow files."""
        result = self.supabase.table("workflow_files").select("*").eq("workflow_id", workflow_id).execute()
        
        workflow_files = []
        for file_data in result.data:
            workflow_file = WorkflowFile(
                id=file_data["id"],
                workflow_id=file_data["workflow_id"],
                filename=file_data["filename"],
                file_path=file_data["file_path"],
                file_size=file_data["file_size"],
                file_type=file_data["file_type"],
                mime_type=file_data["mime_type"],
                parsing_status="pending",  # Default since this field doesn't exist in DB yet
                uploaded_at=file_data.get("uploaded_at"),
                created_by=file_data["created_by"]
            )
            workflow_files.append(workflow_file)
        
        return workflow_files
    
    async def _validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file."""
        # Normalize content type
        content_type = (file.content_type or "").strip()
        
        # Log for debugging
        logger.info(f"Validating file: {file.filename}, content_type: '{content_type}', size: {file.size}")

        # Check MIME type first
        if content_type and content_type in self.allowed_mime_types:
            # MIME type is valid, proceed
            pass
        else:
            # Fallback: check file extension for common mislabeled files
            if file.filename:
                file_extension = self._get_file_extension(file.filename).lower().strip()
                allowed_extensions = {
                    '.md', '.markdown',  # Markdown
                    '.mdx',             # MDX markdown
                    '.txt',              # Plain text
                    '.csv',              # CSV
                    '.html', '.htm',     # HTML
                    '.css',              # CSS
                    '.xml',              # XML
                    '.pdf',              # PDF
                    '.doc', '.docx',     # Word
                    '.ppt', '.pptx',     # PowerPoint
                    '.xls', '.xlsx',     # Excel
                    '.odt',              # OpenDocument Text
                    '.rtf',              # Rich Text
                    '.tex',              # LaTeX
                    '.ods',              # OpenDocument Spreadsheet
                    '.tsv',              # Tab-separated values
                    '.json',             # JSON
                    '.jpg', '.jpeg',     # JPEG
                    '.png',              # PNG
                    '.svg'               # SVG
                }
                
                if file_extension in allowed_extensions:
                    # File extension is valid, proceed
                    pass
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File type not allowed. Allowed types: {', '.join(self.allowed_mime_types)}"
                    )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"File type not allowed. Allowed types: {', '.join(self.allowed_mime_types)}"
                )
        
        if file.size and file.size > self.max_file_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {self.max_file_size // (1024*1024)}MB"
            )
    
    def _get_file_extension(self, filename: str) -> str:
        """Get file extension from filename."""
        if not filename or '.' not in filename:
            return ""
        return f".{filename.split('.')[-1]}"
    
    async def get_file_content(self, workflow_id: str, file_id: str, user_id: str) -> bytes:
        """Get the content of a workflow file from Supabase Storage."""
        try:
            # Verify access first
            await self._verify_workflow_access(workflow_id, user_id)
            
            # Get file record from database
            result = self.supabase.table("workflow_files").select("*").eq("id", file_id).eq("workflow_id", workflow_id).execute()
            
            if not result.data:
                raise ValueError(f"File {file_id} not found in workflow {workflow_id}")
            
            file_record = result.data[0]
            file_path = file_record["file_path"]
            
            # Get file content from Supabase Storage
            file_content = self.supabase.storage.from_("workflow-files").download(file_path)
            
            if not file_content:
                raise ValueError(f"File content not found for {file_path}")
            
            return file_content
            
        except Exception as e:
            logger.error(f"Error getting file content: {e}")
            raise e


    def _map_db_to_workflow_definition(self, data: dict) -> WorkflowDefinition:
        """Helper function to map database record to WorkflowDefinition."""
        from workflows.models import WorkflowStep, WorkflowTrigger
        
        definition = data.get('definition', {})
        raw_steps = definition.get('steps', [])
        steps = []
        for step_data in raw_steps:
            if isinstance(step_data, dict):
                step = WorkflowStep(
                    id=step_data.get('id', ''),
                    name=step_data.get('name', ''),
                    description=step_data.get('description'),
                    type=step_data.get('type', 'TOOL'),
                    config=step_data.get('config', {}),
                    next_steps=step_data.get('next_steps', []),
                    error_handler=step_data.get('error_handler')
                )
                steps.append(step)
            else:
                steps.append(step_data)
        
        raw_triggers = definition.get('triggers', [])
        triggers = []
        for trigger_data in raw_triggers:
            if isinstance(trigger_data, dict):
                trigger = WorkflowTrigger(
                    type=trigger_data.get('type', 'MANUAL'),
                    config=trigger_data.get('config', {})
                )
                triggers.append(trigger)
            else:
                triggers.append(trigger_data)
        
        return WorkflowDefinition(
            id=data['id'],
            name=data['name'],
            description=data.get('description'),
            steps=steps,
            entry_point=definition.get('entry_point', ''),
            triggers=triggers,
            state=data.get('status', 'draft').upper(),
            created_at=self._parse_datetime(data.get('created_at')),
            updated_at=self._parse_datetime(data.get('updated_at')),
            created_by=data.get('created_by'),
            project_id=data['project_id'],
            agent_id=definition.get('agent_id'),
            is_template=False,
            max_execution_time=definition.get('max_execution_time', 3600),
            max_retries=definition.get('max_retries', 3),
            master_prompt=data.get('master_prompt'),
            login_template=data.get('login_template')
        )

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Helper to parse datetime strings from Supabase."""
        if not dt_str:
            return None
        try:
            # Handle ISO format with timezone
            if dt_str.endswith('Z'):
                dt_str = dt_str[:-1] + '+00:00'
            elif '+' in dt_str or dt_str.count('-') > 2:
                # Already has timezone info
                pass
            else:
                # Add UTC timezone if missing
                dt_str += '+00:00'
            return datetime.fromisoformat(dt_str)
        except ValueError:
            # Fallback: try without timezone
            try:
                return datetime.fromisoformat(dt_str.replace('Z', ''))
            except ValueError:
                return None


# Singleton instance for dependency injection
_workflow_builder_service_instance: Optional[WorkflowBuilderService] = None


def get_workflow_builder_service() -> WorkflowBuilderService:
    """
    Get singleton instance of WorkflowBuilderService for dependency injection.
    
    Returns:
        WorkflowBuilderService instance
    """
    global _workflow_builder_service_instance
    
    if _workflow_builder_service_instance is None:
        _workflow_builder_service_instance = WorkflowBuilderService()
    
    return _workflow_builder_service_instance
