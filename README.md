# USS Race Tracker

A web app for exploring US Speedskating competition results, skater profiles, and performance trends.

## Planned features

- Browse competition results and search for skaters.
- View skater names, recorded club affiliations, and historical results.
- Track individual times and compare multiple skaters over the same distance and discipline.
- Display **Skating age** with an explanation, source-based inference, and automatic updates each July 1.

## Architecture

The app will use React, TypeScript, and the ChatGPT Sites Vinext starter, with D1 for structured data and R2 for original result files. The same application will support local development and deployment to ChatGPT Sites.

Data source: [US Speedskating results](https://www.usspeedskating.org/results).

## Project status

Phases 1-3 are implemented for the verified Tempus format: source inventory, local/Sites hosting, a protected import lifecycle, complete RESULTS protocol preparation, original PDF archival, atomic bulk publication, revision history, reviewed identity mappings, skating-age evidence and scoped server queries. The private Site contains two competition rosters, 171 source group/round events, 2,309 race results and 141 separate classification pages. Existing source rows and event URLs are retained. General directory/profile browsing, charts and broader historical format coverage remain the next milestones.

See [phase 3 completion](docs/phase-3-completion.md), the [acceptance checklist](docs/phase-3-acceptance.md) and [data dictionary](docs/data-dictionary.md) for supported scope, validation and reproducible operations.

All product UI, code, comments, help text, and operational documentation will be in English. Planning documents may contain Chinese.

## Data tooling

Run `python3 -m unittest discover -s tests -v` for the offline tests. PDF extraction additionally requires the packages in `requirements-data.txt`.

See [source validation](docs/source-validation.md) for findings, coverage limits, and reproducible download and extraction commands.

See [protocol inventory and coverage](docs/protocol-coverage.md) for full-PDF discovery, per-event review findings, export eligibility and comparison with saved publication evidence.

## Run the application

See [local setup and Sites publication](docs/local-sites-foundation.md) for startup, migrations, authenticated sample import, API verification, and deployment instructions.

See [multi-event imports](docs/multi-event-imports.md) and [reliable imports](docs/reliable-imports.md) for local preparation, validation reports, explicit publication and current coverage limits.

See [group-aware imports](docs/group-aware-imports.md) for the latest seven-event expansion, exact annotated-name matching and backward-compatible validation rules.

Run `node --test web/tests/*.test.mjs` with Node 22.13+ for the backend integration tests.

Private Site: [USS Race Tracker](https://uss-race-tracker.basicsnail67.chatgpt.site).

See the [implementation plan](docs/implementation-plan.md) for milestones, data-import requirements, and the agreed skating-age rules.
