# Phase 5 acceptance checklist

Current implementation: private Site v18. An independent implementation-plan audit on November 3, 2026 **passes the current user-authorized phase 5 scope, with verification limits**. No mandatory feature omission or acceptance blocker was identified. The user accepted the reviewed current scope and explicitly authorized GitHub commit, push and merge on November 3, 2026, followed by a new chat for phase 6. The independent audit remains separate evidence from that user authorization. See [the requirement/evidence matrix](phase-5-plan-audit.md).

The latest user decision requires one best time per full competition, identity, discipline and distance, combining all rounds. Tied source performances share one point with all sources retained. Chart Round/all-appearance controls are removed. Complete race history remains intact. Mobile optimization is explicitly deferred to a later joint review; the current deliverable is [the mobile plan](mobile-profile-plan.md).

## Completed within the current scope

- [x] Single-identity performance history and comparison of up to four separate identities at exactly one discipline and distance.
- [x] One whole-competition-best point/summary per identity, competition, discipline and distance across all rounds; exact minima and every tied source performance retained.
- [x] Chart Round/all-appearance controls and their legacy URL restrictions removed. Inclusive competition-date-range filters, URL state and empty/error/loading states remain available.
- [x] Automatic all-season PBs and optional complete race history remain independent of chart filters, without required profile season/discipline selections. Slower/status/missing-time source rows remain in full history.
- [x] Positive status-free safe-integer microseconds determine eligibility. PEN/DNS/DNF/DQ/FNT/YC and missing/zero finishes never become numerical zero points.
- [x] Competition date anchors/ranges and unknown dates are explicit. No fabricated individual race dates/order, within-competition lines or overlapping-range trend connections.
- [x] Original competition/event/race/round/heat/status/source evidence retained; chart symbols, summary rows, tooltip content and source links agree.
- [x] Shared explicit identity scope, pending-review isolation and selection deduplication without identity/age writes. No invented DOB, current club or track specification.
- [x] Appended index-only migration, 92 passing backend tests, TypeScript and production build. Test-only historical data stays in memory.
- [x] Local/hosted read-only verification covers all 2,309 source results, 2,251 eligible appearances and 1,002 whole-competition-best summaries through 261 queries. Hosted PB checks cover all 289 profiles and 1,002 unchanged PBs.
- [x] Recorded protocol/browsing evidence preserves source fields, archived PDF hashes, classification pages and protected reads. The current audit independently recalculates source counts and inspects the saved evidence.
- [x] Desktop checks on the identical local source verify one point per competition/skater, correct time/source page, keyboard selection, source-event navigation, date empty state, PB independence, browser-back restoration and complete nine-record history for the checked profile.
- [x] Same owner-private project successfully deployed as v18. Fresh audit metadata confirms the owner is the sole allowed user, with no external visitors or allowed groups; GitHub remains public.
- [x] Mobile improvement plan records information hierarchy, touch-chart interaction, comparison controls, mobile record cards and measurable acceptance criteria. Responsive CSS is unchanged from v17; no mobile redesign was implemented ahead of the user's later discussion.
- [x] Independent code review found no substantiated actionable defect; its eight targeted tests passed. The separate plan audit found no mandatory omission within the current scope.

## Verification boundaries and deferred work

The plan auditor inspected source/tests, saved validation JSON/logs and the desktop screenshot, independently recalculated 2,309 source rows / 2,251 eligible times / 1,002 competition-best buckets, and used fresh parent-agent access metadata. It did not rerun the full 92-test suite, repeat hosted browser sign-in or independently repeat operator authorization tests. Hosted browser sign-in previously reached OpenAI security verification; desktop interaction evidence comes from identical local source, with separate private-service hosted data checks.

Current production coverage is two competitions and one season. Cross-competition lines and cross-season behavior are primarily verified with in-memory fixtures. Before broader historical coverage, add interactive checks for more than 25 competition-best summaries, second-page navigation and a refresh that reduces the summary page count.

Mobile layout/phone screen-reader/touch/overflow implementation and acceptance are explicitly deferred. More historical ingestion, Admin A0–A7, domains/login changes, scheduling/email and Season-menu redesign remain outside this scope. Conditional source-backed track-specification storage/filtering has no verified source data to act on yet.

## Separate release closure

- [x] Final user acceptance of the current scope, retaining the recorded verification limits and deferred mobile work.
- [x] Explicit user authorization for this phase 5 GitHub commit/push/merge.

The release pull request and main-branch merge record capture execution of the authorized GitHub closure. This authorization does not automatically cover GitHub release actions for phase 6. The original v17 Round/all-appearance behavior, 91-test checkpoint and browser-connection limitation are historical records in [the completion log](phase-5-completion.md), not the current acceptance state.
