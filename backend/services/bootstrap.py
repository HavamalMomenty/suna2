from fastapi import APIRouter, Depends, HTTPException, Request
from services.supabase import DBConnection
from utils.logger import logger
from utils.auth_utils import get_current_user_id_from_jwt
from services.workflow_builder_service import get_workflow_builder_service
from typing import Optional
import uuid

router = APIRouter()


def initialize(db: DBConnection):
    # Placeholder for parity with other service modules
    return


@router.get("/bootstrap")
async def bootstrap_user(
    request: Request,
    user_id: str = Depends(get_current_user_id_from_jwt),
):
    """Ensure the authenticated user has at least one project and user-owned workflows.

    - Creates a default project tied to the user's personal account (account_id == user_id)
      if none exists.
    - If the user has no workflows yet, automatically copy all default/template workflows
      into the user's space so they immediately appear in the UI.
    """
    try:
        db = DBConnection()
        client = await db.client

        # Check for existing project for this account/user
        existing = await client.table("projects").select("project_id").eq("account_id", user_id).limit(1).execute()
        project_created = False
        if not existing.data:
            # Create default project on the user's personal account
            insert_res = await client.table("projects").insert({
                "name": "My First Project",
                "description": "Your default project to get started",
                "account_id": user_id,
            }).select("project_id").single().execute()
            project_id = (insert_res.data or {}).get("project_id")
            project_created = True
        else:
            project_id = existing.data[0].get("project_id")

        # Determine user's account_id (fallback to user_id)
        try:
            account_res = await client.table("basejump.account_user").select("account_id").eq("user_id", user_id).limit(1).execute()
            account_id = account_res.data[0]["account_id"] if account_res.data else user_id
        except Exception:
            account_id = user_id

        workflows_copied = 0
        
        # EARLY CHECK: First check if user already has any workflows - if so, skip entirely
        # This ensures bootstrap only runs once per account
        user_workflows_check_query = client.table('workflows').select('id').eq('created_by', user_id).eq('default_workflow', False).limit(1)
        if project_id:
            user_workflows_check_query = user_workflows_check_query.eq('project_id', project_id)
        else:
            user_workflows_check_query = user_workflows_check_query.is_('project_id', 'null')
        
        user_workflows_check_result = await user_workflows_check_query.execute()
        
        # If user already has workflows, skip workflow copying entirely (this is not the first time)
        if user_workflows_check_result.data and len(user_workflows_check_result.data) > 0:
            logger.info("User already has workflows - bootstrap already completed, skipping", user_id=user_id)
            return {
                "status": "ok",
                "project_created": project_created,
                "project_id": project_id,
                "workflows_copied": 0,
                "workflows_skipped": 0,
                "total_templates": 0,
                "copying_in_progress": False,
            }
        
        # Fetch all default/template workflows once (only if user has no workflows yet)
        default_result = await client.table("workflows").select("*").eq("default_workflow", True).execute()
        default_workflows = default_result.data or []
        
        if not default_workflows:
            logger.info("No default workflows found to copy", user_id=user_id)
            return {
                "status": "ok",
                "project_created": project_created,
                "project_id": project_id,
                "workflows_copied": 0,
                "workflows_skipped": 0,
                "total_templates": 0,
                "copying_in_progress": False,
            }
        
        # OPTIMIZATION: Batch fetch all user's existing workflows for this project in one query
        # This prevents race conditions and reduces database queries
        user_workflows_query = client.table('workflows').select('name').eq('created_by', user_id).eq('default_workflow', False)
        if project_id:
            user_workflows_query = user_workflows_query.eq('project_id', project_id)
        else:
            user_workflows_query = user_workflows_query.is_('project_id', 'null')
        
        user_workflows_result = await user_workflows_query.execute()
        existing_workflow_names = {wf.get('name', '') for wf in (user_workflows_result.data or [])}
        
        logger.info(
            "Bootstrap workflow sources",
            user_id=user_id,
            num_defaults=len(default_workflows),
            existing_workflows=len(existing_workflow_names)
        )

        # Helper to find unique workflow name (optimized to check against existing set)
        def _find_unique_workflow_name(base_name: str, existing_names: set) -> str:
            """Find a unique workflow name by appending numbers if needed."""
            if base_name not in existing_names:
                return base_name
            counter = 1
            while counter <= 1000:
                candidate = f"{base_name}_{counter}"
                if candidate not in existing_names:
                    return candidate
                counter += 1
            import time
            candidate = f"{base_name}_{int(time.time())}"
            # Ensure uniqueness
            while candidate in existing_names:
                candidate = f"{base_name}_{int(time.time())}_{uuid.uuid4().hex[:8]}"
            return candidate
        
        # Helper to check if user already has this template copied
        # Check for exact base name OR any variant (name_1, name_2, etc.)
        def _has_template_copy(base_name: str, existing_names: set) -> bool:
            """Check if user already has a copy of this template (with or without suffix)."""
            # Check exact match first (fastest)
            if base_name in existing_names:
                return True
            # Check for any variant (name_1, name_2, etc.)
            for existing_name in existing_names:
                # Match exact base name or base_name_N pattern
                if existing_name == base_name or existing_name.startswith(f"{base_name}_"):
                    # Verify it's a numeric suffix (to avoid false matches)
                    suffix = existing_name[len(base_name) + 1:] if existing_name.startswith(f"{base_name}_") else ""
                    if not suffix or suffix.isdigit():
                        return True
            return False

        service = get_workflow_builder_service()
        workflows_to_copy = []
        
        # First pass: identify which workflows need to be copied (without DB operations)
        for src in default_workflows:
            original_name = src.get("name") or "Untitled Workflow"
            base_name = original_name
            
            # Check if user already has this template copied
            if _has_template_copy(base_name, existing_workflow_names):
                logger.debug(f"User already has workflow '{base_name}' (or variant), skipping copy", user_id=user_id, name=base_name)
                continue
            
            workflows_to_copy.append((src, base_name))
        
        # Second pass: actually copy the workflows
        for src, base_name in workflows_to_copy:
            try:
                # Find unique name (check against existing + newly created in this batch)
                copied_name = _find_unique_workflow_name(base_name, existing_workflow_names)
                # Add to set immediately to prevent duplicates in this batch
                existing_workflow_names.add(copied_name)

                # Create the copied workflow (same as copy_workflow endpoint logic)
                copied_workflow_data = {
                    "name": copied_name,
                    "description": src.get('description', ''),
                    "project_id": project_id,
                    "account_id": account_id,
                    "created_by": user_id,
                    "master_prompt": src.get('master_prompt'),
                    "login_template": src.get('login_template'),
                    "image_url": src.get('image_url'),
                    "default_workflow": False,
                    "definition": src.get('definition', {}),
                    "status": "draft"
                }

                try:
                    result = await client.table('workflows').insert(copied_workflow_data).execute()
                    if not result.data:
                        # If insert failed silently, skip
                        logger.debug(f"Workflow insert returned no data for '{copied_name}'", user_id=user_id)
                        continue
                except Exception as insert_err:
                    # Handle unique constraint violations gracefully (concurrent request may have created it)
                    error_str = str(insert_err)
                    if '23505' in error_str or 'duplicate key' in error_str.lower() or 'unique constraint' in error_str.lower():
                        logger.debug(f"Workflow '{copied_name}' already exists (likely created by concurrent request), skipping", user_id=user_id)
                        continue
                    # Re-raise other errors
                    raise

                copied_workflow = result.data[0]
                copied_workflow_id = copied_workflow['id']

                # Copy workflow files if they exist (same as copy_workflow endpoint)
                try:
                    files_result = await client.table('workflow_files').select('*').eq('workflow_id', src.get('id')).execute()
                    if files_result.data:
                        copied_count = 0
                        for file_data in files_result.data:
                            try:
                                source_path = file_data.get('file_path')
                                filename = file_data.get('filename') or 'file'
                                mime_type = file_data.get('mime_type') or 'application/octet-stream'

                                ext = ''
                                if '.' in filename:
                                    ext = f".{filename.split('.')[-1]}"
                                elif source_path and '.' in source_path:
                                    ext = f".{source_path.split('.')[-1]}"

                                new_file_id = str(uuid.uuid4())
                                dest_path = f"{user_id}/{copied_workflow_id}/{new_file_id}{ext}"

                                blob = service.supabase.storage.from_(service.bucket_name).download(source_path)
                                if not blob:
                                    continue

                                service.supabase.storage.from_(service.bucket_name).upload(
                                    dest_path,
                                    blob,
                                    {"content-type": mime_type, "upsert": "true"}
                                )

                                new_file_data = {
                                    'id': new_file_id,
                                    'workflow_id': copied_workflow_id,
                                    'filename': filename,
                                    'file_path': dest_path,
                                    'file_size': len(blob),
                                    'file_type': file_data.get('file_type') or (ext.replace('.', '') or 'unknown'),
                                    'mime_type': mime_type,
                                    'created_by': user_id
                                }
                                await client.table('workflow_files').insert(new_file_data).execute()
                                copied_count += 1
                            except Exception as file_err:
                                logger.warning(f"Failed to copy file {file_data.get('id')}: {file_err}")
                                continue
                        logger.info(f"Copied {copied_count} files to workflow {copied_workflow_id}")
                except Exception as file_err:
                    logger.warning(f"Failed to copy workflow files: {file_err}")

                workflows_copied += 1
                logger.info("Workflow copied for user from default", user_id=user_id, name=copied_name)
            except Exception as e:
                logger.warning(f"Failed to copy workflow from default: {e}", name=src.get("name"), user_id=user_id)
                continue

        workflows_skipped = len(default_workflows) - workflows_copied
        
        result_payload = {
            "status": "ok",
            "project_created": project_created,
            "project_id": project_id,
            "workflows_copied": workflows_copied,
            "workflows_skipped": workflows_skipped,
            "total_templates": len(default_workflows),
            "copying_in_progress": workflows_copied > 0,
        }
        logger.info(
            "Bootstrap result",
            user_id=user_id,
            workflows_copied=workflows_copied,
            workflows_skipped=workflows_skipped,
            total_templates=len(default_workflows)
        )
        return result_payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bootstrap failed: {str(e)}")


