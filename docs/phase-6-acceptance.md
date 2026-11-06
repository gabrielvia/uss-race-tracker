# Phase 6 acceptance: bounded historical increment

Phase 6 remains in progress until the historical import work and overall acceptance are complete. Implementation and independent reviews are complete only for the v21 source increment described here. The original owner-private [USS Race Tracker](https://uss-race-tracker.zhang-michael-gabrie.chatgpt.site) is deployed as **v21**. GitHub commit/push/merge has not been performed or authorized for phase 6.

## Accepted scope

The real corpus contains four competitions in 2024-2025 and 2025-2026: 278 source events, 613 races, 3,238 original individual result rows, 452 competition-local participants, 453 entries, 271 classification pages and two supplemental source pages. The retained 32 MASA/AGN reviewed pairs yield 420 active profiles and 1,526 automatic PB groups. New 2025 identities remain isolated until individually reviewed; no name/bib/club-based merge or historical age-rule assumption was introduced.

The complete Long Track AGN 2025 increment resolves ten literal wrapped headings and preserves the original Team Pursuit Results and Club Champion pages separately. Original PDF/page/text proofs prevent fabricated or dropped supplements. Tables supply no individual PBs or inferred identities. Coverage reporting distinguishes actual publication, pinned source audit and directory discovery. Details and reproducible operations are in [phase 6 coverage](phase-6-coverage.md).

## Verification

- Full suite: **100 backend tests**, **74 Python tests**, TypeScript and production build passed. `git diff --check` passed. Existing identity, age, atomic import, source preservation, PB and chart regressions remain covered.
- Independent completeness validation and independent code review each completed **one clean iteration** under the declared maximum of two. No actionable implementation finding remained. Reviewers independently passed focused checks (code review: eight backend and 17 Python tests; completeness: three historical/coverage checks).
- Protected archive/submit/report/publish passed for the real 2025 LT source. Repeated publish and identical re-submit resolve to the same batch. All three pre-existing competition heads remain unchanged. The new archived PDF was fully downloaded and SHA-256 verified; every one of its 509 result fields, 67 event counts, 88 classification pages and two original supplemental texts was read back.
- Expanded read-only hosted checks freshly compare **all 3,238 source result rows and immutable extraction evidence**, every applicable-entry mapping, all 420 profiles/1,526 PB groups, **1,545 chart queries**, all 32 reviewed pairs and both of their 64 profile aliases, original source names, unchanged age evidence and server pagination. Existing unchanged AGN/MASA binaries retain prior accepted hash verification; no claim is made that all were downloaded again during this increment.
- Desktop browser: historical Long Track season selection, the 2025 competition and source-event labels, distance filtering, supplemental-page disclosure, original text expansion and archived source links passed. Returning to the directory retains Long Track and 2024-2025. Coverage shows four competitions/3,238 results and a separate pending-source disclosure.
- The actual performance component was exercised in a separate **local, in-memory fixture** with 60 synthetic competition summaries. Pages contain 25/25/10 summaries while all 60 chart points remain. Refreshing page 3 to ten summaries clamps to page 1/1 with ten rows; refreshing to zero shows the empty state at page 1/1 with both controls disabled; restoring 60 returns page 1/3. No fixture entered the real database.
- Bounded warmed hosted measurements cover **23 query kinds, five samples each**, at the real four-competition/3,238-result volume. Median round trips range **308.91–869.03 ms**; the largest observed p95 is **1,019.61 ms**. These include network, serialization and temporary curl transport/process overhead; they do not establish an archive-scale service guarantee.

Fresh Sites metadata confirms the original project, one allowed owner, zero external visitors and no allowed groups. No access or binding change was made. Sites source commit: `9cdf3eabc0c50dd8f3ccb587bea37c0926322e90`; deployment: `appgdep_6aeba93ec05c819188f643d986535331`; active new batch: `d519578b1d6321e8e3562fa7155ac80b52d274d5f17afcb2b3526d1568b7c4f6`.

Credential-free evidence is kept in ignored `outputs/phase6-historical-publication.json`, `outputs/phase6-expanded-hosted-verification.json`, `outputs/phase6-expanded-hosted-benchmark.json`, final test logs and browser screenshots. Publication credentials are excluded from source, reports and Git.

## Remaining work and explicit limits

The historical archive remains an ongoing data-expansion queue: **490 sources require a complete audit**, including blocked Short Track AGN 2025. Its unsupported headings/unassigned rows are preserved; no partial candidate was published. Additional source formats, individual cross-year identity reviews and new age rules require evidence before future imports.

Mobile profile redesign remains deferred by the user's explicit decision. A browser viewport override was attempted for a basic phone-width check, but the effective DOM viewport stayed 871 pixels wide; therefore **real narrow-viewport/touch/screen-reader acceptance is not claimed**. Default viewport was restored. The desktop interactions above are verified separately. No responsive CSS change was introduced in this increment.

Admin A0–A7, scheduling/email, audience/domain/login changes and Season-menu redesign remain outside the current increment. The remaining GitHub release action for the v21 increment is user-directed commit/push/PR/squash merge, separate from its completed private Sites deployment. The overall phase 6 historical import continues under [the season-by-season workflow](season-import-workflow.md).
