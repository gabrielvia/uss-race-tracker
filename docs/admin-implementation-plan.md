# Admin website implementation plan

Status: planned; no admin application or admin Site has been created. Recorded October 30, 2026.

The [architecture](admin-architecture.md) defines the product boundaries. This plan defines the development sequence, deliverables, dependencies, and acceptance criteria. It is an Admin delivery track within the [main implementation plan](implementation-plan.md), not a replacement for the viewer roadmap.

## Delivery milestones

| Step | Deliverable | Depends on | Completion evidence |
| --- | --- | --- | --- |
| A0 | Verified identity and data-publication contracts | Current Sites foundation | Recorded supported integration choices and a minimal end-to-end integration check |
| A1 | Independently hosted admin shell and authorization | A0 | Admin can sign in; anonymous and non-admin requests cannot read or write admin data |
| A2 | Import batches, validation reports, and local ingestion API | A0; main phase 3 | Real local parser output creates a traceable candidate batch without changing viewer data |
| A3 | Manual import and review screens | A1 + A2 | Admin can inspect a real batch, see failures, and prepare an eligible revision |
| A4 | Authorized publication to Viewer | A3 + verified A0 publication path | Approved complete data appears on Viewer; failed publication leaves the old revision intact |
| A5 | Portable parser running as a cloud job | A4 | Closing the browser does not interrupt processing; progress and results remain inspectable |
| A6 | Admin-managed recurring imports | A5 | A real unattended run uses the same validation pipeline; pause and retry behavior are verified |
| A7 | Completion email reports and notification history | A6 + configured email integration | A real delivery is verified; retries do not duplicate messages or imports |

**First usable Admin milestone: A1-A4.** Administrators can log in, receive local parser batches, inspect validation, and publish results before cloud parsing and scheduling are introduced. Admin implementation is deferred by the user while work focuses on the main website. Main phase 3 first implements its own protected ingestion contract; future A2 can integrate with it. Do not create an Admin project, domain, UI, login or scheduler during the current viewer milestone. All Admin milestones remain pending.

## A0. Resolve platform and integration contracts

Tasks:

- Verify administrator sign-in and server-side authorization on a separate Sites origin. Define the initial administrator provisioning method without assuming user IDs are shared across Sites.
- Verify the Admin-to-Viewer publication path. Do not assume two Sites can bind the same physical D1/R2 resources. If direct sharing is unavailable, use a protected publication endpoint and versioned read projection in the viewer's own storage.
- Define import payload schema/version, source hashes, competition identity, discipline/season scope, provenance, and validation-report format.
- Define candidate revision and active revision boundaries. Select a publication unit that cannot expose incomplete heats/events or partially transferred competition records.
- Record the machine authorization mechanism for local ingestion and future cloud jobs. Keep it independent of an open browser session.

Acceptance: a supported path is demonstrated with a small isolated test; unresolved platform assumptions are written down as blockers for dependent tasks, not hidden behind a working-looking UI. The current viewer audience is unchanged.

## A1. Create the separate admin application

Tasks:

- Add an `admin/` application in this repository using the supported Sites server template. Keep `web/` as Viewer; give Admin its own `.openai/hosting.json` and project identity when implementation begins.
- Add English navigation for `Overview`, `Imports`, `Validation`, `Publish`, `Schedules`, and `Reports`. Clearly label functionality that is not implemented; do not add controls that pretend to perform unsupported operations.
- Implement server-side admin authorization for every page, API, file download, and mutation. Use platform sign-in and an explicit admin allowlist/role mapping.
- Deploy initially on a separate private Sites hostname. Custom domains and DNS setup are a separate configuration task after the owner supplies the intended domain.

Acceptance: authorized admin access works locally and in the hosted environment. Anonymous users, signed-in non-admins, and direct API calls without permission are rejected. No admin credentials or private batch details appear in the viewer bundle.

## A2. Implement candidate batches and validation

Tasks:

- Add schema migrations for source documents/versions, import runs, candidate rows, validation issues, candidate revisions, and audit records. Reserve clear job, schedule, and notification relationships without implementing scheduled execution yet.
- Define explicit states, such as `received`, `validating`, `needs_review`, `ready`, and `failed`. Store actor, source, parser version, timestamps, counters, and per-row outcomes.
- Add an authenticated batch ingestion API for local Python output. Keep parsing outside the request handler; reject invalid payloads, duplicate submissions, wrong discipline/season scope, and contradictory source revisions.
- Implement the agreed validation layers: source identity, competition/season assignment, row and heat completeness, exact timing/status handling, athlete identity, skating-age evidence, and stored-record reconciliation.
- Preserve errors, unparsed rows, and source-page references. Missing or conflicting evidence must never be silently converted to a guessed value.
- Give retries stable idempotency keys. A failed candidate remains inspectable and cannot replace active viewer data.

Acceptance: representative valid, missing-heat, wrong-season, identity-conflict, unsupported-status, and repeated-submission cases produce the expected stored reports. Existing published results remain unchanged in every failed case.

## A3. Build the manual import and review workflow

Tasks:

