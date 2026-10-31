# Phase 3: data model and reliable import

This milestone completes the main website's data/import foundation for the verified Tempus format. It includes full-source RESULTS imports, original-document archival, audited identity/rule decisions, age constraints and scoped server queries. The separate Admin site, cloud scheduling/email, broad historical format expansion and the later directory/history/chart experience remain in their planned tracks.

## Checked source coverage

| Competition | Physical pages | Group/round event records | Races | Results | Classification pages |
| --- | ---: | ---: | ---: | ---: | ---: |
| ST AGN 2026 | 177 | 112 | 366 | 1,847 | 62 |
| LT AGN 2026 | 118 | 59 | 77 | 462 | 79 |
| Total | 295 | 171 | 443 | 2,309 | 141 |

Event counts describe exact source headings, not distinct printed event numbers. The original seven selected events and all 85 results are retained with stable IDs. Classifications remain separate source pages/rows and never inflate the result count. Full original PDFs are archived in R2 and verified by reading back their SHA-256.

The complete-source preparation also independently matches every SKATER LIST page and every roster row, including non-racing entrants, against the supplied coordinate extraction. An incomplete sampled roster cannot silently become a full-source import.

Every numbered RESULTS record in these two source revisions is now extractable. The remaining cases from the previous inventory were resolved by retaining all lettered finals, literal `FNT`/`YC`, an explicit absent-finish note, and the literal next-line `Finals` in two wrapped headings. Original heading lines are retained. Finals require unique contiguous A-through-last tiers; unknown statuses, missing heats, unassigned rows and unsupported layouts still produce actionable inventory issues.

The format contract remains bounded: one reviewed source PDF per candidate, at most 250 events, 5,000 results, 1,000 participants, 2,000 entries, 100 races per event, 8 MiB candidate JSON and a 32 MiB original PDF. Larger or unsupported sources require explicit review; the tools do not silently truncate them. Historical files have not all been imported; expanding the directory/formats is phase 6 work.

## Prepare and publish

Install `requirements-data.txt` and the existing web dependencies. Preserve the checked original PDFs locally. Review competition metadata with `id`, `title`, `discipline`, `season`, `startsOn`, `endsOn` and `location`; save it as `outputs/st-metadata.json`.

```sh
python3 -m scripts.prepare_protocol \
  --file /private/tmp/uss-st-agn.pdf \
  --roster data/samples/short-track-agn-roster.json \
  --metadata outputs/st-metadata.json \
  --output outputs/st-protocol-item.json \
  --report outputs/st-protocol-inventory.json

python3 scripts/import_batch.py archive --url http://127.0.0.1:5173 \
  --pdf /private/tmp/uss-st-agn.pdf --source-url <official-pdf-url> \
  --local-credentials web/.dev.vars

python3 scripts/import_batch.py head --url http://127.0.0.1:5173 \
  --competition st-agn-2026 --local-credentials web/.dev.vars

python3 scripts/import_batch.py prepare --item outputs/st-protocol-item.json \
  --pdf /private/tmp/uss-st-agn.pdf --output outputs/st-candidate.json \
  --reviewer "Operator name" --season-label "2025-2026" \
  --notes "Reviewed all source pages, rows, heats, finals and classifications." \
  --base-batch-id <current-head>

python3 scripts/import_batch.py submit --url http://127.0.0.1:5173 \
  --candidate outputs/st-candidate.json --local-credentials web/.dev.vars

python3 scripts/import_batch.py report --url http://127.0.0.1:5173 \
  --batch-id <returned-batch-id> --local-credentials web/.dev.vars

python3 scripts/import_batch.py publish --url http://127.0.0.1:5173 \
  --batch-id <validated-batch-id> --local-credentials web/.dev.vars
```

Only omit `baseBatchId` for a genuinely uninitialized publication head. The original PDF must be archived before a full protocol can publish. Repeat the equivalent workflow for long track. Metadata/season review remains explicit; the validator checks consecutive July-to-June seasons and real date ranges rather than inferring a season from a title year.

