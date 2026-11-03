# Phase 5: performance history and comparison

Implemented on `codex/phase-5-performance-charts`. The user accepted the current scope and explicitly authorized phase 5 GitHub commit, push and merge on November 3, 2026, followed by a new chat starting phase 6. Earlier authorization statements below record their historical checkpoints. The existing Site identity, owner-only audience, source corpus and reviewed identity mappings are retained.

## Current behavior — user decision on November 3, 2026

The chart and its summary now show one whole-competition best time per identity, discipline and distance, across all rounds. Equal-best source performances share one point/summary row, with each source retained in expandable evidence. The all-appearances view and chart Round control are removed; old `chartView`/`chartRound` URL fields are cleared. The API returns `competitionBests` separately from unchanged full `records`; a legacy `round` parameter does not narrow competition-best calculations. Missing/invalid-date bests remain in the summary without a fabricated chart position. Full race history still retains every round, slower result, special status and missing time. PBs and age evidence are unchanged.

Mobile layout changes are explicitly deferred. This correction does not change `globals.css`. The [mobile profile plan](mobile-profile-plan.md) proposes a later joint review of information hierarchy, controls, comparison selection, touch interaction and mobile record cards, with measurable viewport/accessibility acceptance criteria.

The original v17 implementation below is historical where it describes all-appearance plotting or Round filtering; the latest user decision above takes precedence.

## Current query and storage contract — v18

`GET /api/performances?participant=<competition-local-id>&participant=<another-id>&discipline=short-track&distance=500&from=2026-01-01&to=2026-12-31`

- One to four requested participants; malformed filters return 400 and missing participants return 404. Without discipline/distance the response is metadata-only with `selectionRequired: true`.
- `records` preserves every matching source row. `competitionBests` groups all rounds into one best time per identity/full competition/discipline/distance, retaining tied evidence in `performances`. Valid legacy `round` values do not narrow these results.
- Date bounds use inclusive competition-range overlap. Invalid/unknown-date bests remain in the summary but do not receive numeric horizontal positions. Chart points do not depend on summary-list pagination.
- Identity series, metadata options and records share one uncached D1 read batch. No comparison action writes identity, age or competition data.
- Track specification is null/Unknown because no verified specification is published. The phase 5 migration adds only the participant/distance index; no extra migration or data publication was needed for v18.

The current [acceptance checklist](phase-5-acceptance.md) and [independent plan audit](phase-5-plan-audit.md) distinguish passed current scope, evidence limits, deferred mobile work and separate user/GitHub closure. The following v17 sections preserve historical delivery evidence rather than current product requirements.

## Original v17 product behavior

Profiles retain automatic all-season personal bests above the chart. Chart discipline, distance, round, date range, point view and comparison selections do not restrict PBs, age evidence or optional full race history. No profile season/discipline prerequisite is introduced.

The chart compares up to four explicitly selected identities at one discipline and distance. Search uses the existing paginated skater service. Selecting records is read-only: it does not create identity links or combine age observations. Current reviewed members share a series; repeated selection of members of the same approved identity is deduplicated. Needs-review mappings stay isolated to the selected competition-local participant, using the same scope as PBs and history.

Default **All valid appearances** retains each positive, status-free, safe-integer microsecond result as its own point. **Best per competition (all ties)** retains every equal minimum within each identity, competition, discipline and distance after applying the chart filters. The full filtered source list remains visible in either point view, including slower performances, PEN/DNS/DNF/DQ/FNT/YC, missing/zero times and records whose competition dates are unknown. Non-plotted records state why they are excluded. The list has 25-row client pages; chart points come from the complete filtered server query, independently of list pagination.

The horizontal anchor is the competition start and a horizontal bar depicts its full evidenced date range. The UI, tooltip and list explicitly describe competition dates/ranges rather than individual race timestamps. All rounds share the same competition range. Appearance points are unjoined. Best-view dashed lines connect adjacent competitions only when their ranges do not overlap; same-competition rounds, equal-day appearances and overlapping ranges are never joined. Unknown/invalid dates remain in the list without fabricated horizontal positions. Date filters use inclusive competition-range overlap; records with unknown dates cannot establish overlap with a chosen interval.

Every point, tooltip, selection card and list row uses the original result object. IDs, source event labels/keys, competition, season, division, gender, competition group, race, round, heat, original place, qualification, status, raw time and physical source page remain traceable. Coincident points remain separate and the selection card offers all appearances at that position. Numbered color markers, keyboard-focusable points, a persistent source selection card, labelled filters, live status/error messages and the parallel table support accessible use. Source links and event navigation are available without relying on a hover tooltip. Track specification is explicitly Unknown; no unsupported track filter or invented specification is introduced.

