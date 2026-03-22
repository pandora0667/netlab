# Netlab

Netlab is a TypeScript full-stack network utility app built on a single Express server.  
In development, the server runs Vite in middleware mode and serves the React client from the same process.  
In production, the server serves the built client from `dist/public`.

## Current Stack

- Frontend: React 18, Wouter, SWR, React Hook Form, Zod, Tailwind CSS, shadcn/ui
- Backend: Express, `ws`, SSE, Node DNS/socket APIs
- Tooling: Vite, TypeScript, tsx, esbuild, pnpm

## Implemented Tools

- IP checker
- DNS lookup with selectable public resolvers and custom resolver validation
- DNS propagation checker with request-scoped WebSocket updates
- Subnet calculator
- Ping tool with WebSocket progress
- WHOIS lookup
- Port scanner with SSE progress and JSON/CSV export

## Repository Layout

```text
.
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── domains/
│       └── lib/
├── server/
│   ├── common/
│   ├── config/
│   ├── data/
│   ├── lib/
│   ├── middleware/
│   ├── modules/
│   └── src/lib/
├── dist/
├── package.json
├── pnpm-lock.yaml
├── .nvmrc
├── tsconfig.json
└── vite.config.ts
```

## Prerequisites

- Node.js 24.x LTS
- pnpm 10.x

Examples below use `pnpm`.

You can pin the local Node runtime with `.nvmrc`.

## Install

```bash
pnpm install
```

For local development, a `.env` file is optional. For production, copy `.env.example` to `.env` and adjust the runtime limits for your deployment.

## Development

```bash
pnpm run dev
```

The Express server starts on `http://localhost:8080`.

## Test

```bash
pnpm run test
pnpm run typecheck
```

The current automated tests cover validation utilities plus HTTP route regressions for both legacy `/api/*` endpoints and the new `/api/v1/*` envelope-based endpoints. Browser flows are not yet covered.

## Build

```bash
pnpm run build
pnpm run start
```

## Docker

The production container now follows the same runtime standard as local development:

- `node:24-bookworm-slim`
- `pnpm` via Corepack
- multi-stage build
- production-only dependencies in the final image

Build and run:

```bash
docker build -t netlab:latest .
docker run --rm -p 8080:8080 --env-file .env netlab:latest
```

## Docker Compose

