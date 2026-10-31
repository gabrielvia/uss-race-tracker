# Protocol inventory and coverage

The local inventory scans every physical page of a supported Tempus protocol, discovers exact numbered RESULTS headings, audits all source race rows and optionally compares them with a supplied publication-evidence snapshot. It never submits or publishes a candidate. The complete import workflow is described in [phase 3 completion](phase-3-completion.md).

## Checked source snapshots

| Source | Physical pages | Event records | Extractable events | Needs review | Published events |
| --- | ---: | ---: | ---: | ---: | ---: |
| Short Track AGN 2026 | 177 | 112 | 112 | 0 | 112 |
| Long Track AGN 2026 | 118 | 59 | 59 | 0 | 59 |

The reports are [short track](../data/samples/short-track-agn-protocol-inventory.json) and [long track](../data/samples/long-track-agn-protocol-inventory.json). Counts describe exact source group/distance/round headings, not distinct printed event numbers or official competition totals. The two revisions contain 1,847 and 462 race results respectively. All 171 per-event checks and both complete candidate validations pass.

Raw classification pages remain separate: 62 short-track and 79 long-track pages. Original PDFs, full extraction files and generated candidate items are outside Git. The private Site contains all 2,309 source race results; all previous selected-event results and URLs are retained.

The original inventory's 43 outstanding event records are now resolved: multiple final tiers, FNT/YC codes, one absent finish and two two-line semi-final headings. The current pipeline does not invent a status, missing title text, birthday, time or official overall rank. Other historical source formats remain outside this checked coverage.

## Audit and export rules

- Verify the PDF hash and page count against the source roster, then scan every physical page.
- Keep classifications separate from RESULTS and retain their original text. Mixed/unassigned tables and incomplete scans are review issues.
- Identify one event by its exact heading, preserving all announced heats across pages. Reused numbers under different groups do not merge those groups.
- Compare the multiset of physical page, source race and exact result row with the extracted rows. Known statuses remain results; an unknown status prefix, including a long or mixed-case code, must be accounted for or flagged.
- Require contiguous numbered heats, or lettered final tiers starting at A without gaps/duplicates. Preserve each race's own place; time order is only a comparison.
- Match roster/result identities using exact competition-local bib, affiliation and names or explicitly evidenced source age annotations. Spelling aliases and arbitrary parentheses are not normalized into identity matches.
- Rejoin a wrapped `Semi-` heading only when the literal following line is `Finals`, retaining both source lines.
- Retain a missing finish only when the original placed row ends at its exact roster name/affiliation. Keep null time/status and an explicit application note.

Full-protocol preparation adds an independent audit of every SKATER LIST page and complete original roster row, including entrants without results. It separately accounts for every classification-page number. A partial roster or omitted classification table cannot silently pass as a full-source candidate.

## Publication evidence

Without `--published-evidence`, publication status is `not_checked`; absence is not assumed. With a saved evidence snapshot, source ID, URL and PDF hash must match. Duplicate supplied events are rejected; exact results, heats and counts are compared, and unknown supplied keys remain in the report.

`published_verified` means agreement with that supplied evidence snapshot, not a live database query. The checked reports were regenerated against the hosted full-source snapshots: 112 short-track and 59 long-track events. `complete_competition` remains false because official classification semantics and arbitrary historical formats are not reconstructed from race times.

## Run locally

```sh
python3 -m scripts.inspect_protocol \
  --file /private/tmp/uss-st-agn.pdf \
  --roster data/samples/short-track-agn-roster.json \
  --output outputs/st-protocol-inventory.json \
  --events-output outputs/st-protocol-events
```

Add `--published-evidence outputs/current-evidence.json` to compare a saved extraction-evidence snapshot. Accepted evidence shapes are `{roster, events}`, legacy `{roster, race}`, or an item containing either under `evidence`. Do not put tokens in evidence files.

Inventory version 0.3 exports event parser 0.4 files. A canonical-report hash selects the run directory; each filename also includes a heading hash so different groups sharing a number cannot overwrite one another. Use the printed `event_directory` rather than globbing all historical runs.

For full sources use `prepare_protocol`, then the reviewed archive/prepare/submit/report/publish workflow. Existing source formats and older parser 0.2/0.3 selected-event inputs remain compatible under the current validator. Bounded full-source limits and explicit correction review are documented in the phase 3 guide.
