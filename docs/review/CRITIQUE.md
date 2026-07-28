# KOQEP — Adversarial Critique (Phase 1)

18 findings, 12 FATAL/SERIOUS.

---

## Product & growth

### [FATAL] Cold-start friction stack from zero community
Claim: Invite-only + text-only + terminal UI + mandatory TOTP + phone verification, aimed at cold-acquired users, compounds to near-zero activation.
Why: Each gate loses 20-40% of signups; stacked, of 100 invited strangers maybe 3-5 send a first message — into a room that's likely empty (next finding).
Precedent: Slack/Discord/IRC grew inside a pre-existing group that supplied users and content before friction was added. You have neither.
Fix: Cut phone verification and mandatory TOTP for v1. Keep invite-only as the only gate.
Cost: You invite once, get near-zero activation, misdiagnose it as "nobody wants this."

### [FATAL] Geographic room hierarchy guarantees empty rooms
Claim: Country → Region → City produces hundreds of rooms; at 100-600 users almost all are permanently silent.
Why: A silent room reads as "dead platform" on first look — and worsens with more geo granularity, not less.
Precedent: Discord servers are topic-scoped and opt-in, not auto-generated per city.
Fix: A handful of topic rooms + one global room. No geography until a cluster exceeds ~30 active users.
Cost: Every new user's first impression is a ghost town.

### [SERIOUS] Level-10 invite gate is too slow to produce growth
Claim: At ~1 level/3 days, invite rights unlock after ~30 days. (Cap 4000 at this rate ≈ 33 years — decorative, say so.)
Why: With zero starting users, growth can't compound until month 2+, if the funnel's survivors last that long.
Fix: Decouple invites from leveling; gate on activity (10 messages + 3 days).
Cost: A growth mechanism that fires after the cohort is already gone.

### [SERIOUS] No defined retention hook
Claim: Nothing brings a user back on day 2, 7, or 30.
Why: Terminal aesthetic earns a first try, not a return visit — novelty fades in days.
Precedent: Discord's retention is social graph + notifications, not its skin.
Fix: Define one concrete pull (mention/DM notification, "who's active now") before v1.

---

## Architecture

### [FATAL] Stack is 3 months of ops before user #1
Claim: NestJS + Next.js + separate WS layer + Redis + Docker, solo, first production ops, 30 hrs/week — not a one-week walking skeleton.
Why: Each piece is a separate deploy target and failure mode, for zero users. Contradicts your own M0 requirement.
Precedent: Solo-founder chat apps ship monolith-first, split only when a real bottleneck forces it.
Fix: One deployable service, managed host, managed Postgres, Redis only when presence needs it.
Cost: Hours burned on infra instead of the funnel/retention problems, which matter more.

### [SERIOUS] Auth must live behind a token API, not Next.js cookies
Claim: Mobile in 6+ months means session state can't live only in Next.js cookies.
Why: A native client can't consume browser cookies; retrofitting later rewrites every auth flow.
Fix: Backend issues access + refresh tokens now; Next.js is just its first consumer. ADR material.
Cost: Mobile launch becomes an auth rewrite, not a new client.

### [SERIOUS] Mobile forces push notifications — name the tradeoff
Claim: Backgrounded mobile drops WebSockets; APNs/FCM become unavoidable once native ships.
Why: Contradicts a minimalism pitch — but minimalism is a UI philosophy, not an infra one.
Fix: Push stays mobile-only. Cost ≈ $0 at 600 users (FCM free tier).

### [MINOR] WebSocket horizontal scaling is premature
Claim: Sticky sessions, Redis pub/sub fan-out, multi-instance WS aren't problems at 600 users.
Why: The real near-term cost is typing-indicator write volume, not scale.
Fix: Single WS process for v1; throttle typing events server-side regardless.

---

## Data model

### [SERIOUS] Contradiction: 30-day deletion vs. public messages others depend on
Claim: "Personal data deleted after 30 days" can't coexist with public threads others' context depends on.
Why: Hard-deleting a message breaks the thread for everyone who read or replied to it.
Precedent: Discord and Reddit anonymize (strip author link) rather than delete content.
Fix: Anonymize authorship on deletion; hard-delete only account PII. Likely satisfies GDPR Art. 17/KVKK — uncertain on TR case law, worth a cheap legal check.
Cost: Public history breaks, or the privacy policy is quietly false.

### [SERIOUS] Multi-device read state is underestimated
Claim: Unread counts across web + mobile need a server-owned cursor, not a client-local one.
Why: Two clients marking "read" independently desync — double-notify or drop unread state.
Fix: Server-owned read-cursor table (user, room, last_read_message).
Cost: Invisible solo, surfaces at mobile launch.

