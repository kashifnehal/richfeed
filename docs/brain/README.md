# docs/brain — the project's living memory

This folder is a running record of **where RichFeed is and why** — product and
business context, architecture, the decisions we've made, a build changelog, and
per-platform / per-feature status. It exists so a human coming back after weeks
away, or a fresh Claude Code session with zero prior context, can get oriented
without re-deriving everything from git history and old chat threads.

It is **not** application docs. Nothing here is imported by code. If it's about
*how the running system behaves in detail*, it belongs in code comments or
`CLAUDE.md`; if it's about *what we're building, why, and how far along we are*,
it belongs here.

## What's in here

| File | What it holds |
| --- | --- |
| `README.md` | This file. |
| `PRODUCT.md` | Product vision, target user, feature scope, roadmap. Maintained by hand (planning thread), not by build steps. |
| `BUSINESS.md` | Business context: who this is for, monetisation thinking, approval-gate / platform-policy landscape. Maintained by hand. |
| `ARCHITECTURE.md` | The real current stack, repo tree, and system flow. |
| `DECISIONS.md` | Dated ADR-style log of real decisions (and reversals). **Newest entry at the bottom.** |
| `CHANGELOG.md` | One dated entry per real build-step commit, oldest first. |
| `platforms/STATUS.md` | Every target platform, its tier, wiring status, and blocker. |
| `platforms/<name>.md` | Per-platform integration detail — only substantive once a real adapter exists. |
| `features/STATUS.md` | Every page in the product and how real it currently is. |

`PRODUCT.md` and `BUSINESS.md` were authored in the planning thread and are
dropped in by hand. If they're missing when a build step runs, that step leaves
a short placeholder stub so nothing is ever absent — the stub is meant to be
overwritten with the real file, not edited in place.

## Maintenance convention — this is part of "done", not a one-time exercise

**Every future build-step prompt run in this repo must end its commit by
updating whichever `docs/brain` files it touched.** Treat this the same way you
already treat writing a good commit message and reporting the SHA: it's part of
the definition of done for the step, not optional cleanup.

Concretely, for each build step:

- **`CHANGELOG.md`** — always add an entry (use the template at the bottom of
  that file).
- **`ARCHITECTURE.md`** — update if the repo structure, stack, or system flow
  changed.
- **`platforms/STATUS.md`** and **`platforms/<name>.md`** — update if any
  platform's wiring status or blocker changed (e.g. an adapter went from
  "not started" to "real OAuth+publish live").
- **`features/STATUS.md`** — update if a page moved between "not built" /
  "empty-state only" / "live data".
- **`DECISIONS.md`** — add an entry if a real decision was made or reversed
  during the step.

If a step changed none of the above except shipping code, it still gets a
`CHANGELOG.md` entry.
