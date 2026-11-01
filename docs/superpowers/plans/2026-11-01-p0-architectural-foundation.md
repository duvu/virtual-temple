# Virtual Temple Live P0 Architectural Foundation Implementation Plan

> **For agentic workers:** Execute this plan task by task. Keep the backlog and implementation tracker updated at each task boundary.

**Goal:** Build a runnable TypeScript monorepo foundation with engine-independent contracts, runtime lifecycle orchestration, an isolated Three.js adapter, and a minimal API.

**Architecture:** `apps/api` is the composition root and depends on `packages/application` plus the selected adapter. `packages/application` depends on `packages/domain` and defines ports. `packages/engine-threejs` implements those ports and is the only package importing Three.js. Domain contracts are engine and platform neutral. P0 uses in-memory channel/runtime state.

**Tech Stack:** Node.js, TypeScript, pnpm workspaces, Fastify REST API, Three.js, Vitest, Zod for API boundary validation.

---

## File Map

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`: root workspace scripts, package discovery, compiler defaults, generated-file exclusions.
- `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/**`: domain IDs, channel/world models, event and command envelopes, engine capabilities, runtime state and errors.
- `packages/application/package.json`, `packages/application/tsconfig.json`, `packages/application/src/**`: engine port, runtime repository port, lifecycle service, capability checks, typed application errors.
- `packages/engine-threejs/package.json`, `packages/engine-threejs/tsconfig.json`, `packages/engine-threejs/src/**`: isolated Three.js adapter and its contract test registration.
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/**`: Fastify routes, request validation, dependency composition, HTTP error mapping.
- `packages/adapter-contract-tests/package.json`, `packages/adapter-contract-tests/src/index.ts`: reusable adapter contract suite.
- `packages/domain/test/**`, `packages/application/test/**`, `packages/engine-threejs/test/**`, `apps/api/test/**`: unit, adapter contract, architecture, and HTTP integration tests.
- `README.md`: setup, package boundaries, commands, and local run instructions.
- `docs/project/BACKLOG.md`: prioritized work items beyond and including P0.
- `docs/project/IMPLEMENTATION_TRACKER.md`: task status and evidence log for this plan.

## Task 1: Establish the pnpm TypeScript workspace

**Files:** Create root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`; update `README.md`.

- [ ] **Step 1: Define workspace package discovery**

Create `pnpm-workspace.yaml` with `packages:` entries `apps/*` and `packages/*`.

- [ ] **Step 2: Add root scripts and compiler defaults**

Run `pnpm --version` and pin that exact version in the root `packageManager` field. Create a private root package named `virtual-temple-live` with scripts `build`, `typecheck`, and `test` delegating through `pnpm -r`; define `dev` as `pnpm --filter @vtl/api dev`. Configure `tsconfig.base.json` for strict TypeScript, ES2022, NodeNext module and resolution, declarations, and source maps. Run `pnpm install` to generate `pnpm-lock.yaml`.

- [ ] **Step 3: Exclude generated and secret files**

Add ignores for `node_modules/`, `dist/`, coverage output, `.env`, and `.env.*`, while allowing `.env.example`.

- [ ] **Step 4: Document workspace commands**

Add README sections for prerequisites, install, build, typecheck, test, and package-boundary overview. Do not claim commands pass until run in the verification task.

## Task 2: Define engine-independent domain contracts

**Files:** Create `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/ids.ts`, `packages/domain/src/channel.ts`, `packages/domain/src/world.ts`, `packages/domain/src/events.ts`, `packages/domain/src/commands.ts`, `packages/domain/src/runtime.ts`, `packages/domain/src/errors.ts`, `packages/domain/src/index.ts`, and focused tests under `packages/domain/test/`.

- [ ] **Step 1: Specify identifiers and logical models with tests**

Write tests that construct a channel with channel ID, world ID, engine ID, destinations, and schedule references; construct a world with environment, scene, assets, camera, characters, lighting, audio, and effects; and confirm no engine SDK types are required.

- [ ] **Step 2: Implement domain types**

Export branded `ChannelId`, `WorldId`, `RuntimeId`, `PlatformId`, `PlatformUserId`, `EventId`, `CommandId`, and `CorrelationId` string types. Define `Channel`, `World`, `CharacterPlacement`, and `SceneConfiguration` using logical identifiers only.

- [ ] **Step 3: Define normalized event and command envelopes**

Define `NormalizedEvent` with `eventId`, `eventType`, `channelId`, `platformId`, optional `platformUserId`, `timestamp`, `payload`, and `metadata`. Define `RuntimeCommand` with `commandId`, `channelId`, `runtimeId`, `commandType`, `payload`, `timestamp`, and `correlationId`. Use string logical action/animation IDs, never Three.js IDs.

- [ ] **Step 4: Define lifecycle, capabilities, and typed errors**

Represent runtime statuses `CREATED`, `INITIALIZING`, `READY`, `RUNNING`, `PAUSED`, `STOPPING`, `STOPPED`, and `ERROR`. Define capability identifiers corresponding to adapter operations and optional features. Define serializable error codes for invalid transition, unsupported capability, adapter failure, and missing runtime.

- [ ] **Step 5: Run domain tests and typecheck**

Run `pnpm --filter @vtl/domain test` and `pnpm --filter @vtl/domain typecheck`. Expected: all contract construction and type-level checks pass.

## Task 3: Implement application ports and lifecycle orchestration

**Files:** Create `packages/application/package.json`, `packages/application/tsconfig.json`, `packages/application/src/ports/engine-adapter.ts`, `packages/application/src/ports/runtime-repository.ts`, `packages/application/src/runtime/transitions.ts`, `packages/application/src/runtime/runtime-service.ts`, `packages/application/src/errors.ts`, `packages/application/src/index.ts`, and tests under `packages/application/test/`.

- [ ] **Step 1: Write transition and capability tests**

Cover legal lifecycle progression, invalid transitions, capability rejection before adapter invocation, adapter failure moving only the selected runtime to `ERROR`, and two runtime IDs retaining independent state.

- [ ] **Step 2: Define `EngineAdapter` port**

Include metadata (`engineId`, engine version, adapter version), declared capabilities, health and performance status, and methods for initialize/load/start/stop/pause/resume, camera, character lifecycle/movement/animation, effects, environment, runtime status, and output capture. Methods for unsupported capabilities must reject with `UnsupportedCapabilityError`.

- [ ] **Step 3: Define repository port and in-memory implementation**

Expose `get(runtimeId)`, `save(runtime)`, and `delete(runtimeId)`. Implement an in-memory repository keyed by `RuntimeId`; return copies or immutable values so consumers cannot mutate shared state without saving.

- [ ] **Step 4: Implement lifecycle service**

Validate each requested transition against a central transition table. Persist `INITIALIZING` before calling adapter initialization; transition through `READY` after successful world load, then to `RUNNING` after start. For pause/resume/stop, call the matching adapter method and persist state only on success. On adapter failure, persist `ERROR` with a serializable error summary and rethrow a typed application error.

- [ ] **Step 5: Verify application tests**

Run `pnpm --filter @vtl/application test` and `pnpm --filter @vtl/application typecheck`. Expected: lifecycle and capability tests pass without importing any engine package.

## Task 4: Implement and contract-test the Three.js adapter

**Files:** Create `packages/engine-threejs/package.json`, `packages/engine-threejs/tsconfig.json`, `packages/engine-threejs/src/threejs-engine-adapter.ts`, `packages/engine-threejs/src/index.ts`, and `packages/engine-threejs/test/engine-adapter.contract.test.ts`.

- [ ] **Step 1: Create reusable adapter contract suite**

Create `packages/adapter-contract-tests` with an exported `defineEngineAdapterContract(name, createAdapter)` Vitest helper. Its input is an `EngineAdapter` factory. Assert metadata/capabilities, successful supported lifecycle operations, explicit errors for unsupported operations, status reporting, and isolation across runtime IDs. Keep this package as a development-only dependency of adapters.

- [ ] **Step 2: Implement the minimal Three.js adapter**

Keep all imports from `three` within this package. Implement supported lifecycle and logical scene operations with a per-runtime scene registry. Declare only capabilities actually implemented. Return explicit unsupported-capability errors for capture/output or advanced renderer features that are not implemented in the P0 runtime.

- [ ] **Step 3: Run the shared contract against Three.js adapter**

Run `pnpm --filter @vtl/engine-threejs test`. Expected: the adapter passes shared checks, and unsupported operations fail explicitly.

## Task 5: Expose minimal channel and runtime operations through the API

**Files:** Create `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/routes/channels.ts`, `apps/api/src/routes/runtimes.ts`, `apps/api/src/http-errors.ts`, and `apps/api/test/api.test.ts`.

- [ ] **Step 1: Write API integration tests**

Cover `GET /healthz`, create/list channels, create/start/pause/resume/stop runtime, unknown runtime, invalid transition, unsupported capability, and two independent runtimes. Verify stable JSON error responses.

- [ ] **Step 2: Build composition root**

Create a Fastify application factory accepting adapter and repository dependencies. Keep `server.ts` as the process entry point; select `ThreeJsEngineAdapter` and in-memory repositories there. Do not instantiate Three.js in route modules.

- [ ] **Step 3: Implement request schemas and routes**

Validate request bodies using Zod. Implement `POST /channels`, `GET /channels`, `POST /channels/:channelId/runtimes`, `POST /runtimes/:runtimeId/actions` with body `{ "action": "initialize" | "start" | "pause" | "resume" | "stop" }`, and `GET /runtimes/:runtimeId`. Document these exact routes in README.

- [ ] **Step 4: Map application errors to HTTP responses**

Map validation to 400, missing entities to 404, invalid transition/capability to 409, adapter failure to 502, and unexpected errors to 500. Never return stack traces or secrets.

- [ ] **Step 5: Run API integration tests and typecheck**

Run `pnpm --filter @vtl/api test` and `pnpm --filter @vtl/api typecheck`. Expected: route responses and error codes match the contracts.

## Task 6: Add cross-package boundary checks and repository documentation

**Files:** Update root scripts and `README.md`; add `packages/domain/test/architecture.test.ts`.

- [ ] **Step 1: Assert domain/application engine isolation**

Add a static test that scans `packages/domain/src` and `packages/application/src` for imports from `three`, `@react-three/*`, Unity, or Unreal SDK namespaces and fails when found.

- [ ] **Step 2: Document local execution and contracts**

Document package responsibilities, dependency direction, adapter capability behavior, lifecycle, API routes, environment variables (none required for P0), and how to add a test adapter.

- [ ] **Step 3: Update tracker with implementation evidence**

Record completed task IDs, exact commands run, and pass/fail outcomes in `docs/project/IMPLEMENTATION_TRACKER.md`.

## Task 7: Verify the complete P0 workspace

**Files:** No new source files; update `docs/project/IMPLEMENTATION_TRACKER.md` with results.

- [ ] **Step 1: Install from the repository root**

Run `pnpm install --frozen-lockfile`. Expected: lockfile and manifests are synchronized and install exits with code 0.

- [ ] **Step 2: Run full build and typecheck**

Run `pnpm build` and `pnpm typecheck`. Expected: every workspace package succeeds.

- [ ] **Step 3: Run the full test suite**

Run `pnpm test`. Expected: domain, application, adapter contract, architecture, and API integration tests all pass.

- [ ] **Step 4: Run the API and inspect health response**

Run the documented dev command, request `GET /healthz`, and confirm the response reports healthy status. Stop the process gracefully and record the command and observed response in the tracker.

- [ ] **Step 5: Review quality gates and update backlog**

Confirm engine SDK imports exist only in `packages/engine-threejs`; confirm two runtimes operate independently; confirm adapter capability errors are explicit; mark P0 backlog items complete only when tracker evidence exists.

---

## Plan Self-Review

- **Spec coverage:** Engine isolation, domain contracts, lifecycle, capability discovery, normalized event and command envelopes, multi-runtime isolation, API boundary, contract tests, and runnable root commands are covered. Persistence, platform connectors, streaming, recovery policy, and UI remain explicitly deferred per the approved P0 scope.
- **Placeholder scan:** No `TBD`, `TODO`, or unspecified implementation steps remain. Read the exact installed pnpm version with `pnpm --version` and pin it before generating the lockfile.
- **Type consistency:** Runtime IDs and statuses come from `@vtl/domain`; `EngineAdapter` is defined in `@vtl/application`; the Three.js adapter implements that port; `apps/api` composes the concrete adapter and application services.
