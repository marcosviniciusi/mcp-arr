# midia-mcp v3.1

Servidor MCP (Model Context Protocol) para gerenciamento completo de uma stack de mídia com **RBAC granular por app, por ação e por categoria**, suporte a **3 transportes**, **multi-instância** e **16 serviços** integrados.

## Serviços Suportados

| Serviço | Tools | Categorias | Descrição |
|---|---|---|---|
| **Sonarr** | 39 | read, search, manage | Gerenciamento de séries TV (API v3 completa) |
| **Radarr** | 38 | read, search, manage | Gerenciamento de filmes (API v3 completa) |
| **Prowlarr** | 22 | read, search, manage | Gerenciamento de indexadores (API v1 completa) |
| **Lidarr** | 37 | read, search, manage | Gerenciamento de música (API v1 completa) |
| **Whisparr** | 10 | read, search, manage | Gerenciamento de conteúdo adulto |
| **Bazarr** | 18 | read, manage, delete | Gerenciamento de legendas |
| **Autobrr** | 10 | read, manage | Automação de torrents |
| **Jellyfin** | 14 | read, playback, manage, admin | Media server |
| **Emby** | 14 | read, playback, manage, admin | Media server |
| **Jellyseerr** | 15 | read, request, manage, admin | Requisições de mídia (3 auth levels) |
| **Seerr** | 14 | read, request, manage, admin | Requisições de mídia (Overseerr-compatible) |
| **qBittorrent** | 12 | read, manage, config | Cliente de torrent |
| **NZBGet** | 12 | read, manage, config | Cliente de usenet |
| **TMDB** | 18 | read, search, discover, rate | The Movie Database (API externa) |
| **MyAnimeList** | 15 | read, search, list, manage | Anime/manga database (API externa) |
| **Ryot** | 13 | read, search, track, manage | Media tracking self-hosted |

**~301 tools** no total. Cada serviço é opcional — apenas os configurados expõem ferramentas.

### Multi-instância

Sonarr, Radarr, Bazarr, Lidarr, Whisparr, Autobrr e Jellyfin suportam múltiplas instâncias via prefixo:

```yaml
services:
  sonarr:
    url: "http://sonarr:8989"
    api_key: "key"
  sonarr_animes:
    url: "http://sonarr-animes:8989"
    api_key: "key"
  radarr:
    url: "http://radarr:7878"
    api_key: "key"
  radarr_animes:
    url: "http://radarr-animes:7878"
    api_key: "key"
```

Cada instância registra tools com seu próprio prefixo (ex: `radarr_animes_get_movies`) e o RBAC resolve automaticamente.

## Arquitetura

```
┌─────────────────────────┐      ┌───────────────────────────────────────────────────┐
│  Claude Desktop /       │      │  midia-mcp (K8s / local)                          │
│  OpenWebUI / LobeChat   │      │                                                   │
│                         │      │  Auth ─── RBAC ──── Tools ──── Services            │
│  Token: admin-...       │─────▶│   │        │        │                              │
│                         │ SSE/ │   │    ┌────┴────┐   ├── Sonarr(2) / Radarr(2)     │
│  (sem credenciais)      │ HTTP │   │    │ ACTION  │   ├── Prowlarr / Lidarr         │
│                         │      │   │    │   MAP   │   ├── Whisparr / Autobrr        │
└─────────────────────────┘      │   │    │ + deny  │   ├── Bazarr(2)                 │
                                 │   │    └─────────┘   ├── Jellyfin / Emby           │
                                 │   ▼                  ├── Seerr / Jellyseerr        │
                                 │  Audit Log ──▶ OTel  ├── qBittorrent / NZBGet      │
                                 │                      └── TMDB / MAL / Ryot         │
                                 └───────────────────────────────────────────────────┘
```

Usuários só precisam de um **token** e uma **URL**. Todas as credenciais de serviços ficam dentro do cluster.

## Início Rápido

### Instalar & Build

```bash
npm install
npm run build
```

### Configuração

O midia-mcp usa um arquivo YAML de configuração. Defina o path via variável de ambiente:

```bash
export MIDIA_MCP_CONFIG=./tokens.yaml
```

Ou coloque no path padrão: `/etc/midia-mcp/config.yaml`

Veja [`examples/config.yaml`](examples/config.yaml) para um exemplo completo com todos os 16 serviços.

### Modo Local (stdio)

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

### Modo Remoto (SSE)

```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.example.com/sse?token=admin-your-token"
    }
  }
}
```

### Modo Remoto (Streamable-HTTP)

