# Local and ChatGPT Sites foundation

Current milestone: [Phase 3 completion](phase-3-completion.md). The source findings and runtime notes below retain their original milestone scope; use the phase 3 guide for current limits, complete-protocol imports, identity/age review and deployment verification.

## Delivered scope

The application lives in `web/` and uses the supported Sites Vinext starter with React, TypeScript, a Cloudflare Worker, D1, and R2. It is a single-page competition explorer with discipline selection, name/club/bib search, roster and selected-race views, source links, and a competition-local skater record.

All shipped text is English. The Skating age information button supports mouse hover, focus, click/tap, and Escape dismissal. Current skating age is deliberately shown as **Not determined**: the cross-season inference algorithm has not been implemented yet. The recorded source category and its season are displayed separately.

The fixed sample slice contains:

| Competition | Participants | Participation entries | Race results |
| --- | ---: | ---: | ---: |
| 2026 Short Track Age Group Nationals | 213 | 213 | 14 |
| 2026 Long Track Age Group Nationals | 76 | 77 | 7 |

These are full extracted rosters plus one complete selected event each, not complete competition result imports. The short-track sample includes all three heats of Group A Junior E Women's 700 m quarter-finals (14 results). The long-track sample includes Junior E Women's 500 m final (one race, seven results). Long-track bib 370 has two participation entries and one participant. IDs are competition-local; no cross-competition identity merge is implied.

Results are selected by competition, discipline, source group/gender, distance, round, and source event identifier. All heats for that event appear together, sorted by exact time for comparison. **Time order is not an official overall classification**; heat and official heat place are separate columns. Other genders, divisions, distances, rounds, or repeated events cannot be silently mixed into the same comparison. Source event labels remain visible in the selector.

`python3 -m scripts.inspect_event` extracts a selected complete event from specified PDF pages and validates that every announced heat is present. It fails explicitly on missing heats, ambiguous group labels, unsupported continuation pages, or unsupported statuses. It does not claim to parse the entire PDF. Original single-race sampling files remain as historical extraction evidence.

## Local setup

Use Node.js 22.13 or newer and Python 3.11 or newer. Keep secrets in ignored files. The dependency lockfile is included. On this author's Mac, the default Homebrew Node installation could not start; validation used the Node runtime bundled with Codex. Other machines can use a normal supported Node installation.

From the repository root:

```sh
python3 scripts/prepare_web_sample.py
python3 -m unittest discover -s tests -v
cd web
npm run install:ci
node -e 'require("node:fs").writeFileSync(".dev.vars", "SEED_TOKEN=" + require("node:crypto").randomBytes(32).toString("hex") + "\n", {flag:"wx", mode:0o600})'
npm run build
# Fresh local databases only: apply every generated schema migration in order.
for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration"
done
npm run dev -- --hostname 127.0.0.1
```

Create `.dev.vars` only once; the exclusive file flag prevents overwriting an existing credential. Open the Local URL printed by the server (normally `http://127.0.0.1:5173/`). In another terminal, from the repository root:

```sh
python3 scripts/check_site.py --url http://127.0.0.1:5173 --local-credentials web/.dev.vars
```

This imports the fixed sample twice and verifies authentication, idempotency, counts, D1 reads, R2 evidence, missing-record responses, and the home page. It changes only the selected local instance. Local D1/R2 state is in `web/.wrangler/state`; rebuilding does not erase it. Do not replay an already-applied schema migration. New schema changes require new generated migrations.

Run the import-failure regression tests with `node --test web/tests/seed.test.mjs` from the repository root after installing the web dependencies. These tests use the real route code with an isolated in-memory SQLite adapter and injected SQL/R2 failures; they never change local or hosted application databases.

`npm start -- --port 5174` runs the built production Worker locally and uses the same local storage. Unlike the development server, this command does not automatically load the root `.dev.vars` as Worker secrets; use the development server for authenticated sample setup before inspecting the built Worker. When `SEED_TOKEN` is absent, the import endpoint remains disabled with HTTP 401. The built Worker was checked against already-seeded local D1/R2.

## API and storage

- `GET /api/competitions`: the two seeded competitions and coverage counts.
- `GET /api/competitions/:id`: competition-local participants, participation entries, and selected race results.
- `GET /api/sources/:id`: the corresponding extraction evidence JSON stored in R2.
- `GET /api/health`: D1 query and evidence-object readiness.
- `POST /api/admin/seed`: a fixed, idempotent sample import requiring `Authorization: Bearer <SEED_TOKEN>`. It accepts no arbitrary SQL, file payload, or user-selected records. A changed source hash is rejected with HTTP 409 rather than silently replacing old data.

