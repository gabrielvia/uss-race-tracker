# Reliable selected-event imports

The current multi-event extension is documented in [multi-event-imports.md](multi-event-imports.md). Schema version 3 publishes several complete events together; schema version 2 remains a compatible single-event input. Both now require retaining all previously published events. The sections below describe the original foundation and its verification history.

This milestone adds ingestion to the main viewer's backend. It does not create an Admin website, login page, scheduler or email service. The visitor interface remains the existing sample viewer.

## Coverage and review

Contract version 2 contains **one competition roster and one complete selected event**, including every announced heat. Only `tempus-roster-sample/0.1` and `tempus-complete-event/0.2` are supported. This is not a whole-competition import, a historical crawler or a multi-event append operation. Publication replaces that competition's entire projection with this reviewed scope. Other competitions are preserved. Do not use this contract to append an event to a competition with broader coverage.

The operator must review PDF pages, competition metadata and the official season assignment, then record a reviewer label, original season label and notes. Preparation checks the local PDF hash. Server validation cross-checks extracted evidence; it does not independently fetch or parse the PDF. The PDF hash remains an operator assertion until original-document uploads are implemented. Validation cannot prove the extraction faithfully represents the PDF or the roster covers every page. Every report retains these coverage and review warnings.

Names, affiliations, raw age categories, repeated roster observations and source pages are preserved. Bibs identify people only within the competition. Cross-competition identities and skating age are not inferred. PEN/DNS/DNF/DQ rows are imported and displayed alongside finishers. The official status is separate from qualification markers. Missing place/time values remain null; any published numeric place or time is retained. Status rows have no comparative time-order number and remain visible after timed finishers. Unknown or ambiguous row formats still require review instead of being silently omitted. Dates must fall inside the reviewed July-to-June season; exceptions require a future explicit rule. Groups/genders, distance, round and source event must agree, raw times must match exact microseconds, and all declared heats must be present.

## Storage and publication

- `import_batches` stores candidate keys, report JSON, timestamps and lifecycle state: `rejected`, `validated`, `published`. A superseded publication retains its historical published state; use the head endpoint to identify the current version.
- Candidate IDs hash canonical JSON plus validation version `selected-event/2`. Key order and formatting do not affect the ID; array order remains meaningful. Repeat submission returns the same batch/report.
- R2 stores candidates under `imports/candidates/` and immutable evidence under `imports/evidence/`. Unpublished candidates are never exposed through the public source API.
- `import_publications` records the current batch per competition. `baseBatchId` must equal that head at publication time. A new competition or initial seed adoption uses null. Competing revisions cannot both publish. A stale candidate needs review and resubmission with the current head.
- Publication verifies candidate integrity and validation again, uploads immutable evidence, then replaces competition rows and updates the head in **one D1 transaction**. An SQL CHECK assertion inside that transaction rejects stale state before replacement. SQL/R2 failures preserve old visible rows and evidence references. Unreferenced R2 objects can remain after failure; cleanup is deferred.
- Source revision IDs derive from the original source ID, PDF hash and evidence hash. Old evidence and candidate reports remain for audit. Global source identity and multi-document competitions are deferred.
- The sample `/api/admin/seed` bootstrap is disabled after the first validated publication. An in-transaction guard also protects against racing seed requests.

Candidates are limited to 2 MiB, checked while streaming even without Content-Length, with at most 1,000 participants, 2,000 entries, 1,000 results and 100 heats. Competition IDs use a shared 1–80 character lowercase letter/digit/hyphen rule across validation and Viewer routes. Every detail query, including metadata and source references, executes in one D1 read batch so a concurrent publication cannot mix revisions. Full historical protocols have not been performance-tested. Reverting to an old payload requires a newly reviewed batch based on the current head. A validation rule change requires a version bump and resubmission.

## Authorization

Every ingestion read/write requires the machine bearer token, currently the existing `SEED_TOKEN` runtime secret. Sites viewer access alone never authorizes writes. Keep the token outside browser code. A future Admin integration needs server-side authorization and a dedicated service credential; this is not an Admin session.

Private hosted Sites also require the separate `OAI-Sites-Authorization` service token to pass the hosting gate. Supply secrets through hidden stdin, never command arguments, URLs or committed files. Ignored local `.dev.vars` may be read only for loopback targets. Cross-origin redirects are blocked before either credential is forwarded.

Version 1 batches must be regenerated using parser 0.2 and resubmitted as schema version 2; old published data remains readable. Migration `0003_early_jigsaw.sql` preserves existing result rows, initializes status to null and permits null places/times for status records. It does not invent zero times.

## Local operation

Apply migrations and start the viewer following [local-sites-foundation.md](local-sites-foundation.md). From the repository root, using the checked short-track extraction and its downloaded source PDF:

