# EchoTalk roadmap review

Status: 2026-11-23. Source: README "Next Up" and "Planned Enhancements", plus a read of the code
(`src/app.ts`, `src/services/*`, `src/index.html`). Tracking issue: issue 4.

## Constraints that shape the ranking

- **Privacy-first and offline-first**: no server, recordings stay in IndexedDB. Anything needing a backend or
  paid API conflicts with the product promise.
- **Small codebase** (about 3,300 lines of non-test TypeScript, jQuery plus Bootstrap, vitest). Cheap features fit well;
  features needing media sync or accounts are large.
- **Data already in place**: sample sentences live in `public/data/sentences/sentences-<locale>.json` as
  level -> category -> sentences, recordings and practice history are in IndexedDB (`recordings`, `practices`).

## Ranking

Value = benefit for a typical learner. Effort: S (days), M (about a week), L (weeks or more).

| # | Item | Value | Effort | Notes from the code |
|---|------|-------|--------|---------------------|
| 0 | DontApply import (interview Q and A) | High (user-requested, feeds the main audience) | M | New content source; contract is defined in issue 5. Done first. |
| 1 | Explore and browse sentences by level and category | High | S | Data and level/category selects already exist in Options; today the user only gets a random sample. A browse list with "practice this" reuses `startPractice`. No new storage. |
| 2 | Export tools for recordings | High | S | Recordings are `Blob`s in IndexedDB; a per-sentence or all-recordings download (single file, later zip) needs no backend and strengthens the privacy story. |
| 3 | Custom video and subtitle upload | High | L | Biggest differentiator. Needs SRT/VTT parsing (easy, testable), a local `<video>` player synced to cue times, storage decisions for large files (do not persist the video; keep only cues), and a new practice flow. Local-only, so it fits the privacy promise. |
| 4 | Gamification (badges, levels, rewards) | Medium | M | Streak and practice history exist, so badges can be derived from `practices`. Value is retention, not learning; risk of noise. |
| 5 | Community sharing | Medium, uncertain | L | Needs a backend, moderation and accounts, which conflicts with offline/privacy-first. A cheap alternative is sharing a collection as a file or link using the import format from issue 5. |
| 6 | YouTube API integration | Medium | L, plus recurring cost | README already flags API cost. Also terms-of-service limits on caption access and playback control. Do after item 3 proves the video flow. |

## Recommendation

1. Finish the DontApply import first (item 0).
2. Then build **item 1 (explore by level and category)** and **item 2 (export recordings)**: both are small, use
   existing data, need no new infrastructure, and give visible value fast. Item 1 also helps new users who do not
   know what to type.
3. Plan **item 3 (video and subtitle upload)** as the next large feature; a spike on SRT parsing and cue-synced
   playback comes first.
4. Defer gamification, community sharing and YouTube. Revisit sharing once the import format exists, as
   file-based sharing; revisit YouTube only if item 3 shows demand.

Issues opened for the recommended items: 7 (explore by level and category), 8 (export recordings), 9 (video and subtitle upload spike).
