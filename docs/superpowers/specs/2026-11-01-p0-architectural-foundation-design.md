# Virtual Temple Live P0 Architectural Foundation Design

**Status:** Approved design, pending written-spec review  
**Date:** 2026-11-01

## Goal

Create an executable TypeScript foundation for Virtual Temple Live that establishes engine-independent domain contracts and runtime lifecycle boundaries, with Three.js as an isolated first adapter.

## Scope

P0 establishes the repository structure and contracts needed to implement later MVP slices safely. It includes:

- A pnpm workspace using TypeScript.
- `packages/domain` for channel, world, normalized event, runtime command, capability, and runtime status contracts.
- `packages/application` for engine-independent ports, runtime lifecycle orchestration, and validation of legal state transitions.
- `packages/engine-threejs` for the first `EngineAdapter` implementation; Three.js dependencies remain isolated to this package.
- `apps/api` as a minimal entry point exposing channel/runtime operations through the application layer.
- An in-memory runtime implementation for a runnable P0 without persistence infrastructure.
- Shared adapter contract tests and domain/application unit tests.
- Root scripts and README instructions for install, development, build, typecheck, and tests.

## Out of Scope

P0 does not implement the admin UI, PostgreSQL persistence, Redis Streams, platform connectors, streaming outputs, scheduling, AI orchestration, asset management UI, production deployment, or automatic crash recovery. These are later independently deliverable slices.

## Architecture and Boundaries

The dependency direction is:

`apps/api -> packages/application -> packages/domain`

`packages/engine-threejs -> packages/application ports + packages/domain`

The domain package has no dependency on application, API, or rendering libraries. Application code depends on an engine port and receives a concrete adapter through dependency injection. The Three.js package is the only package allowed to import Three.js SDK modules. No engine-specific identifiers may enter normalized events, logical commands, or business rules.

The application layer checks declared adapter capabilities before dispatching operations. Unsupported operations return an explicit typed error and do not report success. The adapter contract exposes engine ID/version, adapter version, supported capabilities, runtime health, performance metrics, and error information where available.

## Runtime Lifecycle

A runtime is isolated by runtime ID and follows the SRS states:

`CREATED -> INITIALIZING -> READY -> RUNNING -> PAUSED -> RUNNING -> STOPPING -> STOPPED`

Failures transition the affected runtime to `ERROR`. Only legal transitions are accepted. The application service owns lifecycle policy and state transitions; the adapter performs engine execution. The P0 in-memory implementation stores independent runtime state per runtime ID. Durable recovery and restart policy are deferred.

## Contracts and Data Flow

Normalized events and engine-independent commands are defined in the domain package. Their minimum envelope fields follow the SRS: event identity/type/channel/platform/user/timestamp/payload/metadata, and command identity/channel/runtime/type/payload/timestamp/correlation ID.

For the initial API path, an operator request enters `apps/api`, is validated and handled by an application service, updates the selected runtime lifecycle, and invokes the injected adapter. The API does not call adapter internals or mutate adapter state directly. Platform events are not ingested in P0, but their stable schema is established for later connectors and interaction processing.

## Error Handling

Invalid lifecycle transitions and unsupported capabilities return typed domain/application errors. Adapter failures are recorded against the affected runtime and surfaced in its status without changing other runtimes. API responses map these errors to stable HTTP status and error payloads. P0 does not retry adapter operations automatically; retry and recovery policy will be designed with the runtime supervision slice.

## Verification

- Unit tests cover runtime state transitions, invalid transitions, independent runtime state, and capability checks.
- A reusable adapter contract suite checks lifecycle behavior and explicit unsupported-capability reporting for every adapter.
- Workspace scripts provide build, typecheck, and test commands.
- The Three.js adapter is verified against the same contract suite as a test adapter implementation.

## Acceptance Criteria

1. The workspace installs, builds, typechecks, and runs its tests from the repository root.
2. Domain and application packages compile without importing Three.js or another engine SDK.
3. The API can create and operate two independent in-memory runtimes through the application layer.
4. An adapter can be injected without changing channel, event, or interaction business contracts.
5. Unsupported adapter capabilities produce explicit errors.
6. Contract tests exercise adapter behavior through the shared port.

## Decisions and Trade-offs

- **pnpm workspace:** provides a lightweight TypeScript monorepo without introducing a larger orchestration framework before package boundaries are established.
- **In-memory P0 runtime:** makes lifecycle behavior executable and testable while keeping persistence and recovery as deliberate later slices.
- **Minimal API instead of UI-first work:** proves domain-to-application-to-adapter boundaries before adding administrative presentation.
- **Three.js as an isolated adapter:** satisfies the initial engine choice while preserving the ability to substitute another adapter.