You can also run the app with Docker Compose:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f netlab
```

Stop it with:

```bash
docker compose down
```

Compose uses `compose.yaml`, exposes the app on port `8080` by default, mounts `logs/` into the container, and includes a `/healthz` health check. If you want custom limits or a different port, copy `.env.example` to `.env` and adjust the values before starting the stack.

## Search and AI Discovery

Netlab now exposes discovery signals for both traditional search and AI-assisted search surfaces:

- route-specific title, description, canonical URL, and JSON-LD in the initial HTML response
- `robots.txt`, `sitemap.xml`, `llms.txt`, and `llms-full.txt` at the site root
- `favicon.ico` plus PNG/SVG variants
- optional IndexNow support for faster URL refresh on participating engines

If you want freshness signals for Bing/Copilot-compatible crawlers, set `INDEXNOW_KEY` in `.env` and submit current sitemap URLs with:

```bash
pnpm run indexnow:submit
```

When `INDEXNOW_KEY` is configured, the server exposes the required key file at `/indexnow-key.txt`.

## API Versioning

- Legacy endpoints remain available under `/api/*` for compatibility.
- New backend work should target `/api/v1/*`.
- Frontend HTTP calls now route through `client/src/domains/*` and target `/api/v1/*` by default.
- `/api/v1/*` responses use a unified envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "requestId": "req_..."
}
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable message"
  },
  "requestId": "req_..."
}
```

Current v1 modules:

- `/api/v1/network`
- `/api/v1/dns`
- `/api/v1/dns-propagation`
- `/api/v1/port-scans`

Transport exceptions:

- WebSocket endpoints remain `/ws/ping` and `/ws/dns-propagation`
- Port scan progress streams use `/api/v1/port-scans/stream`

## Runtime Notes

- DNS propagation uses WebSockets for streaming result, progress, and completion events.
- Ping uses WebSockets and validates input on the server before execution.
- Port scanning currently uses server-sent events, not worker threads.
- The app writes structured logs under `logs/`.
- The app also writes structured logs to stdout, so `docker logs` shows live operational events.
- Every HTTP response includes an `X-Request-Id` header. The same request ID is written into application logs for traceability.
- Abuse-oriented events such as rate-limit hits and blocked non-public targets are written to `logs/abuse.log`.
- DNS propagation server metadata is loaded from `server/data/dns-servers.csv` in both local and container runtime paths.

## Production Notes

### Reverse Proxy

`trust proxy` is configurable through `TRUST_PROXY`.

- `TRUST_PROXY=1`
  Use this when Express is behind a single trusted reverse proxy such as Nginx or a platform ingress.
- `TRUST_PROXY=true`
  Trust all proxies. This is convenient but should only be used when upstream headers are tightly controlled.
- `TRUST_PROXY=loopback,linklocal,uniquelocal`
  Use an Express-compatible proxy trust list when you need finer control.

If this setting is wrong, `req.ip`, rate limits, and abuse logs may use the wrong client IP.

### Request Tracing

- `X-Request-Id` is accepted if it matches a safe format, otherwise the server generates a new ID.
- The generated request ID is returned in the response header and included in structured logs.
- `healthz` and `readyz` also return the active request ID for quick diagnostics.

### Outbound Safety Policy

- `ping`, custom DNS server validation, and port scanning only allow public targets.
- Private, loopback, link-local, multicast, and reserved address ranges are blocked.
- Hostnames are resolved first and are rejected if any resolved address is non-public.

### Runtime Limits

The defaults are intentionally usable for a public tool, but they are still bounded.

- Global API limit: `300` requests per `15` minutes per IP
- Ping: `90` requests per `15` minutes, `20` concurrent globally, `2` concurrent per IP
- DNS lookup and validation: `60` requests per `15` minutes per IP
- DNS propagation: `30` requests per `15` minutes, `8` concurrent globally, `2` concurrent per IP
- Port scanning: `20` requests per `15` minutes, maximum `256` ports per request, maximum timeout `2000ms`, `4` concurrent globally, `1` concurrent per IP

All of these values are configurable through environment variables in `.env.example`.

### Logging

- `LOG_LEVEL`
  Base logger level. Recommended production default: `info`
- `CONSOLE_LOG_LEVEL`
  Stdout/stderr logger level. This is what `docker logs` will show.
- `FILE_LOG_LEVEL`
  File logger level under `logs/`
- `LOG_PRETTY_CONSOLE`
  `true` for human-readable console logs, `false` for structured JSON. Recommended production default: `false`

In production, the default behavior is to emit structured console logs for startup, shutdown, warnings, errors, and operational HTTP traffic while suppressing noisy debug-level request chatter.

### Dependency Hygiene

- `pnpm run audit:deps`
  Audit installed packages for known vulnerabilities
- `pnpm run deps:outdated`
  Review dependency drift before upgrade work

### Operational Logs

- `logs/info.log`
  Normal production activity
- `logs/error.log`
  Application errors
- `logs/debug.log`
  Development-only verbose logs
- `logs/abuse.log`
  Rate-limit hits, blocked public-target violations, and other abuse-relevant events

## Jenkins Deployment

This repository now supports a single-image Jenkins deployment flow for `main`:

- build one multi-architecture image for `linux/amd64` and `linux/arm64`
- push `latest` for Watchtower-driven rollout
- push `sha-<commit>` for rollback history
- optionally push an exact Git tag when the checked-out commit is tagged
- run the application on `8080` and expose the Watchtower HTTP API on `18081`

The root `Jenkinsfile` assumes:

- Harbor registry: `harbor.nangman.cloud/library`
- image name: `netlab`
- Watchtower HTTP API: `http://192.168.11.134:18081/v1/update`
- application health endpoint: `http://192.168.11.134:8080/healthz`
- Watchtower Jenkins credential ID: `nangman-netlab-watchtower-token`
- Generic Webhook Trigger token: `nangman-netlab-trigger`

Required server-side Watchtower environment:

```env
WATCHTOWER_DOCKER_API_VERSION=1.40
WATCHTOWER_HTTP_API_UPDATE=true
WATCHTOWER_HTTP_API_TOKEN=<same-token-stored-in-Jenkins>
```

If the Docker daemon on the target host requires a newer minimum API version, update `WATCHTOWER_DOCKER_API_VERSION` to match that daemon requirement.

The included `docker-compose.yaml` is now aligned with this deployment model:

- `netlab` runs from `NETLAB_IMAGE` and defaults to `harbor.nangman.cloud/library/netlab:latest`
- Watchtower only updates containers labeled for the `netlab` scope
- the Watchtower API listens on `${WATCHTOWER_PORT:-18081}` to avoid clashing with the application on `8080`
- the application container receives the runtime limit and logging env vars explicitly, so `.env` tuning is reflected in the running process

The deployment pipeline now embeds build metadata in the image and verifies rollout by polling `/healthz` until the reported `buildSha` matches the freshly built image.

The webhook filter only accepts pushes for the repository `pandora0667/netlab` on `refs/heads/main`.

## Known Maintenance Priorities

- Split the large frontend bundle into route-level chunks
- Continue removing legacy duplicate files and dead code
- Expand server-side and integration test coverage
- Add deployment-specific docs for your actual reverse proxy and hosting setup
