# Season-by-season historical import workflow

Phase 6 remains in progress. The v21 increment passed its checks; it did not complete historical coverage. The user authorized continued imports on November 4, 2026, with pauses for unresolved source meaning and a strict newest-to-oldest season order.

## Confirmed season boundary

Every season starts on July 1 of its first named year and runs through June 30 of the following year, using America/New_York for the season rollover. The 2025-2026 season begins July 1, 2025 and ends June 30, 2026. Record the season independently of the edition year printed in a competition title. Apply this boundary when organizing the queue and validating the event dates against the official directory season. Keep the official competition title and date evidence in their own fields.

## Confirmed competition date rule

Use the dates listed on the matching US Speedskating official event calendar for the tracker’s competition dates, reporting, and statistics. Match the exact edition by event, discipline, venue, and season. Record the calendar URL and its dates in the source review. If the official protocol or a host club’s report gives different dates, retain those dates as printed in the original PDF and source evidence. The calendar dates populate only the tracker’s competition metadata. If the matching calendar entry cannot be verified, record the date as unresolved for review before publication.

## Skip previously imported documents by SHA-256

Before source review or extraction, compute the SHA-256 of the original document bytes and look for that digest in completed publication records across seasons. A match to a completed import with a recorded verification outcome is sufficient to skip the document, even if the URL, filename, or directory listing differs. Record zero new rows and a reference to the original publication in the queue, then advance. Reuse the original import’s verification record and skip parsing, OCR, candidate preparation, re-archiving, submission, publication, repeat validation, and hosted readback.

If the digest is recorded only in an unfinished import, resume from its saved checkpoint. A downloaded or archived file alone does not establish a completed import. A different digest follows the regular new-source or revision workflow.

## Ordering and reporting

