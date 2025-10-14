


The prompt:
Add a knowledge base!

    Security:
        Use RLS, and auth.id to make sure knowledge stays private. 

        See the .cursor file for more details about the implementation

        No public endpoints, ie. no data can be public!

    Database:
        Add the MININMAL number of additional database elements. 
        Database should have "On delete cascade" such that users can be deleted with their associated knowledge bases. 
        
    UI:
        Add a button called "Knowledge base" right beneath the "Connect to Resights/Redata" button. This is in the panel under personal account.

        When clicking on Knowledge base a popup screen in the same style as "Connect to Resights/Redata" should popup. 

        This should have a single page. The page should visually look like the same as the Connect to Resights/Redata button. However it should not have either the close or save and continue button (these buttons should only exist in the add records ui i will come to that in a bit). However it should have a standard black cross button in the top right corner, indicating to close the page. 

        The description should be added similarly to the UI of "Connect to Resights/Redata button", however it should say "Add knowledge to the agent. Knowledge is available in all conversations and when running workflows."

        otherwise the main content of the UI should be the title and description of each record.
        Each record should both have a "edit record" and "delete" button in the main UI. 

        Delete button should have same visual charecter as deleting files in workflow builder, ie a red bin. It should also have a "Are you sure" popup, where the user confirms that they want it deleted.

        Edit button should be visiually identical to the UI for creating a new workflow as described. 

        Clicking outside of this UI should NOT close it, unlike how "Connect to Resights/Redata button" works! 

        Core functionality:
            * Knowledge base allows us to define an unlimited (or nearly unlimited) number of "records". 
            * Each record consists of three elements, 1 title, 2 description 3 content 
            * The meaning of title is self evident but for description describe that "Description should describe what content contains, example "login credentials for services", "
            * UI should have a clear visual element showing how to add a new "record". ie. a button saying "add record". Clicking this should change the change the UI such that 3 new fields are shown. Also isntead 
            When adding a new record each of the three elements described should be shown.
            Visually indicate via the size of the input box that title should only be a few characters, and description should be a bit more and content is main part, of course dont do to scale just be reasonable in the way you visially show this (also put a limit), description should be maybe 150 charecters at most, content should be up to 10k charecters. 
            * Two buttons should exist to leave the UI for creating a new record, 1 a "Delete record" button 2 "Save record and continue". If pressing "delete record", before actually leaving there should be a popup saying "All changes to record will be deleted if confirmed", (please formualte this better btw.) where the user will have a regret option ie. return to editing the record or a confirm option. Colour wise use exactyl the same colours as "Connect to Resights/Redata" for Close and Save record and Continue. 
            * The records should be lined up like rows in a table, with the delete and edit buttons on the right side of the row. Each row is a record. The description should also be shown for each record, but with smaller text. Make it visually appealing. 

    Backend: How it should work.

        * All "records" added to the knowledge base should be exposed endpoints for the ai agent to interract with. 
        * The AI agent should work with the knowledge base in the following way. 1 TItles and Descriptions of all records in the knowledge base should be organized and put into the context window similarly to prompt.py and prompt_real_estate_analyser.py. 2 The content should be easily accessible when the model calls for it, ie. it should have the ability to curl (or by some other method) get the full "Content" field. 
        * Knowledge base should NOT! be added as an additional "Data provider" ie. using the data provider field. It should however work in a similar way, ie. with a bunch of curl commands being able to gather data. 
        * It should be implemented as its own parralel concept to data providers. Call it "Knowledge base". Take insipiration from how data providers work though!



fix UI:
    I would like to change the UI for both the button "Add Resights/Redata api key" and "Knowledge base". 

    Instead of having these buttons in the current location i would like to put them both under the chatbox itself. So beneath the chatbox (ie. where i can input text) I would like the two buttons to be located horitzonatally w.r.t to each other. the look of the buttons should also be changes to fit aesthetically under the bar! The Knowledge base should have the standard symbol for knowledge namely the symbol for database. Redo the aesthetics of the buttons themselves but dont change any of the UI related to the window that pops up when clicking the buttons.

    Also call the button "Knowledge" instead of "Knowledge base"  and call the Connect resights.... Just connect API








Concrete, code-aware implementation plan (do not modify any existing text above)

