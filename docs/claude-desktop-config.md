# Claude Desktop Configuration

## Local Mode (stdio)

For local development, Claude Desktop runs the MCP server as a subprocess. No auth needed.

```json
{
  "mcpServers": {
    "midia-mcp": {
      "command": "node",
      "args": ["/path/to/midia-mcp/dist/index.js"],
      "env": {
        "MIDIA_MCP_CONFIG": "/path/to/midia-mcp/tokens.yaml"
      }
    }
  }
}
```

## Remote Mode (SSE)

When midia-mcp runs in K8s or a remote server, configure only the URL and token:

```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.example.com/sse?token=sk-your-token-here"
    }
  }
}
```

No credentials are exposed to the client — all service API keys and passwords stay inside the cluster.

## Token via Authorization Header

Some MCP clients support custom headers. If so, use:

```
Authorization: Bearer sk-your-token-here
```

## Examples per User Profile

### Admin
```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.home.local/sse?token=sk-admin-token"
    }
  }
}
```

Full access to all 7 services and all tools.

### Family Member
```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.home.local/sse?token=sk-family-token"
    }
  }
}
```

Can search and request media via Jellyseerr and browse Emby catalog. Requests need admin approval.

### Power User
```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.home.local/sse?token=sk-power-token"
    }
  }
}
```

Can request media without needing approval. Can browse Emby catalog.
