"""
LlamaParse Tool for Suna Agents.

Simple tool to parse documents using LlamaParse and return markdown output.
All parsing happens in the backend container, with the Daytona VM used only for file storage.
"""

import os
import tempfile
from typing import Dict, Any

from agentpress.tool import ToolResult, openapi_schema, xml_schema
from sandbox.tool_base import SandboxToolsBase
from agentpress.thread_manager import ThreadManager
from utils.logger import logger

from dotenv import load_dotenv
from utils.config import config
from llama_cloud_services import LlamaParse

class LlamaParseDocumentTool(SandboxToolsBase):
    """Minimal tool for parsing documents using LlamaParse in the Daytona sandbox environment."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        """Initialize the LlamaParseDocument tool."""
        super().__init__(project_id, thread_manager)
        self.workspace_path = "/workspace"
        logger.info("Initialized minimal LlamaParse document tool with hardcoded API key")
        
        # Hardcoded API key - exactly as in the working script
        load_dotenv()
        self.API_KEY = config.LLAMA_API_KEY
        self.premium_mode = config.LLAMA_PREMIUM_MODE

    def clean_path(self, path: str) -> str:
        """Clean and normalize a path to be relative to the workspace."""
        # Remove any initial slash if present
        if path.startswith('/'):
            path = path[1:]

        # Ensure path is relative to workspace
        if not path.startswith(self.workspace_path.lstrip('/')):
            path = os.path.join(self.workspace_path.lstrip('/'), path)

        # Ensure path starts with '/'
        if not path.startswith('/'):
            path = '/' + path

        return path

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "parse_document",
            "description": "Parse a document using LlamaParse to extract structured content as markdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the document file in the sandbox workspace. Example: '/workspace/report.pdf'"
                    }
                },
                "required": ["file_path"]
            }
        }
    })
    @xml_schema(
        tag_name="parse-document",
        mappings=[
            {"param_name": "file_path", "node_type": "attribute", "path": "."}
        ],
        example='''\
<!-- Parse a document file into markdown format using LlamaParse -->

<function_calls>
<invoke name="parse_document">
<parameter name="file_path">/workspace/document.pdf</parameter>
</invoke>
</function_calls>
        '''
    )
    async def parse_document(self, file_path: str) -> ToolResult:
        """Parse a document using LlamaParse with the exact working script approach.
        
        Args:
            file_path: Path to the document in the sandbox
            
        Returns:
            ToolResult with parsed document information
        """
        try:
            logger.info(f"*** STARTING SIMPLE LLAMA PARSE: {file_path} ***")
            
            # Ensure sandbox is initialized
            await self._ensure_sandbox()
            
            # Clean and normalize the path
            clean_file_path = self.clean_path(file_path)

            # Ensure clean_file_path is a string (defensive programming)
            if not isinstance(clean_file_path, str):
                logger.error(f"clean_file_path is not a string: {type(clean_file_path)}, value: {clean_file_path}")
                clean_file_path = str(clean_file_path)
                logger.info(f"Converted to string: {clean_file_path}")
            
            # Create a temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:                
                # Download file from sandbox to backend
                basename = os.path.basename(clean_file_path)
                temp_path = os.path.join(temp_dir, basename)

                try:
                    # download_file is synchronous, not async - like other tools in the codebase
                    content = self.sandbox.fs.download_file(clean_file_path)
                    logger.info(f"Downloaded content, size: {len(content) if content else 'None'}")
                except Exception as e:
                    logger.error(f"Error downloading file from sandbox: {str(e)}")
                    return ToolResult(
                        success=False,
                        message=f"Error downloading file from sandbox: {str(e)}",
                        data={"error": f"Failed to download {clean_file_path} from sandbox", "details": str(e)}
                    )
                
                # Write to temporary file
                with open(temp_path, 'wb') as f:
                    f.write(content)
                                
                # Process the file with LlamaParse - EXACTLY like the working script
                if self.premium_mode:              
                    parser = LlamaParse(api_key=self.API_KEY, result_type="markdown", premium_mode=True)
                else:
                    parser = LlamaParse(api_key=self.API_KEY, result_type="markdown")


                import asyncio
                loop = asyncio.get_event_loop()
                
                try:
                    logger.info("About to call parser.parse via run_in_executor")
                    # Run the parsing in a thread to avoid blocking
                    result = await loop.run_in_executor(
                            None,
                            lambda: parser.parse(temp_path)
                    )
                    logger.info("Successfully completed parser.parse call")
                except Exception as parse_error:
                    logger.error(f"Error during parser.parse: {str(parse_error)}")
                    logger.error(f"Parse error type: {type(parse_error)}")
                    raise
                
                logger.info(f"Successfully parsed document: {os.path.basename(clean_file_path)}")
                
                # Generate and save markdown file with robust error handling
                output_md_path = os.path.join(temp_dir, "output.md")
                logger.info(f"Writing markdown to file: {output_md_path}")
                
                # Initialize markdown_text as string to prevent list concatenation errors
                markdown_text = ""
                
                try:
                    # Get the markdown content with robust error handling
                    markdown_docs = result.get_markdown_documents(split_by_page=False)
                    logger.info(f"markdown_docs type: {type(markdown_docs)}, length: {len(markdown_docs) if isinstance(markdown_docs, list) else 'not a list'}")
                    
                    # Handle different possible return types
                    if isinstance(markdown_docs, list) and len(markdown_docs) > 0:
                        markdown_text = markdown_docs[0].text
                        logger.info("Successfully got text from markdown_docs[0].text")
                    else:
                        markdown_text = str(markdown_docs)  # Fallback to string conversion
                        logger.warning(f"markdown_docs was not a list or empty, converted to string: {type(markdown_docs)}")
                    
                    # Ensure markdown_text is always a string
                    if not isinstance(markdown_text, str):
                        markdown_text = str(markdown_text)
                        logger.warning(f"markdown_text was not a string, converted to: {type(markdown_text)}")
                    
                    # Write the markdown to file
                    with open(output_md_path, "w") as f:
                        f.write(markdown_text)
                                    
                except Exception as e:
                    logger.error(f"Error processing markdown from LlamaParse result: {str(e)}")
                    # Set a fallback markdown_text
                    markdown_text = f"Error processing document: {str(e)}\n\nRaw result: {str(result)}"
                    # Still write the error content to file
                    with open(output_md_path, "w") as f:
                        f.write(markdown_text)

                # Read the markdown content back (this should now always work)
                try:
                    with open(output_md_path, "r") as f:
                        markdown_text = f.read()
                except Exception as e:
                    logger.error(f"Error reading markdown file: {str(e)}")
                    markdown_text = f"Error reading parsed content: {str(e)}"

                # Generate output path in sandbox (with .md extension)
                base_filename = os.path.basename(clean_file_path)
                # Handle file extension removal safely
                if '.' in base_filename:
                    filename_without_ext = base_filename.rsplit('.', 1)[0]
                else:
                    filename_without_ext = base_filename
                
                parsed_sandbox_path = os.path.join(
                    os.path.dirname(clean_file_path),
                    f"parsed_{filename_without_ext}.md"
                )
                
                # Final defensive check before upload - ensure markdown_text is string
                if not isinstance(markdown_text, str):
                    logger.error(f"Critical: markdown_text is {type(markdown_text)} instead of str, converting: {repr(markdown_text)[:200]}")
                    markdown_text = str(markdown_text)
                                
                # Upload markdown results back to sandbox
                self.sandbox.fs.upload_file(markdown_text.encode('utf-8'), parsed_sandbox_path)
                
                preview = markdown_text[:500] + "..." if len(markdown_text) > 500 else markdown_text
                
                return self.success_response({
                    "status": "parsed",
                    "output_path": parsed_sandbox_path
                })

                            
        except Exception as e:
            self.fail_response(f"Error parsing document, will change document parsing tool")
