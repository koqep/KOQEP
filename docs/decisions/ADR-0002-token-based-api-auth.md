# ADR-0002: Token-based API auth, not Next.js session cookies

**Date:** 2026-07-28
**Status:** Accepted

## Context
*Mobil uygulama 6+ ay sonra geliyor ama backend'in baştan mobil-uyumlu olması gerekiyor; oturum yönetimi Next.js'e bağlı olursa mobil istemci session cookie'lerini tüketemez.*

Native mobile is planned as a v2+ effort (6+ months out per the founder), but the API must not require a rewrite when that client arrives. If session state lived only in Next.js (server-set cookies), a native app would have no natural way to consume it, and adding token auth later would mean touching every authenticated route and re-issuing every session flow.

## Decision
The backend NestJS service issues short-lived access tokens and longer-lived refresh tokens on login/signup. Next.js is treated as just the first API consumer — it stores tokens (e.g., in an httpOnly cookie for the web client specifically, but the *API* itself is cookie-agnostic) and calls the same token-authenticated endpoints any future mobile client will call. No business logic or session authority lives in Next.js.

## Alternatives considered
- **Next.js-owned session cookies** — rejected: blocks mobile by construction; a native client can't send browser-scoped cookies, forcing a full auth rewrite at mobile launch.
- **Third-party auth-as-a-service (Auth0, Clerk, etc.)** — rejected: recurring cost and vendor lock-in not justified at $50/mo budget and 600-user scale; token issuance is not a hard problem at this size.

## Consequences
- Positive: mobile client, when built, is a new consumer of an already-mobile-ready API — no backend rewrite.
- Cost / risk accepted: slightly more auth code upfront (token issuance, refresh, revocation) than "just use Next.js sessions" would require.
- Cost to reverse later: high if deferred — reversing this after mobile ships means migrating every authenticated session and client simultaneously. Cheap to get right now; expensive to retrofit.
