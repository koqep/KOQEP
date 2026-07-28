# KOQEP — Architecture & Product Review Brief

## Your role

You are the technical co-founder of KOQEP, not a consultant I hired to please me.
Assume I am wrong about several important things and that finding them is the entire
value you provide. A review that produces no removals and no reversed decisions is a
failed review.

**Do not write application code in this brief. Not one line.**

---

## How to run this (read carefully — this changes everything)

1. Work in **numbered phases**. After each phase, **STOP and wait for my approval.**
   Do not run ahead. Do not merge phases.
2. Write each phase's output to a **file in the repo**, not into the chat. Announce the
   path and give me a 5-line summary in chat. Nothing longer.
3. Use **plan mode** before writing any file.
4. Respect the word limits per phase. If you cannot fit it, cut the weakest content —
   do not exceed the limit.
5. Never restate my specification back to me. I wrote it; I know what it says.
6. If you agree with one of my decisions, say so in **one line** and move on.
   Spend your words on disagreement, tradeoffs, and things I have not thought about.
7. If two of my requirements contradict each other, name the contradiction explicitly
   and do not paper over it.

---

## Context

**Product:** KOQEP — a text-only, invite-only, real-time social chat platform with a
terminal aesthetic. Black & white, monospace, keyboard-first. No voice, no video, no
file uploads, no images.

**Full feature list:** see `docs/raw-idea.md` (I will paste my original brief there —
treat it as a wishlist, not a requirements document).

**Platform sequence:** web first, **native mobile apps follow**. This is not optional
and not "maybe later." Design every decision from day one on the assumption that a
mobile client will consume the same backend.

**Intended stack (challenge it):** Next.js App Router, TypeScript, Tailwind, NestJS,
PostgreSQL, Prisma, Redis, WebSockets, Docker.

**My constraints — fill these in before running:**
- Team size: 1 (solo)
- Weekly hours available: 30
- Runway / infra budget per month: 50$
- Target date for first real users: 3 ay
- Realistic user count at 6 months: 600
- Do I intend to monetize? later

---

## PHASE 0 — Interrogate me first

Before any analysis, ask me **up to 12 questions**, ranked by how much the answer would
change your recommendations. Focus on:

- Who is the first 100 users and why would they leave their existing platform
- What happens on day 1 when a user joins and the rooms are empty
- Whether this is a business or a project
- What I would refuse to cut even if you proved it was wrong
- Anything in my spec whose *purpose* is unclear to you

Then **STOP.** Do not answer your own questions. Do not proceed to Phase 1.

---

## PHASE 1 — Adversarial review → `docs/review/CRITIQUE.md`

Max **1400 words.** No praise section. No summary of my idea.

Format each finding as:

```
### [FATAL | SERIOUS | MINOR] <short title>
Claim: <one sentence — what is wrong>
Why: <2-3 sentences — mechanism, not vibes>
Precedent: <how Discord/Slack/Reddit/Lobsters/Mastodon/IRC handled this, if applicable>
Fix: <concrete change>
Cost of ignoring: <what breaks, and when>
```

**Minimum 15 findings. At least 5 must be FATAL or SERIOUS.** If you cannot find 5,
you have not looked hard enough — look again at growth, retention, and unit economics,
not just at code.

You **must** cover every area below. State explicitly if you find nothing wrong in one.

### Product & growth (weight this heaviest — technical debt is survivable, no users is not)
- Cold start: invite-only + text-only + terminal UI + mandatory TOTP is a compounding
  friction stack. Model the funnel. How many of 100 invited people send a first message?
- Empty room problem: a Country → Region → City hierarchy creates hundreds of rooms
  with zero traffic. What is the actual room strategy at 50 users? At 500?
- Invite gating at Level 10 means a new user waits ~30 days before inviting anyone.
  Compute the growth rate this implies. Is the platform capable of growing at all?
- Level cap 4000 at ~1 level/3 days is roughly 33 years. Is the number decorative,
  is the curve non-linear, or is the cap wrong?
- Retention: what brings a user back on day 2, day 7, day 30? Be specific.
- Is "terminal aesthetic" a moat or a costume? What happens when the novelty wears off?

### Architecture
- Is NestJS + Next.js + separate WebSocket layer + Redis + Docker appropriate for my
  actual team size, or is it three months of infrastructure before a single user?
- Given mobile is coming: where should auth actually live? What breaks if Next.js owns
  session state?
- WebSocket scale: sticky sessions, horizontal scaling, Redis pub/sub adapter,
  reconnection and message ordering, backpressure. Presence and typing indicators are
  usually the expensive part, not messages — is that true here?
- Mobile kills WebSockets on background. That forces push notifications (APNs/FCM),
  which imports third-party dependencies into a platform whose pitch is minimalism.
  Name this tradeoff and resolve it.
- What is the monolith-to-services boundary, and at what user count does it matter?
- Is Prisma the right choice for this workload, specifically for message pagination
  and time-partitioned tables?

### Data model
- Message table growth and partitioning strategy from day one
- Read state / unread counts across multiple devices — this is harder than it looks
- Presence storage: Postgres, Redis, or in-memory, and what happens on restart
- The invite tree: adjacency list vs closure table vs ltree, and which queries it must serve
- Reputation and XP: recomputable from an event log, or mutable counters? Argue for one
- **Contradiction to resolve:** "all personal data permanently deleted after 30 days"
  versus public messages that other users' conversations depend on. Discord and Reddit
  both chose anonymization over deletion. Which do we choose, and does it satisfy
  GDPR/KVKK?

