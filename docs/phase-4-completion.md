# Phase 4: competition and skater browsing

The existing visual design now supports separate Short Track and Long Track directories, a required selected season, server-side search/counts and 25-competition pages. The default is the most recent published season within the selected discipline. Empty scopes stay empty. Desktop uses a table; mobile uses compact competition rows.

Competition details provide independent Division, Distance and Round controls with AND semantics. Gender remains in the structured data and server query contract, but has no Competition page filter control. Broader selections list separate source events; opening an event includes all matching heats/final races. Small selections open their event tables automatically. Source event IDs and original labels keep repeated printed numbers and Group A/B separate. Original places, qualifications, statuses and absent times remain visible. Time order is explicitly a comparison, never an official overall classification.

The new schema stores entry gender/division keys, source event gender/division/competition group, and exact result-to-entry links. Migration `0007_structured_browsing` is schema-only; it does not rewrite applied migrations or seed/backfill data. Original roster division and source group labels remain unchanged. See [the source audit](phase-4-source-audit.md) for the reviewed mapping and mixed Master / multi-entry decisions.

## Query and navigation contract

- `GET /api/competitions/scopes` lists available discipline/season scopes.
- `GET /api/competitions?discipline=short-track&season=2025-2026&q=Nationals&page=1` returns a scoped page, exact total and page size 25.
- `GET /api/competitions/:id?gender=Women&division=Junior%20E&distance=500&round=Quarter-Finals` returns filtered rows, separate source event summaries and matching result/event/participant counts. `event=<existing event ID>` optionally narrows to a source event.
- Each dimension's options and result counts apply all the other selected dimensions in the same competition snapshot. An unavailable selected value remains selected with zero results. Clearing one filter never silently clears another. `Mixed` uses source event scope; Women/Men use applicable roster-entry gender. Mixed overlaps those roster counts and is not a third disjoint roster gender.
- `GET /api/skaters?q=Sara%20Cushman&page=1` searches current published roster names, source aliases, clubs and bibs across seasons/disciplines. It returns 25 identities per page; identical names remain separate unless explicitly linked. Counts describe matching competition records.
- `GET /api/participants/:id/profile` provides sourced observations and the existing evidence/rule-based skating age. Pending identity mappings expose no combined observations/age estimate.
- `GET /api/participants/:id/personal-bests` automatically returns the fastest valid recorded time per **discipline + distance**, across all active published seasons for the mapped identity. It accepts no season/discipline restriction. Every equal-best source performance is retained. Comparable results require a positive exact integer time and no result status; PEN/DNS/DNF/DQ/FNT/YC and missing finishes never establish a PB.
- `GET /api/participants/:id/records?page=1` returns all published source-backed history with 50 rows per page. Profile history is optional and collapsed below PBs; opening it requires no scope selections. The API retains optional explicit discipline/season parameters for direct scoped queries, without making them prerequisites. Pending identities remain restricted to their selected competition record. No date of birth, current club, individual race date or cross-competition identity is fabricated.

URL parameters retain directory discipline, season, search, page, competition, detail filters, optional event, record view, skater search/page, selected profile and history filters/page. Browser back/forward, refresh and sharing restore these states. Changing competition/disciplines/seasons clears incompatible detail selections; returning to the directory preserves its search/page and scroll position. An explicitly linked out-of-scope competition displays a scope message instead of silently switching seasons.

## Import contract and backfill

Server validation is now `competition-events/7`. Payload schemas 2/3 remain compatible. Prepared schema-3 candidates include an optional versioned `item.dimensions` projection; the server verifies every supplied value and entry link against the reviewed original heading/roster evidence. Existing candidates without the field derive the same conservative dimensions during publication. Unknown source/layout membership remains a warning and explicit Unknown values rather than fabricated associations. Published R2 evidence includes the exact derived dimensions, original roster/events and separate protocol/classification evidence.

Both Python preparation and server derivation use `tempus-agn-dimensions/1`, pinned to the two reviewed source hashes. Their conformance is tested. Additional source revisions require a separate source audit before expanding this vocabulary.

The backfill command is **read-only by default**. It retrieves the intact current protected candidate and verifies its archived PDF hash. `--publish` explicitly submits a reviewed replacement using the current publication head, preserves all original IDs/fields and source documents, then reads back every original result/entry/participant field, normalized result link, separate classification page, publication history and PDF hash. It does not rerun an unrelated phase 3 publication script. Repeating the completed backfill verifies the current projection without creating another revision.