Chart URL fields are scoped by `chartOwner`: `chartDiscipline`, `chartDistance`, `chartRound`, `chartFrom`, `chartTo`, `chartView=best` and JSON `chartPeers`. Refresh and browser navigation use the existing URL state mechanism. Another selected profile ignores the prior profile's chart scope. Explicit empty combinations remain empty; they do not fall back to another discipline, distance or time range.

## Historical v17 query and storage contract

`GET /api/performances?participant=<competition-local-id>&participant=<another-id>&discipline=short-track&distance=500&round=Finals&from=2026-01-01&to=2026-12-31`

- One to four distinct requested participants; malformed filters return 400 and missing participants return 404.
- Without discipline and distance, return identity series and available discipline/distance/round combinations, with `selectionRequired: true` and no mixed-scope numeric rows.
- With both, return every matching result in the current projection, including non-numeric source statuses and missing finishes. There is no hidden chart-row limit or dependency on a history page.
- Series, options and results use one D1 read batch. Query responses are uncached. Metadata options span the selected identity records across published seasons.
- `trackSpecification` is null because no verified specifications are currently stored.
- Schema-only migration `0008_easy_doctor_spectrum.sql` adds `(participant_id, distance)` indexing. No applied migration, source row, publication head, identity mapping or age rule is rewritten. No competition republication is needed.

## Historical v17 verification

91 backend tests and 62 Python tests pass, as do TypeScript and the production build. Added tests cover exact one-microsecond distinctions, all equal-best appearances, every supported status, absent/zero times, range endpoint overlap, invalid dates/filters, empty scopes, reviewed and pending identities, duplicate selections, independent same-name records, more than one history page and test-only cross-season history. Rendered SVG symbols, tooltip content and table rows are checked against the same exact result/source objects, including keyboard labels and non-plotted statuses. Synthetic cross-season data remains in memory in tests only.

Read-only local corpus verification issues 261 multi-skater/distance queries and compares all 2,309 source results field by field. It finds 2,251 eligible timed appearances and 1,002 per-competition best appearances including ties. Raw times, exact microseconds, statuses, places, qualifications, event/race identities, all heats, competition ranges and physical source pages match the two pinned protocols. Current coverage still contains only two competitions and one published season; no extra history is manufactured.

Reproduce the source check without writes:

```sh
python3 -m scripts.check_performances --url http://127.0.0.1:5173 \
  --item outputs/st-protocol-item.json --item outputs/lt-protocol-item.json \
  --report outputs/phase5-local-performances.json
```

Use the deployed origin for hosted verification; pass the service credential through hidden stdin when prompted. Do not run the phase 3/4 publication scripts. `scripts.check_personal_bests`, `scripts.check_browsing` and `scripts.check_protocol` remain read-only regression tools.

Browser visual/interaction verification is pending an available UI connection. The UI tool inventory reports no connected browsers; both Chrome application-selection attempts time out. Opening the Codex preview is queued. Responsive CSS and rendered accessibility/source markup have been checked in code/tests, but these checks are not a desktop/mobile browser acceptance result.

Credential-free logs and reports remain ignored under `outputs/phase5-*`. Broader historical ingestion, Admin A0–A7, domains, authentication changes, scheduling/email and Season-menu redesign remain deferred.

## Historical v17 hosted delivery — November 1, 2026

