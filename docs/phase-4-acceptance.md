# Phase 4 acceptance checklist

Accepted by the user on November 1, 2026 after implementation, hosted verification, an independent code review and a separate requirement-completeness audit. The user authorized GitHub commit, push and squash merge, followed by a new chat starting phase 5.

- [x] Separate Short Track and Long Track directories with an explicit latest-data season, scoped server search/counts and 25-competition pages; desktop table and compact mobile list.
- [x] Competition UI exposes Division, Distance and Round with AND semantics. Structured Gender data and backend query support remain intact. Season-menu cosmetics are deferred by explicit user choice.
- [x] Exact event/result-to-entry association, including mixed Master events and the two entries for long-track bib 370; ambiguous membership stays explicit rather than guessed or duplicated.
- [x] Source event identity, all heats/lettered finals, original places, qualifications, statuses, missing times and physical source pages remain available. Time order is not an official overall classification.
- [x] URL-based directory/detail/search/page/profile state supports refresh, sharing, browser navigation and return-to-directory behavior. Empty results never silently broaden a scope.
- [x] Source-backed skater search and profiles, explicit reviewed identity mappings, isolated pending identities, existing evidence-based skating age and optional complete race history.
- [x] Automatic personal bests across all published seasons, one bucket per discipline and distance; exact positive status-free times only, all ties preserved, full-dataset aggregation and source/race links. No profile scope selection is required.
- [x] Schema-only appended migration 0007, validated versioned dimensions and guarded source-evidence backfill preserve 171 events, 443 races, 2,309 results, 289 participants, 290 entries, 141 classification pages, original PDFs and publication lineage.
- [x] Independent review's single P3 search-card representative mismatch is resolved; card ID/name use one matching row and identity review status is independently aggregated.
- [x] 84 backend tests, 62 Python tests, TypeScript checking and production build pass. Hosted evidence verifies 289 profiles, 1,002 PBs, result/filter counts, original source fields/PDF hashes and protected operator reads. Current private Site version is 16.
- [x] Independent completeness audit found no substantive phase 4 blocker within the two reviewed protocol revisions. The audit used source, local/in-memory tests and saved hosted evidence; it did not recertify production permissions through new network calls.

Evidence and reproducible operations: [completion record](phase-4-completion.md), [source dimension audit](phase-4-source-audit.md), [data dictionary](data-dictionary.md). Credential-free operational outputs remain ignored.

## Next stage

Phase 5 adds individual performance charts and same-discipline/same-distance multi-skater comparison. Preserve all valid appearances, offer a per-competition best view, distinguish competition date ranges from individual race dates, and keep source statuses out of numeric chart points. Every plotted point must trace to its source result and agree with the results list. Track specifications are used only when source-backed.

Broader historical source/season coverage remains phase 6. Admin A0–A7, domains, login changes, scheduling/email and Season-menu visual redesign remain deferred. GitHub stays public and the existing Site stays owner-private. No additional Site or worktree is required.