```json
{
  "mcpServers": {
    "midia-mcp": {
      "url": "https://midia-mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer admin-your-token"
      }
    }
  }
}
```

## Transportes

| Transporte | Config | Endpoint | Uso |
|---|---|---|---|
| `stdio` | `transport: stdio` | (processo local) | Claude Desktop local, testes |
| `sse` | `transport: sse` | GET `/sse`, POST `/messages` | K8s, remoto (Claude Desktop, LobeChat) |
| `streamable-http` | `transport: streamable-http` | POST `/mcp` | K8s, remoto (OpenWebUI, streaming) |

## Sistema de Permissões (RBAC)

### Visão Geral

Cada token define **quais apps** pode acessar e **quais ações** dentro de cada app. O sistema suporta:

- **Wildcard**: `actions: ["*"]` — todas as ações
- **Ação exata**: `actions: ["get_series"]` — ação específica
- **Categoria**: `actions: ["@read"]` — expande para todas as ações da categoria `read`
- **Glob pattern**: `actions: ["get_*"]` — match por prefixo
- **Deny list**: `deny_actions: ["delete_*"]` — blocklist (tem precedência sobre allowlist)
- **Multi-instância**: permissões por instância (`sonarr_animes: { actions: ["@read"] }`)

### Categorias de Ação por Serviço

| Serviço | @read | @search | @manage | @request | @admin | @config | @playback | @discover | @rate | @track | @list | @delete |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sonarr | ✅ | ✅ | ✅ | | | | | | | | | |
| radarr | ✅ | ✅ | ✅ | | | | | | | | | |
| prowlarr | ✅ | ✅ | ✅ | | | | | | | | | |
| lidarr | ✅ | ✅ | ✅ | | | | | | | | | |
| whisparr | ✅ | ✅ | ✅ | | | | | | | | | |
| bazarr | ✅ | | ✅ | | | | | | | | | ✅ |
| autobrr | ✅ | | ✅ | | | | | | | | | |
| jellyfin | ✅ | | ✅ | | ✅ | | ✅ | | | | | |
| emby | ✅ | | ✅ | | ✅ | | ✅ | | | | | |
| jellyseerr | ✅ | | ✅ | ✅ | ✅ | | | | | | | |
| seerr | ✅ | | ✅ | ✅ | ✅ | | | | | | | |
| qbittorrent | ✅ | | ✅ | | | ✅ | | | | | | |
| nzbget | ✅ | | ✅ | | | ✅ | | | | | | |
| tmdb | ✅ | ✅ | | | | | | ✅ | ✅ | | | |
| mal | ✅ | ✅ | ✅ | | | | | | | | ✅ | |
| ryot | ✅ | ✅ | ✅ | | | | | | | ✅ | | |

### Auth Levels (Jellyseerr / Seerr)

| `auth_level` | Método Auth | Comportamento |
|---|---|---|
| `admin` | API key (`X-Api-Key`) | Acesso total, auto-approve |
| `poweruser` | Cookie (login do usuário) | Requests auto-aprovados |
| `requester` | Cookie (login do usuário) | Requests precisam de aprovação |

### Exemplos de Perfis de Token

**Admin — acesso total a todas as instâncias:**
```yaml
- token: "admin-..."
  description: "Platform Admin"
  permissions:
    sonarr: { actions: ["*"] }
    sonarr_animes: { actions: ["*"] }
    radarr: { actions: ["*"] }
    radarr_animes: { actions: ["*"] }
    prowlarr: { actions: ["*"] }
    lidarr: { actions: ["*"] }
    whisparr: { actions: ["*"] }
    bazarr: { actions: ["*"] }
    bazarr_animes: { actions: ["*"] }
    autobrr: { actions: ["*"] }
    emby: { actions: ["*"] }
    jellyfin: { actions: ["*"] }
    seerr: { actions: ["*"], auth_level: admin }
    tmdb: { actions: ["*"] }
    mal: { actions: ["*"] }
    ryot: { actions: ["*"] }
```

**Consumidor — buscar, descobrir e rastrear:**
```yaml
- token: "user-..."
  description: "Media Consumer"
  permissions:
    seerr: { actions: ["@read", "@request"] }
    emby: { actions: ["@read", "@playback"] }
    jellyfin: { actions: ["@read", "@playback"] }
    tmdb: { actions: ["@read", "@search", "@discover"] }
    mal: { actions: ["@read", "@search", "@list"] }
    ryot: { actions: ["@read", "@search", "@track"] }
```

