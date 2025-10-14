## How to enable chat screenshots (file attachments) in the UI

By default, chat screenshots and file uploads are disabled at runtime via an environment flag to reduce data ingress.

### Toggle

- Frontend env var: `NEXT_PUBLIC_DISABLE_CHAT_SCREENSHOTS`
- Default: disabled (true) when the variable is unset

### Enable screenshots/uploads

1. Set the environment variable to false in your frontend environment:

```bash
# .env.local or deployment env
NEXT_PUBLIC_DISABLE_CHAT_SCREENSHOTS=false
```

2. Rebuild/redeploy the frontend.

This will:
- Show the attachment button in the chat input
- Re-enable drag-and-drop file uploads into the chat

### Disable again

Set the variable to true (or remove it entirely):

```bash
NEXT_PUBLIC_DISABLE_CHAT_SCREENSHOTS=true
```

Then rebuild/redeploy the frontend.

### Notes
- The flag is read on the client via `isChatScreenshotsDisabled()` in `frontend/src/lib/config.ts`.
- When disabled, the chat hides the attachments UI and ignores drag/drop uploads.

