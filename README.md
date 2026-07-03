# ncentral-mcp

MCP (Model Context Protocol) server for [N-able N-central](https://www.n-able.com/products/n-central-rmm).
It exposes the N-central REST API (`/api`) to Claude and other MCP clients: org units,
device inventory, monitoring, scheduled tasks, custom properties, maintenance windows,
and access groups.

Built on [`@wyre-technology/node-ncentral`](https://github.com/wyre-technology/node-ncentral).

## Decision-tree navigation

To keep the tool surface small, the server uses decision-tree navigation. The initial
`tools/list` exposes only the navigation tools; call `ncentral_navigate` with a domain
name to load that domain's tools (plus `ncentral_back` to return to the menu).

| Tool | Description |
|------|-------------|
| `ncentral_navigate` | Navigate to a domain (`system`, `orgs`, `devices`, `monitoring`, `tasks`, `custom-properties`, `maintenance`, `access-groups`) |
| `ncentral_back` | Return to the domain menu |
| `ncentral_status` | Connectivity check — calls the health + server-info endpoints |

## Tool catalog

### system

| Tool | Description |
|------|-------------|
| `ncentral_health` | API health (server start/current time) |
| `ncentral_server_info` | N-central server + API-Service version info |
| `ncentral_validate_token` | Validate the configured API token |

### orgs

| Tool | Description |
|------|-------------|
| `ncentral_list_service_orgs` | List service organizations |
| `ncentral_list_customers` | List customers (optionally scoped to a service org via `soId`) |
| `ncentral_get_customer` | Get a customer by id |
| `ncentral_list_sites` | List sites (optionally scoped to a customer via `customerId`) |
| `ncentral_get_site` | Get a site by id |
| `ncentral_list_org_units` | List all org units |
| `ncentral_get_org_unit` | Get an org unit by id |
| `ncentral_list_org_unit_children` | List an org unit's children |
| `ncentral_get_registration_token` | Get the agent/probe registration token for a customer, site, or org unit (**sensitive — treat as a secret**) |

### devices

| Tool | Description |
|------|-------------|
| `ncentral_list_devices` | List devices (supports saved `filterId`; offers to narrow scope when unfiltered) |
| `ncentral_get_device` | Get a device by id |
| `ncentral_get_device_assets` | Device asset/inventory info |
| `ncentral_get_device_lifecycle` | Asset lifecycle info (warranty, purchase, replacement) |
| `ncentral_update_device_lifecycle` | ⚠ HIGH-IMPACT — update lifecycle info |
| `ncentral_get_device_service_status` | Service monitor status |
| `ncentral_list_devices_by_org_unit` | List devices under an org unit |
| `ncentral_list_device_filters` | List saved device filters |

### monitoring

| Tool | Description |
|------|-------------|
| `ncentral_list_active_issues` | Active issues for an org unit (customers/sites only) |
| `ncentral_list_job_statuses` | Job statuses for an org unit |

### tasks

| Tool | Description |
|------|-------------|
| `ncentral_list_device_tasks` | Scheduled tasks for a device |
| `ncentral_get_task` | Get a scheduled task |
| `ncentral_get_task_status` | Aggregated task status |
| `ncentral_get_task_status_details` | Per-device task status details |
| `ncentral_create_direct_task` | ⚠ HIGH-IMPACT — creates a direct task that executes **immediately** on a live endpoint |

### custom-properties

| Tool | Description |
|------|-------------|
| `ncentral_list_org_custom_properties` | List an org unit's custom properties |
| `ncentral_get_org_custom_property` | Get one org unit custom property |
| `ncentral_update_org_custom_property` | ⚠ HIGH-IMPACT — overwrite an org unit custom property value |
| `ncentral_list_device_custom_properties` | List a device's custom properties |
| `ncentral_get_device_custom_property` | Get one device custom property |
| `ncentral_update_device_custom_property` | ⚠ HIGH-IMPACT — overwrite a device custom property value |

### maintenance

| Tool | Description |
|------|-------------|
| `ncentral_list_maintenance_windows` | List a device's maintenance windows |
| `ncentral_add_maintenance_windows` | ⚠ HIGH-IMPACT — add maintenance windows to devices |
| `ncentral_delete_maintenance_windows` | ⚠ DESTRUCTIVE — IRREVERSIBLE — delete maintenance window schedules |

### access-groups

| Tool | Description |
|------|-------------|
| `ncentral_list_access_groups` | List access groups for an org unit |
| `ncentral_get_access_group` | Get an access group by id |
| `ncentral_create_device_access_group` | ⚠ HIGH-IMPACT — create a device access group |
| `ncentral_create_org_unit_access_group` | ⚠ HIGH-IMPACT — create an org unit access group |

All list tools accept the standard N-central pagination parameters (`pageNumber`,
`pageSize`, `sortBy`, `sortOrder`) and include pagination metadata in the response so
clients can page through large result sets. Empty results return an explicit
"No X found" error rather than an empty array.

## Generating an N-central User-API Token

The server authenticates with a permanent **User-API Token (JWT)** generated in the
N-central UI:

1. Log into N-central as (or as an admin of) the API user. A dedicated least-privilege
   API service account is strongly recommended.
2. Go to **Administration → User Management → Users** and open the user.
3. Open the **API Access** tab.
4. Click **Generate JSON Web Token** and copy the token.

The token inherits the user's role and org unit access. The server exchanges it for
short-lived access/refresh tokens automatically — you only ever configure the User-API
Token.

## Standalone usage

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NCENTRAL_SERVER_URL` | yes | Base URL of your N-central server, e.g. `https://ncentral.example.com` |
| `NCENTRAL_JWT` | yes | User-API Token (JWT) generated in the N-central UI |
| `MCP_TRANSPORT` | no | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | no | HTTP port (default `8080`) |
| `MCP_HTTP_HOST` | no | HTTP bind host (default `0.0.0.0`) |
| `AUTH_MODE` | no | `env` (default) or `gateway` (read per-request credential headers) |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error` — all logs go to stderr |

### stdio (Claude Desktop / local MCP client)

```bash
npm install && npm run build

NCENTRAL_SERVER_URL=https://ncentral.example.com \
NCENTRAL_JWT=eyJ... \
node dist/index.js
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "ncentral": {
      "command": "node",
      "args": ["/path/to/ncentral-mcp/dist/index.js"],
      "env": {
        "NCENTRAL_SERVER_URL": "https://ncentral.example.com",
        "NCENTRAL_JWT": "eyJ..."
      }
    }
  }
}
```

### HTTP (Streamable HTTP)

```bash
MCP_TRANSPORT=http \
NCENTRAL_SERVER_URL=https://ncentral.example.com \
NCENTRAL_JWT=eyJ... \
node dist/http.js
```

Endpoints: `POST /mcp` (MCP protocol, stateless JSON responses) and `GET /health`
(liveness — never requires credentials).

### Docker

```bash
docker run -p 8080:8080 \
  -e AUTH_MODE=env \
  -e NCENTRAL_SERVER_URL=https://ncentral.example.com \
  -e NCENTRAL_JWT=eyJ... \
  ghcr.io/wyre-technology/ncentral-mcp:latest
