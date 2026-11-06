# Phase 6: reviewed historical coverage increment

The bounded phase 6 increment is implemented on `codex/phase6-historical-coverage`, based on phase 5 squash merge `b5570220fcc5fa78439532f3ff6f2cc74e55fee5`. It expands the real corpus to four competitions in two seasons. It does not complete the historical archive. GitHub commit/push/merge remains a separate user decision.

## Current corpus and source queue

| Source | Season | Physical pages | Source events | Races | Individual results | Classification pages | Supplemental pages |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Short Track AGN 2026 | 2025-2026 | 177 | 112 | 366 | 1,847 | 62 | 0 |
| Long Track AGN 2026 | 2025-2026 | 118 | 59 | 77 | 462 | 79 | 0 |
| MASA Short Track 2026 | 2025-2026 | 72 | 40 | 85 | 420 | 42 | 0 |
| Long Track AGN 2025 | 2024-2025 | 125 | 67 | 85 | 509 | 88 | 2 |
| Total | 2 seasons | 492 | 278 | 613 | 3,238 | 271 | 2 |

There are 452 competition-local participants and 453 entries. The 32 explicitly reviewed MASA/AGN pairs produce 420 active identities. New 2025 identities remain competition-local until individual cross-year links are reviewed. Name or club equality does not establish identity. The [name/profile correction](masa-name-profile-correction.md) retains all original names, annotations, results and source evidence while cleaning 30 MASA display names.

The November 3 directory refresh contains 499 listings, 494 distinct season/source links, 266 PDF listings and 233 historical page listings across 14 season/year groups. Listings are not unique competitions or verified dates. `data/sources/reviews.json` binds reports to exact source hashes and review timestamps. `scripts/source_coverage.py` generates `web/lib/source-coverage.json`, rejecting mismatched URL/hash pairs and incomplete reports labelled audited.

Current queue: four audited individual RESULTS protocols, one partly parsed protocol and 489 uninspected sources; 490 sources still need a complete audit. The remaining **Short Track AGN 2025** source has 79 discovered numbered headings, 76 parsed, three unsupported `Picking 1+(2)` headings and three unassigned final pages. Its 54 source/page issues remain explicit and prevent partial publication. Earlier records describing both 2025 sources as blocked are superseded by this increment.

## Long Track AGN 2025 review

Directory source ID `ea1b0536186f3b34`; PDF SHA-256 `ac7793ee804fff69c79130ee819486cf2cac542bd41d42653061cb7f5bce33bd`. The official cover establishes February 8–9, 2025 in Roseville, MN. All 125 physical pages were scanned; 79 roster entries and every numbered individual RESULTS event were checked. All 509 results have one exact applicable entry. There are 497 positive timed status-free results, ten DNS, one FNT and one DNF. Original times, statuses, qualification markers, headings and result rows remain literal.

Ten wrapped event headings retain both original lines. `tempus-complete-event/0.6` joins only supported literal continuations, including `Super Final` + `Finals` and `Super` + `Final Finals`. The pinned source vocabulary requires those exact lines for the known wrapped headings; missing or fabricated continuations fail validation. Inventory version 0.5 records the complete scan. The original AGN and MASA contracts remain accepted.

Physical page 124 contains Team Pursuit Results and page 125 Club Champion standings. Protocol batch `tempus-protocol-batch/0.3` retains both complete original extracted texts separately. Their exact hash/page/kind/label/text must match `web/lib/imports/reviewed-source-tables.json`; dropping, moving or changing either page fails validation. Team times supply no individual result, PB, distance conversion or identity inference. Original PDF links preserve the table layout when extracted columns are difficult to read. `complete_competition` remains false: preserving classifications and supplements does not reconstruct official classification semantics.

`tempus-lt-agn-2025-dimensions/1` applies only to this exact PDF hash. It maps the source's literal entry/event vocabulary, including mixed Future of Speed and Junior A/Senior Mixed events, Masters and Masters (65+). `Group A` remains a competition group. No 2025 age rule is assigned; the 2025-2026 rules are not applied retroactively.

