# Virtual Temple Live Backlog

This backlog is ordered by prerequisite and delivery priority. Items are not complete until the implementation tracker contains verification evidence.

## P0 — Architectural Foundation

- [x] **VTL-001** Establish pnpm TypeScript workspace and root scripts.
- [x] **VTL-002** Define engine-independent channel, world, normalized event, command, capability, and runtime contracts.
- [x] **VTL-003** Implement runtime lifecycle orchestration and in-memory runtime repository.
- [x] **VTL-004** Implement Three.js adapter behind the engine port and shared adapter contract suite.
- [x] **VTL-005** Implement minimal REST API composition root and channel/runtime endpoints.
- [x] **VTL-006** Add architecture boundary checks and local developer documentation.
- [ ] **VTL-007** Verify full workspace build, typecheck, tests, and live health endpoint.

## P1 — Runtime MVP

- [ ] **VTL-101** Persist channels, worlds, and runtime configuration in PostgreSQL with migrations.
- [ ] **VTL-102** Load GLB environments and host character assets through asset references.
- [ ] **VTL-103** Implement viewer identity, avatar assignment, spawn/despawn, and logical animation mapping.
- [ ] **VTL-104** Add normalized event ingestion, validation, deduplication, ordering, retries, and dead-letter handling.
- [ ] **VTL-105** Map comment, gift, follow, and viewer lifecycle events to logical runtime commands.

## P2 — Streaming

- [ ] **VTL-201** Implement streaming manager and replaceable streaming engine port.
- [ ] **VTL-202** Add OBS/FFmpeg output worker and stream health metrics.
- [ ] **VTL-203** Add TikTok connector subject to account/API eligibility.
- [ ] **VTL-204** Add YouTube connector and multi-destination output configuration.

## P3 — Operations

- [ ] **VTL-301** Build admin portal for channels, worlds, configuration, and runtime state.
- [ ] **VTL-302** Add runtime watchdog, configured restart policy, and crash recovery.
- [ ] **VTL-303** Add scheduling for channel lifecycle, scenes, activities, narration, and camera paths.
- [ ] **VTL-304** Add application, rendering, streaming, and business metrics dashboards.

## P4 — Intelligence

- [ ] **VTL-401** Add policy-bounded AI orchestration that emits logical actions only.
- [ ] **VTL-402** Add optional TTS and AI narration providers behind replaceable ports.

## Architecture Quality Gates

- [ ] Replacement adapter passes the same contract suite without domain/application changes.
- [ ] Two channels run isolated worlds; failure in one does not stop the other.
- [ ] Event and command contracts contain no platform connector or engine SDK types.
- [ ] Avatar lifecycle and animation mapping use logical identifiers.
- [ ] Streaming implementation can be replaced without changes to interaction/runtime domain contracts.
- [ ] Runtime recovery survives a renderer process crash without losing channel/world configuration.