```

## Gateway mode

Behind the WYRE MCP gateway, set `AUTH_MODE=gateway` (the container default). The
gateway injects per-request credential headers:

| Header | Maps to |
|--------|---------|
| `x-ncentral-server-url` | `NCENTRAL_SERVER_URL` |
| `x-ncentral-jwt` | `NCENTRAL_JWT` |

Requests without credentials are never rejected — `tools/list` works without them, and
`tools/call` fails with a clear configuration error. When the headers change between
requests (different tenant), the internal API client is rebuilt automatically.

## On-prem N-central notes

- **Per-server URL**: N-central is deployed per-installation (self-hosted or N-able
  hosted). There is no shared cloud endpoint — always configure your own server's FQDN.
- **Private CA / self-signed certificates**: if your N-central server's TLS certificate
  is signed by a private CA, mount the CA certificate into the container and point
  Node.js at it:

  ```bash
  docker run -p 8080:8080 \
    -v /path/to/ca.pem:/certs/ca.pem:ro \
    -e NODE_EXTRA_CA_CERTS=/certs/ca.pem \
    -e NCENTRAL_SERVER_URL=https://ncentral.internal.example.com \
    -e NCENTRAL_JWT=eyJ... \
    ghcr.io/wyre-technology/ncentral-mcp:latest
  ```

  **Never disable TLS verification** (`NODE_TLS_REJECT_UNAUTHORIZED=0`) — it exposes
  your API token to interception. Use `NODE_EXTRA_CA_CERTS` instead.

## NODE_ENV notes

The container sets `NODE_ENV=production`. The server itself does not branch on
`NODE_ENV`; it exists for Node.js ecosystem conventions (dependency pruning, library
behavior). For local development leave it unset. Logging verbosity is controlled by
`LOG_LEVEL`, not `NODE_ENV`.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint 9 flat config
npm test            # vitest (SDK fully mocked — no live server needed)
npm run build       # tsup → dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Releases are automated with
semantic-release; the container image is published to
`ghcr.io/wyre-technology/ncentral-mcp`.

## License

[Apache-2.0](LICENSE)
