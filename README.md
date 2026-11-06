# USS Race Tracker

A web app for exploring US Speedskating competition results, skater profiles, and performance trends.

## Features

- Browse competition results and search for skaters.
- View skater names, recorded club affiliations, and historical results.
- Track individual times and compare multiple skaters over the same distance and discipline.
- Display **Skating age** with an explanation, source-based inference, and automatic updates each July 1.

## Architecture

The app uses React, TypeScript, and the ChatGPT Sites Vinext starter, with D1 for structured data and R2 for original result files. The same application supports local development and deployment to ChatGPT Sites.

Data source: [US Speedskating results](https://www.usspeedskating.org/results).

## Project status

Phases 1-5 are implemented: protected source imports/PDF archival, reviewed identities/age rules, scoped browsing, automatic all-season PBs and one whole-competition-best chart point per identity/discipline/distance. Phase 6 remains in progress; the completed v21 increment adds audited MASA 2026 and Long Track AGN 2025 protocols with explicit coverage reporting and original team/club source tables. The bounded corpus is four competitions across 2024-2025 and 2025-2026, 278 source group/round events, 3,238 individual results, 271 classification pages and two supplemental pages. Short Track AGN 2025 remains blocked for unsupported content; 490 directory sources still require complete audit. Directory discovery does not mean import coverage.

See [the current import and identity rules](docs/season-import-workflow.md), [the phase 6 coverage increment](docs/phase-6-coverage.md), [phase 5 acceptance](docs/phase-5-acceptance.md), [protected import operations](docs/phase-3-completion.md) and [data dictionary](docs/data-dictionary.md). Mobile profile optimization and Admin/scheduling/access changes remain deferred.

All product UI, code, comments, help text, and operational documentation will be in English. Planning documents may contain Chinese.

## Data tooling

Run `python3 -m unittest discover -s tests -v` for the offline tests. PDF extraction additionally requires the packages in `requirements-data.txt`.

See [source validation](docs/source-validation.md) for findings, coverage limits, and reproducible download and extraction commands.

See [protocol inventory and coverage](docs/protocol-coverage.md) for full-PDF discovery, per-event review findings, export eligibility and comparison with saved publication evidence.

## Run the application

See [local setup and Sites publication](docs/local-sites-foundation.md) for startup, migrations, authenticated sample import, API verification, and deployment instructions.

See [multi-event imports](docs/multi-event-imports.md) and [reliable imports](docs/reliable-imports.md) for local preparation, validation reports, explicit publication and current coverage limits.

See [group-aware imports](docs/group-aware-imports.md) for the earlier exact annotated-name matching milestone. The phase 6 guide records the current parser contracts and source queue.

Run `node --test web/tests/*.test.mjs` with Node 22.13+ for the backend integration tests.

Private Site: [USS Race Tracker](https://uss-race-tracker.zhang-michael-gabrie.chatgpt.site).

See the [implementation plan](docs/implementation-plan.md) for milestones, data-import requirements, and the agreed skating-age rules.