1. Refresh or check the official directory and build the complete source queue for its newest listed season. The November 5 live directory check returned 499 listings, including six for 2026-2027. Its newest season is 2026-2027 with six source documents, followed by 2025-2026 and 2024-2025. The active per-source queue is `data/sources/season-import-progress.json`. Preserve legacy single-year labels without inventing season dates.
2. Process one complete competition protocol at a time within that season. A competition family in another season is a separate source; do not jump to its older editions. Seasonal queues follow actual listings, including one-season-only competitions.
3. Retain previously published earlier-season data and apply the [SHA-256 skip rule](#skip-previously-imported-documents-by-sha-256) before processing each document.
4. Show each successful addition with its season, competition, new-row count and viewer link. Routine additions do not require user approval. If a source adds no rows, record why and continue.
5. Reconcile all listings against existing publication and skip records for the active season before advancing to the preceding season. Pending or ambiguous sources remain explicit and prevent claiming that season complete. A blocked interpretation is not a reason to jump to an older season.

## Per-source workflow

- Start with the [SHA-256 skip rule](#skip-previously-imported-documents-by-sha-256). For a new or unfinished source, archive the official document byte for byte. Record its URL, physical pages and SHA-256, then verify the archived copy against the original. Keep all printed source text and discrepancies intact. Record the official directory season separately and use the [confirmed competition date rule](#confirmed-competition-date-rule) for competition metadata.
- Format reviewed profile display names as First Last, with each name word in title case. Use the source’s given and family name order when evidenced, and retain the exact original spellings in the source records.
- Parse the complete roster, individual events, rounds and original result/status rows. Preserve classifications and team/club supplements separately. Do not silently truncate or omit unsupported pages.
- Fix technical parsing or validation failures and run relevant regressions. Reuse established supported source contracts; do not require user decisions for routine implementation details.
- Pause before publication when source meaning needs a user decision: an unexplained name annotation, uncertain identity, unclear category, event interpretation or status. Show the source page/text, the question and proposed handling. Apply previously confirmed rules only within their supported evidence scope.
- Validate the complete candidate and its applicable entries, source proof, status/time interpretation, bounds and current publication head. Archive the real original PDF and publish atomically through the protected import contract. Repeat requests must not duplicate records.
- Read back source rows, metadata, immutable evidence and PB/chart behavior. Preserve existing publication heads, reviewed mappings and rules. Use only reviewed age rules that apply to each source season and discipline.
- After publishing a competition, apply the [confirmed identity rules](#confirmed-identity-and-age-rules). Reconcile existing publications through the protected identity operation and read back the affected profiles and performance data.

## Confirmed identity and age rules

- Automatically link records across competitions when the complete display name and the recorded club both match. Match case and surrounding whitespace consistently. Ignore source-specific stars or other name marks only after their meaning is confirmed, and retain the literal source name. Use the exact club label correspondences reviewed for MASA/AGN, including Garden State Speedskating and Garden State. Treat a missing club or Direct, Independent, Unaffiliated, Unattached and N/A as insufficient club evidence. A bib, country or similar spelling alone supplies no identity match.
- One matching profile may collect observations from multiple competitions, disciplines or seasons. Prefer an existing reviewed profile. Leave ambiguous matches, two separate reviewed profiles, explicit splits, needs-review links, and matches with more than one participant from the same competition for review. Separate divisions by themselves supply no cross-competition age or identity evidence.
- Age is independent of linking. Display and calculate age from the reviewed rules for the source discipline and season, advancing each interval to the same reference season on July 1 in America/New_York. An F category in one season and an E category in the next may describe the same birth cohort after conversion. Retain source category letters, missing ages and age conflicts as evidence. A conflict can be surfaced on the profile without blocking a name-and-club match.
- Record each automatic decision with its rule version, previous link revision and official source references. The same rule runs for new publications and for existing competitions through the authenticated `POST /api/identity/reconcile?competition=<competition-id>` operation. Reconcile again safely after a partial run and preserve the original publication heads.

When a new decision changes a rule, update this workflow and the corresponding implementation or source-scoped review in the same work. Keep the original record, its source references and any confirmed exception in the import checkpoint.

Private Site v42 applied the rule to 22 existing competitions. The audit recorded 664 link decisions and reduced the number of active profiles from 1,865 to 1,449. Readback matched all 13,282 source result rows and their publication heads. Ethan Liu now has one profile spanning MASA, short-track AGN, Presidential Cup and January Thaw. His 26 source results, personal bests and performance charts passed readback. The distinct Aiden Yu entries in Carl Cepuran remain separate.

The backlog remains open until all historical sources are accounted for, importable competition data is published and overall source/data/UI/performance acceptance passes. Unavailable sources or unresolved interpretations must be surfaced explicitly, not counted as imported. GitHub commit/push/merge, Admin, mobile redesign, access changes, scheduling and email remain separate from this import authorization.

## Current checkpoint

The first 2026-2027 source is the 50-page 2027 U.S. Fall World Cup Qualifier & American Cup 1 protocol, SHA-256 `33d17599ed3cc66b082be4f0590227444ed85bdea41c79c82ece32eb90bad1bd`. Physical cover page 1 confirms October 30-November 1, 2026, Milwaukee, WI. It is a scanned PDF with no embedded text layer, requiring a new extraction contract rather than a Tempus import. All370 reviewed rows are published in v22; full hosted readback passed.

The user approved separate lap-count mass-start events, retaining original placements/points/status/time evidence without guessing metre distances or contributing to ordinary-distance PBs/trends. Physical pages 49-50 show the men's entry list and finish report.

The physical-page-6 question is resolved: the official 500m Women #1 result lists Allison LA (bib101) in place15 at45.59 and Evie FORRER (bib112) in place16 at45.57. Preserve both literal rows and their ordinary eligibility. The full candidate contains 370 result rows across18 events:317 metre-distance rows and53 mass-start rows. Source review and protected publication are complete; full hosted readback passed. Other newest-season sources remain pending.

## Official results are authoritative

The user clarified that displayed data must follow the official result table exactly. Preserve printed places and times independently even where their ordering appears inconsistent; do not correct values, swap official places or add eligibility exclusions solely for such discrepancies. The existing status/time eligibility rules and separately approved lap-count mass-start exclusion still apply. The page6 place/time question is resolved on this basis. Technical OCR mistakes must be corrected against the original image; this does not authorize correcting the official source itself.

The user confirmed the signed-result rule for reskates. Publish the signed official result, including any distinct signed reskate result with its source label. Keep a separately listed reskate from an unsigned timing printout as original supporting evidence. Its time does not create another result row or contribute to personal bests or performance charts.

## Reduce model usage without reducing verification

Use local deterministic programs for downloads, supported parsing, candidate generation, complete record validation, protected publication and hosted readback. These programs and local CPU OCR do not call a language model; asking the assistant to run them and reading their returned output still uses conversation context.

For unfinished imports, reuse extraction and review artifacts only when the original PDF SHA-256, parser version and applicable review digest match. Completed imports follow the SHA-256 skip rule and carry forward their original verification. Independently scoped regression checks may still cover database behavior affected by code changes.

Keep complete logs and row comparisons on disk. Return compact counts, pass/fail results and actionable exceptions to the assistant. Read original pages and detailed logs when necessary for a new format, an uncertain field, a failed check or source interpretation. Avoid repeatedly loading unchanged files, full OCR output or unrelated project history.

Keep full-record automated checks and all source fields. Do not replace them with samples to save usage. Scanned sources require direct source verification wherever extraction cannot be established reliably; OCR confidence alone is insufficient. The initial AmCup review checked all370 result rows and all70 distinct roster observations against source images. Do not imply that an unreviewed future scan inherits that review.

Use model work for new source formats, semantic ambiguities, necessary code changes and bounded reviews. Run relevant tests when code changes; do not repeat an unchanged full test suite for every ordinary data-only batch. Never trade source fidelity, identity evidence, official values or required validation for a lower usage target.

## Buffalo checkpoint — identities confirmed and published

The next2026-2027 source is the52-page Buffalo Short Track Championships2026 protocol. The cover confirms October24-25,2026 at The Northtown Center at Amherst; the directory title remains a separate literal listing. Original PDF SHA-256:`42d59ae2334f8467e9b9a099d1fd25c3bd2ab1358e49e3c3b4e9fc66b7b1d2fa`.

Physical pages4,6,7,9 show three reused bibs:43(CHEN Daniel/USA-PNIC versus SUN Sean/USA-GSSC),44(CHEN Ellie/CAN-MRSSC versus POMETUN Max/USA-EPSSC),65(DAVIDOFF Hannah/USA-BSS versus MONTES Frida/USA-PSSP). The different identities occur in different divisions and the same numbers/names also recur in their distance classifications and race pages. The source review records the exact original rows and physical-page references.

Proposed handling preserves all literal bibs/names/members/divisions and binds results to separate participants using their confirmed local scope. The user confirmed six separate skaters. The1319-row Buffalo competition is published; all191 new profiles,681 active identities/2309 PB groups and580 new chart queries passed full hosted verification. A final source-order deployment preserves the exact84 occurrence page/column sequence. Previous five competition heads and source rows remain intact. The next source stays in2026-2027.

## Nutricost checkpoint — published and verified

The72-page2026-2027 Nutricost protocol is published in private Site v25:57 skaters,38 events,170 races,856 new results and20 separate original classification pages. Official dates September25-27,2026, Kearns,UT. All new source rows/roster records independently compared; all5783 hosted rows/evidence,738 identities/2479 PB groups and170 new chart queries verified. Earlier six publication heads retained. Next queued source: Utah Olympic Oval Fall Challenge, still2026-2027.

## Utah Fall Challenge checkpoint — published and verified

The40-page source is published in private Site v26:43 skaters,21 events,64 races and298 new results;19 separate original classification pages retained. All original rows/roster records independently compared; all6081 hosted source rows/evidence,781 identities/2593 PB groups and115 new chart queries verified. Source genders remain separate within all three mixed Challenge divisions. Previous seven heads retained. Next queued source: Desert Classic, still2026-2027.

## Desert Classic checkpoint — published and verified

The 148-page Desert Classic protocol has SHA-256`e10567180db525162ba16a14fdf026d08a6c076d104d66955db0f601080b8f14`. Original cover page1 states2026 Desert Classic Short Track, August7-9,2026, Kearns,UT. Original officials page2 states20256 Desert Classic Short Track and August7-9,2025. These are visually confirmed printed values. Race pages use2026 DC Short Track Race.

The official results directory lists this exact PDF under 2026-2027. The user confirmed August 7–9, 2026 for database metadata, based on the cover and directory season. The official PDF and all printed evidence are preserved, including the conflicting year on page 2. See `data/sources/desert-2026-review.json` for the resolution. The private Site v28 publication adds 1,644 race results for 161 roster entries across 96 event occurrences and 324 races. All 52 classification pages and their 1,166 rows are retained separately. Hosted readback verified all 8,014 results, 1,000 identities, 3,161 personal-best groups, 441 new chart queries, cover metadata and the archived PDF hash.

All six official 2026-2027 sources are published and verified, with 4,776 race results for this season. The live database includes 10 competitions and 8,014 results across three seasons. The historical import remains in progress. The next official season in order is 2025-2026.

## Carl Cepuran checkpoint — published and verified

The July 3, 2026 official report in Milwaukee, Wisconsin has 54 physical pages. The private Site v27 publication adds 289 official results across 30 events and 69 races, with 58 roster entries. The user confirmed two distinct Aiden Yu profiles. Bib 26 represents Vision and Pettit, and bib 54 represents Legacy and Legendary. Each has five results. The [source review](../data/sources/carl-2026-review.json) retains the original rows and page references.

The school column and original school points table remain separate source evidence. For Kai Kwon, the display uses Richmond Rockets, the full spelling in the results. The roster’s clipped Richmond Rock remains in the source evidence.

All 289 source results and 58 roster entries passed independent comparison. Hosted readback verified all 6,370 original result rows, 839 identities, 2,724 personal-best groups, and 131 new chart queries. The earlier eight competition heads were preserved. Desert Classic subsequently completed the 2026-2027 season.

## Washington State checkpoint — published and verified

The official 88-page Washington State Short Track Championship and Open source is in the 2025-2026 season. The user confirmed April 4–5, 2026 for the competition record, consistent with the race report and the official event page. The original front standings still read April 5–6, 2026. The archived PDF hash matches the original.

Private Site v29 adds 357 results across 56 events and 91 races, with 52 skaters. It retains the 39 Championship and 51 Open standings rows in separate source tables, alongside 435 rows from 58 classification pages. For this reviewed source only, the 14 trailing asterisks remain in raw names and are omitted from displayed names. The shared individual race report is recorded once.

Hosted readback verified all 8,371 results, 1,052 identities, 3,307 personal-best groups and 149 new chart queries. The previous ten publication heads were preserved. The next source remains in 2025-2026.

The next 2025-2026 source, US Age Group Nationals Short Track, matches the exact already-published PDF hash. Its 1,847 original result rows and active publication were verified. The queue advanced without an additional batch.

## Land of Lincoln checkpoint — published and verified

The official 177-page Land of Lincoln and Heartland #6 source is in the 2025-2026 season. The user confirmed March 7–8, 2026 for the competition record. The archived PDF hash matches the original, including the 2025 date printed on the officials list.

Private Site v30 adds 810 results across 101 events and 162 races, with 116 skaters and 131 roster observations. The three appended 500 m qualifier races account for 15 results. Their printed race numbers match three main report race numbers, so the database keys distinguish the two reports. The viewer and source evidence retain the printed numbers. All 117 classification pages and their 1,150 rows remain separate from individual race results. The roster identifies Carolyn Tegtmeier as female in the source division named Heartland A Men, and the record retains both fields.

Hosted readback verified all 9,181 results, 1,168 identities, 3,749 personal-best groups and 458 new chart queries. The previous eleven publication heads were preserved. The next source remains in 2025-2026.

## AmCup Final checkpoint — published and verified

The March 6–8, 2026 AmCup Final, US Open Masters, and Colombian Championships PDF is in the 2025-2026 queue. The original has 45 physical pages, including 42 scanned pages. The archived PDF hash matches the official original. Full-page and focused-cell recognition, source image review and separate completeness checks cover the timed tables. All 58 mass-start rows were read from the official images.

The private Site v31 publication adds 344 results across 18 events, with 87 profiles. Display names follow First Last, using the timed result spellings. The four confirmed same-number name variants resolve to their matching profiles and retain both literal spellings. The 58 mass-start rows preserve laps, points and other printed fields without contributing to metre-distance personal bests or curves. Eleven profiles appear only in mixed tables and have no inferred gender.

Hosted readback verified all 9,525 results, 1,255 identities, 4,025 personal-best groups and 286 new chart queries. The previous twelve publication heads were preserved. The next source remains in 2025-2026.

## Southern California checkpoint — published and verified

The March 7, 2026 Southern California Limited Regional Championships publication adds 77 results from 14 source distance columns. The 27 group standings rows remain available with the two-page original PDF. Elias Hurley has one profile and separate entries for Racing Groups 1 and 5, as confirmed by the user.

Group 4 retains the exact 212.5 m and 255 m distances and its 85 m track. The official places are group standings, and the individual rows retain the original times and points. Valid hand-timed performances participate in the standard personal bests and charts.

Hosted readback verified all 9,602 results, 1,281 identities, 4,065 personal-best groups and 40 new chart queries. The previous thirteen publication heads were preserved. The next source remains in 2025-2026.

The next 2025-2026 source, MASA Short Track Championships, matched the already-published official PDF SHA-256. Its 420 source results and active head were verified. The queue advanced to St. Louis Silver Skate without a new batch.

## St. Louis Silver Skates checkpoint — published and verified

Private Site v33 adds 310 official race results for 45 skaters, across 56 events and 84 races. All 65 classification pages and 450 classification rows remain separate from race results. The official event page and results directory agree with the February 22, 2026 cover date. The original officials page with the printed 2025 date remains in the unchanged PDF.

The eight ability divisions follow the source. The 44 Mixed roster values remain in the original evidence without deriving an individual gender. The one printed Male entry is available through the Men filter. Sawyer Nemeth uses title case for display, with the original lowercase first name retained in the source evidence.

Hosted readback verified all 9,912 results, 1,326 identities, 4,229 personal-best groups and 175 new chart queries. The previous fourteen publication heads were preserved. The next 2025-2026 source is Ohio State Meet Open.

## Ohio State Meet Open checkpoint — published and verified

The February 21, 2026 Ohio State Meet Open adds 201 individual results across 28 events and 54 races for 29 skaters. Individual identities are supported by the four original overall classifications. The 20 classification pages and 144 rows remain separate from individual race results.

All three relay result tables, their nine team finishes, the original lineup page and the Ohio State awards page remain separate source tables. The user confirmed a 3000 m distance for Event 31. Its printed relay name and all Team 2000 names remain intact. The official third place and ADV-A qualification in Race 301 retain their blank time.

Hosted readback verified all 10,113 results, 1,355 identities, 4,343 personal-best groups and 115 new chart queries. The previous fifteen publication heads were preserved. The next source remains in 2025-2026.

The next 2025-2026 source, Age Group Nationals Long Track, matched the already-published official PDF SHA-256. Its 462 source results and active head were verified. The queue advanced to NorthBurke Open without a new batch.

## NorthBurke Short Track Open checkpoint — published and verified

The February 14, 2026 edition adds 463 official results for 85 skaters across 46 events and 113 races. All 49 classification pages and 621 classification rows remain separate source evidence. The official Final 2 report skips event 36 and the published event numbers follow the report. The eight mixed ability divisions use the original roster gender for individual filters.

Hosted readback verified all 10,576 results, 1,440 identities, 4,575 personal-best groups and 245 new chart queries. The previous sixteen publication heads were preserved. The next 2025-2026 source is Presidential Cup.

## Presidential Cup checkpoint — published and verified

The February 14–15, 2026 Presidential Cup and NEST 4 adds 860 official results for 123 entries across 70 events and 165 races. All 73 classification pages and 1,059 classification rows remain separate source evidence. The original 50,420,225-byte PDF was archived and read back with the same SHA-256. Both printed B Final labels in Event 54 and all original name annotations remain in the source evidence.

Ethan Liu's bib 105 Presidential Cup entry joins the user-confirmed MASA and short-track AGN profile. The other same-name candidates retain their competition-local identities. The identity rule in effect at this checkpoint also required an exact inferred age. The current rule is recorded in [Confirmed identity and age rules](#confirmed-identity-and-age-rules).

Hosted readback verified all 11,436 results, 1,562 identities, 5,002 personal-best groups and 437 new chart queries. The previous seventeen publication heads were preserved. The next 2025-2026 source is 2026-02-08 - 2026 Empire State Short Track & Heartland.

## Empire State checkpoint — published and verified

The February 7–8, 2026 Empire State Short Track and Heartland protocol adds 503 official results across 63 event occurrences and 135 races for 79 scoped entries. It preserves 17 classification pages with 360 rows and the original infringement report. Bibs 105 and 162 remain distinct across their respective divisions.

The user confirmed USA-FMSC for bib 113 Elias Wang. The original competitor list still records USA-TSSC. Henry He's Race 94 printed time 11:62:28.000 remains visible without a comparable numerical result. Theodore Tucholski's Race 13 printed time 46:35.000 counts as 46 minutes and 35 seconds. Both official ranks remain first.

Hosted readback verified all 11,939 results, 1,641 identities, 5,216 personal-best groups and 216 new chart queries. The previous eighteen publication heads were preserved. The next source remains in 2025-2026.

## WSA Gold Cup checkpoint — published and verified

The February 1, 2026 long-track pack meet at the Pettit National Ice Center adds 233 official results for 34 skaters across 35 events and 59 races. The 35 classification pages contain 309 rows. The five named source groups and every printed metre distance remain available.

Hosted readback verified all 12,172 results, 1,675 identities, 5,340 personal-best groups and 126 new chart queries. The previous nineteen publication heads were preserved. The next 2025-2026 source is 2026-01-19 - 2026 January Thaw.

## January Thaw checkpoint — published and verified

The user confirmed January 17–18, 2026 from the official US Speedskating event calendar. The archived PDF cover retains its January 18–19 dates. The Garden State January Thaw and NEST 3 adds 655 official results for 95 skaters across 56 events and 135 races. The 53 classification pages and 748 rows are retained separately. All 39 starred roster names retain their source spellings and use the readable display form in skater search.

Hosted readback verified all 12,827 results, the 95 new identities and their personal bests, and 285 new chart queries. Prior personal-best verification carries forward for unchanged identities. The previous twenty publication heads were preserved. The next 2025-2026 source is 2026-01-17 - 2026 Park Ridge Open.

## Park Ridge checkpoint — published and verified

The January 17, 2026 Park Ridge Short Track Open adds 455 official results for 95 skaters across 60 events and 105 races. The original PDF and 72 classification pages with 674 rows are preserved.

Hosted readback checked all 13,282 result rows and independently checked the new identities, personal bests and 269 chart queries. The previous twenty-one publication heads were preserved. The next 2025-2026 source is 2026-01-18 - US Junior Long Track Championships & AmCup 2.

## U.S. Junior Long Track Championships and AmCup 2 checkpoint — published and verified

The 39-page official 2025-2026 report adds 345 results for 79 skaters across 13 events. The official event calendar and physical page 2 establish the display title and January 16–18, 2026 competition dates. The archived cover keeps its printed wording. The archive includes all 21 distance-analysis pages. The 80 mass-start results retain their original 10-lap unit, sprint points, ranks, and times, including the two printed ties.

The user confirmed Jeremy Song’s page 39 result belongs to the same participant as bib 319. The source result preserves helmet number 26, rank 23, and 6:30.02. His single competition profile contains five results.

Hosted readback verified all 13,627 results and the original PDF hash. The new skater profiles, 251 personal-best groups and 265 chart queries passed. The previous twenty-two publication heads were preserved. The next 2025-2026 source is 2026-01-11 - 2026 Gateway Championships.

## Gateway Championships checkpoint — published and verified

The January 11, 2026 Gateway Short Track Championships in Kirkwood, Missouri adds 411 official results for 51 skaters across 72 events and 105 races. The original 106-page PDF and 74 classification pages remain accessible. The eight named divisions retain the mixed designation from the official roster.

Hosted readback verified all 14,038 results, the original PDF hash and 185 chart queries. The confirmed name-and-club rule linked 35 Gateway skaters to existing profiles. The previous twenty-three publication heads were preserved. The next 2025-2026 source is 2026-01-05 2026 U.S. Olymic Team Trials Long Track.

## U.S. Olympic Team Trials checkpoint — published and verified

The January 2–5, 2026 U.S. Olympic Team Trials Long Track report adds 252 signed results for 69 skaters across 15 events. The archive preserves all 150 pages and the two aggregate 500 m classifications with 49 rows. The 56 mass-start results retain the original 16-lap unit.

Matthew Salm’s signed men’s 1000 m result is eighteenth at 1:14.29. His 1:14.661 reskate remains in the unsigned timing evidence on pages 33–34. Greta Myers’s signed 1:56.04 reskate was published as a separate 1500 m result alongside her original disqualification.

Hosted readback verified all 14,290 published result rows, the original PDF hash and 153 chart queries. The previous twenty-four publication heads were preserved. The next 2025-2026 source is 2025-12-28 - 2025 Robby Kaufman Short Track Challenge.

## Robby Kaufman Short Track Challenge checkpoint — published and verified

The December 28, 2025 official protocol adds 195 results for 49 skaters across 28 events. All 31 classifications and three separate awards tables with 49 rows were retained. The 17 starred roster names retain the original asterisk in source evidence and use the clean name for display and matching. The source’s DIR code means Direct and is excluded from club-based matching.

Hosted readback verified all 14,485 published result rows, the original PDF hash and 98 chart queries. The previous 25 publication heads were preserved. The next 2025-2026 source is 2025-12-27 - 2025 Winter SPEEDtacular.

## Winter SPEEDtacular checkpoint — published and verified

The December 27, 2025 official protocol adds 102 race results for 30 skaters across 24 events and 28 races. The 32 original classification pages retain 168 rows separately from races. The original roster records all six divisions as Mixed. Blank club fields remain blank and are excluded from club-based identity matching. The scanned results were checked against the original images and are pinned to the reviewed PDF revision.

Hosted readback verified all 14,587 published result rows, the original PDF hash and 56 chart queries. The previous 26 publication heads were preserved. The next 2025-2026 source is 2025-12-21 - 2025 UOO Winter Challenge.

## Utah Olympic Oval Winter Challenge checkpoint — published and verified

The December 20–21, 2025 dates come from the official US Speedskating event calendar. The 64-page PDF is preserved with its original December 20–22 cover date. The 2025-2026 publication adds 505 race results for 76 skaters across 35 events and 103 races. The 32 original classification pages retain 554 separate standings rows. Bibs 395 and 396 are visible at the page 3 footer and are included in the roster. Matthew Zhang’s fifth place with an ADV marker on page 45 preserves the blank time. The source keeps the literal GSS club label, which matches Garden State Speedskating for identity linking.

Hosted readback verified all 15,092 published result rows, the original PDF hash and 193 chart queries. The previous 27 publication heads were preserved. The next 2025-2026 source is 2025-12-21 - 2026 US Junior Short Track Championships.

## US Junior Short Track Championships checkpoint — published and verified

The December 19–21, 2025 dates come from the official US Speedskating event calendar and match the protocol cover. The 64-page source adds 718 race results for 47 skaters across 38 individual events and 144 races. Twenty classification pages retain 337 standings rows. The separate two-kilometre relay table preserves eight teams and 32 roster entries. Sean Shuai and Tiffany Zhang retain their printed fourth places and ADV marks with blank times.

Hosted readback verified all 15,810 published result rows, the original PDF hash and 139 chart queries. The previous 28 publication heads were preserved. The next 2025-2026 source is 2025-12-14- 2025 Badger International & Heartland #4.
