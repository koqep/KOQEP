# KOQEP — PRD

*Bu doküman Phase 1 eleştirisi sonrası yeniden tasarlanan ürünü tanımlar; orijinal spec değil.*

## Problem
*Discord'un görsel/dikkat dağıtıcı gürültüsünden rahatsız olan teknik kullanıcılar, sade ve hızlı bir metin-odaklı alan istiyor.*

Technical users on Discord are drowning in emoji reactions, voice channels, embeds, and visual noise that compete with actual conversation. They want a fast, text-only, keyboard-first space, and are willing to trade Discord's feature breadth for calm. KOQEP is that space: terminal-styled, invite-only, real-time chat.

## Users
*Tek persona: sinyal isteyen, kalabalık değil küratörlü küçük bir topluluk isteyen teknik kullanıcı.*

One persona for v1: a technically literate user who values signal over reach, is comfortable with an invite-only gate as a quality filter rather than an obstacle, and explicitly does not want KOQEP to become Discord-sized.

## First-100-users strategy
*Büyüme agresif değil organik olacak; hedef geniş kitle değil, gerçekten sohbet eden küçük bir çekirdek.*

Cold acquisition through 2-3 relevant technical communities (a manifesto post, direct outreach), not growth-hacking. Every level-up grants 1 invite starting at Level 1 — invite-gating stays as a quality filter, but no longer blocks growth for ~30 days per user. Success is a small group that actually talks daily, not a large signup count. No paid acquisition, no referral incentives — this is an explicit scale decision, not a budget one.

## v1 scope
*Kapsamda: davetiyeli giriş, opsiyonel TOTP, sabit + kullanıcı üretimi odalar, metin mesajlaşma, olay-günlüğü tabanlı itibar sistemi.*

- Invite-only signup. TOTP available, optional (not mandatory) — no phone verification.
- Rooms: a small fixed set of always-on core rooms (#general, #meta) plus user-created rooms with a free-form topic. A user-created room with no new messages for 14 days auto-archives (read-only, hidden from the active browse list, still linkable). An archived room with zero views for a further 60 days is hard-deleted. No geographic room structure or filtering anywhere. Profile keeps a free-text "region" field — informational only, self-set, never used for access or filtering.
- Text messaging with edit history retained (visible to moderators, abuse-review purpose).
- Reputation/XP stored as an append-only event log, not mutable counters.
- Single deployable monolith service (collapsed from the original NestJS/Next.js/Redis/Docker split) — Redis and service splitting added only when an actual bottleneck appears.
- Token-based auth API (access + refresh tokens) from day one, so a native mobile client can be added later without a rewrite. The mobile client itself is not built in v1.

## Non-goals (v1)
*Kapsam dışı bırakılanlar ve nedenleri.*

- **Mass-scale growth** — explicit founder decision; this is a niche community, not a growth business.
- **Phone verification** — PII/regulatory liability with near-zero marginal sybil benefit over the invite tree at this scale.
- **Boost-for-XP monetization** — selling progression corrupts the reputation signal it's built on.
- **Geographic room browsing** — guaranteed to produce empty rooms at this user count.
- **Native mobile app** — backend is mobile-ready; the client is a v2+ effort (6+ months out per founder timeline).
- **Voice, video, images** — confirmed as out of scope from the original spec; not reversed by this review.

## Success metrics
*Başarı, kayıt sayısı değil gerçek günlük aktif sohbet ile ölçülür.*

- A real daily-active conversational core actually chatting daily by month 3 — this is the founder's own definition of done. **Revised 2026-08-12:** the invite wave itself now explicitly targets ~500 registered users (not the 15-30 originally written here) — the daily-active core is still expected to be a fraction of that, this line no longer states a specific small number since the input population changed. Product analytics (`docs/milestones/M7-scale-and-critical-fixes.md`) exist specifically to measure the real daily-active number once this wave goes out, rather than assume it.
- The original brief's "~600 users at 6 months" was kept as a soft infra/cost-planning ceiling through M2-M6 (20-30-person launch cohort) — **as of 2026-08-12 this is no longer a soft ceiling, it's the actual near-term target** (~500 users, one invite wave). `docs/BACKLOG.md`'s "Karar kuralı (500 kullanıcı dönemi)" section is now the governing scope criterion; see `docs/milestones/M7-scale-and-critical-fixes.md` for what that requires.
- Zero users lost to account lockout from TOTP (recovery path must work).
- No week with zero new messages in any core room.

## Removed from original scope
*Orijinal spesifikasyondan çıkarılanlar, tek satır gerekçeyle.*

- Phone verification — PII liability outweighs marginal sybil benefit.
- Mandatory TOTP — made optional to avoid solo-founder support burden from lockouts.
- Geographic room hierarchy — replaced with core + user-created rooms, no geo filtering.
- Level-10 invite gate — replaced with 1 invite per level-up from Level 1.
- `/sudo` hidden command — social-engineering surface with no product value.
- Shadow ban — ineffective at this scale where users know each other; replaced with transparent temp-mute (TBD in security phase).
- NestJS + separate WS + Redis + Docker split — deferred, not removed; collapsed to one service for v1.

## Open questions
*Sonraki fazlarda karara bağlanacak konular.*

- [x] Rate limit on user-created room creation — resolved Phase 5: 1 new room per user per 24h. See `docs/THREAT-MODEL.md` row 6.
- [ ] Final tuning of the 14-day archive / 60-day delete windows — reasonable defaults, not load-tested.
- [x] Is edit history visible to all users, or moderators only? — resolved Phase 5: visible to the message's own author and to moderators only, never public. See `docs/THREAT-MODEL.md` row 3.
- [ ] Which of the 4 non-XP monetization alternatives from Phase 1 to prototype first, and when.
- [ ] 5651/KVKK compliance checklist — flagged as real but not yet resolved; needs a cheap legal check before real traffic.