Backend (FastAPI, Supabase client already present)
    Where to add:
        - Use existing router at `suna2/backend/knowledge_base/api.py` (already mounted at `/api/knowledge-base` in `suna2/backend/api.py`).
        - Supabase async client via `services/supabase.py` `DBConnection` is the standard pattern.
        - Auth via `utils.auth_utils.get_current_user_id_from_jwt` and feature flag via `flags.flags.is_enabled`.

    Data access patterns (effective Supabase usage):
        - Listing KB for a thread: already implemented `GET /knowledge-base/threads/{thread_id}` calling RPC `get_thread_knowledge_base` and reading `threads` table for existence check. Keep using RPC for token-cost summarization and pagination server-side. If RPC missing, implement in SQL in `backend/supabase/migrations/` with proper RLS.
        - Creating entries: `POST /knowledge-base/threads/{thread_id}` reads `account_id` from `threads`, inserts into `knowledge_base_entries` with fields: `thread_id`, `account_id`, `name` (title), `description`, `content`, `usage_context`. Continue using `client.table('knowledge_base_entries').insert(...)`.
        - Updating, deleting, fetching single entry: implemented via `PUT/DELETE/GET /knowledge-base/{entry_id}`. Keep using `.eq('entry_id', entry_id)` filters. Return `KnowledgeBaseEntryResponse` model.
        - Context assembly: `GET /knowledge-base/threads/{thread_id}/context` calls RPC `get_knowledge_base_context` with `p_max_tokens`, which should return summarized metadata and/or selected content. Keep logic in SQL for token-aware truncation.

    What to add/change:
        - Ensure DB migrations exist: `knowledge_base_entries` table with columns: `entry_id uuid pk default gen_random_uuid()`, `thread_id uuid ref threads(thread_id) on delete cascade`, `account_id uuid ref auth.users(id) on delete cascade`, `name text not null`, `description text`, `content text not null`, `usage_context text default 'always' check in ('always','on_request','contextual')`, `is_active boolean default true`, `content_tokens int`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`; trigger to maintain `updated_at`.
        - Enable RLS and policies: `ALTER TABLE knowledge_base_entries ENABLE ROW LEVEL SECURITY;` Policy: user can manage rows where `account_id = auth.uid()`. Optional extra policies for thread-level sharing if teams later.
        - RPCs in SQL:
            - `get_thread_knowledge_base(p_thread_id uuid, p_include_inactive bool)` returning rows with token counts; respect RLS implicitly.
            - `get_knowledge_base_context(p_thread_id uuid, p_max_tokens int)` selecting titles/descriptions first and adding content until token budget. Compute tokens either via stored `content_tokens` or approximate by length.
        - In `knowledge_base/api.py`, after inserts/updates, optionally recompute `content_tokens` server-side if you add a token counter utility. Otherwise leave null and let RPC compute lazily.

    Example Supabase usage patterns to keep consistent:
        - Existence check: `await client.table('threads').select('thread_id').eq('thread_id', thread_id).execute()`
        - Insert: `await client.table('knowledge_base_entries').insert({...}).execute()`
        - Update: `await client.table('knowledge_base_entries').update(update_data).eq('entry_id', entry_id).execute()`
        - Delete: `await client.table('knowledge_base_entries').delete().eq('entry_id', entry_id).execute()`

Frontend (Next.js, using Supabase client and existing API helper style)
    Where to add:
        - Add API helper functions in `suna2/frontend/src/lib/api.ts` mirroring backend endpoints under a `Knowledge Base` section:
            - `listKbEntries(threadId)` -> GET `${API_URL}/knowledge-base/threads/${threadId}`; returns `{ entries, total_count, total_tokens }`.
            - `createKbEntry(threadId, { name, description, content, usage_context })` -> POST.
            - `updateKbEntry(entryId, patch)` -> PUT.
            - `deleteKbEntry(entryId)` -> DELETE.
            - `getKbContext(threadId, maxTokens?)` -> GET context for agent.
        - UI: In the personal account panel, place a "Knowledge base" button under "Connect to Resights/Redata". Implement a Dialog using same component system as Resights modal, but do not close on outside click. Use existing patterns from `components/workflows/WorkflowBuilderModal.tsx` for layout and confirmation dialogs (red bin icon is already used there).

    UI specifics matching your spec:
        - Modal with list view: rows show `name` as title and `description` as secondary text. Right-aligned actions: Edit, Delete (red bin + confirm dialog: "Are you sure you want to delete this record?").
        - "Add record" toggles to editor view with three fields: Title (short), Description (<=150), Content (textarea up to ~10k). Buttons: "Delete record" (confirm: "All changes to this record will be discarded. Continue?"), "Save record and continue" (saves, returns to list).
        - Keep consistent styling with existing modals and forms; use existing form components (react-hook-form + zod if present) and error display patterns from `components/workflows/*`.

Agent integration
    - When assembling agent prompt, fetch metadata via `GET /knowledge-base/threads/{thread_id}` and place only titles/descriptions into the context (similar to patterns in `backend/agent/prompt_real_estate_analysis.py`).
    - When the model needs a record’s full content, call `GET /knowledge-base/{entry_id}` on demand. For workflows, provide a tiny helper to fetch by id with token in headers (see existing patterns in `src/lib/api.ts` using `supabase.auth.getSession()` and `Authorization: Bearer`).

Image correctness hook
    - Ensure components that render house/property images resolve the URL via a single resolver that calls Resights for the specific address. Enforce this via the rendering component used in property contexts and remove any generic image fallbacks in those code paths. Add a simple unit/integration test mirroring the workflow image URL tests.

Migrations placement and style
    - Create a single SQL file under `suna2/backend/supabase/migrations/` adding table, indexes, triggers, RLS policies, RPCs. Follow existing migration style (idempotent `IF NOT EXISTS`, token update trigger, and policy naming). The project prefers editing existing migration and force-push when needed rather than many files [[memory:8305246]].

Exact files to touch/add
    - Backend:
        - `suna2/backend/supabase/migrations/<timestamp>_knowledge_base.sql` (table + policies + RPCs)
        - `suna2/backend/knowledge_base/api.py` (verify/adjust field names to match table; light changes only)
    - Frontend:
        - `suna2/frontend/src/lib/api.ts` (add KB helpers following the same `fetch` + Supabase token pattern used elsewhere)
        - UI components under the personal account panel: add button and modal component; reuse icons/styles from workflow builder components.

Notes on performance and correctness
    - Do not return `content` in list endpoints; fetch individually.
    - Use pagination in backend RPC or add `range` parameters later; initial list is fine for small N.
    - Keep all endpoints private; no public exposure or bypass of RLS. Backend uses service role, but RLS policies should still guard data access.

Testing
    - Backend: tests for CRUD, RLS denial when `account_id != auth.uid()`, cascade delete via thread removal, RPC happy-path.
    - Frontend: modal UX, create/edit/delete flows, no outside-click close, confirm dialogs.
    - Agent: ensure metadata-only injection, on-demand content fetch works.

---



















# Browser Screenshot System - Implementation Summary

## TL;DR

**Problem:** Browser screenshots were captured and shown in right panel (VM actions), but NOT in the left chat panel where users see the conversation.

**Solution:** Intercept `browser_state` messages in the agent loop, extract screenshots, and create duplicate `assistant` messages that the frontend renders in the chat.

**Result:** Every time the agent navigates to a webpage, the screenshot automatically appears in the chat with the page title as caption. ✅

## The Core Logic

### 1. Browser Captures Screenshot (Already Existed)
```python
# In sb_browser_tool.py
# Browser automation captures screenshot automatically
# Stores in database as type='browser_state' message
```

### 2. Agent Loop Intercepts Screenshot (NEW - run.py lines 393-489)
```python
# Every iteration:
# 1. Query for latest browser_state message
latest_browser_state_msg = await client.table('messages').select('*').eq(
    'thread_id', thread_id
).eq('type', 'browser_state').order('created_at', desc=True).limit(1).execute()

# 2. Extract screenshot
screenshot_base64 = browser_content.get("screenshot_base64")
screenshot_url = browser_content.get("image_url")

# 3. Check if already displayed (prevent duplicates)
if not browser_state_metadata.get("screenshot_displayed_in_chat", False):
    # 4. Create visible chat message
    screenshot_content = {
        "content": f"🌐 {page_title}",
        "image": {
            "base64": display_screenshot,
            "mime_type": "image/jpeg",
            "type": "user_feedback_screenshot"
        }
    }
    
    # 5. Add as assistant message (appears in chat!)
    await thread_manager.add_message(
        thread_id=thread_id,
        type="assistant",  # <-- This makes it appear in chat
        content=screenshot_content,
        metadata={"is_image_message": True},
        is_llm_message=False
    )
    
    # 6. Mark as displayed
    await client.table('messages').update({
        "metadata": {..., "screenshot_displayed_in_chat": True}
    }).eq('message_id', browser_state_msg_id).execute()
```

### 3. Frontend Renders (Already Existed)
```typescript
// In ThreadContent.tsx
// Detects messages with image field
if (imageData && imageData.base64) {
    if (imageType === 'user_feedback_screenshot') {
        // Render full-width card with caption
        <div className="border rounded-lg">
            <div className="caption-header">{caption}</div>
            <img src={`data:${mime_type};base64,${base64}`} />
        </div>
    }
}
```

## Why This Works

1. **Reuses existing infrastructure** - Browser automation already captures screenshots
2. **Separate message types** - `browser_state` for LLM context, `assistant` for chat display
3. **Proven pattern** - Uses same message structure that worked for the logo
4. **Metadata tracking** - Prevents duplicates with `screenshot_displayed_in_chat` flag
5. **Non-intrusive** - Image messages excluded from conversation logic via `is_image_message` flag

## Files Modified

1. **`backend/agent/run.py`** (lines 393-489)
   - Added screenshot interception logic in main agent loop
   - Converts browser_state screenshots to visible assistant messages

2. **`backend/agent/image_manager.py`** (NEW)
   - Helper class for creating image messages
   - Handles message structure and metadata
   - Provides convenience methods

3. **`backend/agent/tools/web_search_tool.py`**
   - Added `thread_id` parameter to constructor
   - Optional: Captures first search result image

4. **`backend/agent/tools/sb_browser_tool.py`**
   - Enhanced logging for debugging
   - No functional changes (screenshots already working)

5. **`frontend/src/components/thread/content/ThreadContent.tsx`**
   - Image rendering logic (already existed)
   - Handles `user_feedback_screenshot` type

## Testing

**Test it:**
1. Start new conversation
2. Ask: "Go to example.com"
3. Screenshot appears in chat! ✅

**Logs to verify:**
```
📸 DISPLAYING browser screenshot in chat for URL: https://example.com
✅ SCREENSHOT ADDED TO CHAT for https://example.com
```

## Key Takeaways

- **Browser screenshots were always being captured** - just not displayed in chat
- **The fix was simple** - intercept and duplicate them as assistant messages
- **Every browser action now shows a screenshot** - automatic visual feedback
- **No changes to browser automation** - purely an interception/display enhancement














# IN the fule image system documentation the following was written

# Browser Screenshot System Documentation

## Overview
System for automatically displaying browser screenshots in the chat when the agent navigates to webpages or performs web searches.

## How It Works

### The Core Mechanism

**The browser automation already captures screenshots** - they're stored in `browser_state` messages and shown in the right panel (Daytona VM actions). The challenge was making them also appear in the left chat panel.

**Solution:** Every agent iteration, check for new `browser_state` messages with screenshots and convert them into visible chat messages.

## Architecture

### Core Components

#### 1. **Browser State Processing** (`backend/agent/run.py` lines 393-489)
The main loop that converts browser screenshots into visible chat messages.

**Process Flow:**
1. **Check for browser_state messages** - Query database for latest `browser_state` message
2. **Extract screenshot data** - Get `screenshot_base64` or `image_url` from the message
3. **Check if already displayed** - Use metadata flag `screenshot_displayed_in_chat` to prevent duplicates
4. **Create visible message** - Build assistant message with image structure
5. **Add to thread** - Store as assistant message so it appears in chat
6. **Mark as displayed** - Update browser_state metadata to prevent re-display

**Key Code:**
```python
# Get latest browser_state message
latest_browser_state_msg = await client.table('messages').select('*').eq(
    'thread_id', thread_id
).eq('type', 'browser_state').order('created_at', desc=True).limit(1).execute()

# Extract screenshot
screenshot_base64 = browser_content.get("screenshot_base64")
screenshot_url = browser_content.get("image_url")

# Create visible chat message
screenshot_content = {
    "content": f"🌐 {browser_content.get('title', 'Page Screenshot')}",
    "image": {
        "base64": display_screenshot,
        "mime_type": "image/jpeg",
        "type": "user_feedback_screenshot"
    }
}

# Add as assistant message (appears in chat!)
await thread_manager.add_message(
    thread_id=thread_id,
    type="assistant",
    content=screenshot_content,
    metadata={"is_image_message": True, ...},
    is_llm_message=False
)
```

#### 2. **ImageManager** (`backend/agent/image_manager.py`)
Helper class for creating image messages with consistent structure.

**Key Features:**
- Validates and structures image data
- Adds proper metadata for conversation logic exclusion
- Provides convenience methods for different image types
- Comprehensive logging for debugging

**Supported Image Types:**
- `user_feedback_screenshot`: Browser screenshots, web search images
- `tool_visualization`: Visual representations of tool results

#### 3. **Web Search Image Capture** (`backend/agent/tools/web_search_tool.py`)
Optional: Captures first image from web search results.

**Features:**
- Downloads first image from Tavily search results
- Converts to base64
- Uses ImageManager to add to conversation
- Only captures first search per conversation

#### 4. **Frontend Rendering** (`frontend/src/components/thread/content/ThreadContent.tsx`)
Renders image messages with appropriate styling.

**Rendering Logic:**
- **User Feedback Screenshot**: Full-width card with caption header
- **Generic Images**: Full-width card with optional caption
- Handles double-encoded JSON automatically
- Extracts image data and caption from message content

### Message Structure

All image messages follow this structure:

```json
{
  "role": "assistant",
  "type": "assistant",
  "content": {
    "content": "Optional caption text",
    "image": {
      "base64": "base64_encoded_image_data",
      "mime_type": "image/png",
      "type": "logo_welcome"
    }
  },
  "metadata": {
    "is_image_message": true,
    "image_type": "logo_welcome",
    "is_logo_message": true  // For logo messages
  },
  "is_llm_message": false
}
```

### Conversation Logic Exclusion

Image messages are automatically excluded from conversation logic:

```python
# In run.py
real_assistant_msgs = [msg for msg in existing_assistant_msgs 
                      if not ImageManager.should_exclude_from_conversation_logic(msg)]
```

This prevents:
- Agent stopping when last message is an image
- Image messages being counted as "real" assistant responses
- Conversation flow interruption

## Implementation Details

### The Key Insight

**Browser screenshots were already being captured** - they just weren't being displayed in the chat. The browser automation stores screenshots in `browser_state` messages (type='browser_state'), which are:
- Used by the LLM for context
- Displayed in the right panel (Daytona VM actions)
- **NOT displayed in the left chat panel**

**The Solution:** Intercept these `browser_state` messages and create duplicate `assistant` messages with the screenshots, which the frontend DOES render in the chat.

### Step-by-Step Flow

**1. Browser Captures Screenshot**
- Agent calls `browser_navigate_to` or other browser actions
- Browser automation captures screenshot automatically
- Screenshot stored in `browser_state` message with `screenshot_base64` or `image_url`

**2. Agent Loop Detects Screenshot** (`run.py` lines 393-489)
- Every iteration checks for latest `browser_state` message
- Extracts screenshot data (base64 or URL)
- Checks metadata flag `screenshot_displayed_in_chat`

**3. Create Visible Chat Message**
- If screenshot exists and not yet displayed:
  - Create assistant message with structure:
    ```json
    {
      "content": "🌐 Page Title",
      "image": {
        "base64": "...",
        "mime_type": "image/jpeg",
        "type": "user_feedback_screenshot"
      }
    }
    ```
  - Add as `type='assistant'` message
  - Set metadata: `is_image_message=True`, `image_type='user_feedback_screenshot'`

**4. Mark as Displayed**
- Update original `browser_state` message metadata
- Set `screenshot_displayed_in_chat=True`
- Prevents duplicate screenshots in subsequent iterations

**5. Frontend Renders**
- Frontend fetches messages (including new assistant message)
- Detects `image` field with `type='user_feedback_screenshot'`
- Renders as full-width card with caption header
- Screenshot appears in LEFT CHAT PANEL ✅

### Critical Implementation Points

**Why This Works:**
1. **Reuses existing screenshots** - No need to capture new ones
2. **Separate message types** - `browser_state` for LLM, `assistant` for chat display
3. **Metadata tracking** - Prevents duplicates across iterations
4. **Same structure as logo** - Uses proven message format that frontend already renders
5. **Non-intrusive** - Doesn't affect conversation logic (excluded via `is_image_message` flag)

**Key Files Modified:**
- `backend/agent/run.py` - Main screenshot-to-chat conversion logic
- `backend/agent/image_manager.py` - Helper for creating image messages
- `backend/agent/tools/web_search_tool.py` - Optional web search image capture
- `backend/agent/tools/sb_browser_tool.py` - Enhanced logging
- `frontend/src/components/thread/content/ThreadContent.tsx` - Image rendering (already existed)

## Usage Examples

### How Screenshots Appear in Chat

**User asks:** "Go to example.com and take a screenshot"

**What happens:**
1. Agent navigates to example.com
2. Browser captures screenshot → stored in `browser_state` message
3. Next iteration detects the `browser_state` message
4. Creates assistant message with screenshot
5. **Screenshot appears in chat with caption:** "🌐 Example Domain"

**User asks:** "Search for AI news"

**What happens:**
1. Agent performs web search
2. Tavily returns results with images
3. First image downloaded and converted to base64
4. Creates assistant message with image
5. **Image appears in chat with caption:** "🔍 First search result for: 'AI news'"

### For Developers: Adding Custom Image Messages

```python
from agent.image_manager import ImageManager
import base64

# In your tool (must have self.thread_id)
image_manager = ImageManager(self.thread_manager, self.thread_id)

# Add a screenshot
await image_manager.add_screenshot_message(
    screenshot_base64=base64_string,
    caption="🌐 Custom screenshot",
    source="my_tool"
)

# Add any image type
await image_manager.add_image_message(
    image_data=base64_string,
    image_type="tool_visualization",
    mime_type="image/png",
    caption="📊 Chart",
    metadata={"custom": "data"}
)
```

## Benefits

### 1. **Automatic**
- No code changes needed in browser automation
- Reuses existing screenshot capture
- Works for all browser actions (navigate, click, scroll, etc.)

### 2. **Non-Intrusive**
- Images don't interrupt conversation flow
- Agent continues normally after image messages
- Excluded from conversation logic checks via metadata

### 3. **User Feedback**
- Visual confirmation of what the agent is seeing
- Better understanding of browser actions
- Enhanced transparency and trust

### 4. **Efficient**
- No duplicate screenshot capture
- Minimal performance overhead
- Screenshots already being generated anyway

### 5. **Maintainable**
- Simple interception pattern
- Centralized in agent loop
- Easy to modify or disable

## Future Enhancements

### Potential Features:
1. **Image Compression**: Reduce base64 size for faster loading
2. **Cloud Storage**: Store images externally, reference by URL
3. **Lazy Loading**: Load images on demand
4. **Image Gallery**: Collect all images in a conversation
5. **Screenshot Annotations**: Add markers, highlights to screenshots
6. **Video Support**: Extend system to support video clips
7. **Interactive Images**: Clickable regions, zoom functionality

### Additional Image Types:
- `error_screenshot`: Capture errors visually
- `comparison_screenshot`: Before/after comparisons
- `diagram`: Generated diagrams and flowcharts
- `code_visualization`: Visual representation of code execution

## Testing

### Test Browser Screenshot Display:
1. **Start new conversation**
2. **Ask agent to navigate to a webpage** (e.g., "go to example.com")
3. **Verify screenshot appears in LEFT CHAT PANEL** with caption showing page title
4. **Check right panel** - screenshot also appears in Daytona VM actions (as before)
5. **Verify conversation continues** - agent doesn't stop or get confused
6. **Navigate to another page** - new screenshot appears for each navigation

### Test Web Search Image:
1. **Start new conversation**
2. **Ask agent to search the web** (e.g., "search for AI news")
3. **Verify first search result image appears** in chat with search query caption
4. **Subsequent searches** - no more images (only first one)

### Verify Logs:
Look for these indicators in backend logs:
- `📸 DISPLAYING browser screenshot in chat for URL: ...`
- `✅ SCREENSHOT ADDED TO CHAT for ...`
- `📸 Capturing FIRST search result image` (for web searches)

## Troubleshooting

### Screenshot Not Appearing:
- Check backend logs for errors in browser tool
- Verify browser automation is working
- Ensure screenshot validation passes
- Check S3 upload succeeds
- Verify `_first_navigation_captured` flag logic
- Check database for image message

### Images Breaking Conversation:
- Verify metadata includes `is_image_message: true`
- Check `should_exclude_from_conversation_logic()` logic
- Review conversation state checks in `run.py`

## Performance Considerations

### Base64 Encoding:
- **Pros**: Simple, no external dependencies
- **Cons**: Increases message size by ~33%
- **Mitigation**: Consider compression or external storage for large images

### First Search Detection:
- **Current**: Count all tool messages
- **Better**: Track web_search specifically in metadata
- **Best**: Dedicated flag in thread metadata

### Image Download:
- **Timeout**: 10 seconds
- **Retry**: None (fails gracefully)
- **Async**: Non-blocking search execution

## Security

### Input Validation:
- Validate image URLs before downloading
- Check file size limits
- Verify MIME types
- Sanitize captions

### Storage:
- Images stored in database as base64
- No external file storage (currently)
- Consider encryption for sensitive screenshots

### Access Control:
- Images inherit thread permissions
- Row-level security applies
- User can only see their own conversation images




# CHAT IMAGE SYSTEM. Probably the primary and last implementation version

# Chat Screenshot System Documentation

## Overview

Targeted screenshot system for displaying property images in real estate analysis conversations. Unlike general browser screenshots, **chat screenshots are explicitly requested by the agent** only when showing property-related images.

## Purpose

**Specific Use Case:** Real estate property image display
- Property photos from bbr.dk
- Orthophotos from matriklen.dk  
- Property showcase images
- Sales material screenshots

**NOT for:** General web browsing, search results, or non-property content

## How It Works

### The Agent-Controlled Approach

**Key Difference from Previous System:**
- **Before:** ALL browser actions automatically showed screenshots in chat
- **Now:** Agent explicitly calls `show_chat_screenshot` tool ONLY for property images

**Why This Is Better:**
- Targeted: Only property images appear in chat
- Intentional: Agent decides when to show screenshots
- Clean: No clutter from general browsing
- Context-aware: Captions describe the specific property

### Implementation Flow

**1. Agent Receives Property Query**
```
User: "Show me the property at Hovedgaden 123"
```

**2. Agent Navigates to Property Page**
```python
# Agent calls browser_navigate_to
await browser_navigate_to("https://bbr.dk/se-bbr-oplysninger?...")
# Browser captures screenshot (stored in browser_state)
```

**3. Agent Explicitly Requests Chat Screenshot**
```xml
<function_calls>
<invoke name="show_chat_screenshot">
<parameter name="caption">Property at Hovedgaden 123, Copenhagen</parameter>
<parameter name="property_identifier">Hovedgaden 123</parameter>
</invoke>
</function_calls>
```

**4. Tool Executes** (`message_tool.py`)
```python
# 1. Get latest browser_state message
# 2. Extract screenshot (base64 or URL)
# 3. Create assistant message with image
# 4. Add to thread → appears in chat!
```

**5. Screenshot Appears in Chat**
```
🏠 Property at Hovedgaden 123, Copenhagen
[Full-width property image displayed]
```

## Technical Implementation

### Core Components

#### 1. **show_chat_screenshot Tool** (`backend/agent/tools/message_tool.py`)

**New tool method** that the agent explicitly calls:

```python
@openapi_schema({
    "name": "show_chat_screenshot",
    "description": "Display browser screenshot in chat. Use ONLY for property images.",
    "parameters": {
        "caption": "Property description",
        "property_identifier": "Address/BFE/BBR number"
    }
})
async def show_chat_screenshot(self, caption: str, property_identifier: Optional[str] = None):
    # Get latest browser_state screenshot
    # Create assistant message with image
    # Add to thread
    # Return success
```

**Key Features:**
- Fetches latest `browser_state` message
- Extracts screenshot data
- Creates visible assistant message
- Adds property-specific metadata

#### 2. **Real Estate Prompt** (`backend/agent/prompt_real_estate_analysis.py`)

**Updated instructions** guide the agent:

```python
# 6 Finding property images and using CHAT SCREENSHOTS
- When provided with a property, ALWAYS show an image using chat screenshot feature
- Navigate to bbr.dk or matriklen.dk
- Ensure property image is visible
- Call `show_chat_screenshot` with descriptive caption
- IMPORTANT: Only use chat screenshots for property images
```

**Workflow Example:**
1. Navigate to property page
2. Verify image is visible
3. Call `show_chat_screenshot(caption="Property at...", property_identifier="...")`
4. Screenshot appears in chat

#### 3. **Frontend Rendering** (`frontend/src/components/thread/content/ThreadContent.tsx`)

**Handles `chat_screenshot` type:**
```typescript
if (imageType === 'chat_screenshot' || imageType === 'user_feedback_screenshot') {
    // Render full-width card with caption
}
```

#### 4. **Image Manager** (`backend/agent/image_manager.py`)

**Supports `chat_screenshot` type:**
```python
ImageType = Literal["logo_welcome", "chat_screenshot", "user_feedback_screenshot", "tool_visualization"]
```

### Message Structure

**Chat screenshot messages:**
```json
{
  "type": "assistant",
  "content": {
    "content": "Property at Hovedgaden 123, Copenhagen",
    "image": {
      "base64": "...",
      "mime_type": "image/jpeg",
      "type": "chat_screenshot"
    }
  },
  "metadata": {
    "is_image_message": true,
    "image_type": "chat_screenshot",
    "screenshot_source": "property_analysis",
    "property_identifier": "Hovedgaden 123"
  },
  "is_llm_message": false
}
```

## Usage Guide

### For the Agent (via Prompt)

**When to use chat screenshots:**
- ✅ Showing property images from bbr.dk
- ✅ Displaying orthophotos from matriklen.dk
- ✅ Presenting property showcase images
- ✅ Showing sales material screenshots

**When NOT to use:**
- ❌ General web browsing
- ❌ Search result pages
- ❌ Non-property related content
- ❌ Navigation/debugging screenshots

### For Developers

**Adding chat screenshot capability to other tools:**

```python
# In your tool's __init__
def __init__(self, thread_id: str, thread_manager: ThreadManager):
    self.thread_id = thread_id
    self.thread_manager = thread_manager

# To display a chat screenshot
from agent.image_manager import ImageManager

image_manager = ImageManager(self.thread_manager, self.thread_id)
await image_manager.add_image_message(
    image_data=base64_screenshot,
    image_type="chat_screenshot",
    mime_type="image/jpeg",
    caption="Property at...",
    metadata={"property_identifier": "..."}
)
```

## Benefits

### 1. **Targeted**
- Only property images appear in chat
- No clutter from general browsing
- Clean, focused user experience

### 2. **Intentional**
- Agent explicitly decides when to show screenshots
- Context-aware captions
- Property-specific metadata

### 3. **Flexible**
- Agent can choose best image source (bbr.dk vs matriklen.dk)
- Can verify image quality before displaying
- Can skip if image not relevant

### 4. **Traceable**
- Logs show when chat screenshots are requested
- Property identifiers in metadata
- Easy to debug and monitor

## Testing

### Test Property Image Display:

1. **Start new conversation**
2. **Ask:** "Show me the property at [address]"
3. **Agent should:**
   - Navigate to bbr.dk or matriklen.dk
   - Load property image
   - Call `show_chat_screenshot` tool
   - Screenshot appears in chat with property caption

### Verify Logs:

```
📸 CHAT SCREENSHOT requested: caption='Property at...', property='...'
📸 Creating chat screenshot message with X chars of base64 data
✅ CHAT SCREENSHOT ADDED to conversation: Property at...
```

### Test Non-Property Browsing:

1. **Ask:** "Search for AI news and browse some articles"
2. **Agent should:**
   - Search and browse normally
   - **NOT call show_chat_screenshot**
   - No screenshots appear in chat (only in right panel)

## Comparison: Before vs After

### Before (Automatic Screenshots)
- ✅ Easy - no tool calls needed
- ❌ Cluttered - every browser action showed screenshot
- ❌ Uncontrolled - couldn't prevent unwanted screenshots
- ❌ Generic captions - just page titles

### After (Chat Screenshots)
- ✅ Clean - only property images in chat
- ✅ Controlled - agent decides when to show
- ✅ Targeted - specific to real estate use case
- ✅ Descriptive captions - property-specific information
- ✅ Metadata - property identifiers for tracking

## Files Modified

1. **`backend/agent/tools/message_tool.py`**
   - Added `show_chat_screenshot` tool method
   - Takes caption and optional property_identifier
   - Fetches latest browser screenshot and displays in chat

2. **`backend/agent/prompt_real_estate_analysis.py`**
   - Updated section #6 with chat screenshot instructions
   - Added workflow examples
   - Clarified when to use chat screenshots

3. **`backend/agent/run.py`**
   - Removed automatic screenshot display logic
   - Updated MessageTool instantiation to include thread_id

4. **`backend/agent/image_manager.py`**
   - Added `chat_screenshot` to ImageType enum

5. **`frontend/src/components/thread/content/ThreadContent.tsx`**
   - Updated to handle `chat_screenshot` type
   - Same rendering as user_feedback_screenshot

## Key Takeaways

- **Chat screenshots are agent-controlled** - not automatic
- **Use case specific** - designed for real estate property images
- **Clean implementation** - reuses existing browser screenshots
- **No changes to browser automation** - just adds explicit display control
- **Prompt-guided** - agent knows when and how to use the feature
