---
title: RichFeed — Product
last_updated: 2026-09-18
status: living document — update this file whenever product scope, audience, or priorities change
---

# RichFeed — Product

## What it is

RichFeed is a social media scheduling and multi-account publishing platform. A user connects social accounts across platforms (LinkedIn personal, Instagram, Facebook Pages, X/Twitter, YouTube, Threads — rolled out platform-by-platform), composes a post once, picks which connected accounts to target, schedules it for an exact date/time, and RichFeed publishes it via each platform's own API at that moment. It tracks publish status per target (scheduled / published / failed / needs-reconnect) and surfaces failures clearly.

Same category as Buffer, Hootsuite, Later, Publer, SocialBee, Metricool — a scheduling and publishing tool, not a content-creation tool (users supply finished captions/media), not a social-listening or inbox tool, not an ads/boosting tool.

## Core value proposition

Reliability and visibility, not more features. The core promise: "which posts are working, which are failing, which accounts need attention" is always visible at a glance, never buried. This is a deliberate positioning choice — see `BUSINESS.md` for why.

## Problem statement

Posting content to multiple platforms, multiple times a day, across multiple accounts, at specific times, doesn't scale by hand — it silently stops happening within days. This is a scheduling/publishing automation problem, not a content-creation problem: content is prepared separately; the product's job is to take finished content plus a target account plus an exact time and reliably make it appear, correctly, every time.

## Must-have functionality (v1 / MVP)

1. Multi-platform scheduled posting (platform rollout order below).
2. Exact date/time scheduling per post, per platform — not "roughly this week," not an AI-suggested time.
3. Multiple accounts per platform, chosen per post — never a single implicit account.
4. Pre-made content upload (image/video/carousel) — no in-app content generation.
5. Captions and hashtags per post, editable per platform (a caption written for one platform often needs trimming/reformatting for another).
6. Real OAuth per platform for every connected account — never a shared login, never scraping.
7. Reliable, complete, correct publishing as a hard reliability bar — a silently-failed post, a broken image, or a dropped caption is a product failure, not an edge case.
8. A queue/calendar view showing what's scheduled, for what account, at what time.

## Should-have / post-MVP (not launch-blocking)

AI-assisted caption/hashtag suggestions; best-time-to-post suggestions; bulk/CSV upload scheduling; post recycling/evergreen content queues; basic analytics; team/approval workflows (relevant once multi-tenant use is real, not for a single-operator launch); link-in-bio landing page; first-comment auto-hashtag posting (a plausible wedge — no researched competitor clearly owns this).

## Explicitly out of scope for v1

Content creation/generation (image/video/caption generation); social listening, competitor monitoring, unified inbox/DM replies; paid ad management/boosting; white-label/reseller/agency tooling; any platform without a real, ToS-compliant posting API (Snapchat — confirmed no such API exists).

## Platform rollout priority

**Tier 1 — build first, low friction:** Instagram + Facebook (Meta, own-account posting), Twitter/X, LinkedIn personal-profile, YouTube, Threads (dev-mode). Either free-and-instant (LinkedIn personal, YouTube's basic flow, Threads dev-mode) or free-with-a-bounded review process (Meta Advanced Access, Threads production).

**Tier 2 — production capability gated by a review process measured in weeks:** Instagram/Facebook multi-tenant (Meta Advanced Access), Threads production App Review.

**Tier 3 — genuinely hard, deliberately deferred:** LinkedIn Company Page posting. Partner Program approval structurally favors applicants who already have a shipped product and customers — apply once Tier 1 is live and there's something real to demo, not before.

**Excluded:** Snapchat (no organic posting API exists). **Permanently out of scope (founder decision):** TikTok and Pinterest — not planned, not a future tier. **Deferred, low priority:** Reddit (API access is trivial; the real constraint is community anti-spam norms, a messaging problem more than an engineering one).

## Current build status (update this section every step)

- Product is **live in production** as of commit `2716e3d`: web at `richfeed.social` (Vercel); API + worker on Railway (`richfeed-api` / `richfeed-worker`). Public API: `https://richfeed-api-production.up.railway.app` (`GET /health` 200).
- Scheduling engine (data model, encrypted token storage, BullMQ scheduler/worker with real enqueue on create/reschedule): live.
- Real frontend app — every MVP page, real Supabase Auth, real backend routes: live.
- Public legal pages (no auth): `https://richfeed.social/privacy`, `https://richfeed.social/terms`, `https://richfeed.social/data-deletion`. Footer-linked from sign-in and the dashboard. Required for Meta App Review.
- LinkedIn (personal), X, YouTube, Instagram, Facebook, and Threads all have real OAuth + publish wired. Carousel / multi-image is wired on LinkedIn, Facebook Pages, Instagram, and Threads (X paused; YouTube has no carousel). Per-platform status, blockers, and known bugs live in `platforms/STATUS.md` — do not duplicate that detail here.
- TikTok and Pinterest are permanently out of scope. LinkedIn Company Pages remain deferred.

For exact commit SHAs and what shipped in each step, see `CHANGELOG.md`. For the full page/component spec, see the build-prompt archive (kept in the planning thread, not duplicated here to avoid drift).