The fixed sample is written using one D1 transaction for both competitions. Evidence JSON is uploaded first at a content-addressed immutable R2 key; database references switch only when the entire SQL batch commits. SQL or R2 failure leaves the previous visible data and evidence references unchanged. An unsuccessful attempt can leave unreferenced evidence objects, but those objects are not exposed through the read APIs. This bounded sample transaction does not replace the planned production candidate/revision workflow.

The verification client accepts HTTPS origins and HTTP loopback origins only. It rejects cross-origin redirects, including protocol downgrades and port changes, before forwarding any credentials. Same-origin redirects may retain the scoped headers.

Migrations create `sources`, `competitions`, `participants`, `entries`, and `results`. All request filters use bound parameters. Readiness probes actual storage; there is no in-memory or hardcoded fallback for failed database requests. The checked-in JSON fixture is used only by the authenticated import endpoint, not by normal read APIs.

R2 currently stores extraction-evidence JSON, not the original PDF binaries. The official PDFs remain linked externally, including physical page anchors. Original file archival, broad identity reconciliation, robust source revisions, general result/status ingestion, and chart history remain later work.

## Private Site and publication

The existing project identity is in `web/.openai/hosting.json`. Reuse it; do not create another Site for this app. D1 and R2 bindings are `DB` and `BUCKET`.

Private deployment: [USS Race Tracker](https://uss-race-tracker.basicsnail67.chatgpt.site).

The GitHub development repository and Sites source repository have separate histories. Publish a clean copy of `web/` in the ignored `outputs/site-source/` checkout so future GitHub squash merges cannot diverge from the Sites source history. This checkout is publication state, not an embedded repository to commit to GitHub.

For Sites-assisted publication:

1. Read the existing project ID and obtain a short-lived source credential for that same Site. Keep credentials only in session memory; pass them to the Sites source helper through hidden stdin.
2. Open its source repository with the Sites skill's `site-workflow.mjs` and retain the returned checkout. For a brand-new empty source repository, initialize that checkout and copy the existing hosting manifest before retrying the opening operation if the helper requires it.
3. Regenerate the sample fixture if its inputs changed, run tests and TypeScript checks, and build `web/` using the Sites build helper.
4. Run `python3 scripts/prepare_site_publication.py`. It copies Git-unignored source plus `dist/` to the opened publication checkout, preserves `.git`, and removes source files removed since the last synchronization. Never manually modify generated build output.
5. Package/push through the Sites source helper. Pass the exact returned source commit and archive to the private save/deploy tool. Sites applies schema migrations; data imports are separate.
6. Wait for deployment success, then run `scripts/check_site.py --url <site-origin>` with the seed credential and the Site's service-access token through hidden JSON stdin. The service token goes only in `OAI-Sites-Authorization` to this Site. Configure `SEED_TOKEN` as a Sites runtime secret before deploying. Never include either credential in source, command arguments, a URL, or an artifact.

The source-copy helper expects this repository's ignored `outputs/site-source/` path. On a fresh machine, open or clone the existing Site source there before running it. Build and copy from the same unchanged source state. The deployment archive must remain unchanged until saving succeeds. Preserve owner-only access.

## Verification performed

- 27 offline Python tests passed, including redirect-origin boundaries, unsupported continuation rejection, all-heat completeness, group/gender/round isolation, sample identity, and exact-time checks.
- Five isolated Node/SQLite tests passed: early and late SQL failure rollback, R2 failure isolation, preservation of existing evidence after a failed reseed, repeat import, and unauthorized writes.
- TypeScript compilation and the Sites production build passed.
- Local development API checks passed, including repeat imports, unauthorized imports, D1 queries, R2 reads, and 404s.
- The locally built Worker reported D1/R2 ready with both competitions.
- Desktop and 390 px mobile UI checks covered discipline switching, roster search, skater details, and the age explanation; no page-level horizontal overflow was observed at the desktop viewport. Tables scroll horizontally on small screens.
- The private deployment succeeded. The same live API checker passed against hosted D1/R2, including two imports without duplicate rows.

## Next step

Implement the production data model and import lifecycle: stable cross-competition skater mapping, dated affiliation observations, audited skating-age constraints and July 1 derivation, and versioned import reconciliation. Then expand result coverage and add the history/comparison charts. This foundation does not yet implement those features.