```sh
python3 -m scripts.backfill_browsing --url http://127.0.0.1:5173 \
  --competition st-agn-2026 --reviewer "Operator name" \
  --local-credentials web/.dev.vars --report outputs/st-browse-review.json

# After reviewing the source mapping, add --publish to the same command.
# Repeat for lt-agn-2026. Hosted credentials are passed through hidden stdin.
```

Read-only browse verification compares exact IDs, every dimension/facet count, source event isolation, unknown/empty scopes, multi-entry histories, same-name identity isolation and server pagination:

```sh
python3 -m scripts.check_browsing --url http://127.0.0.1:5173 \
  --item outputs/st-protocol-item.json --item outputs/lt-protocol-item.json \
  --report outputs/phase4-browsing.json
```

## Acceptance evidence

Local schema application and guarded backfill preserve all 171 source events, 443 races, 2,309 results, 289 competition-local participants, 290 entries and 141 separate classification pages. Both PDF SHA-256 read-backs pass; every original field and result ID remains intact. All 2,309 result-to-entry associations resolve under the reviewed source evidence.

84 backend tests, 62 Python tests, TypeScript checking and production build pass. Tests cover four-way AND filters, self-excluding facets, empty results, event IDs, duplicate eligible entries, forged structured links, unsupported revisions, mixed scopes, same-number Group A/B events, server pagination, unmerged same-name athletes, reviewed linked history and pending-identity isolation.

Browser checks cover the required Women + Junior E + 500 m + Quarter-final combination (14 results across three heats), URL refresh/back/forward, competition-to-profile-to-history navigation, empty search and responsive 390-pixel mobile layout without document overflow. The original age help/evidence and archived protocol links remain available.

Hosted deployment and final read-back also pass; details follow. Charts, broader historical imports, Admin A0–A7, domains, login, scheduling and email remain in their later tracks. GitHub commit/push/merge is outside this delivery authorization.

## Hosted verification — October 31, 2026

