# Data dictionary

All identifiers are internal strings, not membership numbers or verified global athlete IDs. Source names, affiliations, categories, times, statuses and physical PDF page numbers are retained.

## Current projection

| Table | Meaning and important fields |
| --- | --- |
| `sources` | Immutable extraction-evidence revision: official URL, whole-PDF SHA-256 and content-addressed R2 JSON key. Different extractions of the same PDF can have different evidence IDs. |
| `competitions` | Reviewed title, discipline, consecutive July-to-June season, competition date range, location and current evidence revision. `competition_scope_date` indexes discipline, season and start date. |
| `participants` | One competition-local bib, normalized name and recorded affiliation. Uniqueness is `(competition_id, bib)`. `Direct` is registration affiliation, not a club name. |
| `entries` | Every roster observation, including repeated divisions/categories for one participant, original name and physical source page. |
| `competition_events` | One exact group/gender, distance, round and complete source heading. Source numbers may repeat between groups. Event IDs retain the existing heading-based hash. |
| `races` | Source race number/label, event ID, numbered heat information or lettered final tier, and source page. Source race IDs are unique within a supported protocol. |
| `results` | Exact integer microseconds plus original time text; heat/final place, qualification, status, source page and event/race identity. `finish_note` distinguishes an explicitly missing source finish from an official status. |

A nullable time/place remains null. `PEN`, `DNS`, `DNF`, `DQ`, `FNT` and `YC` are source codes, preserved literally. Codes with no recorded time are never converted to zero. `Time not recorded in source.` is an application note, not a fabricated source status. A/B/C finals retain their own places; a time comparison does not create an official overall classification.

## Planned phase 4 filter dimensions

The current schema retains original roster divisions in `entries.division` and combined event group/gender labels in `competition_events.group_label`. Independent Gender/Division filtering and explicit event-to-entry division associations are phase 4 requirements, not a claim about the currently shipped sample UI.

Within a selected competition, `Gender`, `Division`, `Distance` and `Round` must be independently queryable and combinable with AND semantics. Division is a competition-entry fact, not a permanent skater attribute or an inferred skating age. Multiple entries for one participant must remain distinct; an event/result must resolve to its applicable entry scope rather than inherit every division attached to that bib.

Reviewed structured values must retain original labels and source evidence. Division, source competition groups such as Group A/B, gender and age categories must preserve their distinct meanings. Combined scopes must retain their membership and source meaning; unresolved result-level membership remains explicit rather than guessed from names, age or performance. Filters, available options and counts share the selected competition scope. Broader selections present separate competitive events, with all heats within each event by default; they do not create a combined official ranking.

Implementation includes schema/import-contract migrations, evidence-backed backfill and validation before adding API/UI filters. Existing IDs, results, source values and publication history must remain intact. See the [implementation plan](implementation-plan.md) for the confirmed interaction and acceptance criteria.

## Immutable provenance and publication

| Table | Meaning |
| --- | --- |
| `source_documents` | Original PDF bytes in R2, keyed by their verified SHA-256, with official source URL, size and archive time. |
| `import_batches` | Immutable submitted candidate object, versioned validation report, competition scope, timestamps and validated/rejected/published state. Candidate identity includes the validator version and canonical input. |
| `import_publications` | Current batch pointer for one competition, switched in the same transaction as its complete projection. |
| `publication_revisions` | Publication lineage, previous batch, PDF hash, original reviewed season label, reviewer/reason and immutable competition metadata. Older published batches are integrity-checked and restored to this history on their first upgraded correction. |
| `classification_pages` | Batch-scoped original overall/distance classification text and source rows, separate from timed results. Raw points/columns remain source text; place zero is preserved if printed. No points or rankings are recomputed. |
| `import_assertions` | Transactional check guards. Inserting a failing value rolls back the entire D1 batch; successful operations clear the temporary assertion rows. |

R2 evidence and original PDFs use immutable content addresses. Database references switch only after all new objects are available. A failed SQL publication can leave an unreferenced R2 object, but cannot expose a partial projection. Correcting a source retains old candidates, PDF revisions, observations, classifications and publication history.

`protocol-results` coverage means every numbered RESULTS event/row in the fully scanned supported source is represented. It does not certify reconstructed official classifications, every other source layout, or historical directory coverage; `completeCompetition` remains false. The manifest independently accounts for all physical pages, discovered event headings, result counts and classification-page numbers.

## Identity and dated observations

| Table | Meaning |
| --- | --- |
| `skaters` | Stable profile IDs. Initial records are separate per competition-local participant; matching names/bibs in different competitions do not merge them. |
| `skater_links` | Current participant-to-skater mapping, exact expected name/affiliation, competition-local/reviewed/needs-review state and optimistic revision. A changed source identity requires review. |
| `skater_aliases` | Original and normalized source names with participant, source batch and page. These are traceable observations, not unrestricted spelling aliases. |
| `skater_observations` | Immutable participation/category/affiliation facts for every batch. `competed_on` is the competition-start date anchor, not a claimed individual race date; the full range is retained in the publication metadata. |
| `identity_decisions` | Explicit reviewed mapping/split, previous revision and skater, target skater, source references, reviewer/reason and timestamp. |

The public age/profile query uses only active source revisions and reviewed or competition-local links; superseded facts remain available through provenance. Historical affiliations remain attached to their competition and source. The current profile shows the affiliation at the selected competition, not a verified current club.

Exact source age annotations can match an exact normalized roster name only when the original name and recorded category agree under the supported suffix rule. Name case, spelling and arbitrary parentheses are not normalized into identity matches. Reconciliation across competitions requires an explicit authorized decision with the current publication and mapping revisions.

## Age evidence and rules

| Table | Meaning |
| --- | --- |
| `age_rules` | Immutable content-addressed reviewed rule definition, source URL/hash when known, physical pages, season, discipline, July 1 baseline convention and explicit category intervals. |
| `competition_age_rules` | Current reviewed rule assignment and optimistic revision for one competition. |
| `age_rule_decisions` | Immutable assignment/correction history, previous revision, reviewer/reason and timestamp. |

Age evidence is the combination of a source observation and its reviewed matching rule. Explicitly listed single-age divisions can be used when personal category data is absent. Ability groups and combined divisions are excluded unless separately evidenced; category names are not guessed from performance times.

Intervals are shifted to one reference season and intersected. A unique integer is `inferred`; a finite interval is `range`; an open upper bound is `lower_bound`; no applicable evidence is `not_available`; contradictory intervals or incompatible baseline conventions are `conflict`. No birthday is invented. A conflicting estimate is quarantined from numerical display while valid race results remain visible.

The current season changes at July 1, 00:00 in `America/New_York`, using timezone-calendar calculations. Values derive from reference-season evidence rather than an annual database increment. Responses are uncached; an open profile refreshes at the transition and on focus. Original result categories remain historical values.

Validation reports record age checks against active reviewed evidence at submission time, including rule revision, reference season, unresolved categories, identity reviews and conflicts. Reports are immutable snapshots; current profiles use current reviewed rule/mapping revisions. The two checked rule files in `data/rules/` apply only to their declared 2025-2026 discipline/season. A null rule-source hash means the official version/pages were checked but the original rulebook binary hash was not obtained; it is not invented.
