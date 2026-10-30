# Viewer and administration architecture

Status: agreed product requirements, recorded October 30, 2026. This document does not create an admin Site, enable schedules, send email, or change access to the existing Site.

Execution roadmap: [Admin website implementation plan](admin-implementation-plan.md). It defines A0-A7, dependencies, and completion criteria; the first usable admin milestone covers sign-in, manual import review, and publication.

## Separate Sites and audiences

The final product has two independently deployed web applications on different origins:

| Application | Audience | Responsibilities |
| --- | --- | --- |
| Viewer | Visitors granted access to published results | Browse competitions, rosters, profiles, and charts; read published data only |
| Admin | Explicitly authorized administrators | Start imports, inspect validation reports, review changes, publish approved data, manage schedules, and inspect notification delivery |

Keep both applications in this repository. Retain `web/` as the viewer application; a future admin application will have its own Sites project identity and hosting configuration. A private route inside the viewer application alone does not satisfy the separate-origin requirement.

Each Site can use its own generated Sites address. Custom subdomains such as `results.example.com` and `admin.example.com` are illustrative options, not selected hostnames. Custom domains require a domain controlled by the owner, DNS configuration, and successful platform validation before activation. No domain purchase or DNS changes are authorized by this planning document.

The current viewer Site stays private until the owner explicitly chooses a broader audience. Its future audience could be public or an allowed set of visitors; that decision is independent of the administrator allowlist. Sharing the viewer must never widen admin access.

## Authorization

- Require sign-in and explicit administrator authorization for the admin Site and every administrative operation. Authentication alone does not grant an admin role.
- Enforce authorization server-side. Knowing the admin URL or calling an API directly must not bypass the access policy. Hiding navigation or checking only Origin/CORS is insufficient.
- Ordinary viewers receive no administrative credentials, job controls, validation internals, or recipient settings. A direct attempt to use an administrative endpoint must be rejected.
- Give unattended jobs separate, narrowly scoped service authorization. A visitor session must not be required for scheduled work.
- Keep service credentials, source-repository credentials, and email-provider keys out of browser bundles, URLs, Git, reports, and logs.
- Sites user IDs are scoped to each Site. Do not assume the same ID can identify one administrator across both origins; define the trusted identity/authorization mapping explicitly.
- The existing fixed `/api/admin/seed` endpoint is development-stage infrastructure. Migrate or retire it as part of the admin split; do not treat the current sample seed route as the production administration system.

## Data flow and execution

Development starts with the existing local Python download/parser tools. They will submit a validated, traceable candidate batch through an authenticated admin ingestion path. The final cloud version runs the portable parser pipeline as a background job in a compatible runtime, triggered from the admin application or scheduler. Browser requests create jobs and return job IDs; they do not remain open for an entire PDF import.

The logical flow is:

1. Discover source files, preserve original files and hashes, and identify the competition, discipline, and season.
2. Parse into a candidate batch; preserve source locations and all candidate-row outcomes.
3. Validate source/version identity, season assignment, table and heat completeness, field/status interpretation, athlete mapping, and skating-age constraints.
4. Show the batch and actionable errors/warnings in Admin. Unparsed or contradictory records remain reviewable instead of silently disappearing.
5. Publish a validated revision through an authorized operation. A failed or incomplete candidate must not replace the last valid published revision. Define the activation unit explicitly, preserving complete event/competition boundaries.
6. Expose the active published revision to the viewer, and retain the batch history and publication audit trail in Admin.
7. Record a final report and attempt configured email notifications without changing the import outcome if email delivery fails.

The two Sites share a publication contract, not an assumed shared database binding. Sites provisions D1/R2 per project; cross-Site sharing of a physical binding has not been verified. Before implementation, verify whether authorized shared resources are supported. Otherwise use authenticated server-to-server publication of a versioned read projection to the viewer's own D1/R2. Keep candidate data and administrative state private, and activate the viewer revision only after complete transfer and validation. Do not place secrets or an unverified cross-Site connection in the manifest.

## Admin screens

- **Overview:** last successful import, last published revision, next scheduled run, and issues requiring attention.
- **Imports:** manual triggers and job history, with queued/running/completed/failed states, source files, discipline, season, timestamps, counts, and retries.
- **Validation:** successful rows, rejected/unparsed rows, missing heats, duplicate/source-revision issues, identity and age conflicts, and links to original PDF pages.
- **Publish:** review validated candidate revisions and record the administrator, publication time, and result.
- **Schedules:** enabled/paused schedules, timezone, source scope, next run, and last run. Work must continue while the browser is closed.
- **Reports & notifications:** saved import reports, configured recipients, delivery attempts, failures, and explicit retry controls.

All UI, help text, code, comments, report labels, and generated email copy must be English. Preserve original skater/club names and source evidence.

## Scheduled imports and email reports

Schedules are managed in Admin but executed by a verified server-side scheduler and background worker. Configure cadence, timezone, discipline/season scope, publication policy, and notification recipients explicitly. Actual setup must inspect existing schedules to avoid duplicates, verify unattended source access separately from write authorization, and exercise the job without waiting for the next scheduled time.

Retain the report even if the email service is unavailable. A report includes the run ID, trigger (manual/scheduled), scope, timing, discovered/new/unchanged files, validated and failed competitions/events, accepted/rejected/pending rows, publication outcome, and a link to its authorized admin detail page. Do not equate successful extraction with successful publication.

Use a supported server-side email integration selected and configured during implementation. A browser-connected mail session is not proof of unattended sending capability. Verify provider access, sender, recipients, delivery behavior, and secret storage before enabling delivery. Re-running or retrying a job must not duplicate imports or send the same completion email repeatedly; notification status is tracked separately from import and publication status.

## Implementation order and acceptance

1. In the current data/import stage, design batch, validation, publication, job, schedule, notification, and audit records alongside the discipline/season constraints.
2. Verify the two-Site data-publication path and administrator identity model before widening viewer access.
3. Build the separately hosted admin application and manual local-to-admin ingestion workflow first.
4. Move the portable parser to a supported cloud job runtime, then enable scheduling and email reporting after unattended end-to-end checks pass.

Acceptance includes: an ordinary viewer cannot access admin screens or perform writes; a signed-in non-admin is rejected; an authorized admin can inspect a completed or failed batch; failed validation leaves the active viewer data unchanged; manual and scheduled runs use the same validations; jobs run with the browser closed; reports accurately distinguish import/publication/email outcomes; retries do not duplicate data or notifications.

Still to select or verify: admin hostname, final viewer audience, authorized administrators, cross-Site resource/publication support, cloud parser runtime, schedule cadence, email provider, sender, and recipient list.
