from typing import List, Optional, Union
from agentpress.tool import Tool, ToolResult, openapi_schema, xml_schema
from utils.logger import logger
from agentpress.thread_manager import ThreadManager
from agent.image_manager import ImageManager
import json

class MessageTool(Tool):
    """Tool for user communication and interaction.

    This tool provides methods for asking questions, with support for
    attachments and user takeover suggestions.
    """

    def __init__(self, thread_id: Optional[str] = None, thread_manager: Optional[ThreadManager] = None):
        super().__init__()
        self.thread_id = thread_id
        self.thread_manager = thread_manager

    # Commented out as we are just doing this via prompt as there is no need to call it as a tool

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "ask",
            "description": "Ask user a question and wait for response. Use for: 1) Requesting clarification on ambiguous requirements, 2) Seeking confirmation before proceeding with high-impact changes, 3) Gathering additional information needed to complete a task, 4) Offering options and requesting user preference, 5) Validating assumptions when critical to task success. IMPORTANT: Use this tool only when user input is essential to proceed. Always provide clear context and options when applicable. Include relevant attachments when the question relates to specific files or resources.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Question text to present to user - should be specific and clearly indicate what information you need. Include: 1) Clear question or request, 2) Context about why the input is needed, 3) Available options if applicable, 4) Impact of different choices, 5) Any relevant constraints or considerations."
                    },
                    "attachments": {
                        "anyOf": [
                            {"type": "string"},
                            {"items": {"type": "string"}, "type": "array"}
                        ],
                        "description": "(Optional) List of files or URLs to attach to the question. Include when: 1) Question relates to specific files or configurations, 2) User needs to review content before answering, 3) Options or choices are documented in files, 4) Supporting evidence or context is needed. Always use relative paths to /workspace directory."
                    }
                },
                "required": ["text"]
            }
        }
    })
    @xml_schema(
        tag_name="ask",
        mappings=[
            {"param_name": "text", "node_type": "content", "path": "."},
            {"param_name": "attachments", "node_type": "attribute", "path": ".", "required": False}
        ],
        example='''
        <function_calls>
        <invoke name="ask">
        <parameter name="text">I'm planning to bake the chocolate cake for your birthday party. The recipe mentions "rich frosting" but doesn't specify what type. Could you clarify your preferences? For example:
1. Would you prefer buttercream or cream cheese frosting?
2. Do you want any specific flavor added to the frosting (vanilla, coffee, etc.)?
3. Should I add any decorative toppings like sprinkles or fruit?
4. Do you have any dietary restrictions I should be aware of?

This information will help me make sure the cake meets your expectations for the celebration.</parameter>
        <parameter name="attachments">recipes/chocolate_cake.txt,photos/cake_examples.jpg</parameter>
        </invoke>
        </function_calls>
        '''
    )
    async def ask(self, text: str, attachments: Optional[Union[str, List[str]]] = None) -> ToolResult:
        """Ask the user a question and wait for a response.

        Args:
            text: The question to present to the user
            attachments: Optional file paths or URLs to attach to the question

        Returns:
            ToolResult indicating the question was successfully sent
        """
        try:            
            # Convert single attachment to list for consistent handling
            if attachments and isinstance(attachments, str):
                attachments = [attachments]
          
            return self.success_response({"status": "Awaiting user response..."})
        except Exception as e:
            return self.fail_response(f"Error asking user: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "web_browser_takeover",
            "description": "Request user takeover of browser interaction. Use this tool when: 1) The page requires complex human interaction that automated tools cannot handle, 2) Authentication or verification steps require human input, 3) The page has anti-bot measures that prevent automated access, 4) Complex form filling or navigation is needed, 5) The page requires human verification (CAPTCHA, etc.). IMPORTANT: This tool should be used as a last resort after web-search and crawl-webpage have failed, and when direct browser tools are insufficient. Always provide clear context about why takeover is needed and what actions the user should take.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Instructions for the user about what actions to take in the browser. Include: 1) Clear explanation of why takeover is needed, 2) Specific steps the user should take, 3) What information to look for or extract, 4) How to indicate when they're done, 5) Any important context about the current page state."
                    },
                    "attachments": {
                        "anyOf": [
                            {"type": "string"},
                            {"items": {"type": "string"}, "type": "array"}
                        ],
                        "description": "(Optional) List of files or URLs to attach to the takeover request. Include when: 1) Screenshots or visual references are needed, 2) Previous search results or crawled content is relevant, 3) Supporting documentation is required. Always use relative paths to /workspace directory."
                    }
                },
                "required": ["text"]
            }
        }
    })
    @xml_schema(
        tag_name="web-browser-takeover",
        mappings=[
            {"param_name": "text", "node_type": "content", "path": "."},
            {"param_name": "attachments", "node_type": "attribute", "path": ".", "required": False}
        ],
        example='''
        <function_calls>
        <invoke name="web_browser_takeover">
        <parameter name="text">I've encountered a CAPTCHA verification on the page. Please:
1. Solve the CAPTCHA puzzle
2. Let me know once you've completed it
3. I'll then continue with the automated process

If you encounter any issues or need to take additional steps, please let me know.</parameter>
        </invoke>
        </function_calls>
        '''
    )
    async def web_browser_takeover(self, text: str, attachments: Optional[Union[str, List[str]]] = None) -> ToolResult:
        """Request user takeover of browser interaction.

        Args:
            text: Instructions for the user about what actions to take
            attachments: Optional file paths or URLs to attach to the request

        Returns:
            ToolResult indicating the takeover request was successfully sent
        """
        try:
            # Convert single attachment to list for consistent handling
            if attachments and isinstance(attachments, str):
                attachments = [attachments]

            return self.success_response({"status": "Awaiting user browser takeover..."})
        except Exception as e:
            return self.fail_response(f"Error requesting browser takeover: {str(e)}")

