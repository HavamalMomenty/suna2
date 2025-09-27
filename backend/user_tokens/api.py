"""
User Token API endpoints for managing user API tokens.

This module provides REST API endpoints for users to manage their
encrypted API tokens for external services.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from utils.auth_utils import get_current_user_id_from_jwt
from services.user_token_service import UserTokenService, UserTokenData
from utils.logger import logger

router = APIRouter()

# Initialize the token service
token_service = UserTokenService()


class TokenUpdateRequest(BaseModel):
    """Request model for updating user tokens."""
    resights_token: Optional[str] = None
    redata_token: Optional[str] = None


class TokenResponse(BaseModel):
    """Response model for user tokens."""
    resights_token: Optional[str] = None
    redata_token: Optional[str] = None
    has_any_tokens: bool = False


@router.get("/user/tokens", response_model=TokenResponse)
async def get_user_tokens(
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> TokenResponse:
    """
    Get user's API tokens.
    
    Returns the user's encrypted API tokens for external services.
    Tokens are returned in a decrypted state for the user to view.
    """
    try:
        logger.info(f"Retrieving tokens for user {user_id}")
        
        tokens = await token_service.get_user_tokens(user_id)
        has_any = await token_service.has_any_tokens(user_id)
        
        return TokenResponse(
            resights_token=tokens.resights_token,
            redata_token=tokens.redata_token,
            has_any_tokens=has_any
        )
        
    except Exception as e:
        logger.error(f"Error retrieving tokens for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve user tokens"
        )


@router.put("/user/tokens", response_model=TokenResponse)
async def update_user_tokens(
    token_data: TokenUpdateRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> TokenResponse:
    """
    Update user's API tokens.
    
    Updates the user's API tokens for external services.
    Tokens are encrypted before storage.
    """
    try:
        logger.info(f"Updating tokens for user {user_id}")
        logger.info(f"Token data received: resights={bool(token_data.resights_token)}, redata={bool(token_data.redata_token)}")
        
        # Create UserTokenData object
        tokens = UserTokenData(
            resights_token=token_data.resights_token,
            redata_token=token_data.redata_token
        )
        
        # Save tokens
        success = await token_service.save_user_tokens(user_id, tokens)
        
        if not success:
            logger.error(f"Token service returned False for user {user_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to save user tokens"
            )
        
        # Return updated tokens
        updated_tokens = await token_service.get_user_tokens(user_id)
        has_any = await token_service.has_any_tokens(user_id)
        
        logger.info(f"Successfully updated tokens for user {user_id}")
        
        return TokenResponse(
            resights_token=updated_tokens.resights_token,
            redata_token=updated_tokens.redata_token,
            has_any_tokens=has_any
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating tokens for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update user tokens: {str(e)}"
        )


@router.delete("/user/tokens")
async def delete_user_tokens(
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> dict:
    """
    Delete user's API tokens.
    
    Removes all stored API tokens for the user.
    """
    try:
        logger.info(f"Deleting tokens for user {user_id}")
        
        success = await token_service.delete_user_tokens(user_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete user tokens"
            )
        
        return {"message": "User tokens deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tokens for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete user tokens"
        )


@router.get("/user/tokens/status")
async def get_token_status(
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> dict:
    """
    Get user's token status.
    
    Returns information about which tokens are configured.
    """
    try:
        logger.info(f"Checking token status for user {user_id}")
        
        has_any = await token_service.has_any_tokens(user_id)
        resights_token = await token_service.get_resights_token(user_id)
        redata_token = await token_service.get_redata_token(user_id)
        
        return {
            "has_any_tokens": has_any,
            "has_resights_token": bool(resights_token),
            "has_redata_token": bool(redata_token),
            "resights_configured": bool(resights_token),
            "redata_configured": bool(redata_token)
        }
        
    except Exception as e:
        logger.error(f"Error checking token status for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to check token status"
        )


@router.get("/user/tokens/test")
async def test_token_endpoint(
    user_id: str = Depends(get_current_user_id_from_jwt)
) -> dict:
    """
    Test endpoint to verify the API is working.
    """
    try:
        logger.info(f"Test endpoint called for user {user_id}")
        return {
            "status": "ok",
            "user_id": user_id,
            "message": "Token API is working"
        }
    except Exception as e:
        logger.error(f"Error in test endpoint for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Test endpoint failed: {str(e)}"
        )
