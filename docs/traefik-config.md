# Configuracao do Traefik para midia-mcp

O midia-mcp expoe endpoints SSE e Streamable HTTP via Traefik:

| Subdominio | Porta | Protocolo | Clientes |
|------------|-------|-----------|----------|
| `mcp-arr.vinicima.com` | 80 | SSE + Streamable HTTP (MCP) | Claude Desktop, OpenWebUI, LobeChat |

## Middlewares

```toml
# Desabilitar buffering para SSE/streaming
[http.middlewares.mcp-arr-streaming.headers]
  [http.middlewares.mcp-arr-streaming.headers.customResponseHeaders]
    X-Accel-Buffering = "no"

# CORS para OpenWebUI (requisicoes do browser)
[http.middlewares.mcp-arr-cors.headers]
  accessControlAllowOriginList = ["https://openwebui.vinicima.com"]
  accessControlAllowMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  accessControlAllowHeaders = ["Content-Type", "Authorization", "X-Auth-Token"]
  accessControlMaxAge = 86400
```

> Substitua `https://openwebui.vinicima.com` pela URL do seu OpenWebUI.

## Router — `mcp-arr.vinicima.com`

Para todos os clientes MCP: Claude Desktop, OpenWebUI, LobeChat.

```toml
[http.routers.mcp-arr]
  rule = "Host(`mcp-arr.vinicima.com`)"
  entryPoints = ["websecure"]
  middlewares = ["mcp-arr-cors", "mcp-arr-streaming"]
  service = "mcp-arr-service"
  [http.routers.mcp-arr.tls]
    certResolver = "letsencrypt"

[http.services.mcp-arr-service.loadBalancer]
  passHostHeader = true
  [[http.services.mcp-arr-service.loadBalancer.servers]]
    url = "http://192.168.253.41:80"
  [http.services.mcp-arr-service.loadBalancer.responseForwarding]
    flushInterval = "1ms"
```

## DNS

```
mcp-arr.vinicima.com  →  <IP-DO-TRAEFIK>
```

## Endpoints

| Endpoint | Metodo | Transporte | Uso |
|----------|--------|------------|-----|
| `/sse` | GET | SSE | Claude Desktop, LobeChat |
| `/messages` | POST | SSE | Mensagens via SSE session |
| `/mcp` | POST | Streamable HTTP | OpenWebUI |
| `/health` | GET | HTTP | Health check (sem auth) |

## Exemplos de Conexao

### Claude Desktop (SSE)
```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://mcp-arr.vinicima.com/sse?token=admin-YOUR_TOKEN"
    }
  }
}
```

### OpenWebUI (Streamable HTTP)
```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://mcp-arr.vinicima.com/mcp",
      "headers": {
        "Authorization": "Bearer admin-YOUR_TOKEN"
      }
    }
  }
}
```

## Notas

- `flushInterval = "1ms"`: forca o Traefik a enviar os chunks imediatamente (essencial para SSE).
- `X-Accel-Buffering = "no"`: sinaliza para proxies intermediarios nao bufferizarem.
- CORS: o `accessControlAllowOriginList` deve conter a URL exata do OpenWebUI (com protocolo). **Nao use `*`** em producao.
- O LoadBalancer IP `192.168.253.41` e o IP interno do servico no cluster — o Traefik externo precisa ter acesso a rede do cluster.
- Auth: todos os endpoints exceto `/health` requerem token (query param ou Bearer header).
