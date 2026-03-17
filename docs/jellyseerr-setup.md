# Jellyseerr Setup Guide

## Overview

Jellyseerr has a **single global API key** (always admin-level). To support different permission levels in midia-mcp, we create dedicated Jellyseerr user accounts for each non-admin level.

## Architecture

```
MCP Token (admin)     → Jellyseerr API key      → Full access, auto-approve
MCP Token (poweruser) → Jellyseerr user login    → Auto-approve enabled
MCP Token (requester) → Jellyseerr user login    → Requests need approval
```

## Step 1: Get the Admin API Key

1. Open Jellyseerr → **Settings** → **General**
2. Copy the **API Key**
3. Add it to your config.yaml under `services.jellyseerr.api_key`

## Step 2: Create the Power User Account

1. Go to **Users** → **Create Local User**
2. Set:
   - Email: `poweruser@home.local` (or your choice)
   - Password: a strong password
3. After creating, click the user → **Edit Permissions**
4. Enable:
   - **Request** (can create requests)
   - **Auto-Approve** (requests are auto-approved)
   - **Auto-Approve Movies**
   - **Auto-Approve Series**
5. Save

Add credentials to config.yaml:
```yaml
services:
  jellyseerr:
    users:
      poweruser:
        email: "poweruser@home.local"
        password: "the-password-you-set"
```

## Step 3: Create the Requester Account

1. Go to **Users** → **Create Local User**
2. Set:
   - Email: `requester@home.local`
   - Password: a strong password
3. After creating, click the user → **Edit Permissions**
4. Enable **only**:
   - **Request** (can create requests)
5. Do **NOT** enable Auto-Approve
6. Save

Add credentials to config.yaml:
```yaml
services:
  jellyseerr:
    users:
      requester:
        email: "requester@home.local"
        password: "the-password-you-set"
```

## Step 4: Map MCP Tokens

In your config.yaml `auth_tokens`:

```yaml
auth_tokens:
  - token: "sk-admin-..."
    description: "Admin"
    permissions:
      jellyseerr:
        actions: ["*"]
        auth_level: admin           # Uses API key

  - token: "sk-power-..."
    description: "Power User"
    permissions:
      jellyseerr:
        actions: ["search", "request", "get_requests"]
        auth_level: poweruser       # Logs in as poweruser@home.local

  - token: "sk-user-..."
    description: "Regular User"
    permissions:
      jellyseerr:
        actions: ["search", "request", "get_requests"]
        auth_level: requester       # Logs in as requester@home.local
```

## How It Works

1. User connects to midia-mcp with their token
2. midia-mcp checks the token's `auth_level` for Jellyseerr
3. For `admin`: uses the API key directly (X-Api-Key header)
4. For `poweruser`/`requester`: authenticates via `/api/v1/auth/local` with the corresponding email/password, gets a session cookie
5. All subsequent Jellyseerr API calls use that auth context

## Troubleshooting

### "Jellyseerr login failed (401)"
- Check email/password are correct
- Ensure the user account exists in Jellyseerr
- Make sure you created a **Local** user (not Plex/Jellyfin)

### Power user requests still need approval
- Go to the user's permissions in Jellyseerr
- Ensure **Auto-Approve**, **Auto-Approve Movies**, and **Auto-Approve Series** are all enabled

### Admin can't see settings
- Make sure `api_key` is set in config.yaml
- The API key comes from Settings → General in Jellyseerr
