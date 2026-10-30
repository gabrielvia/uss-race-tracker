# USS Race Tracker

A planned web app for exploring US Speedskating competition results, skater profiles, and performance trends.

## Planned features

- Browse competition results and search for skaters.
- View skater names, recorded club affiliations, and historical results.
- Track individual times and compare multiple skaters over the same distance and discipline.
- Display **Skating age** with an explanation, source-based inference, and automatic updates each July 1.

## Architecture

The app will use React, TypeScript, and the ChatGPT Sites Vinext starter, with D1 for structured data and R2 for original result files. The same application will support local development and deployment to ChatGPT Sites.

Data source: [US Speedskating results](https://www.usspeedskating.org/results).

## Project status

The source-validation milestone and the minimal local/Sites application foundation are implemented. The repository includes a 498-entry directory snapshot, PDF sampling tools, a React/TypeScript app in `web/`, D1/R2 integration, and a private deployment using two real competition samples. Selected-event results combine all heats within the same group, gender, distance, and round, with original heat places retained. A protected selected-event import workflow now separates candidates, validation reports and atomic publication. Bulk imports, cross-competition profiles, skating-age inference, and charts remain planned.

All product UI, code, comments, help text, and operational documentation will be in English. Planning documents may contain Chinese.

## Data tooling

Run `python3 -m unittest discover -s tests -v` for the offline tests. PDF extraction additionally requires the packages in `requirements-data.txt`.

See [source validation](docs/source-validation.md) for findings, coverage limits, and reproducible download and extraction commands.

## Run the application

See [local setup and Sites publication](docs/local-sites-foundation.md) for startup, migrations, authenticated sample import, API verification, and deployment instructions.

See [reliable imports](docs/reliable-imports.md) for local preparation, validation reports, explicit publication and current coverage limits.

Run `node --test web/tests/*.test.mjs` with Node 22.13+ for the backend integration tests.

Private Site: [USS Race Tracker](https://uss-race-tracker.basicsnail67.chatgpt.site).

See the [implementation plan](docs/implementation-plan.md) for milestones, data-import requirements, and the agreed skating-age rules.
