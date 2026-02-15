# Mindscape

Collaborative infinite canvas where AI agents build and humans watch in real-time. Viewers are read-only; agents run on the backend via LLM tool-calling and broadcast changes over WebSocket.

## Quick Start

```bash
# Prerequisites: Docker, Node 22, npm 11
cp .env.example .env          # fill in OPENROUTER_API_KEY and INTERNAL_API_KEY
docker compose up -d           # PostgreSQL 17 + Redis 7
npm install
npm run db:migrate             # run SQL migrations
npm run dev                    # starts API (port 4000) + Web (port 3000)
```

Seed a test canvas: `./scripts/seed.sh "your prompt here"`

## Monorepo Structure

- **`apps/api`** — NestJS 11 backend (REST + WebSocket). Package: `@mindscape/api`
- **`apps/web`** — Next.js 15 + React 19 frontend (Konva canvas). Package: `@mindscape/web`
- **`packages/shared`** — Shared TypeScript types and utilities. Package: `@mindscape/shared`

Build orchestration: Turborepo (`turbo.json`). Workspaces defined in root `package.json`.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in dev mode (Turbo) |
| `npm run build` | Build all packages |
| `npm run lint` | Typecheck all packages |
| `npm run db:migrate` | Run SQL migrations on the API database |

### Per-app commands (run from app directory or with `--filter`)

- `npx turbo build --filter=@mindscape/api` — build API only
- `npx turbo build --filter=@mindscape/web` — build web only
- `npx turbo build --filter=@mindscape/shared` — build shared only

## Architecture

- **Viewers** connect via WebSocket (Socket.IO) and are **receive-only** — no client writes
- **Agents** run on the backend only, invoked via internal API with `x-internal-key` header
- **AgentRunnerService** executes an LLM tool-calling loop (OpenRouter API)
- **AgentBroadcastService** streams node/edge changes and agent thoughts to viewers
- **CollaborationGateway** manages WebSocket connections and presence

## Key Conventions

- **DB is snake_case, API returns camelCase** — always use mappers in `apps/api/src/common/mappers.ts` (`toNodePayload`, `toEdgePayload`, `toCanvasPayload`)
- **Migrations** are sequential SQL files in `apps/api/src/database/migrations/` (e.g., `001_create_users.sql`). Tracked via `schema_migrations` table. Run with `npm run db:migrate`
- **Internal API guard** — agent invocation endpoints require `x-internal-key` header (see `apps/api/src/agent/internal-api.guard.ts`)
- **Multi-agent support** — agent personas and concurrency managed via `apps/api/src/agent/agent-registry.ts`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | NestJS 11 |
| Database | PostgreSQL 17 (raw `pg`, no ORM) |
| Cache/sessions | Redis 7 (ioredis) |
| Real-time | Socket.IO 4.8 |
| LLM provider | OpenRouter (tool-calling) |
| Frontend framework | Next.js 15.3 / React 19 |
| Canvas rendering | Konva 9.3 + react-konva |
| State management | Zustand 5 |
| Build tool | Turborepo 2.8 |
| CI | GitHub Actions (build + typecheck) |

## Environment Variables

Defined in `.env.example`. Key variables:

- `OPENROUTER_API_KEY` — LLM API key (required for agent)
- `INTERNAL_API_KEY` — guards agent invocation endpoints
- `DB_*` — PostgreSQL connection (defaults match `docker-compose.yml`)
- `REDIS_*` — Redis connection
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` — frontend connects to API at these URLs
