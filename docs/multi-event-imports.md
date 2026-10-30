# Multi-event competition imports

This main-website milestone extends the reliable import foundation to multiple complete selected events from one source PDF. It does not create an Admin website or claim to import an entire competition protocol.

## Contract and limits

Schema version 3 uses `coverage: "selected-events"`. The item contains the same reviewed competition metadata, source, competition-local participants, roster entries and normalized results. Its evidence is `{ roster, events: [...] }`; each event is a complete `tempus-complete-event/0.2` extraction, including every announced heat. All events must reference the roster's exact source ID, URL and PDF hash.

Validation checks every event independently, then checks the combined projection. A single invalid event rejects the whole candidate. Reports include an event key, original source event number and label, result/heat counts and errors for each event. Duplicate source events, source race IDs reused across events, undeclared results, cross-group/round rows and source revision mismatches are rejected. This Tempus contract requires source race IDs to be unique across the selected events. Other naming schemes require a future parser contract.

Limits remain 2 MiB, 1,000 participants, 2,000 roster entries and 1,000 results in total, with at most 20 selected events and 100 heats per event. Validation version `competition-events/3` identifies the current rules. Existing schema-version-2 inputs remain accepted under the same validation and publication protections; old candidate records must be resubmitted to receive the current report version. The preparation CLI upgrades a legacy one-event item to a one-element `events` array.

Published identities remain competition-local. Skating-age inference, cross-competition profiles, automatic protocol discovery, classifications and multi-document imports are deferred. Original PDFs remain local/official-source files; R2 stores candidate and extraction evidence JSON.

## Event coverage protection

Publication still replaces the whole current competition projection in one D1 transaction. Every already-published event must be included in the candidate. Both schema versions are protected, so an older single-event client cannot erase an expanded competition.

The server checks coverage before uploading evidence and again inside the publication transaction. It also checks `baseBatchId`, preserving the existing stale-revision protection. A missing current event returns 409 with an explanation; the old projection stays visible. Corrections to people, entries, places, times and statuses can be published when event keys are retained. Removing an event, or changing its identifying label, requires a future explicit reconciliation operation and is intentionally unavailable through this additive-coverage workflow.

`competition_events` stores the source event number, original label, group label, distance and round. Migration `0004_parched_shard.sql` adds this table without changing published rows. Until their next validated publication, legacy competitions derive their event metadata from the same result snapshot used by the detail endpoint. The public response includes an ordered `events` array and explicit coverage with `completeCompetition: false`. Listing counts derive from published results, so old rows remain counted before reimport.

## Local tooling

The existing `inspect_event` tool continues to extract one event completely. Use `assemble_competition` to combine reviewed extractions before preparation:

```sh
python3 -m scripts.assemble_competition \
  --metadata outputs/st-metadata.json \
  --roster data/samples/short-track-agn-roster.json \
  --events data/samples/short-track-agn-event-1.json data/samples/short-track-agn-event-2.json \
  --output outputs/st-item.json
```

The metadata file contains the reviewed `id`, `title`, `discipline`, `season`, `startsOn`, `endsOn` and `location` fields. Assembly preserves event order and original rows; it does not publish or replace server validation. The checked sample shortcut is:

```sh
python3 scripts/import_batch.py head --url http://127.0.0.1:5173 \
  --competition st-agn-2026 --local-credentials web/.dev.vars

python3 scripts/import_batch.py prepare --competition st-agn-2026 \
  --pdf /private/tmp/uss-st-agn.pdf --output outputs/st-multi.json \
  --reviewer "Operator name" --season-label "2025-2026" \
  --notes "Checked every selected event and all announced heats." \
  --base-batch-id <current-head>

python3 scripts/import_batch.py submit --url http://127.0.0.1:5173 \
  --candidate outputs/st-multi.json --local-credentials web/.dev.vars
```

Use `--item outputs/st-item.json` instead of `--competition` for assembled input. Review the returned report, then invoke the separate `publish` command with its batch ID. Omit `--base-batch-id` only when the current head is null. Hosted authorization, hidden stdin and redirect protections are unchanged; see [reliable-imports.md](reliable-imports.md).

## Viewer and checked samples

The event selector uses the published event directory, ordered by source event number. Selection keeps gender/group, distance and round isolated, combines all heats of that event and preserves special-status rows. The selected event is written to the `event` URL parameter and restored on refresh. A competition change clears an event that belongs to the previous competition.

Coverage copy reports the number of selected events and explicitly excludes the rest of the protocol. The checked dataset contains:

| Competition | Source events | Results | Heats/races |
| --- | --- | --- | --- |
| ST AGN 2026 | Junior E Women's 700 QF #1; Junior E Men's 700 QF #2 | 14 + 39 = 53 | 3 + 7 = 10 |
| LT AGN 2026 | Junior E Women's 500 Final #1; Junior E Men's 500 Final #6 | 7 + 7 = 14 | 1 + 1 = 2 |

Rosters remain 213 short-track participants and 76 long-track participants, with 213 and 77 entry observations respectively. The original events are retained. Short-track event #2 includes its official PEN row with null place/time. These are four complete selected events, not complete competition results.

## Verification

39 Python tests and 44 route integration tests pass, including previous status, authorization, stale-revision and coherent-read regressions. New cases cover both real multi-event datasets, per-event errors, duplicate events/races, source mismatch, undeclared rows, legacy expansion, accidental coverage reduction, failure while writing a later event and a concurrent bootstrap/publish race. TypeScript checking and the production build pass.

`check_site.py --read-only` verifies the expanded sample projection, exact source rows, event isolation, counts, status-aware time ordering, coverage and R2 evidence. Use `--legacy-sample --read-only` to verify the original one-event projection before expansion.

### Runtime verification — 2026-10-30

Local and hosted migration checks preserved the original 21-result projection before expansion. Both competitions then passed version-3 validation, repeated submission, atomic publication, repeated publication, event isolation and R2 read-back: 53 short-track results and 14 long-track results, with all original rows retained. Local runtime also rejected a reduced candidate without altering the current event set.

Browser checks covered both disciplines, gender-separated selectors, complete heat counts, status-row visibility, refresh restoration and clearing the previous event when changing competitions. Selection from the default home page records both competition and event in the share URL.

The existing owner-private Site deployed from source commit `43a7edc22b0420b82ca34ffa7b7b2151c2cfa6df` (deployment `appgdep_6ae4de08ada081919aa8ed0eda5036f5`). Implementation branch: `codex/multi-event-imports`; no Admin Site or automation was created.

### Active-competition selection fix

Independent review found that clicking an already-selected competition removed its event URL parameter without reloading the detail. Active-card clicks are now a no-op. Browser regression verification selected the non-default men's event, clicked the active card and refreshed: the URL retained competition and event, the selected event stayed unchanged and all 39 results remained visible. TypeScript checking and the production build passed after this correction.