Hosted operations use the same commands with the existing Site origin and hidden-stdin machine/service credentials. Never place tokens in arguments, URLs, reports or Git. `--local-credentials` is restricted to loopback. Ordinary viewers cannot call import, candidate-export, identity-review, rule-review or history operations.

The database activation unit is one complete candidate competition. Publication uses bounded JSON row chunks and one D1 transaction, retaining stale-head and event-coverage guards. Chunking does not activate partial rows. D1 JSON functions keep bind counts bounded even for hundreds of event keys. Exact candidate resubmission/publication is idempotent; historical correction records are intentional provenance, not duplicate active athletes/results.

Payload schemas 2/3 and checked event parsers 0.2/0.3 remain compatible. New full extraction uses event parser 0.4, inventory 0.3 and protocol batch 0.1. Current server validation is `competition-events/6`; older unpublished reports must be regenerated. Existing publications remain readable. Schema-only migrations 0005/0006 add the model and nullable fields without changing existing data.

## Reviewed source corrections

A normal candidate must include every published event. If an official correction actually removes an event or changes its identifying heading, use `prepare --remove-event-key <old-key> --reconciliation-reason "<reviewed source correction>"` with the current head. List every removed/replaced old key explicitly. The server verifies that each key exists, does not remain in the replacement and is covered by the explicit review record. It repeats coverage/revision checks inside the transaction. Old documents, candidates and publication lineage remain intact.

Import history is protected and paginated:

```sh
python3 scripts/import_batch.py history --url http://127.0.0.1:5173 \
  --competition st-agn-2026 --local-credentials web/.dev.vars
```

`GET /api/imports/:id?candidate=1` exports the original candidate only to an authorized operator. Failed validation and failed publication leave the prior projection visible. The report records errors/warnings per event; age issues quarantine numerical estimates instead of hiding valid race participation.

## Identity and age review

Initial identities are competition-local. Names/bibs never merge competitors automatically. Source spelling, clubs and categories are immutable observations. A changed name/affiliation on the same competition bib requires review before combined identity/age use.

Use the protected CLI to inspect current mappings and rule assignments:

```sh
python3 scripts/review_metadata.py identity-history \
  --url http://127.0.0.1:5173 --participant st-agn-2026:185 \
  --local-credentials web/.dev.vars

python3 scripts/review_metadata.py age-rule-history \
  --url http://127.0.0.1:5173 --competition st-agn-2026 \
  --local-credentials web/.dev.vars
```

An identity decision JSON contains `participantKey`, current `expectedRevision`, current `expectedBatchId`, target `skaterId` (or null to establish a distinct reviewed identity), `reviewer`, `reason` and source-reference `evidence` URLs. Submit it with `review_metadata.py identity --decision outputs/identity-decision.json` and the same origin/credential flags. Mapping corrections append an audit record and guard both identity and publication revisions.

An age-rule decision contains `competitionId`, current `expectedBatchId`, current assignment `expectedRevision` (null initially), a `definition` from a reviewed rule file, `reviewer` and `reason`. Submit it with `review_metadata.py age-rule --decision outputs/age-rule-decision.json`. The rule must match the competition's exact discipline/season and July 1 baseline. Definitions and assignments are versioned; concurrent/stale reviews cannot silently overwrite one another.

The checked rules are [short track](../data/rules/short-track-agn-2025-2026.json) and [long track](../data/rules/long-track-agn-2025-2026.json). Their explicit source pages and baseline conventions are retained. Single-age division evidence is allowed only where the rule lists that exact division; ability/combined groups are not age evidence. Current profiles derive ranges or unique inferred values, preserve conflicts and update each July 1 in `America/New_York`. Original historical categories do not change. The evidence panel links both the source observation and rule, with its baseline date. No birthdate is invented.

