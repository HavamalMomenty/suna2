from agentpress.tool import Tool, ToolResult, openapi_schema, xml_schema
from sandbox.tool_base import SandboxToolsBase
from agentpress.thread_manager import ThreadManager
from services.supabase import DBConnection
from utils.logger import logger
import json
import asyncio

class SandboxKnowledgeBaseTool(SandboxToolsBase):
    """Tool for accessing and managing the Knowledge Base system."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.db = DBConnection()

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_knowledge_base_entry",
            "description": "Retrieve a specific knowledge base entry by its ID. Use this to get the full content of a knowledge base record when you need detailed information that was referenced in your context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entry_id": {
                        "type": "string",
                        "description": "The unique identifier of the knowledge base entry to retrieve"
                    }
                },
                "required": ["entry_id"]
            }
        }
    })
    @xml_schema(
        tag_name="get-knowledge-base-entry",
        mappings=[
            {"param_name": "entry_id", "node_type": "attribute", "path": "."}
        ]
    )
    async def get_knowledge_base_entry(self, entry_id: str) -> ToolResult:
        """Get a specific knowledge base entry by ID"""
        try:
            logger.info(f"Retrieving knowledge base entry: {entry_id}")
            
            client = await self.db.client
            result = await client.table('knowledge_base_entries').select('*').eq('entry_id', entry_id).execute()
            
            if not result.data:
                return self.fail_response(f"Knowledge base entry {entry_id} not found")
            
            entry = result.data[0]
            
            return self.success_response(
                result={
                    "entry_id": entry['entry_id'],
                    "name": entry['name'],
                    "description": entry['description'],
                    "content": entry['content'],
                    "usage_context": entry['usage_context'],
                    "is_active": entry['is_active'],
                    "created_at": entry['created_at']
                },
                message=f"Retrieved knowledge base entry: {entry['name']}"
            )
            
        except Exception as e:
            logger.error(f"Error retrieving knowledge base entry {entry_id}: {str(e)}")
            return self.fail_response(f"Failed to retrieve knowledge base entry: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search through the knowledge base for entries matching a query. This searches across entry names, descriptions, and content to find relevant information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to find relevant knowledge base entries. Can search by name, description, or content."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 10)",
                        "default": 10
                    }
                },
                "required": ["query"]
            }
        }
    })
    @xml_schema(
        tag_name="search-knowledge-base",
        mappings=[
            {"param_name": "query", "node_type": "attribute", "path": "."},
            {"param_name": "max_results", "node_type": "attribute", "path": "."}
        ]
    )
    async def search_knowledge_base(self, query: str, max_results: int = 10) -> ToolResult:
        """Search knowledge base entries"""
        try:
            logger.info(f"Searching knowledge base for: {query}")
            
            client = await self.db.client
            
            # Get current thread to determine account scope
            thread_result = await client.table('threads').select('account_id').eq('thread_id', self.thread_manager.thread_id).execute()
            if not thread_result.data:
                return self.fail_response("Thread not found")
            
            account_id = thread_result.data[0]['account_id']
            
            # Search in both thread-specific and account-global entries
            result = await client.table('knowledge_base_entries').select('*').or_(
                f'thread_id.eq.{self.thread_manager.thread_id},and(thread_id.is.null,project_id.is.null,account_id.eq.{account_id})'
            ).ilike('name', f'%{query}%').or_(
                f'description.ilike.%{query}%,content.ilike.%{query}%'
            ).eq('is_active', True).limit(max_results).execute()
            
            entries = []
            for entry in result.data or []:
                entries.append({
                    "entry_id": entry['entry_id'],
                    "name": entry['name'],
                    "description": entry['description'],
                    "content_preview": entry['content'][:200] + "..." if len(entry['content']) > 200 else entry['content'],
                    "usage_context": entry['usage_context'],
                    "created_at": entry['created_at']
                })
            
            return self.success_response(
                result={
                    "query": query,
                    "entries": entries,
                    "total_found": len(entries)
                },
                message=f"Found {len(entries)} knowledge base entries matching '{query}'"
            )
            
        except Exception as e:
            logger.error(f"Error searching knowledge base: {str(e)}")
            return self.fail_response(f"Failed to search knowledge base: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_knowledge_base_entries",
            "description": "List all available knowledge base entries for the current context. This shows all entries that are accessible to the current thread/user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "include_inactive": {
                        "type": "boolean",
                        "description": "Whether to include inactive entries (default: false)",
                        "default": False
                    }
                }
            }
        }
    })
    @xml_schema(
        tag_name="list-knowledge-base-entries",
        mappings=[
            {"param_name": "include_inactive", "node_type": "attribute", "path": "."}
        ]
    )
    async def list_knowledge_base_entries(self, include_inactive: bool = False) -> ToolResult:
        """List all knowledge base entries for the current thread"""
        try:
            logger.info(f"Listing knowledge base entries (include_inactive: {include_inactive})")
            
            client = await self.db.client
            
            # Use the RPC function to get entries
            result = await client.rpc('get_thread_knowledge_base', {
                'p_thread_id': self.thread_manager.thread_id,
                'p_include_inactive': include_inactive
            }).execute()
            
            entries = []
            for entry in result.data or []:
                entries.append({
                    "entry_id": entry['entry_id'],
                    "name": entry['name'],
                    "description": entry['description'],
                    "content_preview": entry['content'][:200] + "..." if len(entry['content']) > 200 else entry['content'],
                    "usage_context": entry['usage_context'],
                    "is_active": entry['is_active'],
                    "created_at": entry['created_at']
                })
            
            return self.success_response(
                result={
                    "entries": entries,
                    "total_count": len(entries)
                },
                message=f"Retrieved {len(entries)} knowledge base entries"
            )
            
        except Exception as e:
            logger.error(f"Error listing knowledge base entries: {str(e)}")
            return self.fail_response(f"Failed to list knowledge base entries: {str(e)}")
