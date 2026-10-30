# Sample code review fixes

The independent one-pass review identified three P2 issues. Each was reproduced before correction; no application databases or real credentials were used in fault-injection tests.

## Credential redirect boundaries

Python's default redirect handler retained both dummy credential headers when redirected to a different hostname. The site checker now installs a same-origin redirect handler, compares scheme/hostname/effective port, rejects credential-bearing URLs, and permits cleartext HTTP only for the supported loopback hosts. Redirect rejection happens before a request can be sent to the other origin.

Regression tests cover another hostname, a changed port, HTTPS downgrade, loopback-to-external redirection, and an allowed same-origin/default-port redirect. No live secrets are used.

## Atomic sample import and immutable evidence

The original route committed groups of 40 SQL statements. An injected failure at statement 45 left one source, one competition, and 38 participants visible without entries or results. A failure uploading the second evidence object also left the first competition committed.

The route now accumulates all fixed-sample statements and makes one `db.batch()` call. D1 documents a batch as a transaction whose entire sequence rolls back on failure: [D1 batch contract](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch). Each statement remains below the documented binding limits; batching avoids separate-query invocation limits: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/#batch-limits).

Evidence keys include a hash of the evidence JSON, so a new extraction cannot overwrite an object referenced by existing data. All evidence uploads complete before the database transaction starts, and source pointers are updated inside that transaction. A failed operation may leave an unreferenced object; it cannot switch the published reference to an incomplete revision.

The actual transpiled route is tested against isolated in-memory SQLite with transaction semantics and injected failures. Tests verify failure at statement 45 and the final statement leaves zero new records, failed reseeding preserves existing rows and evidence references, R2 failure publishes neither competition, repeat imports remain identical, and unauthorized requests never write. These tests do not implement or claim the future general import/version system.

## Unsupported PDF continuation handling

The original event extractor reset page context and ignored result rows without repeated headers. A two-page input could therefore be labelled complete after omitting a continued skater row.

Selected result pages now reject numeric/status result rows without a valid event and race context, including pages missing the RESULTS heading. Repeated race headings across pages still fail explicitly because continuation assembly is not supported. Supported separate heats on pages with complete headings continue to parse normally. Classification pages remain outside the selected-race extractor's scope.

The tool still validates only the explicitly supplied pages and supported layouts; it does not claim to discover every continuation anywhere in a full PDF. Real short-track and long-track sample pages were re-extracted and compared with the checked-in results: 14 results across three heats and seven results in one final, unchanged.

## Verification commands

```sh
python3 -m unittest discover -s tests -v
node --test web/tests/seed.test.mjs
cd web
./node_modules/.bin/tsc --noEmit --incremental false
```

The production build and authenticated local/hosted API checker are also required before publishing the fix. UI behavior and sample coverage are unchanged by these corrections.