## Retained MASA review

MASA source ID `a3e0ccc938d4730c`, SHA-256 `2671f997837bdc170dfc1fc995fbe9431ea30df968678e51e62d350a72440ae2`, March 7, 2026 in Shelton, CT. The complete source has 84 participants/entries, 40 events, 85 races and 420 individual rows: 408 timed results, nine DNS and three PEN. All original stars remain in immutable evidence and `source_name`.

The literal `(#2)` distance annotation and `Super Final Finals` remain distinct source headings. Protocol batch 0.2 requires the exact empty roster template on physical page 5, pinned to hash/page/full text. A changed or missing template fails validation. `tempus-masa-dimensions/1` preserves eight ability divisions, separate NEST MEN/WOMEN scopes and mixed events. Ability categories provide no numeric age inference. Existing AGN dimensions and long-track bib 370's two exact entries remain unchanged.

## APIs and publication

Validator `competition-events/9` retains source archival, bounded-size validation, exact entry evidence, heat completeness, stale-head protection and atomic publication. Supplement pages stay in immutable R2 extraction evidence; the active publication metadata stores their count. No schema migration or existing competition re-publication is required.

`GET /api/coverage` reads current publication counts/seasons/timestamp from the database and distinguishes them from directory discovery and pinned-source audits. The disclosure shows pending sources and the blocked protocol. A directory refresh never claims that a PDF was audited or published.

`GET /api/competitions/:id/source-tables?source=:sourceId` returns the current published source's original supplemental pages. A mismatched source revision returns 409, preventing a stale competition view from combining a new table with its old PDF. Responses are uncached. The competition page fetches tables only when their disclosure opens and links each physical page to the archived PDF.

The original Site project, D1/R2 bindings and owner-only audience are preserved. Private **v21** uses Sites source commit `9cdf3eabc0c50dd8f3ccb587bea37c0926322e90`, deployment `appgdep_6aeba93ec05c819188f643d986535331`. This is Sites source history, separate from GitHub. The new active batch is `d519578b1d6321e8e3562fa7155ac80b52d274d5f17afcb2b3526d1568b7c4f6`. Repeated publication and identical re-submission are idempotent; all three pre-existing publication heads remain unchanged.

## Reproduce and validate

Run from the repository root with Python/pdfplumber and Node 22.13+:

```sh
python3 scripts/download_sample.py --source-id ea1b0536186f3b34 --output .data-cache/long-track-agn-2025.pdf
python3 scripts/inspect_roster.py --file .data-cache/long-track-agn-2025.pdf --source-id ea1b0536186f3b34 --max-pages 125 --output outputs/lt-2025-roster.json
python3 -m scripts.prepare_protocol --file .data-cache/long-track-agn-2025.pdf --roster outputs/lt-2025-roster.json --metadata data/samples/long-track-agn-2025-metadata.json --output outputs/lt-2025-item.json --report outputs/lt-2025-inventory.json
python3 scripts/source_coverage.py
python3 -m unittest discover -s tests
node --test web/tests/*.test.mjs
```

Metadata must explicitly record the ID `lt-agn-2025`, discipline `long-track`, season `2024-2025`, title, source-confirmed location and dates above. After reviewing source and metadata, follow [protected import operations](phase-3-completion.md): archive/head/prepare/submit/report/publish. Only a new competition may use a null base head. Ordinary verification must never replay a seed or writer script. Credentials travel through hidden stdin, not parameters, URLs, reports or Git.

The full suite passes 100 backend tests, 74 Python tests, TypeScript and production build. Meaningful negative cases include forged/dropped supplemental evidence, wrapped heading changes, incorrect applicable entries, unsupported unnumbered RESULTS and stale source selection. Existing identity, age, atomicity, PB and chart regressions pass.

Independent completeness validation and code review each stopped after one clean iteration (maximum two permitted); reviewers independently passed focused backend/Python checks. See [phase 6 acceptance](phase-6-acceptance.md) for hosted/browser/performance evidence and remaining scope.
