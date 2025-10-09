"""
Image Manager for handling different types of images in conversations.

This module provides a centralized system for managing various image types
that can be displayed in the conversation UI, including:
- Logo welcome messages
- User feedback screenshots (from web searches, browser actions, etc.)
- Tool result visualizations
"""

import json
import base64
import logging
from typing import Dict, Any, Optional, Literal
from agentpress.thread_manager import ThreadManager

logger = logging.getLogger(__name__)

ImageType = Literal["logo_welcome", "chat_screenshot", "user_feedback_screenshot", "tool_visualization"]


class ImageManager:
    """Manages different types of images that appear in conversations."""
    
    def __init__(self, thread_manager: ThreadManager, thread_id: str):
        self.thread_manager = thread_manager
        self.thread_id = thread_id
    
    async def add_image_message(
        self,
        image_data: str,
        image_type: ImageType,
        mime_type: str = "image/png",
        caption: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Add an image message to the conversation.
        
        Args:
            image_data: Base64 encoded image data
            image_type: Type of image (logo_welcome, user_feedback_screenshot, etc.)
            mime_type: MIME type of the image (default: image/png)
            caption: Optional caption to display with the image
            metadata: Optional metadata for the message
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Create the message content structure
            content = {
                "content": caption or "",  # Text content/caption
                "image": {
                    "base64": image_data,
                    "mime_type": mime_type,
                    "type": image_type
                }
            }
            
            logger.info(f"Creating image message with type={image_type}, caption='{caption}', base64_length={len(image_data)}")
            
            # Prepare metadata
            msg_metadata = metadata or {}
            msg_metadata["is_image_message"] = True
            msg_metadata["image_type"] = image_type
            
            logger.debug(f"Image message content structure: {json.dumps({**content, 'image': {**content['image'], 'base64': f'<{len(image_data)} chars>'}})}")
            logger.info(f"📤 Storing image message: type={image_type}, thread={self.thread_id}")
            logger.debug(f"📤 Content keys: {list(content.keys())}, Image keys: {list(content['image'].keys())}")
            
            # Store the message in the database
            # The content should be stored directly, not wrapped in another structure
            result = await self.thread_manager.add_message(
                thread_id=self.thread_id,
                type="assistant",
                content=content,  # Pass content directly
                metadata=msg_metadata,  # Pass metadata as dict, not JSON string
                is_llm_message=False
            )
            
            logger.info(f"📤 thread_manager.add_message returned: {result is not None}, result keys: {list(result.keys()) if result else 'None'}")
            
            if result:
                logger.info(f"✅ Successfully added {image_type} image message to thread {self.thread_id}, message_id={result.get('message_id')}")
                return True
            else:
                logger.error(f"❌ Failed to add image message - thread_manager returned None")
                return False
            
        except Exception as e:
            logger.error(f"Failed to add image message: {e}")
            return False
    
    async def add_logo_message(self, logo_path: str) -> bool:
        """
        Add the welcome logo message to the conversation.
        
        Args:
            logo_path: Path to the logo file
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with open(logo_path, 'rb') as f:
                logo_base64 = base64.b64encode(f.read()).decode('utf-8')
            
            return await self.add_image_message(
                image_data=logo_base64,
                image_type="logo_welcome",
                mime_type="image/png",
                metadata={"is_logo_message": True}
            )
        except Exception as e:
            logger.error(f"Failed to add logo message: {e}")
            return False
    
    async def add_screenshot_message(
        self,
        screenshot_base64: str,
        caption: Optional[str] = None,
        source: Optional[str] = None
    ) -> bool:
        """
        Add a user feedback screenshot to the conversation.
        
        Args:
            screenshot_base64: Base64 encoded screenshot data
            caption: Optional caption describing the screenshot
            source: Optional source identifier (e.g., "web_search", "browser_action")
            
        Returns:
            bool: True if successful, False otherwise
        """
        metadata = {
            "is_screenshot_message": True,
            "screenshot_source": source or "unknown"
        }
        
        return await self.add_image_message(
            image_data=screenshot_base64,
            image_type="user_feedback_screenshot",
            mime_type="image/jpeg",  # Screenshots are typically JPEG
            caption=caption,
            metadata=metadata
        )
    
    @staticmethod
    def is_image_message(message: Dict[str, Any]) -> bool:
        """
        Check if a message is an image message.
        
        Args:
            message: Message dictionary from database
            
        Returns:
            bool: True if message contains an image
        """
        try:
            metadata = message.get('metadata', '')
            if isinstance(metadata, str):
                metadata = json.loads(metadata) if metadata else {}
            return metadata.get('is_image_message', False)
        except:
            return False
    
    @staticmethod
    def should_exclude_from_conversation_logic(message: Dict[str, Any]) -> bool:
        """
        Check if a message should be excluded from conversation logic
        (e.g., checking if last message is from assistant).
        
        Args:
            message: Message dictionary from database
            
        Returns:
            bool: True if message should be excluded
        """
        try:
            metadata = message.get('metadata', '')
            if isinstance(metadata, str):
                metadata = json.loads(metadata) if metadata else {}
            
            # Exclude logo messages and image messages from conversation logic
            return (
                metadata.get('is_logo_message', False) or
                metadata.get('is_image_message', False)
            )
        except:
            return False
