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

Source-data validation is underway. The repository includes a 498-entry directory snapshot, bounded PDF roster and race extractors, structured samples, and regression tests. Application UI, database setup, bulk imports, and deployment are not implemented yet.

All product UI, code, comments, help text, and operational documentation will be in English. Planning documents may contain Chinese.

## Data tooling

Run `python3 -m unittest discover -s tests -v` for the offline tests. PDF extraction additionally requires the packages in `requirements-data.txt`.

See [source validation](docs/source-validation.md) for findings, coverage limits, and reproducible download and extraction commands.

See the [implementation plan](docs/implementation-plan.md) for milestones, data-import requirements, and the agreed skating-age rules.