## Query contract and read-back verification

`GET /api/competitions?discipline=short-track&season=2025-2026&q=Nationals&page=1` performs server-side scoped search/counts and returns at most 25 records. Discipline and season are required together; empty scopes stay empty. Search treats `%`/`_` literally. `GET /api/competitions/scopes` lists available scopes for the phase 4 directory. The parameter-free endpoint remains compatible with the current two-competition sample client; phase 4 applies the recorded directory layout/URL decisions.

Public read endpoints also expose the current competition projection, separate classifications, archived documents and participant age/source profiles. They use uncached, coherent database snapshots where records must agree. See the [data dictionary](data-dictionary.md).

```sh
python3 -m scripts.check_protocol --url http://127.0.0.1:5173 \
  --item outputs/st-protocol-item.json --local-credentials web/.dev.vars
```

This read-only verifier compares every result field, event/race isolation, roster counts, exact R2 extraction/classification data, archived PDF hash, scoped directory query and protected history. Use the same command/hidden-stdin flow against the private Site after deployment.

## Acceptance evidence

62 Python tests and 70 backend integration tests pass. Coverage includes unknown-status detection, complete heats/final tiers, wrapped titles, classification case variants, exact timing, source hashes, absent finishes, duplicate requests, bulk limits, 1,200 rows across 120 events, late SQL rollback, stale publications, explicit event reconciliation, lineage restoration, identity splits/reviews, age conflicts, July 1/timezone boundaries, concurrent rule/identity reviews and discipline/season pagination.

TypeScript checking and the production build pass. Local runtime checks archive/read back both PDFs and publish all 171 events with all original 85 results retained. Reviewed age checks cover 213 short-track and 76 long-track local identities without unresolved categories/conflicts. Browser checks cover multiple finals, literal statuses, missing finishes, age ranges, rule/source links and accessible age help.

## Hosted verification — October 30, 2026

The existing private [USS Race Tracker Site](https://uss-race-tracker.basicsnail67.chatgpt.site) successfully deployed source commit `989674871de5a4e755d5420bbfd0eaae4a4445d7` through deployment `appgdep_6ae55f327c688191a45b2f2baf0b7c9c`. This is the Sites source revision; GitHub changes remain uncommitted at this checkpoint. Both new schema migrations are applied to the hosted database.

Final server validation uses `competition-events/6`. Both published candidates report `protocol-results` coverage: all numbered RESULTS events are covered, while official classification pages remain separate original source evidence.

| Protocol | Events | Races | Results | Classification pages | Roster participants / entries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Short-track AGN | 112 | 366 | 1,847 | 62 | 213 / 213 |
| Long-track AGN | 59 | 77 | 462 | 79 | 76 / 77 |
| Total | 171 | 443 | 2,309 | 141 | 289 / 290 |

The protected submit/publish flow and repeated-request checks passed against the deployed runtime. Read-back matched every event, race and result field, all roster rows, classification evidence, current publication history and both archived PDF SHA-256 hashes. The original 85 results remain intact. Reviewed age checks covered all 289 competition-local identities with no unresolved categories, identity reviews or age conflicts in these two publications.

Final published batch IDs:

- Short track: `049132cc81db810b4bcaa3062c4fef003d4e2cc6486f6926e59c63272fdcf046`
- Long track: `b9c97d992a95161f5ece0f1227d702c1dfc68522d627384a1304d26b0390f8a4`

Hosted browser checks confirmed 14 results across all three A/B/C finals in Junior E Women's 700 Event #19, preserved selection on refresh, the archived protocol link, and the current-season skating-age range with expandable source/rule/baseline evidence. The final screenshot is saved locally at `outputs/phase3-complete.png` (ignored operational evidence).

Phase 3 is complete for the verified Tempus protocol formats represented by these two complete protocols. Additional historical formats remain subject to their own source audit and parser acceptance; they are not implicitly covered by this milestone.
