# Phase 3 completion checklist

This checklist implements the existing data-model and reliable-import milestone. It does not create the separate Admin site or implement the later history/chart experience. Supported Tempus protocols are the initial production format; other source layouts remain explicitly reviewable.

- [x] Preserve every RESULTS race in the two checked protocols, including separate final races, missing finishes and truncated source headings; retain classifications separately from timed results.
- [x] Archive original PDF revisions and extraction evidence, record publication lineage and original season labels, and expose protected import history/reports.
- [x] Support bounded full-competition candidates and efficient atomic publication, with idempotency, stale-revision and coverage protections, and failure rollback.
- [x] Store stable skater records, exact source aliases, dated affiliation/category observations and explicit reviewed identity mappings. Never auto-merge competitors on name or bib across competitions.
- [x] Store versioned age evidence and reviewed rules; implement interval intersections, conflicts and July 1 derivation without inventing birthdates or silently resolving contradictory identities.
- [x] Implement server-side discipline/season scoping, search, counts, pagination and matching indexes. Preserve compatibility for the existing sample client while introducing the scoped query contract.
- [x] Exercise corrected sources, duplicate imports, ambiguous identities, missing data, failures and bulk-size boundaries with meaningful tests.
- [x] Verify local and private hosted D1/R2 publication and browser result semantics, update the data dictionary and reproducible operations documentation, then update the implementation plan with evidence of completion and explicit source-format limits.


Evidence: [completion and operations](phase-3-completion.md), [data dictionary](data-dictionary.md), [source coverage reports](protocol-coverage.md). Local/hosted read-back verifies 171 event records, 2,309 results, 141 separate classification pages and the exact archived PDF hashes. Code checks: 62 Python tests, 70 backend integration tests, TypeScript and production build. This completes phase 3 for the verified format; phase 4-6 and the separate Admin track retain their original scope.
