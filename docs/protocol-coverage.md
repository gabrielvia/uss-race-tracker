# Protocol inventory and coverage

This local tool scans every physical page of a Tempus PDF before expanding the main website's selected-event coverage. It inventories numbered RESULTS records, audits extraction completeness and optionally compares them with a supplied publication-evidence snapshot. It does not submit candidates, publish results or create an Admin website.

## Checked source snapshots

| Source | Physical pages | Discovered event records | Export eligible | Needs review | Verified published events |
| --- | ---: | ---: | ---: | ---: | ---: |
| Short Track AGN 2026 | 177 | 112 | 29 | 83 | 2 |
| Long Track AGN 2026 | 118 | 59 | 30 | 29 | 2 |

The checked reports are [short-track inventory](../data/samples/short-track-agn-protocol-inventory.json) and [long-track inventory](../data/samples/long-track-agn-protocol-inventory.json). Each records the official source URL, PDF hash, scanned pages, original event headings, observed races, result-row counts, issues and evidence comparison. Original PDFs and exported extraction files remain outside version control.

These are counts of `(source event number, exact source heading)` records, not official competition event totals. The same short-track number can appear under different groups. Classifications are listed separately; unsupported layouts require review. `complete_competition` is always false.

The 29 short-track exports contain 605 result rows; the 30 long-track exports contain 238. All 59 exported events passed the existing server validator in separate offline schema-version-3 candidates. This confirms compatibility of those checked files, not approval to publish them together. No new results were published during this inventory. The website still contains four selected events and 67 results.

## Audit rules

- Read all physical pages and verify the PDF hash and page count against the roster. Partial scans, unresolved roster issues, conflicting bib identities, mixed classification/results pages and unassigned race data prevent automatic exports for the source.
- Discover source headings independently of the narrower supported event parser. Preserve unsupported headings in the report rather than silently ignoring them.
- Collect each event's blocks across pages and require every announced heat. Compare the exact multiset of physical page, race ID and original result row with the extracted rows. Unknown status prefixes such as `WD` must appear as review issues if the parser cannot account for them.
- Preserve supported `PEN`, `DNS`, `DNF` and `DQ` results, including null place/time values. These statuses do not make results disappear.
- Flag event numbers with different headings and race IDs reused across events. Current assembly and publication contracts do not resolve these ambiguities automatically.
- Compare result names and affiliations with normalized roster identities. Age annotations in raw names remain source evidence; they require an explicit identity-mapping solution before server import, rather than weakening the server identity checks.
- Distinguish event extraction status from export eligibility. An otherwise complete event can remain ineligible because the source has unresolved issues. Other events' local extraction failures do not by themselves suppress a valid, independent event.

In these snapshots, short-track review cases include 52 records with reused event numbers across headings and 31 extraction failures. Long-track review cases include 18 identity-annotation cases, nine extraction failures and two unsupported headings. These issue counts describe these files only. Some printed long-track headings end at `Semi-`; the tool does not invent the missing text.

Publication coverage has a separate evidence basis. Without `--published-evidence`, publication is `not_checked`, not assumed absent. With a saved evidence snapshot, the tool verifies source ID, URL and hash, rejects duplicate supplied events, compares exact results/heats/counts, and retains unknown supplied event keys for review. `published_verified` means agreement with that supplied snapshot, not a live database query. Both checked samples matched their two supplied published events.

## Run locally

Install `requirements-data.txt` for PDF extraction. From the repository root:

```sh
python3 -m scripts.inspect_protocol \
  --file /private/tmp/uss-st-agn.pdf \
  --roster data/samples/short-track-agn-roster.json \
  --output outputs/st-protocol-inventory.json \
  --events-output outputs/st-protocol-events
```

For long track, use `uss-lt-agn.pdf`, `long-track-agn-roster.json` and separate output paths. Add `--published-evidence outputs/current-evidence.json` when a saved extraction-evidence snapshot is available. Accepted shapes are `{roster, events}`, legacy `{roster, race}`, or a competition item containing either under `evidence`. Do not include authorization tokens in this file.

Exports use the existing `tempus-complete-event/0.2` format. They are written under a subdirectory named from the canonical report's SHA-256 prefix. Use the `event_directory` printed by this run; scanning all historical export directories would mix stale files with current results. Repeating the same deterministic report reuses the same directory.

After reviewing issues and selecting compatible exports, follow [multi-event imports](multi-event-imports.md): assemble, prepare a candidate against the exact local PDF, submit, inspect the server report, and explicitly publish. Existing limits still apply: at most 20 selected events and 1,000 total results per candidate. Include all already-published events and the current `baseBatchId`; splitting an import must not erase earlier coverage.

## Verification and next step

The offline Python suite passes 54 tests, including 15 inventory tests covering page/heat completeness, unknown statuses, supported status retention, ambiguous identifiers, unsupported headings, source/evidence mismatch and raw-name annotations. Real scans cover all 295 physical pages, and the 59 eligible exports pass the existing server validator without network or publication calls.

The next parser milestone should resolve group-aware event identity and annotated roster/result name matching while preserving original evidence, then regenerate these reports before proposing wider publication. Complete competition coverage, cross-competition identity and skating-age inference remain separate milestones.
