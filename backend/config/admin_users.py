"""
Admin user configuration for default workflow management.

This module defines which users have admin privileges to promote workflows
to default workflows or create new default workflows.
"""

import json
import os

def _load_admin_user_ids():
    """Load admin user IDs from JSON file."""
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_file = os.path.join(current_dir, 'admin_users_list.json')
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
            return set(data.get('admin_user_ids', []))
    except (FileNotFoundError, json.JSONDecodeError):
        # Fallback to hardcoded values if JSON file doesn't exist or is invalid
        return {
            "00af93e6-1dd3-4fc2-baf0-558b24634a5d",  # Your user ID
        }

# Admin user IDs loaded from JSON file
ADMIN_USER_IDS = _load_admin_user_ids()

def is_admin_user(user_id: str) -> bool:
    """
    Check if a user ID has admin privileges.
    
    Args:
        user_id: The user ID to check
        
    Returns:
        True if the user has admin privileges, False otherwise
    """
    return user_id in ADMIN_USER_IDS

def get_admin_user_ids() -> set[str]:
    """
    Get the set of admin user IDs.
    
    Returns:
        Set of admin user IDs
    """
    return ADMIN_USER_IDS.copy()
