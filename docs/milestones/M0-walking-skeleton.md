# M0 — Walking Skeleton

*En ince uçtan uca akış: repo → CI → DB → API → WS → istemci → deploy. Gerçek kullanıcı yok, tek sabit oda, tek seed kullanıcı.*

**Goal:** Prove the entire stack works end-to-end and is deployed, before any real feature exists.
**Duration:** ≤1 week (aspirational — see capacity check below).
**Estimated hours:** 45–70h (heaviest item: first-ever production deploy + WS-in-prod, not the feature code itself).
**Demo:** Two browser tabs, both logged in as the seeded dev user, one hardcoded room. A message sent in one tab appears in the other in real time, and survives a page reload (persisted).

## Out of scope
- Invite-only signup, TOTP, password reset.
- Any room beyond the one hardcoded room.
- Reputation/XP, moderation, rate limiting.

## Acceptance criteria
- [ ] CI is green: lint + typecheck + test.
- [ ] A seeded dev-login endpoint issues a working access token (no real invite flow yet).
- [ ] A message sent by one client appears via WebSocket in a second connected client in real time.
- [ ] The message is persisted in Postgres and survives a reload.
- [ ] One end-to-end test covers: send → receive over WS → persisted in DB.
- [ ] The app is deployed to a public staging URL.
- [ ] `docs/STATE.md` is current.

## Tasks
- [ ] Pick the deploy target *before* writing app code (a managed platform with git-push deploy — Fly.io/Render/Railway — not self-managed containers, per ADR-0003).
- [ ] Repo skeleton: NestJS + Next.js monolith per `docs/ARCHITECTURE.md`.
- [ ] CI pipeline (lint, typecheck, test).
- [ ] DB connection + first migration: minimal `User`, `Room`, `Message` tables per `docs/DATA-MODEL.md`.
- [ ] One seeded dev-login endpoint.
- [ ] One seeded room + one screen: terminal-style single-room view.
- [ ] WebSocket send/receive round trip, persisted to DB.
- [ ] One end-to-end test.
- [ ] Deploy to staging.

## Risks
- First-time solo production deploy (flagged FATAL in `docs/review/CRITIQUE.md`) — mitigation: the deploy target is chosen and a "hello world" is deployed on it *before* any real app code is written, so deploy friction surfaces on day 1, not day 7.