```sh
python3 scripts/import_batch.py head --url http://127.0.0.1:5173 \
  --competition st-agn-2026 --local-credentials web/.dev.vars

python3 scripts/import_batch.py prepare --competition st-agn-2026 \
  --pdf /private/tmp/uss-st-agn.pdf --output outputs/st-import.json \
  --reviewer "Operator name" --season-label "2025-2026" \
  --notes "Checked metadata, roster and every selected event heat."

python3 scripts/import_batch.py submit --url http://127.0.0.1:5173 \
  --candidate outputs/st-import.json --local-credentials web/.dev.vars

python3 scripts/import_batch.py report --url http://127.0.0.1:5173 \
  --batch-id <returned-id> --local-credentials web/.dev.vars

python3 scripts/import_batch.py publish --url http://127.0.0.1:5173 \
  --batch-id <validated-id> --local-credentials web/.dev.vars

python3 scripts/check_site.py --url http://127.0.0.1:5173 \
  --local-credentials web/.dev.vars --read-only
```

For a revision, pass `--base-batch-id <current-head>` during preparation. The `head` command supplies that value. Use `--item <file.json>` instead of `--competition` for a normalized item from the same supported parser contract. Preparation does not submit; submission does not publish. Review the report before the separate publish command.

Hosted commands use the deployed HTTPS origin and omit `--local-credentials`. At the hidden stdin prompt supply JSON containing `seed_token` and `service_token`. Do not put actual secrets in shell history.

## HTTP contract

| Operation | Endpoint | Result |
| --- | --- | --- |
| Current base | `GET /api/imports?competition=<id>` | Current baseBatchId, or null before first publication |
| Submit | `POST /api/imports` | Stable batch/report; 200 validated, 422 rejected |
| Report | `GET /api/imports/<id>` | Stored report and lifecycle timestamps |
| Publish | `POST /api/imports/<id>/publish` | 200 active publication; 409 rejected, stale or superseded |

Other responses: 401 unauthorized, 400 invalid JSON, 415 wrong content type, 413 oversized body, 404 missing batch and 503 transient storage failure. Retry storage failures with the same payload/ID.

## Verification

Tests execute the actual TypeScript routes against SQLite with generated migrations and fault-injectable R2 storage. They cover both formats, repeated submission/publication, candidate privacy, authorization, source integrity, precision, seasons, malformed dates, incomplete heats, mixed groups, bib conflicts, SQL rollback near the end of replacement, R2 failures and competing revisions. Python tests cover preparation, PDF hashes, size limits and credential transport. Actual local and hosted runtime smoke checks supplement these tests.

### Verification record — 2026-10-30

- 32 Python tests, 26 TypeScript-route integration tests, TypeScript checking and the production build passed.
- The actual local D1/R2 runtime accepted and published the checked short-track candidate; repeated publication was idempotent. The long-track projection was preserved.
- The existing owner-private Site deployed successfully from Sites source commit `345adbf9e16fb4cd11a211d2ae031b24e3254d73` (deployment `appgdep_6ae4270dbdd481919e89a1d1d6c43250`). Hosted candidate submission and publication passed. Viewer read-back retained ST counts of 213 participants / 213 entries / 14 results and LT counts of 76 / 77 / 7.
- No Admin Site, schedule or email integration was created. Implementation branch: `codex/reliable-competition-imports`.

### Independent review fixes — 2026-10-30

The review identified three P2 defects. All three are corrected:

1. Parser 0.2 retains PEN/DNS/DNF/DQ from the place column, an unplaced bib-first row or the time column. It stores the source row, separate status, optional official place and optional exact time. Viewer shows a Status column and em dashes for missing values; it does not give status rows a comparative time-order number. Schema/validation version 2 requires status-aware extraction, so old candidates must be regenerated.
2. Competition metadata, source reference, participants, entries and results are read in one D1 batch. The SQLite adapter now returns actual SELECT rows. A deterministic regression publishes a revision at the former read gap and checks coherent source/metadata/person/entry results.
3. Public details, ingestion validation and current-head lookup share the same competition ID rule. Tests import, publish, list and open 61- and 80-character IDs; 81-character IDs are rejected.

Verification: 38 Python tests and 33 route integration tests pass, with TypeScript checking and the production build. Local migration preserved the original 21 sample results. Browser QA used a real 39-result / 7-heat event with an unplaced PEN record; the record stayed visible with null time/place and its source page. Original sample selection was restored afterward. Actual protocol status-row excerpts are retained in `tests/fixtures/tempus-status-rows.json` for regression coverage.
Hosted verification also passed after deployment `appgdep_6ae4d492dcfc8191bdd8efb257076d67` from Sites source `bcf071e05c424ec57c6dd53302d410959ffe8ea0`: schema migration preserved both original samples; version-2 candidate submission, repeat submission, publication, repeat publication, stored report, current head and Viewer read-back all succeeded. The hosted selection remains the original ST 14-result / 3-heat event and LT 7-result event; the 39-result status event was used only for local QA.