**Monitoramento — leitura somente:**
```yaml
- token: "mon-..."
  description: "Monitoring"
  permissions:
    sonarr: { actions: ["@read"] }
    radarr: { actions: ["@read"] }
    prowlarr: { actions: ["@read"] }
    lidarr: { actions: ["@read"] }
    emby: { actions: ["@read"] }
    jellyfin: { actions: ["@read"] }
    ryot: { actions: ["@read"] }
```

Referência completa de permissões: [`docs/auth-permissions.md`](docs/auth-permissions.md)

## Configuração

```yaml
transport: sse                    # stdio | sse | streamable-http
host: "0.0.0.0"
port: 3000

otel:
  enabled: true
  endpoint: "http://otel-collector:4318"
  service_name: "midia-mcp"

services:
  # *arr Stack (multi-instância)
  sonarr: { url: "http://sonarr:8989", api_key: "key" }
  sonarr_animes: { url: "http://sonarr-animes:8989", api_key: "key" }
  radarr: { url: "http://radarr:7878", api_key: "key" }
  radarr_animes: { url: "http://radarr-animes:7878", api_key: "key" }
  prowlarr: { url: "http://prowlarr:9696", api_key: "key" }
  lidarr: { url: "http://lidarr:8686", api_key: "key" }
  whisparr: { url: "http://whisparr:6969", api_key: "key" }

  # Subtitles
  bazarr: { url: "http://bazarr:6767", api_key: "key" }
  bazarr_animes: { url: "http://bazarr-animes:6767", api_key: "key" }

  # Automation
  autobrr: { url: "http://autobrr:7474", api_key: "token" }

  # Media Servers
  emby: { url: "http://emby:8096", api_key: "key" }
  jellyfin: { url: "http://jellyfin:8096", api_key: "key" }

  # Request Managers
  seerr:
    url: "http://seerr:5055"
    api_key: "admin-key"
    users:
      vinicima: { email: "vinicima", password: "password" }

  # External Databases
  tmdb: { api_key: "tmdb-v4-read-access-token" }
  mal: { client_id: "mal-client-id" }

  # Media Tracking
  ryot: { url: "http://ryot:8000", api_token: "ryot-token" }

auth_tokens:
  - token: "admin-..."
    description: "Admin"
    permissions:
      sonarr: { actions: ["*"] }
      # ...
```

Gerar tokens: `openssl rand -hex 32 | sed 's/^/admin-/'`

## Deploy Kubernetes

### Estrutura

```
deploy/
├── kustomization.yaml
├── namespace.yaml              # mcp-arr
├── configmap.yaml              # Config não-sensível
├── deployment.yaml             # 2 réplicas, security context restritivo
├── service.yaml                # LoadBalancer
└── sealedsecret-config.yaml    # SealedSecret (kubeseal)
```

### Deploy

1. **Selar config:**
```bash
./scripts/seal-secrets.sh --config tokens.yaml --fetch-cert --controller-name sealed-secrets-controller
```

2. **Build e push da imagem:**
```bash
docker build -t marcosviniciusi/midia-mcp:v3.1 .
docker push marcosviniciusi/midia-mcp:v3.1
```

3. **Aplicar manifests:**
```bash
kubectl apply -k deploy/
```

4. **Verificar:**
```bash
kubectl -n mcp-arr get pods
kubectl -n mcp-arr logs -f deployment/midia-mcp
curl http://192.168.253.41/health
```

O `config.yaml` (com todas as credenciais) é montado como Secret volume em `/etc/midia-mcp/config.yaml`. Nenhuma credencial é exposta aos clientes.

### SealedSecrets

