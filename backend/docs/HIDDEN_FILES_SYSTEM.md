# Hidden Files System Documentation

## Overview

The Hidden Files System allows the automatic placement of template files into a hidden directory within each Daytona VM workspace. These files are:

- **Automatically created** when a new sandbox is initialized
- **Hidden from users** (not visible in file listings or UI)
- **Accessible to the Daytona VM** for internal operations
- **Scalable** - any files placed in the assets directory will be automatically included

## Architecture

### Directory Structure

```
/home/momenty2/suna2/backend/
├── assets/
│   └── hidden_files/           # Source files (visible to developers)
│       ├── file1.txt
│       ├── file2.txt
│       └── file3.txt
└── docs/
    └── HIDDEN_FILES_SYSTEM.md  # This documentation

# In Daytona VM workspace:
/workspace/
├── docs/                       # Hidden directory (invisible to users)
│   ├── file1.txt
│   ├── file2.txt
│   └── file3.txt
└── [user files...]             # Regular workspace files
```

### File Flow

1. **Development Phase**: Place template files in `backend/assets/hidden_files/`
2. **Sandbox Creation**: Files are automatically copied to `/workspace/docs/`
3. **Runtime**: VM can access files, users cannot see them
4. **Scaling**: Add more files to assets directory → automatically included

## Implementation Details

### 1. Sandbox Creation Modification

The `create_sandbox()` function in `sandbox/sandbox.py` has been modified to:

```python
def create_sandbox(password: str, project_id: str = None, user_id: str = None):
    # ... existing sandbox creation code ...
    
    # Initialize hidden files after sandbox is created
    initialize_hidden_files(sandbox)
    
    return sandbox

def initialize_hidden_files(sandbox: Sandbox):
    """Initialize hidden system files in the sandbox workspace."""
    try:
        # Create hidden directory
        hidden_dir = "/workspace/docs"
        sandbox.fs.create_folder(hidden_dir, "755")
        
        # Read and upload all files from assets directory
        assets_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "hidden_files")
        
        if os.path.exists(assets_dir):
            for filename in os.listdir(assets_dir):
                file_path = os.path.join(assets_dir, filename)
                if os.path.isfile(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    target_path = f"{hidden_dir}/{filename}"
                    sandbox.fs.upload_file(content.encode('utf-8'), target_path)
                    logger.debug(f"Uploaded hidden file: {target_path}")
                    
    except Exception as e:
        logger.error(f"Failed to initialize hidden files: {e}")
```

### 2. File Exclusion Logic

The `should_exclude_file()` function in `utils/files_utils.py` has been updated to hide the `docs/` directory:

```python
def should_exclude_file(rel_path: str) -> bool:
    """Check if a file should be excluded based on path, name, or extension"""
    
    # Exclude hidden docs directory
    if rel_path.startswith('docs/'):
        return True
    
    # ... existing exclusion logic ...
```

### 3. Directory Exclusion

Added `docs` to the `EXCLUDED_DIRS` set:

```python
EXCLUDED_DIRS = {
    "node_modules",
    ".next",
    "dist", 
    "build",
    ".git",
    "docs"  # Hide docs directory from users
}
```

### 4. API Endpoint Filtering

Updated the sandbox API endpoint in `sandbox/api.py` to apply exclusion logic:

```python
@router.get("/sandboxes/{sandbox_id}/files")
async def list_files(...):
    # ... existing code ...
    
    for file in files:
        # Skip excluded files and directories
        if should_exclude_file(file.name):
            continue
            
        # ... process file ...
```

## Usage

### Adding New Hidden Files

1. **Place files** in `/home/momenty2/suna2/backend/assets/hidden_files/`
2. **Deploy changes** - files will automatically appear in new sandboxes
3. **No code changes** required for additional files

### Accessing Hidden Files in VM

The Daytona VM can access these files through:

```bash
# Shell commands
cat /workspace/docs/file1.txt
ls -la /workspace/docs/

# File system operations (in Python)
content = sandbox.fs.download_file("/workspace/docs/file1.txt").decode()
```

### User Perspective

Users will **NOT** see:
- The `docs/` directory in file listings
- Any files within the `docs/` directory
- References to hidden files in the UI

Users **WILL** see:
- All other files in `/workspace/`
- Normal workspace functionality

## Security Considerations

1. **Isolation**: Hidden files are isolated to the VM workspace
2. **Access Control**: Only the VM processes can access these files
3. **User Privacy**: Users cannot see or access hidden files
4. **Scalability**: Easy to add/remove files without code changes

## Maintenance

### Updating Hidden Files

1. **Modify files** in `assets/hidden_files/`
2. **Deploy backend changes**
3. **New sandboxes** will include updated files
4. **Existing sandboxes** retain old files until recreated

### Removing Hidden Files

1. **Delete files** from `assets/hidden_files/`
2. **Deploy changes**
3. **New sandboxes** will not include deleted files

### Adding New File Types

The system supports any text-based file format. Binary files should be handled with appropriate encoding considerations.

## Testing

### Verification Steps

1. **Create new sandbox** through the API
2. **Check VM access**: `ls -la /workspace/docs/` (should show files)
3. **Check user UI**: File listings should not show `docs/` directory
4. **Verify content**: `cat /workspace/docs/file1.txt` (should show file content)

### Test Commands

```bash
# In sandbox shell
ls -la /workspace/
ls -la /workspace/docs/
cat /workspace/docs/file1.txt
```

## Troubleshooting

### Common Issues

1. **Files not appearing**: Check `assets/hidden_files/` directory exists
2. **Permission errors**: Verify file permissions in assets directory
3. **Encoding issues**: Ensure files are UTF-8 encoded
4. **Hidden files visible**: Check exclusion logic in `files_utils.py`

### Debug Logging

Enable debug logging to see hidden file initialization:

```python
logger.debug(f"Uploaded hidden file: {target_path}")
logger.error(f"Failed to initialize hidden files: {e}")
```

## Future Enhancements

1. **Dynamic file updates**: Update files in existing sandboxes
2. **File versioning**: Track file versions and updates
3. **Conditional files**: Include files based on project type
4. **File templates**: Support for templated files with variable substitution
