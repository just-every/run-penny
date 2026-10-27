# Contract mechanism

The mechanism behind Penny's contract clauses: formats, timing and accounting rules the clauses link to. [CONTRACT.md](../CONTRACT.md) holds the acceptance text and status; this page holds no status.

## Where the shipped slice is described

`docs/read-spine.md`, `docs/native-feedback.md`, `docs/requester-board.md` and [HANDOVER.md](HANDOVER.md) describe the proven and deferred boundaries of the shipped slice. `rer verify` runs the repository's actual structural, source-custody, lint, type, importer, Worker, installer and build checks, not a universal satisfied/overridden/broken clause ledger. Base integration and its proof boundary are recorded in `docs/base-adoption.md`; local proof does not establish hosted mail delivery, and source custody checks do not satisfy runtime or release clauses.

Local running is `rer install`, `setup`, `dev`, then `verify`, `reset`, `export`/`import` and `deploy`, as README.md and OPERATIONS.md describe. Setup claims the first owner, and the owner completes first-run setup at `/setup` (OPS-005).

## Observed-time precision

**Observed-time precision (EVID-002, DEC-003, DEC-004).** New operator evidence requires a date and time with an explicit timezone offset or `Z`, with up to nine fractional-second digits. Stored provenance retains the exact accepted string. Evidence order and latest-support snapshots compare UTC whole seconds and the complete fractional part separately; equal instants use evidence ID as a stable tie-break. Snapshot selection stays inside the commitment transaction. Existing stored date-only or timezone-free observations are preserved and retain their UTC interpretation. Browser-local observed-time controls submit the corresponding explicit UTC instant.

## Blank decision questions

**Blank decision questions (DEC-001, DEC-004).** A question containing only ECMAScript whitespace or line terminators is blank. Operator create/edit trims that set; readiness and commitment transaction admission apply the same set to existing records without rewriting historical questions.

## First-release operation profile

**First-release operation profile (11 October 2026).** EVID-005 recording can explicitly select account, request and candidate-bet links in the same transaction, and optional release attribution connects post-release evidence under DEC-008. EVID-010 wording edits require the current version identity and append a version. EVID-008 attachment originals and all operator versions remain private even when a linked request is published. DATA-003 still outranks these histories.

REL-003 corrections retain the original publication's recipient and target snapshot. The portal marks the current wording version, while operators read earlier versions and explicitly request one new delivery command for a corrected version. REL-008 answers retain one release/requester/target identity across corrections and native identity merges without rewriting the publication snapshot; changing an answer appends a revision. The default outcome question is “Have you adopted this update?” REL-009 coverage is current responses divided by original snapshot recipients. The whole-release numerator counts responses across all targets, so it can exceed the recipient count; the UI shows both numbers and does not cap the ratio. With no recipients, counts and coverage are zero. REL-012 subscription permission is address-bound and timestamped. Unsubscribing on Updates or through any notification's global unsubscribe link withdraws that permission without removing follows, votes or requests. The separate “Mute this request” link changes only that request's mute.

Date-only DEC-007 review dates expire after that calendar date in `workspaceTimezone`; timestamps require an explicit timezone and expire at their instant. A minute Cron marks decisions due and queues the one NOTIFY-003 owner reminder without requester quiet hours. Completing a review requires a note plus a new date or revision; a review revision that retains the date completes that schedule without scheduling a repeat reminder. Changing the date starts another schedule. Dismissing its in-app notification alone is not a review.

Hosted restore and supported-root erasure expose the authenticated API and CLI, with current native operator and exact same-origin mutation admission plus the existing maintenance, empty-target, latest-journal and preview-hash fences. Hosted Data screens show operation state and exact commands and provide no destructive button. Verification of this source path is source-only, local TLS.

## Notification timing

**NOTIFY-002 deployment timezone.** The optional validated `WORKSPACE_TIMEZONE` deployment input pre-selects the timezone at setup; the owner's choice at setup (OPS-008) then sets `workspaceTimezone`. The built-in default (the IANA timezone for Brisbane) applies only to an installation that has not yet recorded a choice, and OPS-008's one-time prompt asks its owner to confirm or change it. Requester quiet hours are OPS-008's owner setting (default 20:00–08:00, or off); one-minute coalescing and minute Cron do not change.

**Release ordering clarification (NOTIFY-002, REL-006):** a queued release command for an address closes that address's still-open coalescing window for a request in the release's recipient context at the next drain, which sends the gathered update before the release command through the Queue or Cron drain; a release claim also waits for earlier queued or in-flight updates to that address and request. The window only ever ends earlier, never later, and the update's content is unchanged.

## Release scheduling

**Release scheduling clarification (REL-006, NOTIFY-002):** each published release version creates its own durable recipient commands, outside the request status/comment one-minute coalescing window. Release commands are due immediately outside the requester quiet hours (OPS-008; by default, during 08:00 inclusive to 20:00 exclusive in the workspace timezone); quiet-hour commands become eligible when the quiet period ends, and at once when quiet hours are off. Publication queues an immediate wakeup; the Queue consumer drains eligible commands without waiting for Cron activation. The minute Cron remains a recovery backstop, subject to actual platform scheduling. Quiet deferral consumes no retry attempt. Known pre-acceptance rejections use an initial attempt plus at most five retries at 1, 2, 4, 8 and 16 minutes, bounded by one hour from the first attempted send. Accepted or ambiguous SendGrid outcomes never automatically resend. Correlation keys do not provide SendGrid duplicate suppression.
