# Virtual Temple Live

Virtual Temple Live is a TypeScript monorepo for a virtual temple runtime. The P0 foundation separates engine-independent contracts and application behavior from the rendering adapter and API.

## Prerequisites

- Node.js 22 or newer
- pnpm 11.4.0 (the repository's pinned package manager version)

## Install

From the repository root, install workspace dependencies:

```sh
pnpm install
```

## Workspace commands

Run these commands from the repository root:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm dev
```

Build, typecheck, and test run the matching script recursively in workspace packages. `pnpm dev` starts the `@vtl/api` development script.

The API listens on `http://localhost:3000` by default. Set `PORT` to change the port.

## API routes

- `GET /healthz` returns `{ "status": "ok" }`.
- `POST /channels` creates a channel and its in-memory world. Send `{ "name": "Temple", "world": { "name": "Main world" } }`; `engineId` is optional and defaults to `threejs`.
- When a world repeats values at its top level and under `scene`, top-level `environment`, `camera`, `characters`, `lighting`, `audio`, and `effects` take precedence; absent top-level values fall back to `scene`. The API stores matching normalized values at both levels.
- `GET /channels` lists channels.
- `POST /channels/:channelId/runtimes` creates a runtime for that channel.
- `POST /runtimes/:runtimeId/actions` accepts `{ "action": "initialize" | "start" | "pause" | "resume" | "stop" }`.
- `GET /runtimes/:runtimeId` returns the runtime state.

Request validation errors return HTTP 400, missing channels or runtimes return 404, invalid transitions and conflicts return 409, adapter failures return 502, and unexpected failures return 500. Error bodies have a stable `{ "error": { "code": "...", "message": "..." } }` shape and do not include stack traces.

## Package boundaries

- `apps/api` is the composition root and exposes the application through HTTP.
- `packages/application` owns engine-independent ports and runtime orchestration. It depends on `packages/domain`.
- `packages/domain` contains engine- and platform-neutral business contracts.
- `packages/engine-threejs` implements the application engine port. Three.js imports belong only in this package.
- `packages/adapter-contract-tests` provides reusable adapter checks for development and tests.
- `apps/api` owns the HTTP composition root and P0 in-memory channel/world records; `packages/application` owns the runtime repository and lifecycle service. The API selects the Three.js adapter in `src/server.ts`; route modules use injected services and repositories without importing the engine package.

The dependency direction is `apps/api` → `packages/application` → `packages/domain`. The Three.js adapter implements application ports and uses domain contracts; domain and application code do not depend on an engine SDK.
