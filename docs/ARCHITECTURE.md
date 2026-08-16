# KOQEP — Architecture

*Bu doküman "neden böyle" ve "sınırlar nerede" sorularını cevaplar; kod tabanından çıkarılabilecek şeyleri tekrar etmez.*

## Overview
*Tek bir NestJS servisi hem REST/token API'yi hem WebSocket gateway'i aynı process içinde sunar; Next.js sadece web istemcisidir.*

One deployable NestJS service owns both the token-based REST API and the WebSocket gateway, in-process — not a separate WS deployment. Next.js is a web client that talks to that API like any other consumer; it holds no session-auth logic of its own (see ADR-0002). Postgres is the single source of truth. Redis is not deployed in v1 — presence/typing state lives in-process. Docker is used for local dev only; production deploys to a managed platform's native build path.

## Components & responsibilities
*Sorumluluk sınırları CLAUDE.md'deki kuralla birebir örtüşür: iş mantığı sadece servis katmanında yaşar.*

| Component | Responsible for | NOT responsible for |
|---|---|---|
| API/WS handlers | validate input, authenticate, delegate | business rules |
| Service layer (`src/services/`) | business rules, transaction boundaries | HTTP/WS wire format, SQL detail |
| DB layer (`src/db/`) | data access, migrations | business rules |
| Next.js client | render UI, call token API | auth/session state, business rules |

## Key flows
*Üç ana akış: davetiye ile kayıt, mesaj gönderme, oda yaşam döngüsü.*

**Invite signup:** invite code validated → account created → access + refresh tokens issued (ADR-0002) → client stores tokens, not a server session cookie.

**Send message:** client sends over WS → handler validates + delegates to service → service writes to DB, appends an XP event (ADR-0004) → service broadcasts to room subscribers in-process. "Room subscribers" is now literal (ADR-0009, M7a Slice B): a socket only joins the WS rooms it holds `RoomMember` rows for, scoping fan-out instead of every open connection — membership is a broadcast/list-scoping mechanism, not access control, so any authenticated user can still read/post to any active room by name regardless of membership.

**Room lifecycle:** user creates a room (rate limit TBD, open question from PRD) → 14 days with no new messages → auto-archived (read-only, hidden from active list) → 60 more days with zero views while archived → hard-deleted (ADR-0006).

## Boundaries & rules
*Handler'lar iş mantığı görmez; servisler HTTP/WS detayı görmez; modüller arası import public arayüz üzerinden olur.*

- Service layer never sees a raw HTTP/WS request object or response — only plain arguments and return values.
- Handlers validate + delegate only; zero business rules in `src/api/`.
- Cross-module imports go through a module's public interface, not internal files.
- The WebSocket gateway and REST controllers both call the same service layer — no duplicated business logic between them.

## Deliberately not doing
*Bilinçli olarak ertelenenler: mikroservis ayrımı, Redis pub/sub, yatay WS ölçekleme, ltree, zaman bazlı partition.*

- **Separate WS service, Redis pub/sub adapter, horizontal WS scaling** — premature at ~600 users; single-process WS handles this load. Revisit only when a real multi-instance need appears (ADR-0003).
- **ltree/closure table for the invite tree** — a plain adjacency list suffices at this scale (Phase 1 finding).
- **Time-partitioned message tables** — plain Prisma pagination suffices; partitioning solves a problem 10-100x this scale away.
- **Geographic room hierarchy** — replaced entirely by core + user-created rooms (ADR-0006).

## Scaling assumptions
*Beklenen yük küçük; ilk kırılacak yer muhtemelen WS bağlantı/bellek ayak izi, DB değil.*

- Expected load: ~600 users at 6 months (soft ceiling, not a target), low message volume, presence/typing events being the chattier traffic — not messages themselves.
- First thing likely to break: single-process WS connection count or memory footprint under a traffic spike, not the database. Mitigation when it happens: move presence to Redis and add a second instance — not before.
- Prisma + a single managed Postgres instance is not the bottleneck at this scale.

## ADRs
Five decisions, each expensive to reverse, get their own ADR under `docs/decisions/`:
- ADR-0002 — API boundary: token-based auth, not Next.js session cookies
- ADR-0003 — Monolith-first deployment
- ADR-0004 — Reputation/XP as an append-only event log
- ADR-0005 — Data retention: anonymize-on-delete, not hard-delete
- ADR-0006 — Room model: core + user-created rooms, archive/delete lifecycle, no geography
