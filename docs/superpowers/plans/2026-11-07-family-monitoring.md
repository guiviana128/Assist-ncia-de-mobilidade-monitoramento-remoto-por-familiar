# Family monitoring implementation plan

Goal: connect persistent family accounts, device ownership, care history, continuous vision and supervised local AI without replacing Gustavo's interface.

Architecture: Spring Boot/PostgreSQL owns accounts, authorization, alerts, history and AI reports. React renders the family's state. A separately launched Python camera worker continues capture without the browser. Ollama suggests, never calls or dispatches assistance automatically.

Decisions delegated by user: implement in the existing isolated checkout on feat/family-monitoring; one accompanied person/device per initial account, invite-based caregiver access, generated device credentials, browser notifications and durable inbox; optional FCM remains configurable. No cloud publication or replacement of the old C:/TEMP checkout.

## Tasks
- [x] 1. Integration tests: registration/login, persisted hashed sessions, family isolation across dashboard/alerts/telemetry/vision/AI/robot, immutable ownership, identity of care decisions.
- [x] 2. Persistent accounts and family/device registry; scoped HTTP authorization; no silent fake success on protected API failures.
- [x] 3. Persistent gesture alerts, reviewed history, acknowledgement, connection heartbeats and notification inbox with honest delivery state.
- [x] 4. AI reports and periodic analysis, timeouts, per-device failure isolation, manual supervised decisions.
- [x] 5. Background camera worker with bounded upload, heartbeat, quality gate, durable retry and source-session separation; lifecycle cleanup.
- [x] 6. Registration, onboarding credentials, care console/history/AI/connection UI integrated with existing layout, explicit demonstration mode.
- [x] 7. Run Java integration suite, Python suite, frontend build and browser flows. Package reproducible source and startup instructions; review whole branch.

## Review focus
Cross-family ID guessing including object IDs; offline services and misleading success; concurrent acknowledgement and duplicate vision delivery; late/stale frames; Ollama downtime must never block urgent alerts. Recovery and external push require configured delivery credentials, never fabricated delivery.
