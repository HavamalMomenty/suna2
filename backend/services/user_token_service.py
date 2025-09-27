"""
User Token Service for managing encrypted API tokens.

This service handles the storage, retrieval, and encryption of user API tokens
for external services like Resights and Redata.
"""

import os
from typing import Optional, Dict, Any
from services.supabase import DBConnection
from utils.logger import logger
from pydantic import BaseModel


class UserTokenData(BaseModel):
    """Pydantic model for user token data."""
    resights_token: Optional[str] = None
    redata_token: Optional[str] = None


class UserTokenService:
    """Service for managing user API tokens."""
    
    def __init__(self):
        self.db = DBConnection()
    
    async def get_user_tokens(self, user_id: str) -> UserTokenData:
        """
        Get user's API tokens.
        
        Args:
            user_id: The user ID
            
        Returns:
            UserTokenData: The user's tokens
        """
        try:
            client = await self.db.client
            result = await client.table('user_api_tokens').select('*').eq('user_id', user_id).execute()
            
            if not result.data or len(result.data) == 0:
                return UserTokenData()
            
            token_record = result.data[0]
            
            return UserTokenData(
                resights_token=token_record.get('resights_token_encrypted'),
                redata_token=token_record.get('redata_token_encrypted')
            )
            
        except Exception as e:
            logger.error(f"Error retrieving user tokens: {str(e)}")
            raise
    
    async def save_user_tokens(self, user_id: str, tokens: UserTokenData) -> bool:
        """
        Save user's API tokens.
        
        Args:
            user_id: The user ID
            tokens: The tokens to save
            
        Returns:
            bool: True if successful
        """
        try:
            # Prepare data
            data = {
                'user_id': user_id,
                'resights_token_encrypted': tokens.resights_token if tokens.resights_token else None,
                'redata_token_encrypted': tokens.redata_token if tokens.redata_token else None,
            }
            
            logger.info(f"Attempting to save tokens for user {user_id}")
            logger.info(f"Data keys: {list(data.keys())}")
            
            # Use upsert to handle both insert and update
            client = await self.db.client
            result = await client.table('user_api_tokens').upsert(data).execute()
            
            logger.info(f"Upsert result: {result}")
            
            if result.data:
                logger.info(f"Successfully saved tokens for user {user_id}")
                return True
            else:
                logger.error(f"Failed to save tokens for user {user_id} - no data returned")
                logger.error(f"Result: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving user tokens: {str(e)}")
            raise
    
    async def delete_user_tokens(self, user_id: str) -> bool:
        """
        Delete user's API tokens.
        
        Args:
            user_id: The user ID
            
        Returns:
            bool: True if successful
        """
        try:
            client = await self.db.client
            result = await client.table('user_api_tokens').delete().eq('user_id', user_id).execute()
            
            if result.data is not None:
                logger.info(f"Successfully deleted tokens for user {user_id}")
                return True
            else:
                logger.error(f"Failed to delete tokens for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting user tokens: {str(e)}")
            raise
    
    async def has_any_tokens(self, user_id: str) -> bool:
        """
        Check if user has any tokens configured.
        
        Args:
            user_id: The user ID
            
        Returns:
            bool: True if user has any tokens
        """
        try:
            tokens = await self.get_user_tokens(user_id)
            return bool(tokens.resights_token or tokens.redata_token)
        except Exception as e:
            logger.error(f"Error checking user tokens: {str(e)}")
            return False
    
    async def get_resights_token(self, user_id: str) -> Optional[str]:
        """
        Get user's Resights token specifically.
        
        Args:
            user_id: The user ID
            
        Returns:
            Optional[str]: The Resights token or None
        """
        try:
            tokens = await self.get_user_tokens(user_id)
            return tokens.resights_token
        except Exception as e:
            logger.error(f"Error retrieving Resights token: {str(e)}")
            return None
    
    async def get_redata_token(self, user_id: str) -> Optional[str]:
        """
        Get user's Redata token specifically.
        
        Args:
            user_id: The user ID
            
        Returns:
            Optional[str]: The Redata token or None
        """
        try:
            tokens = await self.get_user_tokens(user_id)
            return tokens.redata_token
        except Exception as e:
            logger.error(f"Error retrieving Redata token: {str(e)}")
            return None
