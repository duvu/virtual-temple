# Operations Scripts Implementation Plan

> **For agentic workers:** Execute each task in an isolated worktree; parallelize Tasks 2–4 after Task 1 is integrated.

**Goal:** Add reusable developer, demo, and API process-control scripts under `ops/`.

**Architecture:** `ops/lib/common.sh` owns repository-root discovery, command checks, base URL/port selection, and health waiting. Other scripts source it and delegate build/test/dev work to existing pnpm scripts. API process control uses the built API entrypoint, a PID file, and log under ignored `.run/`.

**Tech Stack:** Bash, Node.js built-in `fetch`, curl, pnpm.

---

## Task 1: Shared operations helpers

**Files:** Create `ops/lib/common.sh`; update `.gitignore` to ignore `.run/`.

- Define `vtl_root`, `vtl_port`, `vtl_base_url`, `vtl_run_dir` from script location/environment.
- Add `vtl_require_command`, `vtl_healthcheck`, `vtl_wait_for_health`, and safe PID/command identity helpers.
- Keep helpers source-only and safe under `set -Eeuo pipefail`.

## Task 2: Developer operation wrappers

**Files:** Create `ops/install.sh`, `ops/build.sh`, `ops/verify.sh`, `ops/dev.sh`, `ops/health.sh`.

- Each script resolves root via `common.sh`, changes to root, and forwards arguments/environment.
- `verify.sh` runs frozen install, build, typecheck, then tests in that order.
- `dev.sh` runs the existing foreground API development command.
- `health.sh` checks `${VTL_BASE_URL}` and prints the response/status.

## Task 3: End-to-end demo operation

**Files:** Create `ops/demo-channel.sh`.

- Use Node fetch to create a channel/world, create a runtime, initialize/start it, then fetch and print final runtime state and IDs.
- Fail with a concise status/body for any non-2xx response.
- Use the shared base URL and document that the API stores demo state in memory.

## Task 4: API process controls

**Files:** Create `ops/api-start.sh`, `ops/api-stop.sh`, `ops/api-restart.sh`, `ops/api-status.sh`.

- Start builds the API, launches `node apps/api/dist/server.js` in background, records PID/log under `.run/`, and waits for health.
- Stop validates the PID belongs to this API entrypoint, sends TERM, waits with a timeout, then removes the PID file.
- Restart composes stop/start; status reports process and health without killing unrelated processes.

## Task 5: Documentation and static review

**Files:** Update `README.md` with the operation command list, options, port/base URL behavior, process-control files, and demo sequence.

- Review scripts for quoted paths, safe PID checks, useful errors, and executable modes.
- Check git diff and script syntax. Do not claim live service behavior unless an operation is explicitly run.
