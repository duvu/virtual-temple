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

## Package boundaries

- `apps/api` is the composition root and exposes the application through HTTP.
- `packages/application` owns engine-independent ports and runtime orchestration. It depends on `packages/domain`.
- `packages/domain` contains engine- and platform-neutral business contracts.
- `packages/engine-threejs` implements the application engine port. Three.js imports belong only in this package.
- `packages/adapter-contract-tests` provides reusable adapter checks for development and tests.

The dependency direction is `apps/api` → `packages/application` → `packages/domain`. The Three.js adapter implements application ports and uses domain contracts; domain and application code do not depend on an engine SDK.