#     @openapi_schema({
#         "type": "function",
#         "function": {
#             "name": "inform",
#             "description": "Inform the user about progress, completion of a major step, or important context. Use this tool: 1) To provide updates between major sections of work, 2) After accomplishing significant milestones, 3) When transitioning to a new phase of work, 4) To confirm actions were completed successfully, 5) To provide context about upcoming steps. IMPORTANT: Use FREQUENTLY throughout execution to provide UI context to the user. The user CANNOT respond to this tool - they can only respond to the 'ask' tool. Use this tool to keep the user informed without requiring their input.",
#             "parameters": {
#                 "type": "object",
#                 "properties": {
#                     "text": {
#                         "type": "string",
#                         "description": "Information to present to the user. Include: 1) Clear statement of what has been accomplished or what is happening, 2) Relevant context or impact, 3) Brief indication of next steps if applicable."
#                     },
#                     "attachments": {
#                         "anyOf": [
#                             {"type": "string"},
#                             {"items": {"type": "string"}, "type": "array"}
#                         ],
#                         "description": "(Optional) List of files or URLs to attach to the information. Include when: 1) Information relates to specific files or resources, 2) Showing intermediate results or outputs, 3) Providing supporting documentation. Always use relative paths to /workspace directory."
#                     }
#                 },
#                 "required": ["text"]
#             }
#         }
#     })
#     @xml_schema(
#         tag_name="inform",
#         mappings=[
#             {"param_name": "text", "node_type": "content", "path": "."},
#             {"param_name": "attachments", "node_type": "attribute", "path": ".", "required": False}
#         ],
#         example='''

# Inform the user about progress, completion of a major step, or important context. Use this tool: 1) To provide updates between major sections of work, 2) After accomplishing significant milestones, 3) When transitioning to a new phase of work, 4) To confirm actions were completed successfully, 5) To provide context about upcoming steps. IMPORTANT: Use FREQUENTLY throughout execution to provide UI context to the user. The user CANNOT respond to this tool - they can only respond to the 'ask' tool. Use this tool to keep the user informed without requiring their input."