Todos os secrets usam [SealedSecrets](https://github.com/bitnami-labs/sealed-secrets) para armazenamento GitOps seguro:

```bash
# Com acesso ao cluster (busca cert automaticamente)
./scripts/seal-secrets.sh --config tokens.yaml --fetch-cert --controller-name sealed-secrets-controller

# Com certificado local
./scripts/seal-secrets.sh --config tokens.yaml --cert ./sealed-secrets-cert.pem
```

## Observabilidade

Toda chamada de tool emite logs de auditoria estruturados via OpenTelemetry.

| Atributo | Descrição |
|---|---|
| `audit.token_description` | Nome legível do token |
| `audit.token_hash` | Hash SHA256 (12 chars) — token real nunca logado |
| `audit.app` | Serviço alvo |
| `audit.action` | Ação executada |
| `audit.action_category` | Categoria da ação (read, manage, search, etc.) |
| `audit.status` | `success`, `error` ou `denied` |
| `audit.duration_ms` | Tempo de execução |

```
Platform Admin → radarr.add_movie [manage] [success]
Regular User → sonarr.delete_series [manage] [DENIED]
Consumer → tmdb.search_multi [search] [success]
```

## Segurança

- **Timing-safe** comparação de tokens (`crypto.timingSafeEqual`)
- **Rate limiting**: 10 tentativas por minuto por IP → HTTP 429
- **Token hashing**: apenas SHA256 truncado em logs (12 chars)
- **Todos os endpoints protegidos** exceto `/health`
- **Credenciais isoladas**: API keys e passwords ficam dentro do pod/cluster
- **SealedSecrets**: secrets encriptados seguros para git
- **Security context**: non-root (UID 1000), readOnlyRootFilesystem, no privilege escalation

## Estrutura do Projeto

```
midia-mcp/
├── deploy/                          # Kustomize manifests + SealedSecrets
├── docs/                            # Documentação detalhada
│   ├── auth-permissions.md          # Referência completa de permissões
│   ├── audit-logging.md             # OTel + SigNoz
│   ├── claude-desktop-config.md     # Configuração de clientes
│   └── jellyseerr-setup.md          # Setup do Jellyseerr
├── examples/                        # Exemplos de configuração
│   └── config.yaml                  # Exemplo completo (16 serviços)
├── scripts/
│   └── seal-secrets.sh              # Wrapper do kubeseal
├── src/
│   ├── index.ts                     # Entry point, config, transportes
│   ├── auth.ts                      # Validação de tokens + rate limiting
│   ├── rbac.ts                      # RBAC per-app/action com categorias
│   ├── action-map.ts                # ACTION_MAP — categorias por serviço
│   ├── server-wrapper.ts            # Guard de permissões + audit
│   ├── logger.ts                    # OTel audit logging
│   ├── clients/                     # Clientes de API
│   │   ├── arr-client.ts            # Sonarr / Radarr / Prowlarr / Lidarr / Whisparr
│   │   ├── bazarr-client.ts         # Bazarr (X-API-KEY)
│   │   ├── autobrr-client.ts        # Autobrr (X-API-Token)
│   │   ├── jellyfin-client.ts       # Jellyfin (MediaBrowser Token)
│   │   ├── emby-client.ts           # Emby (API key)
│   │   ├── jellyseerr-client.ts     # Jellyseerr (API key + cookie)
│   │   ├── seerr-client.ts          # Seerr/Overseerr (API key + cookie)
│   │   ├── qbittorrent-client.ts    # qBittorrent (cookie)
│   │   ├── nzbget-client.ts         # NZBGet (JSON-RPC)
│   │   ├── tmdb-client.ts           # TMDB (Bearer token)
│   │   ├── mal-client.ts            # MyAnimeList (Client ID + OAuth2)
│   │   └── ryot-client.ts           # Ryot (GraphQL + Bearer)
│   └── tools/                       # Definições de tools MCP
│       ├── sonarr.ts                # 39 tools
│       ├── radarr.ts                # 38 tools
│       ├── lidarr.ts                # 37 tools
│       ├── prowlarr.ts              # 22 tools
│       ├── bazarr.ts                # 18 tools
│       ├── tmdb.ts                  # 18 tools
│       ├── jellyseerr.ts            # 15 tools
│       ├── mal.ts                   # 15 tools
│       ├── jellyfin.ts              # 14 tools
│       ├── emby.ts                  # 14 tools
│       ├── seerr.ts                 # 14 tools
│       ├── ryot.ts                  # 13 tools
│       ├── qbittorrent.ts           # 12 tools
│       ├── nzbget.ts                # 12 tools
│       ├── whisparr.ts              # 10 tools
│       └── autobrr.ts               # 10 tools
├── tokens.yaml                      # Config principal (gitignored)
├── Dockerfile
└── package.json
```

## Desenvolvimento

```bash
npm run dev    # Executar com tsx (sem build)
npm run build  # Compilar TypeScript
npm start      # Executar versão compilada
```

## Roadmap

- [ ] Suporte a OIDC/SSO para autenticação (além de tokens estáticos)
- [ ] Plex media server integration
- [ ] Readarr (ebooks) integration
- [ ] Dashboard web para gerenciamento de tokens
- [ ] Health check detalhado por serviço (status de cada integração)
- [ ] Webhook notifications (Discord/Telegram) em ações críticas
- [ ] Cache de respostas para APIs externas (TMDB, MAL) com TTL configurável
- [ ] Métricas Prometheus endpoint (`/metrics`)
- [ ] Token rotation sem downtime
- [ ] Rate limiting por token (além de por IP)

## Licença

MIT
