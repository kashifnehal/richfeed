---
title: RichFeed — Business
last_updated: 2026-08-28
status: living document — update this file whenever positioning, blockers, or business-model thinking changes
---

# RichFeed — Business

## Audience sequencing

Built for a single operator's own use first — real multi-tenancy in the data model from day one (RLS-scoped by `auth.uid()`), but effectively single-tenant at launch. If it works well, the intent is to spin it out as a standalone SaaS sold to anyone with the same daily-multi-platform-posting problem: solo creators, small businesses, agencies managing multiple client accounts. This ordering is deliberate: build for the immediate use case first, but never make a decision that would require a rebuild to serve outside customers later. Retrofitting multi-tenancy after the fact is expensive; including it from the start while only using it internally is nearly free.

## Competitive landscape

Six direct competitors researched: Buffer, Hootsuite, Later, Publer, SocialBee, Metricool. All six cover roughly the same core platform set, all have a visual content calendar and multi-account scheduling, and AI captions + best-time-to-post suggestions are now close to standard everywhere. This is a mature, crowded category with clear table stakes — a new entrant has to be meaningfully cheaper, meaningfully more reliable, or meaningfully differentiated, not just "another scheduler."

## The positioning wedge: reliability and trust, not features

The clearest opportunity found across the research isn't a missing feature — it's trust and reliability. Recurring, public complaints across competitors: Instagram/Reels posting failures (Buffer has its own troubleshooting docs for this), opaque billing/renewal practices (Later sits at a 1.3/5 Trustpilot rating largely from this), platform support disappearing without warning (Later dropped X/Twitter entirely with a hard cutoff date), and per-account pricing that balloons for anyone managing many accounts. A product that is boringly, verifiably reliable at the one job description — post the right thing, to the right account, at the right time, every time — and transparent about billing is a real, evidenced wedge, not a guess. This is why the product's core UI promise (dashboard docs call it "what's working, what's failing, what needs attention, always visible") is treated as the differentiator, not a nice-to-have.

## Business model (placeholder — not yet decided)

Not decided yet; flagged here only so it isn't lost. Competitor pricing anchors for when this becomes real: entry tiers range roughly $5/channel/month to $99/user/month; free tiers range from generous (Publer) to nonexistent (Hootsuite, Later, SocialBee). The reliability/billing-transparency wedge above is a plausible core positioning if/when this becomes a real priced product — revisit this section when go-to-market actually gets planned, don't treat the numbers above as a decision.

## Platform approval blockers (Track A — external, file-and-wait)

Four of six real blockers — Meta Advanced Access, TikTok's content-posting audit, Pinterest Standard Access, and Meta's Threads App Review — all require the same two prerequisites before you can even submit: (1) a live, public Privacy Policy + Terms of Service page, and (2) a working demo of the real OAuth-connect-and-publish flow, often as a screen recording. Neither is platform-specific, which is why the fastest way to unblock four queues at once was to ship one small thing first: the policy page, plus a minimal working version of the product on a platform that needs no review at all (LinkedIn personal-profile).

| # | Blocker | Gates | Realistic timeline | Status |
|---|---|---|---|---|
| 1 | Meta Business Verification + Advanced Access App Review | Instagram/Facebook posting for accounts other than the operator's own | Verification 1-2+ wks; review itself 4-8+ wks realistic w/ any rejection cycle | Not started |
| 2 | TikTok Content Posting API audit | Direct Post (true automated public posting) | "Several days to two weeks" per TikTok, budget 2-4+ wks incl. resubmission | Not started |
| 3 | Pinterest Standard Access | Public (non-sandboxed) Pins | 3-4+ wks, no official SLA | Not started |
| 4 | Meta Threads App Review | Production Threads posting for other users | Meta's 2026 guidance: up to ~20 days | Not started |
| 5 | LinkedIn Company Page Partner Program | Posting to LinkedIn Company Pages (personal-profile posting needs no approval at all) | No official SLA; independent estimates 4-8 wks best case, 3-4 months typical; favors applicants with an already-shipped product | Deliberately deferred — do not start until Tier-1 platforms are live with real usage to demo |
| 6 | X/Twitter developer account funding | Any X posting (pay-per-use since Feb 2026, no free tier) | 15 minutes, no review | Not started |

Update the Status column as each moves — this table should always reflect reality, not the original plan.

## Known platform economics worth remembering

X/Twitter is not free: $0.015/plain post, $0.20/post-with-a-URL (since Feb 2026), realistic MVP floor ~$10-30/mo; avoid links in auto-posted text (13x cost multiplier). LinkedIn personal-profile posting is free and instant. Meta, TikTok, Pinterest, YouTube are free at any volume — the cost is process/time (approval queues), not money. Revisit this section if any platform changes its pricing model — it has happened multiple times across these platforms in recent history, so treat pricing/policy as a quarterly-review item, not a fixed fact.