### Security & abuse
- Mandatory TOTP: what is the account recovery path when a user loses their device?
  This is the single most common support burden in TOTP-mandatory products.
- Phone verification: what threat does it stop that invite-only does not already stop,
  and is that worth holding phone numbers (cost, PII liability, breach exposure)?
- Sybil resistance via invite tree — but also: invite trees enable coordinated
  brigading. Both directions.
- Markdown rendering: XSS surface. Which renderer, which sanitizer, what is the CSP?
- Message edit as an abuse vector (post benign, edit to abuse after reputation accrues).
  Does moderation need edit history?
- Hidden `/sudo` command: is this a fun easter egg or a social-engineering target?
- Rate limiting: per-user, per-IP, per-room, per-connection. Which layer, which store?
- Shadow ban: does it actually work on a platform this small, where users know each other?
- Legal exposure for a Turkey-connected social platform: KVKK, GDPR, EU DSA, and
  Turkey's 5651. What obligations attach at what user count?

### Monetization
- Challenge "Boost = faster XP" directly. Paying for progression inside a reputation
  system corrupts the reputation signal. Argue the case, then propose 3–5 alternatives
  that do not sell status or visibility.
- What does the business look like at 1,000 users? At 10,000? Is it viable at all?

### What I am missing entirely
Assume my spec has gaps. Candidates to check, plus anything else you find:
message search, history pagination, offline reconnect and ordering, i18n (the product
is explicitly multi-country but has no language plan), observability and on-call,
backup and restore, ToS and privacy policy, abuse report SLA, moderator tooling,
onboarding flow, email deliverability, accessibility (a monospace black-and-white
keyboard-first UI has real screen-reader and contrast implications).

### Required closing sections
1. **KILL LIST** — features to remove or defer before v1, each with a one-line reason.
   Be aggressive. I would rather cut ten things than ship late.
2. **RISKIEST ASSUMPTION** — the single belief that, if false, makes the whole project
   pointless. Plus the cheapest experiment that would test it in under two weeks.

**STOP.**

---

## PHASE 2 — Product redesign → `docs/PRD.md`

Max **1000 words.** The product as *you* would build it after Phase 1, not as I
described it. Include: problem, first-100-users strategy, v1 scope, explicit
non-goals with reasons, success metrics, open questions.

Where you cut something I asked for, say so in one line under "Removed from original scope."

**STOP.**

---

## PHASE 3 — Architecture → `docs/ARCHITECTURE.md` + `docs/decisions/ADR-000X-*.md`

Max **900 words** for ARCHITECTURE.md.

Write a separate ADR for each of the **five most expensive-to-reverse decisions**.
ADR format: Context / Decision / Alternatives considered and why rejected / Consequences /
Cost to reverse later.

At minimum, one ADR must address the API boundary given that native mobile is coming.

**STOP.**

---

## PHASE 4 — Data model → `docs/DATA-MODEL.md`

Entities, relationships, invariants, growth and partitioning strategy, retention and
deletion policy. **Prose and tables, not a Prisma schema.** Max 800 words.

**STOP.**

---

## PHASE 5 — Security & abuse → `.claude/rules/security.md` + `docs/THREAT-MODEL.md`

Threat model as: actor → goal → attack path → control → residual risk.
Security rules file must be under 60 lines and written as enforceable instructions.

**STOP.**

---

## PHASE 6 — Delivery plan → `docs/milestones/`

Milestones as **vertical slices**, each demoable and testable. Not "M1: database layer."

M0 must be a walking skeleton: repo + CI + one endpoint + one screen + one real-time
message + one test + deployed. One week maximum.

For each milestone: goal, out-of-scope, acceptance criteria, checkbox task list, risks.
State which milestone is the earliest point a real user could use the product, and
argue for making it earlier.

**STOP.**

---

## PHASE 7 — Repo harness → `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `docs/STATE.md`

Set up the working configuration for months of development:

- `CLAUDE.md` — **under 150 lines.** Commands, directory map, invariant rules only.
  It is a router, not a document. Everything else loads on demand.
- `.claude/rules/*.md` — path-scoped via `paths:` frontmatter so they load only when
  relevant files are touched (api, db, ui, security, testing).
- `.claude/skills/` — repeatable workflows (new endpoint, new migration, release check).
- `docs/STATE.md` — the continuity file: what works, what is half-done, what the next
  step is, known traps. Under 60 lines, updated at the end of every session.
- Slash commands `/task` and `/wrap` to load and save that state.

Do **not** create MASTER_PROMPT.md, TODO.md, or a flat pile of top-level markdown files.
A single large always-loaded prompt file costs full price every session and measurably
reduces instruction adherence as it grows. Layered, lazily-loaded files instead.

**STOP.**

---

## Standing rules for the whole brief

- Every strong claim needs a mechanism or a precedent. "Best practice" is not a reason.
- Prefer boring, proven technology. Justify every piece of infrastructure by naming the
  specific failure it prevents.
- When you recommend something that costs me time or money, say roughly how much.
- If you are uncertain, say "I am uncertain" and state what would resolve it.
- Optimize for a product that ships and gets used, not for one that is architecturally
  impressive and empty.
