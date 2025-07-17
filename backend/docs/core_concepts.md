# Core Concepts in Suna

This document explains some of the core architectural concepts of the Suna system, specifically focusing on tool registration and the Daytona SDK integration.

## Tool Registration System

The tool registration system in Suna enables agents to access various capabilities by registering and managing tools that can be dynamically discovered and invoked at runtime.

### Architecture

Suna's tool registration system follows a registry pattern:

1. **Tool Registry**: Central repository of available tools
2. **Tool Registration**: Process of adding tools to the registry
3. **Tool Discovery**: Mechanism to find appropriate tools for a task
4. **Tool Invocation**: Framework for executing tool functions

### Registration Process

Tools are registered using the `register_tool` function from the tool registry:

```python
from agent.tools.registry import register_tool

# Register a tool with a unique name
register_tool("document_processing", DocumentProcessingTool)
```

Tools are typically registered during system initialization, making them available to all agents that run afterward.

### Tool Structure

A tool typically consists of:

1. **Tool Class**: Contains methods that implement the tool's functionality
2. **Static Methods**: Stateless functions that perform specific operations
3. **Documentation**: Descriptions and parameter specifications
4. **Permissions**: Optional access control specifications

Example of a tool class:

```python
class DocumentProcessingTool:
    """Tool for processing documents with various methods."""
    
    @staticmethod
    async def process_document(agent_run, document_path, options=None):
        """
        Process a document with specified options.
        
        Args:
            agent_run: The agent run context
            document_path: Path to the document
            options: Optional processing parameters
            
        Returns:
            Processing results
        """
        # Implementation
        pass
```

### Tool Discovery and Execution

When an agent needs to perform a task, it:

1. Queries the tool registry for appropriate tools
2. Selects the best tool based on the task requirements
3. Invokes the tool with necessary parameters
4. Processes the results and continues execution

Tools are made available to agents through a dynamic accessor:

```python
# In agent execution code
result = await agent.tools.document_processing.process_document(
    agent_run=agent,
    document_path=document_path
)
```

### Tool Categories

Suna organizes tools into several categories:

1. **Core Tools**: Essential functionalities like file operations or network requests
2. **Domain-Specific Tools**: Specialized for particular domains like document processing
3. **Integration Tools**: Connect with external services and APIs
4. **Custom Tools**: Created by users for specific workflows

## Daytona SDK

The Daytona SDK provides a secure, isolated environment for agent execution and file operations, offering a sandboxed virtual machine (VM) where code can run safely.

### Architecture

The Daytona integration consists of:

1. **Daytona Client**: Interfaces with the Daytona cloud service
2. **Sandbox VM**: Isolated environment for file storage and execution
3. **API Layer**: Manages communication between backend and VM
4. **Security Model**: Ensures isolation and resource constraints

### Configuration

The Daytona SDK is configured using environment variables:

```python
daytona_config = DaytonaConfig(
    api_key=config.DAYTONA_API_KEY,
    server_url=config.DAYTONA_SERVER_URL,
    target=config.DAYTONA_TARGET
)
```

These parameters authenticate and connect to the appropriate Daytona environment.

### Sandbox Lifecycle Management

Sandboxes follow a lifecycle that includes:

1. **Creation**: Initialize a new sandbox environment
   ```python
   sandbox = daytona.create(params)
   ```

2. **Retrieval**: Get an existing sandbox by ID
   ```python
   sandbox = daytona.get(sandbox_id)
   ```

3. **Starting/Stopping**: Control sandbox execution state
   ```python
   daytona.start(sandbox)
   daytona.stop(sandbox)
   ```

4. **Deletion**: Remove a sandbox when no longer needed
   ```python
   daytona.delete(sandbox)
   ```

### File System Operations

The Daytona SDK provides a virtual file system interface:

```python
# Upload a file to the sandbox
sandbox.fs.upload_file(content, path)

# Download a file from the sandbox
content = sandbox.fs.download_file(path)

# List files in a directory
files = sandbox.fs.list_files(path)

# Delete a file
sandbox.fs.delete_file(path)
```

### Process Execution

The SDK allows execution of processes within the sandbox:

```python
# Create a session for process execution
session_id = "my-session"
sandbox.process.create_session(session_id)

# Execute a command in the session
response = sandbox.process.execute_session_command(
    session_id,
    SessionExecuteRequest(
        command="echo 'Hello World'",
        var_async=False
    )
)
```

### Security Model

The Daytona sandbox provides several security features:

1. **Resource Isolation**: Each sandbox runs in its own isolated environment
2. **Resource Constraints**: Limits on CPU, memory, and disk usage
3. **Network Control**: Managed network access
4. **Auto-termination**: Sandboxes can automatically stop after a period of inactivity
5. **Access Control**: API key-based authentication and authorization

### Integration with Document Processing

In Suna, the Daytona sandbox is used primarily for file storage while processing occurs in the backend:

1. Files are uploaded to the sandbox
2. The backend downloads files for processing
3. Processing (like document parsing) occurs in the backend container
4. Results are uploaded back to the sandbox

This separation ensures secure execution while maintaining the benefits of isolation.

## Combining Tools and Daytona

When tools and Daytona work together:

1. Files are uploaded to the Daytona sandbox
2. Tools registered in the system process these files
3. Results are stored back in the sandbox
4. Agents can access and use both original files and processing results

This architecture ensures:

- Secure file handling
- Controlled execution environment
- Separation of concerns
- Scalable and extensible design

By understanding these core concepts, developers can effectively extend Suna's capabilities while maintaining its security and architectural integrity.