#         <!-- Use inform FREQUENTLY to provide UI context and progress updates - THE USER CANNOT RESPOND to this tool -->
#         <!-- The user can ONLY respond to the ask tool, not to inform -->
#         <!-- Examples of when to use inform: -->
#         <!-- 1. Completing major milestones -->
#         <!-- 2. Transitioning between work phases -->
#         <!-- 3. Confirming important actions -->
#         <!-- 4. Providing context about upcoming steps -->
#         <!-- 5. Sharing significant intermediate results -->
#         <!-- 6. Providing regular UI updates throughout execution -->

#         <inform attachments="analysis_results.csv,summary_chart.png">
#             I've completed the data analysis of the sales figures. Key findings include:
#             - Q4 sales were 28% higher than Q3
#             - Product line A showed the strongest performance
#             - Three regions missed their targets

#             I'll now proceed with creating the executive summary report based on these findings.
#         </inform>
#         '''
#     )
#     async def inform(self, text: str, attachments: Optional[Union[str, List[str]]] = None) -> ToolResult:
#         """Inform the user about progress or important updates without requiring a response.

#         Args:
#             text: The information to present to the user
#             attachments: Optional file paths or URLs to attach

#         Returns:
#             ToolResult indicating the information was successfully sent
#         """
#         try:
#             # Convert single attachment to list for consistent handling
#             if attachments and isinstance(attachments, str):
#                 attachments = [attachments]