- Build `Overview` with the latest import, active published revision, and items requiring review.
- Build `Imports` with source/discipline/season scope, run state, progress, counts, and history. Local development starts by submitting prepared parser output; the UI must say whether work is waiting for an external/local worker.
- Build batch detail and `Validation` views with successful, rejected, and pending records; exact error reasons; PDF page links; and original versus proposed values where applicable.
- Add authorized retry and review actions with an audit trail. A reviewer cannot bypass a structural completeness failure merely by dismissing a warning.

Acceptance: an administrator can use the interface to understand a real successful batch and a real failed batch without reading terminal logs. The report totals reconcile with candidate-row outcomes. Unauthorized users cannot access reports by guessing IDs.

## A4. Publish validated data to Viewer

Tasks:

- Build a `Publish` review screen showing the eligible revision, discipline/season, affected competitions/events, record counts, changes, and validation outcome.
- Add an admin-authorized publication operation. Transfer a candidate revision, verify it, and activate it only when complete. Preserve the previous valid version if transfer or activation fails.
- Make viewer queries read the active published revision only. Keep candidate records, internal errors, job settings, and email recipients private.
- Add readback verification and publication audit entries. Provide controlled recovery to a previous valid revision where supported by the version model.
- Migrate or retire the development `/api/admin/seed` path as the production import flow takes over. Verify the viewer cannot use the old sample route as a general import mechanism.

Acceptance: a validated batch can be published and read through the real viewer APIs. Injected validation, transfer, and activation failures preserve the last valid results. Repeating publication does not create duplicate data. Widening viewer access is a separate owner decision.

## A5. Move parsing into cloud jobs

Tasks:

- Select and verify a cloud runtime that supports the portable Python parser and its PDF dependencies, expected files, resource needs, and authenticated access to Admin. Hosting this worker inside a Sites request is not assumed.
- Add persisted jobs, checkpoints/progress, bounded retries, failure details, and protection against concurrent duplicate work. Record parser and payload versions so a run is reproducible.
- Add `Start import` on Admin to create a job and return promptly. Reopening Admin must recover the job state from storage.
- Run the same parser/validation contracts locally and in the cloud. Select representative short-track, long-track, and historical inputs with explicitly documented coverage limits.

Acceptance: a real cloud job completes with the browser closed and produces an A2 validation report. Worker failure and retry do not duplicate records or falsely mark an incomplete run successful.

## A6. Add schedules and unattended execution

Tasks:

- Verify a supported scheduler and a management integration callable by the deployed app or an explicitly linked automation. Agent-only Sites scheduling tools do not by themselves prove the web application can create or edit schedules at runtime.
- Build schedule configuration for cadence, timezone, source scope, discipline/season, enabled/paused state, and the selected publication policy. Default new scheduled imports to validated candidates requiring review until automatic publication rules are agreed.
- Inspect existing schedules before creating one; keep stable schedule/run identifiers and avoid overlapping duplicate runs.
- Show next run, last run, failures, and retry status in Admin. Unattended source access and machine write authorization must both work without the authoring session.

Acceptance: an end-to-end unattended invocation is exercised immediately; do not wait for a scheduled date as the only test. Pausing prevents future dispatch, a repeated trigger is idempotent, and failed validation cannot auto-publish. If no supported runtime management API is available, expose the actual configured schedule read-only and record the limitation rather than shipping inert controls.

## A7. Add email reports

Tasks:

- Select a supported server-side email integration and configure the sender, authorized recipients, and secrets. Verify unattended delivery; browser-connected mail access alone is insufficient.
- Generate an English report after each configured completed run, including scope, discovered/new/unchanged sources, successful/failed/pending items, validation totals, publication outcome, and an authorized admin detail link.
- Add notification records, provider delivery references where available, retry limits, and a stable deduplication key per report/recipient/notification type.
- Build `Reports` and notification-history views. Distinguish `import failed`, `publication failed`, and `email failed`; email failure must not undo or mislabel a completed import.

Acceptance: an actual test report is delivered to the configured recipient. Delivery failure remains visible and retryable. Retrying notifications does not rerun imports or resend already completed notifications. Reports exclude secrets and do not grant recipients new access to Admin.

## Development and release rules

- All shipped UI, reports, emails, code, comments, tests, and operational instructions are English. Planning conversations may remain Chinese.
- Keep source, migrations, fixtures, and run instructions in this repository; keep credentials and local runtime state untracked.
- Use real source fixtures and meaningful tests at each step. Keep migrations separate from seed/import data.
- Release coherent milestones through reviewable PRs. Apply the repository's squash-and-merge policy; no Admin implementation PR is created by this document.
- Update this plan with completion evidence, limitations, and the next ready step. Do not mark a milestone complete merely because its interface exists.

## Decisions to resolve during implementation

Admin hostname and initial administrator identities; supported cross-Site publication/identity integration; exact publication unit; cloud worker/runtime and any associated spending; schedule cadence/timezone; automatic publication policy; email integration, sender, and recipients. Resolve each before its dependent action. Creating this plan does not purchase services, change audiences, enable jobs, or send email.
