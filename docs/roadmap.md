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
Rows are in recommended order. "Status" says what exists today.

| # | Item | Value | Effort | Status | Notes from the code |
|---|------|-------|--------|--------|---------------------|
| 1 | Pause and resume in auto-skip mode (user request, issue 13) | High | S | Done (PR 15, merged) | `pauseAutoSkip` / `resumeAutoSkip` already exist for the word modal; this exposes them as a button. |
| 2 | Your own sentences, saved in the app (user request, issue 12) | High | S | Done (PR 17, merged) | Same user review as row 1. Stored in localStorage, practiced through the existing "practice this sentence" path. |
| 3 | Delete recordings (issue 14, answers the user question in issue 2) | Medium-high | S | Done (PR 16, merged) | Only Reset App deleted recordings, and it also wiped history and streaks. Per-recording and delete-all, keeping history. |
| 4 | DontApply import (interview Q and A) | High (user-requested, feeds the main audience) | M | Done (PR 11, merged) | New content source; contract is in issue 5 and in the PR. |
| 5 | Explore and browse sentences by level and category (issue 7) | High | S | Not started | Data and level/category selects already exist in Options; today the user only gets a random sample. A browse list with "practice this" reuses `startPractice`. No new storage. |
| 6 | Export tools for recordings (issue 8) | High | S | Not started | Recordings are `Blob`s in IndexedDB; a per-sentence or all-recordings download (single file, later zip) needs no backend and strengthens the privacy story. |
| 7 | Custom video and subtitle upload (issue 9) | High | L | Not started | Biggest differentiator. Needs SRT/VTT parsing (easy, testable), a local `<video>` player synced to cue times, storage decisions for large files (do not persist the video; keep only cues), and a new practice flow. Local-only, so it fits the privacy promise. |
| 8 | Gamification (badges, levels, rewards) | Medium | M | Deferred | Streak and practice history exist, so badges can be derived from `practices`. Value is retention, not learning; risk of noise. |
| 9 | Community sharing | Medium, uncertain | L | Deferred | Needs a backend, moderation and accounts, which conflicts with offline/privacy-first. A cheap alternative is sharing a collection as a file or link using the import format from issue 5. |
| 10 | YouTube API integration | Medium | L, plus recurring cost | Deferred | README already flags API cost. Also terms-of-service limits on caption access and playback control. Do after row 7 proves the video flow. |

## Recommendation

1. Rows 1 to 3 first: real users asked for them (an app-store review and issue 2) and each is small. Their pull
   requests are open and waiting for review.
2. Then row 4, the DontApply import (PR 11, merged; it only works once DontApply provides the endpoint from its issue 48).
3. Then build **row 5 (explore by level and category)** and **row 6 (export recordings)**: both are small, use
   existing data, need no new infrastructure, and give visible value fast. Row 5 also helps new users who do not
   know what to type. These are the proposed top 2 after the DontApply link.
4. Plan **row 7 (video and subtitle upload)** as the next large feature; a spike on SRT parsing and cue-synced
   playback comes first.
5. Defer gamification, community sharing and YouTube. Revisit sharing once the import format exists, as
   file-based sharing; revisit YouTube only if row 7 shows demand.

Tracking issues: 13 (row 1), 12 (row 2), 14 (row 3), 5 (row 4), 7 (row 5), 8 (row 6), 9 (row 7).

Source of rows 1 and 2: a user review in an app store asking to "add our own sentences, saved in the app for later
access" and a "temporary pause" in automatic repeat mode.
