"""
Workflow Credential Encryption Service

Handles encryption and decryption of workflow credentials using the same
encryption infrastructure as MCP credentials for consistency.
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from utils.logger import logger


class WorkflowCredentialService:
    """Service for encrypting and decrypting workflow credentials."""
    
    def __init__(self):
        """Initialize with the same encryption key used by MCP credentials."""
        self.encryption_key = self._get_encryption_key()
        self.cipher = Fernet(self.encryption_key)
    
    def _get_encryption_key(self) -> bytes:
        """Get the MCP encryption key from environment."""
        key_env = os.getenv("MCP_CREDENTIAL_ENCRYPTION_KEY")
        
        if not key_env:
            raise ValueError(
                "MCP_CREDENTIAL_ENCRYPTION_KEY environment variable is required. "
                "This should be the same key used for MCP credentials."
            )
        
        try:
            if isinstance(key_env, str):
                return key_env.encode('utf-8')
            else:
                return key_env
        except Exception as e:
            logger.error(f"Invalid encryption key format: {e}")
            raise ValueError("Invalid encryption key format")
    
    def encrypt_credential(self, value: str) -> str:
        """
        Encrypt a credential value.
        
        Args:
            value: The credential value to encrypt
            
        Returns:
            Base64-encoded encrypted value
        """
        if not value:
            return ""
        
        try:
            # Encrypt the value
            encrypted_bytes = self.cipher.encrypt(value.encode('utf-8'))
            
            # Return base64-encoded string for database storage
            return base64.b64encode(encrypted_bytes).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to encrypt credential: {e}")
            raise ValueError("Failed to encrypt credential")
    
    def decrypt_credential(self, encrypted_value: str) -> str:
        """
        Decrypt a credential value.
        
        Args:
            encrypted_value: Base64-encoded encrypted value
            
        Returns:
            Decrypted credential value
        """
        if not encrypted_value:
            return ""
        
        try:
            # Decode from base64
            encrypted_bytes = base64.b64decode(encrypted_value.encode('utf-8'))
            
            # Decrypt the value
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            
            return decrypted_bytes.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to decrypt credential: {e}")
            raise ValueError("Invalid or corrupted encrypted credential")
    
    def encrypt_credentials_dict(self, credentials: dict) -> dict:
        """
        Encrypt all values in a credentials dictionary.
        
        Args:
            credentials: Dictionary of credential key-value pairs
            
        Returns:
            Dictionary with encrypted values
        """
        encrypted_creds = {}
        
        for key, value in credentials.items():
            if value:
                encrypted_creds[key] = self.encrypt_credential(str(value))
            else:
                encrypted_creds[key] = ""
        
        return encrypted_creds
    
    def decrypt_credentials_dict(self, encrypted_credentials: dict) -> dict:
        """
        Decrypt all values in an encrypted credentials dictionary.
        
        Args:
            encrypted_credentials: Dictionary with encrypted values
            
        Returns:
            Dictionary with decrypted values
        """
        decrypted_creds = {}
        
        for key, encrypted_value in encrypted_credentials.items():
            if encrypted_value:
                decrypted_creds[key] = self.decrypt_credential(encrypted_value)
            else:
                decrypted_creds[key] = ""
        
        return decrypted_creds


# Singleton instance for dependency injection
_credential_service_instance: Optional[WorkflowCredentialService] = None


def get_workflow_credential_service() -> WorkflowCredentialService:
    """
    Get singleton instance of WorkflowCredentialService for dependency injection.
    
    Returns:
        WorkflowCredentialService instance
    """
    global _credential_service_instance
    
    if _credential_service_instance is None:
        _credential_service_instance = WorkflowCredentialService()
    
    return _credential_service_instance
