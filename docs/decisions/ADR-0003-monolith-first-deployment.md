# ADR-0003: Monolith-first deployment

**Date:** 2026-07-28
**Status:** Accepted

## Context
*Orijinal stack (NestJS + Next.js + ayrı WebSocket katmanı + Redis + Docker) tek kişilik, haftada 30 saatlik, ilk kez production ops yapacak bir kurucu için gün 1'den itibaren dört ayrı parça yönetmek anlamına geliyordu.*

The original stack specified NestJS + Next.js + a separate WebSocket layer + Redis + Docker as independently-run pieces. For a solo founder with 30 hrs/week, first-time production ops experience, and a one-week walking-skeleton requirement (M0), that's four deploy targets and failure modes before a single real user exists.

## Decision
Ship v1 as one deployable NestJS service that serves both the REST/token API and the WebSocket gateway in-process. Next.js remains the web client, deployed separately as a static/SSR frontend, but it carries no backend logic. Redis and any service split are added only when an actual bottleneck is measured, not provisioned speculatively.

## Alternatives considered
- **Original 4-piece split (NestJS + separate WS service + Redis + Docker orchestration)** — rejected: this is the FATAL finding from the Phase 1 review — months of infra work for zero users, and directly contradicts the one-week M0 walking-skeleton goal.
- **Serverless functions for the API** — rejected: WebSocket connections don't fit cleanly into most serverless execution models (connection lifetime vs. function timeout); would add complexity to solve a scaling problem that doesn't exist yet at 600 users.

## Consequences
- Positive: a single service the founder can deploy, monitor, and debug alone; matches the actual team size and ops experience.
- Cost / risk accepted: when real scale arrives, splitting the WS gateway out and adding Redis pub/sub will require real migration work — deferred deliberately, not avoided forever.
- Cost to reverse later: moderate. Splitting a well-bounded monolith into services later is a known, incremental migration (extract the WS gateway, add Redis, add a load balancer) — cheaper than the reverse (un-splitting a premature microservice mess with no users to justify it).