#             return self.success_response({"status": "Information sent"})
#         except Exception as e:
#             return self.fail_response(f"Error informing user: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "complete",
            "description": "A special tool to indicate you have completed all tasks and are about to enter complete state. Use ONLY when: 1) All tasks in todo.md are marked complete [x], 2) The user's original request has been fully addressed, 3) There are no pending actions or follow-ups required, 4) You've delivered all final outputs and results to the user. IMPORTANT: This is the ONLY way to properly terminate execution. Never use this tool unless ALL tasks are complete and verified. Always ensure you've provided all necessary outputs and references before using this tool.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
    @xml_schema(
        tag_name="complete",
        mappings=[],
        example='''
        <function_calls>
        <invoke name="complete">
        </invoke>
        </function_calls>
        '''
    )
    async def complete(self) -> ToolResult:
        """Indicate that the agent has completed all tasks and is entering complete state.

        Returns:
            ToolResult indicating successful transition to complete state
        """
        try:
            return self.success_response({"status": "complete"})
        except Exception as e:
            return self.fail_response(f"Error entering complete state: {str(e)}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "show_chat_screenshot",
            "description": "Display the most recent browser screenshot in the chat for the user to see. Use this ONLY for property-related queries when showing real estate images (e.g., property photos from bbr.dk or matriklen.dk orthophotos). This tool takes the latest browser screenshot and makes it visible in the conversation. IMPORTANT: Only use this for property images - not for general web browsing. The screenshot should show the property image clearly before calling this tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caption": {
                        "type": "string",
                        "description": "Caption to display with the screenshot. Should describe the property (e.g., 'Property at Hovedgaden 123' or 'Orthophoto of property BFE 12345'). Be specific about what property is shown."
                    },
                    "property_identifier": {
                        "type": "string",
                        "description": "Property identifier (address, BFE number, or BBR number) for reference. Helps track which property the screenshot shows."
                    }
                },
                "required": ["caption"]
            }
        }
    })
    @xml_schema(
        tag_name="show-chat-screenshot",
        mappings=[
            {"param_name": "caption", "node_type": "attribute", "path": "."},
            {"param_name": "property_identifier", "node_type": "attribute", "path": ".", "required": False}
        ],
        example='''
        <function_calls>
        <invoke name="show_chat_screenshot">
        <parameter name="caption">Property at Hovedgaden 123, Copenhagen</parameter>
        <parameter name="property_identifier">Hovedgaden 123</parameter>
        </invoke>
        </function_calls>
        
        <!-- Example with BFE number -->
        <function_calls>
        <invoke name="show_chat_screenshot">
        <parameter name="caption">Orthophoto of property BFE 12345</parameter>
        <parameter name="property_identifier">BFE 12345</parameter>
        </invoke>
        </function_calls>
        '''
    )
    async def show_chat_screenshot(self, caption: str, property_identifier: Optional[str] = None) -> ToolResult:
        """Display the most recent browser screenshot in the chat.
        
        This tool should ONLY be used for property-related images when analyzing real estate.
        It takes the latest browser screenshot and makes it visible in the conversation.
        
        Args:
            caption: Description of what the screenshot shows (property address/identifier)
            property_identifier: Optional property identifier for tracking
            
        Returns:
            ToolResult indicating success or failure
        """
        try:
            if not self.thread_id or not self.thread_manager:
                return self.fail_response("Chat screenshot feature not available - missing thread context")
            
            logger.info(f"📸 CHAT SCREENSHOT requested: caption='{caption}', property='{property_identifier}'")
            
            # Get the latest browser_state message with screenshot
            client = await self.thread_manager.db.client
            latest_browser_state = await client.table('messages').select('*').eq(
                'thread_id', self.thread_id
            ).eq('type', 'browser_state').order('created_at', desc=True).limit(1).execute()
            
            if not latest_browser_state.data or len(latest_browser_state.data) == 0:
                return self.fail_response("No browser screenshot available. Please navigate to the property page first.")
            
            # Extract screenshot from browser_state
            browser_content = latest_browser_state.data[0]["content"]
            if isinstance(browser_content, str):
                browser_content = json.loads(browser_content)
            
            screenshot_base64 = browser_content.get("screenshot_base64")
            screenshot_url = browser_content.get("image_url")
            
            if not screenshot_base64 and not screenshot_url:
                return self.fail_response("Browser screenshot exists but contains no image data")
            
            # Use base64 if available, otherwise extract from URL
            display_screenshot = screenshot_base64
            if not display_screenshot and screenshot_url and 'base64,' in screenshot_url:
                display_screenshot = screenshot_url.split('base64,')[1]
            
            if not display_screenshot:
                return self.fail_response("Could not extract screenshot data")
            
            logger.info(f"📸 Creating chat screenshot message with {len(display_screenshot)} chars of base64 data")
            
            # Create visible chat screenshot message
            screenshot_content = {
                "content": caption,
                "image": {
                    "base64": display_screenshot,
                    "mime_type": "image/jpeg",
                    "type": "chat_screenshot"
                }
            }
            
            # Add metadata
            metadata = {
                "is_image_message": True,
                "image_type": "chat_screenshot",
                "screenshot_source": "property_analysis"
            }
            if property_identifier:
                metadata["property_identifier"] = property_identifier
            
            # Add as assistant message so it appears in chat
            result = await self.thread_manager.add_message(
                thread_id=self.thread_id,
                type="assistant",
                content=screenshot_content,
                metadata=metadata,
                is_llm_message=False
            )
            
            if result:
                logger.info(f"✅ CHAT SCREENSHOT ADDED to conversation: {caption}")
                return self.success_response(
                    f"Chat screenshot displayed successfully for property: {property_identifier or caption}"
                )
            else:
                return self.fail_response("Failed to add chat screenshot to conversation")
                
        except Exception as e:
            logger.error(f"❌ Error in show_chat_screenshot: {e}", exc_info=True)
            return self.fail_response(f"Error displaying chat screenshot: {str(e)}")


if __name__ == "__main__":
    import asyncio

    async def test_message_tool():
        message_tool = MessageTool()

        # Test question
        ask_result = await message_tool.ask(
            text="Would you like to proceed with the next phase?",
            attachments="summary.pdf"
        )
        print("Question result:", ask_result)

        # Test inform
        inform_result = await message_tool.inform(
            text="Completed analysis of data. Processing results now.",
            attachments="analysis.pdf"
        )
        print("Inform result:", inform_result)

    asyncio.run(test_message_tool())