### [SERIOUS] Reputation/XP should be event-log-recomputable
Claim: XP should derive from an append-only event log, not a mutable total.
Why: Mutable counters can't be corrected after an abuse-rule change without manual reconciliation.
Fix: Store XP events; materialize totals as cache, not source of truth. Expensive to retrofit — ADR candidate.

### [MINOR — nothing wrong here] Invite tree + pagination
Claim: Plain adjacency list + standard Prisma cursor pagination are fine at 600 users.
Why: ltree/closure tables and time-partitioning solve problems 10-100x this scale away.
Fix: None needed now.

---

## Security & abuse

### [FATAL] Kill phone verification
Claim: Adds PII liability without meaningfully improving on what invite-only already provides.
Why: A motivated sybil attacker isn't stopped by a $2 SIM; you're left holding numbers and KVKK/GDPR exposure.
Fix: Drop it. Rely on invite-tree rate limits + TOTP/WebAuthn.
Cost: Regulated PII you explicitly want to avoid, for a control that barely controls.

### [SERIOUS] Mandatory TOTP with no recovery path
Claim: The single most common support burden in TOTP-mandatory products — and you're the entire support team.
Why: Users lose phones constantly; "mandatory, no recovery" means permanent lockout or manual verification, solo.
Fix: TOTP optional at signup, encouraged after; add recovery codes if kept mandatory.
Cost: A trickle of angry, locked-out early users — the ones you can least afford to lose.

### [FATAL] Turkey's 5651 is a distinct, commonly-missed obligation
Claim: 5651 requires log retention and takedown-response for TR-reachable platforms — separate from GDPR/KVKK.
Why: Real enforcement regime, routinely missed because GDPR checklists don't cover it.
Fix: Log retention policy + documented takedown process before real traffic. Not a lawyer — needs a real check, budget now.
Cost: Exposure scales with users, discovered only when expensive.

### [SERIOUS] /sudo is a social-engineering target dressed as a feature
Claim: A hidden admin-flavored command is exactly what a bad actor DMs new users about.
Fix: Cut it, or gate behind a real re-auth challenge with no privileged effect.
Cost: First "security incident" is a self-inflicted easter egg.

---

## Monetization

### [SERIOUS] Boost = faster XP corrupts the reputation signal
Claim: Selling progression inside a trust-signaling system destroys the thing being sold.
Why: Purchasable XP means level stops meaning "earned track record," undermining invite gating and sybil resistance both.
Alternatives: cosmetic prompt themes, extended history/search retention, larger private-room capacity, one-time supporter badge not tied to level.
Cost: Power users notice pay-to-win; abuse-resistance degrades.

---

## What I am missing entirely

### [SERIOUS] No observability/on-call plan
Claim: No monitoring, alerting, or incident-response plan exists.
Why: Solo means you're the entire on-call rotation; without alerting, you learn about outages from angry users.
Fix: Uptime check + free-tier error tracking before real users arrive. Cheap, not optional.

Also absent, not expanded here: backup/restore, ToS/privacy policy, i18n (spec is multi-country, no language plan), accessibility (mono B&W has real contrast/screen-reader implications), search, moderator tooling, abuse-SLA, email deliverability, offline reconnect/ordering.

---

## KILL LIST
- **Phone verification** — PII liability, near-zero sybil benefit.
- **Country→Region→City rooms** — guarantees empty rooms until far larger scale.
- **Mandatory TOTP** — make optional; solo support burden otherwise.
- **Level-10 invite gate** — replace with activity-based unlock; keep invite-only principle.
- **/sudo command** — social-engineering surface, no product value.
- **Shadow ban** — doesn't work where users know each other; use transparent temp-mute.
- **Boost = faster XP** — corrupts the reputation system it's attached to.
- **NestJS + WS + Redis + Docker split** — collapse to one service for v1.
- **WS horizontal-scaling design** — not a problem until far past 600 users.
- **ltree/closure-table/partitioning** — premature; plain structures suffice.

## RISKIEST ASSUMPTION
That technical Discord refugees want a *less*-featured, text-only, terminal chat badly enough to switch cold, with no community pulling them in, and then invite others themselves. Everything else here is optimization; if this is false, none of it matters.

Cheapest test (<2 weeks, no production infra): a one-page manifesto + invite waitlist posted into 2-3 relevant technical communities. If strangers request invites, put the first 20-30 into one bare-bones room (throwaway infra) and see if they talk unprompted. If not, no architecture fix saves the product.