The original [owner-private Site](https://uss-race-tracker.basicsnail67.chatgpt.site) ran version **17** at that checkpoint, Sites source commit `72591b29ddc2db3bcb893c13a453646d891e3b9a`, deployment `appgdep_6ae77904a7c08191bc00b2f9c986ae3b`. Native publication reports `succeeded`. The manifest still uses project `appgprj_6ae403e6a8508191b9abe60dfd927d8e` with the original D1/R2 bindings. Access inspection confirms the current user is owner, the sole allowed user is owner, and there are zero external visitors. GitHub repository visibility is still public; its HEAD remains phase 4 merge `5384a02d84327c19fca1b7be605f33dd3ea51cbe`. No phase 5 GitHub commit, push or merge was performed.

The source helper builds, commits and pushes only the separate Sites source history. All 180 selected web source files match the GitHub working copy byte for byte. No credentials or local runtime database were added to that source or archive. Synthetic historical records exist only inside isolated test fixtures; none were written to the production database.

Hosted read-only verification passes:

- All 261 chart queries and 2,309 original source rows, with 2,251 eligible appearances and 1,002 per-competition-best appearances including ties.
- All 289 profiles and 1,002 automatic all-season PBs, unchanged in scope and exact source performances.
- All 29 existing browsing/filter cases, exact facets, event isolation, optional unscoped history, same-name identity isolation and skater pagination.
- Both archived PDF hashes, all 171 source events, 443 distinct source races, 290 entry observations and 141 separate classification pages. Every original result field remains intact.
- Four operator-only reads reject a viewer service request with 401; health reports connected D1, ready R2 evidence and the original two competitions.

No competition data or identity mapping was republished. Evidence: ignored `outputs/phase5-hosted-performances.json`, `outputs/phase5-hosted-personal-bests.json`, `outputs/phase5-hosted-browsing.json`, `outputs/phase5-hosted-integrity.json` and `outputs/phase5-release.json`. Browser visual/interaction acceptance remains pending for the connection limitation stated above; the deployed implementation is ready for that check and user review.

## Competition-best correction — November 3, 2026

The user requested one best time for each full competition/distance to show progress and variation. Version 18 implements that behavior and preserves complete history separately. One competition-best summary/point is returned even when multiple source performances tie; each tied source remains available in `performances` and expandable source details. Chart Round and all-appearances controls are removed, including their legacy URL restrictions. No new migration or data publication is required; the existing v17 responsive styles remain byte-for-byte unchanged.

92 backend tests, TypeScript and the production build pass. Local full-corpus checks cover all 2,309 source records and 1,002 competition-best summaries through 261 queries. Tests include one-microsecond distinctions, grouped source ties, all-round selection, separate identities/competitions/discipline/distance, unplottable-date summaries and full-history/PB preservation.

The restored desktop browser verifies Lindsay Lin's 700 m best as one `1:19.261` point with original Finals race 1903/source page 97, and two comparison skaters as one best point each. Keyboard point selection, source URL/event navigation, date empty state, independent PBs and browser-back chart restoration pass. Her complete nine-record history is still available separately. Mobile optimization remains explicitly deferred under the [mobile plan](mobile-profile-plan.md).

Sites deployment `appgdep_6ae96bfd540c8191b2ec97891ab3d201` reports `succeeded` for source commit `3450d5fb972953d175834fb99ffe4cc55ace5ff3` and version 18. The same project ID is retained. Sites now returns [this current private address](https://uss-race-tracker.zhang-michael-gabrie.chatgpt.site); no project, audience, domain binding or login configuration was created or changed by this correction. Access inspection still shows only the owner and zero external visitors. Hosted browser sign-in reaches OpenAI's security-verification page; desktop interaction checks were therefore performed against the identical local source, with hosted data verified separately through the private service.

Hosted follow-up read-back passes for all 261 queries, 2,309 retained source results, 1,002 unique competition-best points with exact source/tie evidence, and all 289 profiles/1,002 unchanged PBs. Evidence is stored in ignored `outputs/phase5-best-only-hosted.json`, `outputs/phase5-best-only-pbs.json`, `outputs/phase5-best-only-tests.txt` and `outputs/phase5-best-only-release.json`. Screenshot `outputs/phase5-best-only-desktop.jpg` shows the locally verified single 700 m competition-best point and its original source card. The screenshot uses the exact same web source as v18; it is not a claim of a completed hosted sign-in session or a mobile redesign.

## Independent code review — November 3, 2026

A user-requested independent sub-agent completed one bounded read-only review pass and found no substantiated actionable defect. The reviewer independently reran all eight performance tests successfully. No source/data changes or recursive delegation occurred. The review did not repeat hosted permissions/browser acceptance or the full 92-test suite; interactive pagination beyond 25 competition-best summaries and page-count reduction after refresh remain additional checks for broader historical coverage. All reviewed web files still match v18. See [the review record](phase-5-code-review.md) for scope and limits.

## Independent implementation-plan audit — November 3, 2026

A separate independent sub-agent completed one bounded read-only requirements audit. Current user-authorized phase 5 scope passes with verification limits; no mandatory omission or blocker was found. The auditor mapped requirements to implementation/tests/saved evidence, independently recalculated full source and best-bucket counts and inspected the desktop screenshot. Fresh parent-agent Site/GitHub metadata confirms v18 remains owner-only and GitHub public. The non-blocking historical checklist/dictionary wording drift was consolidated in a documentation-only follow-up. Product code, data and deployment are unchanged. See [the complete requirement/evidence matrix](phase-5-plan-audit.md).

## User acceptance and GitHub release authorization — November 3, 2026

After the independent code review and separate implementation-plan audit passed, the user accepted the current phase 5 scope and authorized commit, push and merge, followed by a new chat continuing the next implementation-plan stage. The release PR/main merge provides the final GitHub execution record; Sites source/deployment history remains separate. This authorization supersedes earlier checkpoint statements that phase 5 release closure was still pending, and does not authorize automatic GitHub release closure for later phases.

The next chat starts phase 6, broader historical/source coverage and formal delivery, with a bounded first ingestion/coverage slice chosen after checking the source inventory and supported formats. The latest one-competition-best chart behavior, independent all-season PBs, explicit identity mappings and source provenance remain requirements. Mobile profile optimization remains deferred to the later joint design discussion under its existing plan. Admin, access/domain/login changes and scheduling/email remain deferred.