The existing owner-private [USS Race Tracker Site](https://uss-race-tracker.basicsnail67.chatgpt.site) runs version 12, Sites source commit `228b678f93012a57dda5c882ff7ff2f0db9b2b8a`, deployment `appgdep_6ae623c2358c81919f53ca364f51db21`. Access remains owner-only with zero external visitors. GitHub HEAD remains `a52d8c7`; phase 4 changes are uncommitted on `codex/phase-4-browsing`.

The schema-only migration applied successfully. Protected reviewed publication retained every original result/entry/participant field, source event ID, race and original document. Final PDF hash and extraction/classification read-back verifies 171 events, 443 races, 2,309 results, 290 entries and 141 classification pages. Every result resolves to exactly one applicable entry. Prior phase 3 publication heads remain in lineage.

| Competition | Current batch | Previous batch retained |
| --- | --- | --- |
| Short track | `79a1df3afd76283ce6f8f9ef6c1c92765876f23adb10279fff627e9eb7e1b298` | `049132cc81db810b4bcaa3062c4fef003d4e2cc6486f6926e59c63272fdcf046` |
| Long track | `fad14d57be58bb21eed2dbc297bb79e1f17e4bdbf635512b6114a2f9540f67ac` | `b9c97d992a95161f5ece0f1227d702c1dfc68522d627384a1304d26b0390f8a4` |

Read-only hosted browsing checks pass for 29 representative/exhaustive division combinations, exact result ID sets, all self-excluding facet counts, empty/Unknown filters, source event narrowing, multi-entry athlete history, separate same-name identities and 25-identity pages. Current validation reports use `competition-events/7`, retain reviewed age rules, check all 289 identities and report no age conflicts, pending identity reviews or unresolved age categories. Four viewer attempts to read operator history, candidate exports, identity review and age rules correctly return 401.

The deployed browser also verifies Women + Junior E + 500 m + Quarter-final: 14 results across three heats with original places, qualification and physical page 108. Screenshot: ignored `outputs/phase4-hosted-results.png`. Operational evidence is stored in ignored `outputs/phase4-*-backfill.json`, `outputs/phase4-hosted-browsing.json`, `outputs/phase4-final-access.json`, `outputs/phase4-backend-tests.txt` and `outputs/phase4-build.txt`. Credentials are excluded from these artifacts.

Implementation is ready for user acceptance. The user clarified that the skater profile should show PBs automatically across seasons, grouped only by discipline and distance. No profile discipline/season selection is required. Full race history is optional below the PB summary; obsolete mandatory history-filter URL fields are removed. This does not authorize identity merging. Charts and the later delivery tracks remain out of scope.

## Superseded version 13 history-selection behavior — October 31, 2026

The initial answer was interpreted as requiring discipline and season selection for profile history. The subsequent user clarification supersedes this behavior with automatic PBs; this section records version 13 history only. Version 13 deploys this behavior using Sites source commit `40c39970f87577abde8c2194ddc9e880825b5e51`, deployment `appgdep_6ae6278dc7c48191b18cbcd109784231`.

The profile starts with no history selection. Season is disabled until discipline is selected. Selecting discipline alone returns no race rows; selecting both fields loads only that identity/discipline/season. Changing discipline clears season/page; clearing either field immediately hides prior rows. The API enforces the same requirement and returns available identity scopes without unscoped race results. Explicit valid URL selections restore results after refresh/back/forward.

78 backend tests, TypeScript and the production build pass. Local and hosted read-only source verification passes with required-selection checks in addition to the existing 29 result-filter/facet queries. Hosted browser verification confirms no rows before both choices, nine source-backed Lindsay Lin records after choosing Short Track + 2025-2026, restoration after refresh, and immediate removal after clearing Season. Evidence: ignored `outputs/phase4-history-selection-tests.txt`, `outputs/phase4-history-selection-build.txt`, `outputs/phase4-history-selection-hosted.json` and `outputs/phase4-history-selection-hosted.png`.

The Site remains owner-only with zero external viewers. This follow-up uses the existing data projection and publication heads; it requires no new data migration or import. GitHub changes remain uncommitted.

## Personal-best profile policy

The skater profile opens directly on **Personal bests**, without discipline or season controls. Each discipline has its own section, with one PB per distance across every active published season for that existing identity. Full source-backed history remains available in a collapsed **Browse race history** section and no longer requires selections. The competition directory continues to require its independent discipline/season scope.

PBs are the minimum positive exact integer microseconds among status-free timed results. They are derived from the full current projection, never the first history page. Every tied fastest performance is preserved, along with the source competition date range, round, heat/race, original place, entry, affiliation and physical page. PB cards link both to original evidence and the exact competition event. Coverage explicitly describes published results available in this app, rather than claiming complete career coverage. Empty valid timing coverage produces an explicit no-PB state while status records remain in history.

Identity rules are unchanged: names and bibs do not merge athletes across competitions; only existing reviewed links combine records. Needs-review mappings remain local to the selected participant. PB aggregation and full history share this identity scope and coherent database snapshots.

83 backend tests, TypeScript checking and the production build pass. Added tests cover exact microsecond minima, separate discipline/distance buckets, all seasons independent of query filters, equal-best ties, every retained status code, missing/zero times, empty PBs, reviewed identity linkage, pending identity isolation and more than 50 source rows. A read-only verifier (`python3 -m scripts.check_personal_bests`) compares every checked competition-local profile against original source rows, including every equal-best provenance record.

## Hosted PB verification — October 31, 2026

Version 14 deploys automatic PB profiles through Sites source commit `a12fce07794a34dfcab7eea90320db284582f4e8`, deployment `appgdep_6ae62b8b3d5481918b5fd2d4d297cc29`. Owner-only access and zero external viewers are unchanged. The underlying source publications, documents and result rows are unchanged; no data import or schema migration was needed for this follow-up.

Local and hosted exact-source verification passes for **all 289 competition-local profiles and 1,002 discipline/distance PBs**, including every tied source performance. The existing 29 result-filter/facet queries and history/search pagination checks also pass. Evidence: ignored `outputs/phase4-pb-local.json`, `outputs/phase4-pb-hosted-personal-bests.json`, `outputs/phase4-pb-hosted-browsing.json`, `outputs/phase4-pb-tests.txt` and `outputs/phase4-pb-build.txt`.

Deployed browser verification confirms automatic PBs with zero profile select controls, removal of obsolete required history URL fields, and source-event navigation. Lindsay Lin's source-backed Short Track PBs are 333 m `0:33.997`, 500 m `0:50.961` and 700 m `1:19.261`. Optional full history opens directly, remains paginated and restores on refresh/back. Mobile cards stack at 390 pixels with no document overflow. Screenshot: ignored `outputs/phase4-pb-hosted.png`.

Current behavior supersedes the version 13 selection gate. The competition directory still requires a discipline and season; the skater profile's PBs and optional full history do not.

## Competition filter simplification — November 1, 2026

The Competition page now exposes only Division, Distance and Round controls. Legacy `gender` URL parameters are removed on page load and are not forwarded by the client, preventing an invisible gender restriction on shared or refreshed pages. Source gender labels, separate event identities, roster/result gender, mixed-event meaning and backend Gender query support remain intact for future skater features. The Season dropdown and its styling are unchanged by this update.

The simplification is deployed as version 15 through Sites source commit `1c8c877dc136518a528d0c7231b138347cade472`, deployment `appgdep_6ae6c9e4c42881919cabed46a209d040`. TypeScript, production build and all 13 browsing/PB integration tests pass. Before packaging, all backend API/import/schema files and the Season dropdown markup were compared byte-for-byte with deployed version 14 and matched.

Hosted verification confirms exactly three visible result controls, removal of a legacy `gender=Women` URL restriction, and 53 Junior E / 500 m / Quarter-final rows across two separate source events. Backend Gender querying still returns 14 Women rows; all 189 Group 1 Master mixed-event rows retain exact roster gender and entry associations. The original source event labels remain distinct. Access remains owner-only. Evidence: ignored `outputs/competition-filters-tests.txt`, `outputs/competition-filters-build.txt`, `outputs/competition-filters-hosted.json` and `outputs/competition-filters-hosted.png`. GitHub changes remain uncommitted.

## Search-card representative consistency — November 1, 2026

The independent read-only review identified one P3 display issue: independent `MIN(id)`, `MIN(name)` and `MIN(identity_status)` aggregates could combine fields from different source observations within a reviewed identity. Search now selects the existing deterministic minimum matching participant ID and reads the displayed name from that exact participant row. Matching competition counts, disciplines and seasons remain aggregates over matching rows.

Identity status is calculated separately across every current member of the same identity, so a search matching only a competition-local anchor still shows that its identity has reviewed linkage. Needs-review records keep their isolated participant key; they never inherit another member's status, name or counts.

A regression test first reproduced the original mismatch, then passed after the fix. It uses a test-only explicit review decision between differently named fixture observations, verifies card/profile name equality, checks queries matching only either observation, and confirms pending-review isolation. All 84 backend tests, TypeScript checking and production build pass. This is a read-query correction; it requires no identity decisions, data imports or schema changes in production.

The fix is deployed in version 16 through Sites source commit `4f097f1ae20f5880ac8ad5c6adcfa3ec383616a2`, deployment `appgdep_6ae74b16db008191a7ddd0e40db50403`. Hosted read-only checks verify all 289 search cards against their original participant names, stable complete pagination, and card/profile name equality for targeted searches. The reviewed multi-observation edge case is covered by the regression test without modifying production identities. Browser verification confirms the Jori Kola card opens a profile headed Jori Kola. Access remains owner-only with zero external visitors.

Evidence: ignored `outputs/search-card-fix-tests.txt`, `outputs/search-card-fix-build.txt`, `outputs/search-card-fix-hosted.json` and `outputs/search-card-fix-hosted.png`. GitHub changes remain uncommitted.

## User acceptance and GitHub release closure — November 1, 2026

The user accepted the phase 4 result after a separate completeness audit found no substantive acceptance blocker. The audit independently checked requirement coverage, source counts, exact entry mappings and both PDF hashes; 84 backend tests, 62 Python tests, TypeScript and diff checks passed. The prior P3 search-card finding was fixed and regression-tested before acceptance.

The user explicitly authorized commit, push and squash merge of phase 4, followed by a new chat implementing phase 5 (charts and multi-skater comparison). This supersedes the earlier checkpoint statements that GitHub changes were intentionally uncommitted. The final repository release is recorded by its GitHub pull request and merge commit; Sites source history remains separate. See [the acceptance checklist](phase-4-acceptance.md).
