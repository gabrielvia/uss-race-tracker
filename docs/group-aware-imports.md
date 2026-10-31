# Group-aware events and exact name annotations

Current milestone: [Phase 3 completion](phase-3-completion.md). The source findings and runtime notes below retain their original milestone scope; use the phase 3 guide for current limits, complete-protocol imports, identity/age review and deployment verification.

This milestone supports same-number source events under different groups and exact age annotations in roster/result names. It extends the main website's import pipeline and keeps the original evidence. It does not implement cross-competition identity or skating-age inference.

## Event identity

A Tempus number alone does not identify a competition event. For example, the checked short-track protocol prints both Group A and Group B Junior E Women's 700 Semi-Finals as Event #9. Each full source heading identifies its own group, distance, round and number; every announced heat remains inside that event.

The existing event key remains the first 20 hexadecimal characters of SHA-256 over `competition_id|exact_source_heading`. Existing URLs and published event keys do not change. Assembly and server validation allow repeated numbers with different headings, while duplicate headings and race IDs reused across selected events remain invalid. The publication coverage guard protects each full event key, so a Group A replacement cannot erase Group B.

Event parser `tempus-complete-event/0.3` adds an exact-heading selector:

```sh
python3 -m scripts.inspect_event \
  --file /private/tmp/uss-st-agn.pdf \
  --roster data/samples/short-track-agn-roster.json \
  --pages 85 --event-number 9 \
  --event-label "Group A Junior E Women's 700 Semi-Finals Event #9" \
  --output outputs/st-event-9-group-a.json
```

The number-only selector still refuses different groups rather than choosing one. Inventory version `tempus-protocol-inventory/0.2` passes the full heading explicitly. Export filenames include a heading hash to prevent two Event #9 files from overwriting one another.

## Name matching

Match within one competition using the exact bib and affiliation. A result name must equal the normalized roster name or the roster's exact original name. The latter is accepted only when removing one supported trailing age annotation reproduces the normalized name and the annotation agrees with that observation's recorded `age_status_raw`.

Supported suffix forms are `Jr A` through `Jr E`, `Sr`, and `M`/`W` age ranges, optionally prefixed by `Master`. Category comparison ignores case; person names, original raw names and affiliations remain exact. The parser already recognizes these forms in the roster; the server now independently checks the same rule.

For example, `Keeley Whitcomb (Jr A)` maps to competition bib 366, normalized name `Keeley Whitcomb`, only with the matching roster annotation and affiliation. Both `name_raw` and the complete original `row_raw` remain in evidence. The server checks that bib, name and affiliation occur together under the recorded place/status prefix in the source row. It rejects spelling aliases, unrecorded or conflicting annotations, changed affiliations and discarded raw annotations. Names are not matched by approximate spelling or by stripping arbitrary parentheses.

These suffixes remain historical category evidence. They do not establish a date of birth or a current numerical Skating age.

## Compatibility and operation

Payload schemas 2 and 3 remain supported. Server validation is now `competition-events/4`; new extracts use event parser 0.3 while checked 0.2 extracts remain accepted. Existing valid publications remain visible; older unpublished candidate reports must be regenerated under the current validator before publication. No database migration or event-key rewrite is required.

The default bootstrap fixture remains the earlier four-event dataset. The additive, reviewed sample selection is explicit:

```sh
python3 scripts/import_batch.py prepare --competition st-agn-2026 \
  --group-samples --pdf /private/tmp/uss-st-agn.pdf \
  --output outputs/st-group-candidate.json \
  --reviewer "Operator name" --season-label "2025-2026" \
  --notes "Checked the original events and both groups of event 9." \
  --base-batch-id <current-head>
```

Use the equivalent long-track competition and PDF for its checked expansion. Candidate submission, report inspection and explicit publication remain separate operations; see [multi-event imports](multi-event-imports.md). Every candidate retains all previous events. R2 keeps original extraction JSON under immutable content addresses.

Verify the expanded published samples with:

```sh
python3 scripts/check_site.py --url http://127.0.0.1:5173 \
  --read-only --group-samples --local-credentials web/.dev.vars
```

Hosted verification uses the existing hidden-stdin credential flow. `--group-samples` in the checker requires read-only mode and cannot be combined with the original single-event sample check. Verification compares number and exact heading, result rows, complete heats, participant/entry counts and exact R2 event evidence.

## Checked expansion

| Competition | Retained events | Added events | Results after expansion |
| --- | --- | --- | ---: |
| ST AGN 2026 | #1 women QF and #2 men QF | #9 Group A women SF: 10 results / 2 heats; #9 Group B women SF: 4 results / 1 heat | 67 |
| LT AGN 2026 | #1 women final and #6 men final | #5 Junior A-B-Senior women final: 4 results / 1 race | 18 |

The additions were checked visually against physical page 85 in each source PDF. The seven-event selection contains 85 results, retaining every earlier result and its event key. It is still partial competition coverage. Sample source files are [Group A](../data/samples/short-track-agn-event-9-group-a.json), [Group B](../data/samples/short-track-agn-event-9-group-b.json) and [annotated-name final](../data/samples/long-track-agn-event-5.json).

The full-protocol inventory now finds 80 short-track and 48 long-track events eligible for export. All 128 pass the server validator as independent offline candidates; this does not approve a single oversized batch or automatically publish the other events. The remaining 32 short-track and 11 long-track records require review, chiefly multiple finals, three unsupported finishes and two truncated headings. See [protocol coverage](protocol-coverage.md).

## Verification

57 Python tests and 54 backend integration tests pass, with shared Python/TypeScript name cases, source annotation preservation, same-number group publication and independent coverage protection. TypeScript checking and the Sites production build pass. Local runtime verification exercises repeated submission/publication, seven-event API reads, exact R2 evidence and original-row retention. Browser checks verify both short-track groups remain separate, Group A combines both heats, selections survive refresh, and annotated-name results open the correct roster record.

### Hosted verification - 2026-10-30

The existing owner-private Site deployed successfully from Sites source commit `480d427d15bb99822b20ff639c6bd71128df15f8`, deployment `appgdep_6ae546ec4dd48191a35343e59f7e002c`. Hosted validation, repeated submission, atomic publication, repeated publication and exact API/R2 read-back passed for both expanded competitions. All original result IDs and values were retained.

Hosted browser checks confirmed the two #9 selections contain 10 and four results respectively; Group A shows both heats. Selecting Group B, clicking the active competition and refreshing preserves its URL and selection. The added long-track final opens the normalized bib-366 record with its recorded `Jr A` category; current Skating age remains `Not determined`. The inventory reports were regenerated against the exact seven-event hosted evidence snapshots after publication.
