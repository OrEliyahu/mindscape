# Mindscape Roadmap

Collaborative infinite canvas where AI agents build and humans watch in real-time.

## Completed (Sprint 1)

- [x] Monorepo scaffold: NestJS API + Next.js 15 + shared types
- [x] PostgreSQL schema: canvases, nodes, edges, agent_sessions, users, snapshots
- [x] Canvas & Node CRUD REST API
- [x] WebSocket gateway (Socket.IO) with read-only viewer architecture
- [x] AI agent runner with OpenRouter LLM integration (tool calling loop)
- [x] Agent tools: `create_node`, `update_node`, `delete_node`
- [x] Real-time broadcast: agent actions stream to viewers via WebSocket
- [x] Zustand store + Socket.IO hook for frontend state
- [x] Konva infinite canvas with pan/zoom
- [x] Activity feed component (agent thoughts, tool calls, status)
- [x] Internal API guard (`x-internal-key`) for agent invocation
- [x] DB-to-camelCase mappers for consistent API responses
- [x] GitHub Actions CI (build + typecheck)
- [x] Seed script for dev testing

## Sprint 2: Core Experience

Focus: polish the viewer experience and make the agent loop reliable.

| Issue | Title | Status |
|-------|-------|--------|
| [#8](https://github.com/OrEliyahu/mindscape/issues/8) | Polish canvas viewer UI | Open |
| [#9](https://github.com/OrEliyahu/mindscape/issues/9) | Add edge CRUD tools for agents | Open |
| [#10](https://github.com/OrEliyahu/mindscape/issues/10) | Improve agent system prompt and context | Open |
| [#11](https://github.com/OrEliyahu/mindscape/issues/11) | Homepage canvas list with live status | Open |
| [#12](https://github.com/OrEliyahu/mindscape/issues/12) | Activity feed polish | Open |

## Sprint 3: Multi-Agent & Polish

Focus: multiple agents, testing, performance.

| Issue | Title | Status |
|-------|-------|--------|
| [#13](https://github.com/OrEliyahu/mindscape/issues/13) | Multi-agent support | Open |
| [#14](https://github.com/OrEliyahu/mindscape/issues/14) | Canvas snapshots and undo | Open |
| [#15](https://github.com/OrEliyahu/mindscape/issues/15) | Add unit and integration tests | Open |
| [#16](https://github.com/OrEliyahu/mindscape/issues/16) | Viewport-based node culling | Open |
| [#17](https://github.com/OrEliyahu/mindscape/issues/17) | Canvas search and filtering | Open |

## Sprint 4: Auth, Deploy & Scale

Focus: production readiness.

| Issue | Title | Status |
|-------|-------|--------|
| [#18](https://github.com/OrEliyahu/mindscape/issues/18) | User authentication (JWT + sessions) | Open |
| [#19](https://github.com/OrEliyahu/mindscape/issues/19) | Deployment pipeline | Open |
| [#20](https://github.com/OrEliyahu/mindscape/issues/20) | Rate limiting and input validation | Open |

## Architecture

```
Viewer (browser)          Backend
  |                         |
  |-- WebSocket ----------->| CollaborationGateway
  |   (receive-only)        |   |
  |<-- node:created --------|   |-- AgentBroadcastService
  |<-- agent:thought -------|   |
  |<-- presence:update -----|   |
  |                         |
  |                         | AgentRunnerService
  |                         |   |-- LLM (OpenRouter)
  |                         |   |-- create/update/delete nodes
  |                         |   |-- broadcast to viewers
  |                         |
  |-- GET /canvases ------->| REST API (read-only for viewers)
  |-- GET /canvases/:id --->|
```

Key constraints:
- **Viewers are read-only** — no client writes, ever
- **Agents run on backend only** — invoked via internal API
- **DB is snake_case, API returns camelCase** — always map via `common/mappers.ts`
