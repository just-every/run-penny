# Penny acceptance

CONTRACT.md is the target contract. [Target contract acceptance](#target-contract-acceptance-18-october-2026) at the end lists every clause's acceptance evidence and current status; the sections before it record the first release's bounded receipts.

## First release: what a person can do

1. Install with `rer`, run `rer setup` and `rer dev`, and land signed in as the owner at **Finish setup**.
2. Create a public board and invite operators, who share equal product access.
3. As a customer, verify an email (hosted) or be added as a test customer (Penny Dev), then submit, vote, follow and comment.
4. Review submissions and comments in Moderation and approve customer-safe wording for publication.
5. Record private evidence, tag it, link it to requests and accounts, or create a request from it.
6. Compare and commit decision bets, approve roadmap wording and map requests to roadmap items.
7. Publish status updates and releases; followers get Queue-driven email outside quiet hours.
8. Export, restore and erase data, including saved Canny/UserVoice imports, with an erasure journal.
9. Deploy to your own Cloudflare account with `rer deploy`, sign in by email, and remove it with `rer deploy --remove --yes`.
10. Not needed for the first release: custom domains, outbound webhooks/Slack without an egress service, general tracker sync, automatic publication.

## Unmet first-release obligations

Penny 0.2.1 is public at `just-every/run-penny` (tag `v0.2.1`; earlier releases
`v0.2.0`, `v0.1.4`, `v0.1.3`, `v0.1.2`, `v0.1.1`, `v0.1.0` and `v0.0.0`); later heads are unreleased source. A named passing test or exact-head receipt
satisfies only its bounded claim. Uncovered, local-only and provider-limited
requirements remain unmet; a table, build, listing or historical receipt cannot
close them. CONTRACT.md and BASELINE.md retain their full authority.

The maintained terminal CLI is the setup, development and recovery path; the
browser installer and its native/browser proof scripts were removed in an earlier slice.
Persistent owner-account setup is locally proved with provider fixtures.
Exact-head CI is recorded for finished slices; final-source integration and
live receipts remain separate. Terminal setup/dev/
recovery and the separate artifact controller are documented. The maintained
schema-2 producer and dispatch-only caller are in source; the generated project
descriptor binds canonical `rer-setup.json` through `setup.path` and
`setup.sha256`; a registered project's separate `setupDigest` must match those
bytes. The caller selects the reviewed immutable trusted-build workflow with
full verification. Native owner-claim/editor checks passed 6/6;
the delivery-payload check passed 1/1 against actual built bytes; Penny's
structural operations check exited 0; and Platform's maintained integration
check inspected the committed 23-file bundle and exited 0. These are bounded
local/source checks, not a managed workflow dispatch or live installation.
Outbound integrations stay disabled until the owner deploys Base's egress
service and declares its `PENNY_EGRESS` binding with the service's receipt
grant (docs/INTEGRATIONS.md); the egress service is built and copied, and the
owner-account declaration keeps the account `workers.dev` origin with no
custom-domain field. Custom-domain or egress
provisioning, Resend sender configuration, stage installation, live preview or
production deployment, registry admission and any release after `v0.0.0` are
owner-only actions and are not evidenced here. Signed inbound
receipts, saved-file import and existing issue linking have their separate
bounded tests. Global registry and live provider acceptance remain unmet. No
replacement claim exists without a tested real owner export.

A later release still requires final-head hosted setup/health, real provider inbox
and Cron proof, applicable-prefix resource emptiness/teardown, public publication
inspection, release/tag approval and any registry/site acceptance. Local TLS
hosted-mode data proof is not a deployed-installation receipt. Hosted restore and
erasure run from the Data page with the browser session and finish on the server;
hosted erasure has run on real deployments (stranger journey 8 and sd-penny-r19).
Hosted restore into a real deployment remains unproven. Archive limits, the
authority and credential exclusions and journal continuity are in
docs/data-ownership.md.

REL-007: Resend receives each delivery key as its `Idempotency-Key`; SendGrid has
no provider duplicate suppression, so its key is correlation only and REL-007
stays unmet for SendGrid. With either provider ambiguous or interrupted sends
remain unknown and are never automatically retried; inspect provider records
before deliberate reconciliation. REL-011 and NOTIFY-005: events are correlated
for every kind of Penny mail (request updates, releases, rejection notices and
decision-review mail), by Penny's signed arguments, by provider message ID
(including historical attempts without recipient snapshots) or, for SendGrid's
delayed bounces without `sg_message_id`, by an address Penny mailed through that
provider (OPERATIONS.md, "Mail events"). Events from other mail on the account are
acknowledged without effect. Hosted provider callbacks remain unproven.

The dated feature-head source proofs below cover EVID-005/007/008/010,
DEC-006/007/008 with NOTIFY-003, and REL-003/008/009/012. The integrated head
requires its own affected checks and exact-head receipt.
SendGrid REL-007 and the live obligations above remain open. Declared-capacity
queue/search latency, general accessibility/load limits and customer-outcome/
economic acceptance remain required. Existing
appeals/duplicate/account variants are not new gates for this bounded candidate.

## Preserved requirements

Operator documents, APIs and generated functions independently require current
native Base authority. Requester authority is separate. Same-origin mutation,
revocation, expiry, block state and maintenance fences remain server checks.
Local development enters automatically as the owner through the checkout's
loopback dev key, suppresses mail silently and has no outbox; GET confirmation
does not consume a hosted sign-in link. Unconfigured mail is explained and partial
configuration refuses. No mocked product path or implicit provider fallback.

Submission keeps exact source wording and provenance and atomically creates one
request/evidence version/link. Moderation explicitly approves customer-safe
fields; held, rejected, internal and archived content stays out of public reads
and SSR. Votes, follows/consent, moderated comments/edits, merge/unmerge, private
tags and separately approved request attachments retain their existing coverage.
External identity/history cannot manufacture verified email, consent or operator
power. Equal product operators do not imply owner-only configuration authority.

Evidence review/link/unlink preserves wording; an explicit edit appends a private
operator version under the same evidence ID. Decisions compare common
dimensions without a combined score; commitment requires rationale, owner,
confidence and review date and freezes snapshots once. It creates an internal
Planned item. Public approval is separate and reversible. Selected-bet suggestions
include only linked published requests. Failed evidence reads cannot silently
erase relations. Auxiliary loading, failure, expired session and retry are distinct.

Approved roadmap moves prepare private status drafts atomically. Grouped
publication freezes approved mappings and identity-bound intent. Stale witnesses
refuse publication and expose discard without rewriting history. Releases require
all exact approved targets still Shipped; publication seals version, display
metadata, target membership and recipient context before delivery. No republish
queues a second command. A correction appends a marked current release version;
older approved versions stay readable to operators and correction delivery
requires its own explicit command.

Notifications retain consent, mute, suppression, current eligibility and public
content checks and fixed first-event one-minute windows. Requester mail follows
the configured workspace timezone and quiet hours (default 20:00–08:00, or off;
OPS-008); operator email has no quiet hours. A Queue consumer wakes at publication
with the minute Cron as backstop. Release deliveries use separate immediate commands.
Claims/attempts, address-bound generations, provider event correlation and
uncertainty survive restarts. Known pre-acceptance retries are bounded; unknown
sends are not retried. Restored intent is held, new native intent cannot join a
restored batch, and restoration makes no provider call.

Every applied SQL byte remains immutable. Historical integration evidence,
11 October 2026: the reviewed main inventory ended at 0029, including native dev
sessions and dev-minted credential custody; the integrated clause candidate
added migrations 0030–0033. Its populated 0029 test
compares every prior column after each added migration and repeated application,
with original files, authority, snapshots, delivery and erasure custody populated.
Native valid, revoked and expired sessions and ordinary, revoked and dev-minted
API credentials are exercised before and after migration. The historical
populated 0015 restoration-hold proof remains as a separate predecessor check.
Those dated integration receipts do not describe the current migration inventory.
Production applies the complete product inventory. Historical predecessor tests
apply the complete inventory, including native authority prerequisites, while
keeping the predecessor transport under its own entry point. Export inventories explicit tables/columns and original R2 hashes;
unknown schema, missing/untracked files, bounds overflow, interrupted custody or
stale journal refuse visibly. Local restore keeps destination Base authority.
Recovery revokes restored credentials/links and does not replay pending effects.

Custody follows edition.json, base/PROVENANCE.json, retained snapshots and
sources.lock.json. Current copied pins are listed in docs/base-adoption.md;
prospective adoption is not an accepted copy. Verify staged intentional inputs
with `pnpm source:lock`, `pnpm source:check` and `pnpm verify:base-source`, exact modes/hashes, schema,
production/predecessor builds and all retained behavior.

## Dated exact-head evidence

Reviewed-main integration scope, 11 October 2026: incoming main
`5a6649bc490a1e0c0fb1ea7de656abda3a92633f` is integrated with feature
`c156d22cc99e401bbd372817f334d7de8dc03d14`. Main's applied 0001–0029 and
selected Base bytes are retained;
only the four unmerged feature migrations move to 0030–0033. The existing
populated-upgrade case now targets main's 0029 schema and seeds native
revoked/expired authority plus genuine ordinary and dev-minted credentials before
its all-table snapshot. This paragraph records the scope, not a passing run.
The final merged SHA, exact-head `Verify Penny` CI receipt, affected checks and
fresh-clone/browser results are recorded in the release-review evidence kept
outside this source tree. No self-hash or
historical pass substitutes for that final exact-head receipt.

Historical feature evidence, 11 October 2026: the clause-extension source at
`4fe3205fc2ddadb9c870512398660b80d268af64` used its then-unmerged migrations
0028–0031. The receipts through the next source pin describe that historical
feature order, not the reviewed-main integration or the current 0030–0033 order.
The root's affected Worker runs completed 77 passing cases across the final
11-suite run and the corrected historical-upgrade rerun, with no dropped
assertions. The 321-request suggestion call took 2 ms. The following tests in
tests/base/penny-evidence.test.ts, penny-decisions.test.ts and
penny-releases.test.ts passed through the Hono routes:

Historical feature evidence, 11 October 2026: the EVID-006 case also passed its final populated privacy expansion: genuine
roadmap approval and release publication, positive safe-copy assertions and
commercial/source/internal markers absent from list/detail APIs and complete
built roadmap/updates HTML, metadata and hydration. The same case also
correlates an accepted local-outbox release delivery with its actual recipient,
public request/release links and safe wording; stored and rendered mail exclude
the commercial/source/internal markers.

| Clause | Passing test title |
| --- | --- |
| EVID-005 | [EVID-005] account writes require an owner and context includes transaction-linked requests and decisions in observed-time order |
| EVID-007 | [EVID-007][REQ-004] deterministic published-only suggestions rank lexical overlap within 500ms and actions create no draft |
| EVID-008 | [EVID-008] original evidence attachment bytes stay operator-only with export and durable upload recovery |
| EVID-010 | [EVID-010] edits retain immutable operator wording versions and reject stale edits and revoked sessions |
| EVID-006 | [AI-006 EVID-006] resolves cited summaries and editable reply drafts while keeping private records out of publication and requester mail |
| DEC-006 | [DEC-006] revisions preserve commitment evidence and declined dimensions while atomically replacing approved roadmap bets |
| DEC-007 | [DEC-007] calendar dates expire after the workspace day, explicit timestamps at their instant, and a revision can complete a due schedule |
| NOTIFY-003 | [NOTIFY-003] completing a review before Cron holds that schedule; changed dates notify once without quiet hours and stay in app until dismissed |
| DEC-008 | [DEC-008] requester outcome revisions and release-linked evidence appear immediately through original publication links without changing commitment snapshots |
| REL-003 | [REL-003] correction preserves original context and operator history; portal marks current; one explicit delivery command per version |
| REL-008 | [REL-008 REL-009 DEC-008 DATA-003] original snapshot members retain revisions through identity merges until erasure; outsiders and erased archive restoration are refused |
| REL-009 | [REL-009] coverage state table counts current responses over original recipients across multiple targets with private snapshot links |
| REL-012 | [REL-012] request mute retains update subscription and global unsubscribe withdraws permission while preserving votes and follows |

The populated 0027 upgrade preserves every prior column, file, session, sealed
publication/delivery and tombstone, then exercises the new features on those
records. Existing restoration-upgrade tests passed 2/2. Literal CLI export,
reset, import and export passed with equal table counts/content hash and two
original files. Erasure followed the available erasure-1 GO memo and was built
last: requester, evidence and account roots lose their selected dependent rows
and original files; audit references are anonymized and old archives are
refused by the journal. A mixed-recipient proof retains independent surviving
outcomes and post-release evidence without changing commitment snapshots.

The emitted hosted-mode Worker proof passed over locally trusted TLS, including
current native authority, same origin, maintenance, empty destination, latest
journal, preview hash, original-file removal and interrupted recovery. This is
source-only, local TLS; hosted acceptance remains owner/live. The old
hosted-export test's intentional `data_local_only` refusal was replaced by
those guarded source checks. The guarded owner/live commands now live in
docs/data-ownership.md; OWNER-STEPS.md and docs/TRIAL.md describe the separate
saved-Canny local trial. Base copies and applied migrations 0001–0027 were not changed.

Both existing browser harnesses completed at 1440×900 and 390×844: 98
operator-pages captures and 186 decision-loop captures, all 284 personally
inspected by the root. They reported zero serious/critical axe findings,
horizontal overflow, unexpected console/page errors or external requests.
Loading, failed and expired-session states are distinct; deliberate network-edge
fault diagnostics are narrowly matched and bounded. Both fresh-copy CLI
journeys completed real initial/repeated setup and the complete feature loop;
each owned process tree was stopped.

The release-review evidence kept outside this tree records the exact pushed verification head,
GitHub CI run, both-width operator/decision captures and their inspected
axe/layout/error results, all destructive before/after counts, command outputs
and the conditional main-integration disposition. The source pin above
identifies the tested implementation before this acceptance receipt; it is not
a live acceptance claim.

The editing-resource review correction was integrated at
`c63eee282873695889967a19ab812e7f9baeae4a` on 9 October 2026. Its full local gate
passed 603 test executions without failures/skips; exact-head private CI passed.
The decision-loop journey passed at 1440×900 and 390×844 with 102 inspected
captures, no unexpected browser errors/external requests, serious/critical axe
violations or overflow. Four deliberately failed auxiliary GETs per operator
width were counted narrowly. The selected-request proposal and resource guards
were removed temporarily and their regression checks failed.

The authenticated archive extension at
`c964e3a1b1aee029c65fdd07fe96cb2a0ecbb533` passed 617 full local test executions
and exact-head private CI 37866855077. New proof surfaces are
hosted-export.test.ts, restoration-upgrade.test.ts,
restored-notifications.test.ts and tests/data/*.test.mjs. They exercise the emitted
hosted-mode Worker over locally trusted TLS, native D1/R2, private-file custody,
redirect/TLS refusal, isolated export/import/export, maintenance bounds and
held-history delivery. Current safe execution receipts belong in the external
integration report; these test definitions alone are not a passing receipt.

The installer completion and emitted-preview/cancellation plus fresh-copy
setup/recovery journeys passed at source
`e6b9ebd7d8afb8e5b5712ba8a0c3e72944464ce2`, remote command exit 0 in 319.411
seconds. At both required widths, 48 inspected captures had zero unexpected
errors/external requests, serious/critical axe findings or overflow. The moderate
evidence-form heading-order finding remains a note. Native owner, empty startup,
settings/origin repeat and owned-process teardown passed. Source
`5860241000d4e94a3c49f30a18e9476132381375` separately passed forced failure,
saved resume and the 130004 ms slow-start experiment before a preview-harness
failure; source `f372d4cc863da0cb7a7d83f587f397e6025869f4` passed the corrected
literal README journey at both widths: one test, zero failures/skips, 72.715
command seconds, 14 inspected captures with zero serious/critical axe findings,
unexpected errors/external requests or overflow. Product/runtime copies were unchanged by the
later proof-caller corrections. HANDOVER.md describes these bounded receipts;
finished merge CI and final clean-clone proof remain separate.

All six existing browser scripts remain required on the final integrated source.
Fresh frozen-clone proof must install its own dependencies and run its own gate,
then literal local setup and automatic owner entry at both widths. Inspect captures and record
axe/layout, real 404/private admission, hydrated navigation and owned-process
teardown. No prepared-but-unexecuted check counts as acceptance.

## Historical evidence

[Historical acceptance records](docs/acceptance-history.md) preserve earlier
requirements, milestone pins and counts. The supplied predecessor
`398d185a218b484735453d05392c1ac4749c3118` had 594 test executions, clean-clone,
six-browser and README receipts, and private CI 37843898786. Those receipts do
not prove changed source. Hosted receipts at
`05fa94b717664376d518b49b6ca7181102b4c61b` establish only that historical
installation, not current delivery or complete R2/account teardown. Previously
failed mobile startup and diagnostic-boundary reproductions retain their bounded
meaning; a later pass does not prove the earlier failure's cause.

## Dated saved-file import evidence, 10 October 2026

At `366d36711bcde9e95c36171b7dbf80c487b2b834`, the three native Worker import
suites passed eight tests. They exercised exact separate boards/posts/votes/
comments/merges/tags/evidence counts, private original bytes, non-authorizing
historical identities, late mapping/SQL refusal, persisted checkpoint resume,
exact repeat, strict reversal and later native work conflict, revocation race,
erasure resurrection refusal and a populated full-inventory upgrade. This proves
only those fixture flows. Real owner export, global importer registry admission,
complete browser/CLI archive receipts and public replacement acceptance remain
separate. The schema-valid local status is documented format, synthetic-only,
with no real export supplied. The migration guide states the supported versions,
refusal limits, consent policy and retained omissions.

## Saved-history archive and browser proof, 10 October 2026

At `e23764bee6ba0c9fd71ef74c7d27af8e6e290ae5`, the emitted hosted-mode
Worker and isolated local destination passed 21 unchanged archive/erasure tests
and five data-command tests. The literal command round-trip compared all 102
product tables and 159 rows, including 19 import records/eight retained originals,
and one original file with matching SHA-256. Destination native authority stayed
intact, with zero provider calls. This is local TLS proof, not a hosted deploy.

At `96fbc6745cd0bfd6925d9e83a5884884b8cc3ae1`, the actual operator browser
preview/error/apply/checkpoint/restart/resume/repeat/undo journey passed at
1440×900 and 390×844. All 12 captures were inspected: no horizontal overflow,
serious/critical axe violations, unexpected browser errors or external requests.
Runtime/browser teardown completed. The browser harness now uses the installed
Miniflare persistence API; its restart assertions remain intact. The four native
custody tests also pass after extending the existing later-work flow with native
votes, follows and approved status publication; refused undo preserves their
complete native rows. Exact-head integration CI and the final clean clone remain
separate required receipts. No real owner export or global registry admission
is claimed.

## Native admission preparation evidence, 10 October 2026

Named local checks prove bounded source composition: owner-claim four tests,
editor-admission two, host-identity four and preserved no-mail checks twenty
passed on native workerd/D1. Browser SSO at preparation source b03be8a made
six captures at 1440/390 with no permission/session/provider effects. Editor
source 74857e6 made four captures and proved native owner → versioned live edit
→ saved source → emitted public reload and client navigation at both widths.
Each had zero serious/critical axe violations, overflow, unexpected browser
errors and external requests, with fulfilled teardown. The management writer was
a labeled local network fixture; platform hosted publishing and stage key
transport remain unmet. These receipts precede the finished merge and do not
establish its full CI or final clean-clone evidence.

## Native owner and requester-host proof, 10 October 2026

Private source `3f2f8898bd08459a63dcd9a12e11793cf0b21e7e` passed the full
remote `pnpm verify`: 850 executions, 848 passes, two explicitly skipped Base-only
cases and zero failures. Private CI 37997836321 succeeded on that exact source.
Owner-claim, editor and host-identity suites include ten native Worker tests.
Four editor and six host browser captures passed at 1440×900 and 390×844 and
were inspected, with zero serious/critical axe findings, overflow, unexpected
errors or external requests. Native requester host sign-in and a persisted local
visual edit are bounded local proof; platform signing-key transport, registry
admission, live host configuration and hosted source publication remain unmet.

Historical evidence, 10 October 2026: the literal README journey also passed on this source inside the full gate,
using its own frozen scratch install and real development outbox sign-in.
Final source receipts and a fresh complete installer slow-start/cancellation
proof remain separate from this dated accepted slice.

### Historical maintained CLI adoption — 10 October 2026, scoped pending acceptance

Historical preparation, 10 October 2026 (the outbox command below is obsolete; current dev enters automatically as the owner and suppresses mail silently): the single-pin adapter, contained state migration refusal and native owner-account
flows have 14 passing local assertions; TypeScript passes. Base source bytes and
modes verify against the reviewed checkout. Real CLI portability and the amended
fresh-clone browser journey must pass on the final source; historical receipts
above do not accept these changes. The amended browser journey now executes
README install/setup/dev, repeats setup, then runs the actual
`rer outbox --json --non-interactive` command against managed dev
at both 1440/390 widths. It requires successful exit and uses the emitted
`signInUrl` for native owner sign-in, including read-only GET confirmation,
privacy, navigation, 404, accessibility and cleanup checks. This is prepared
coverage, not a passing runtime receipt. The integrated Base runtime adopts its
upstream readiness correction for Penny's declared `AUTH_SECRET`; no duplicate
`SESSION_SECRET` or local vendor patch is added. Full verify remains a separate
command boundary. No provider/deployment/publication acceptance is implied.
HANDOVER.md gives the remote commands and recovery boundaries.

The subsequent operations correction reproduces Part 1's five failures among
seven obsolete release-metadata tests and replaces the global-mail assumptions
with explicit command-level hosted profiles. Four focused operations tests and
TypeScript pass locally, including credential suppression and structural checks
before dependencies/settings in a genuine clone. The unprofiled operations
doctor uses the maintained local doctor. Its dated failure exposed the
SESSION_SECRET/AUTH_SECRET defect; the upstream correction is now adopted and
actual journey acceptance remains pending the final-source remote run. This does not accept the full README journey
or establish exact-head CI, provider access, deployment or public release.

### Maintained import-kit schema adoption — scoped local evidence

The new append-only 0026 custody migration, schema inventory, exact archive
restoration and native erasure policy passed 23 affected real Worker/D1/R2
checks on the rebuilt candidate. Existing Canny API and CSV-with-sidecar flows
apply, resume, repeat and undo; a populated previous-head import checkpoint
upgrades without changed prior rows or original R2 bytes and resumes afterward.
Restoration preserves source custody and destination authority, and erasure
retains opaque source/target fences across another archive round trip. TypeScript
passed. HANDOVER.md records the consumer schema defect and bounded correction;
full integration, browser, real-export and release acceptance remain separate.

## Saved Canny Ideas and move-in receipts — 12 October 2026

Implementation source `166afb1fc548f41c0d277450b1c681bec21e7d2c` passed
45/45 affected public-route tests on the parent's own run: the import lifecycle,
custody, populated upgrade, erasure and hosted archive suites. These are local
emitted-Worker/D1/R2 proofs with synthetic sources.

| Clause | Bounded proof in the existing suites |
| --- | --- |
| IMP-001 | `feedback-import.test.ts`: API/export multi-board history and Ideas mappings with and without supplied historical authors preserve absent authority, consent and publication; aggregate cells create no individual records. |
| IMP-002 | `feedback-import.test.ts`: classic multiline Unicode originals, explicit status/visibility review, named unknown/missing Ideas headings, individually unresolved references and refused unauthenticated/foreign-origin or unreviewed application. |
| IMP-003 | `feedback-import.test.ts` bounded saved history; `feedback-import-custody.test.ts` persisted resume, identical replay, changed-row conflicts, original custody and partial ordinary/stream rollback recovery. |
| IMP-004 | `feedback-import-custody.test.ts`: later native wording, votes, follows, comments, publication, unmerge and decision links preserve the complete graph on refused undo; invalidated reversal scans retain direction and refuse an identical-source apply bypass. |
| IMP-005, DATA-003 | `feedback-import-custody.test.ts`: Ideas request/requester erasure after restore purges originals and retains opaque replay fences; `penny-erasure.test.ts` covers the independent supported erasure roots and maintenance recovery. |
| IMP-006 | `feedback-import.test.ts`: explicitly mapped Ideas CSV with BOM, CRLF, quoting, Unicode, poisoned retained-only legacy headings and 40-vote/12-comment cells; the supplied ID/URL is the stable key. |
| IMP-007 | `feedback-import.test.ts` and `feedback-import-custody.test.ts`: preview/applied/undone/conflicted receipts, duplicate source rows and aggregate coverage, destination counts, omissions, unresolved references, historical identity treatment and zero job-created mail/notifications. |
| DATA-001 | `feedback-import-upgrade.test.ts`: a populated 0033 database with applied and undone classic jobs, saved work, originals and actual erasure fences survives append-only 0034–0037 with every prior row/file/fence unchanged and old receipts readable; the populated 0036 case closes maintenance writes without changing retained history. `hosted-export.test.ts` validates retained streamed custody through archive restore. |

These rows were proved at feature head `3ef9f52425328c93c78a09cef5c13fce1faaff09`:
GitHub `Verify Penny` run 38174390071 passed on that exact SHA, and the existing
`tests/browser/feedback-import.mjs` journey passed there on a fresh clone through
`rer dev` at 1440×900 and 390×844 (42 captures, zero serious or
critical axe findings, no overflow, no unexpected console error, failed request
or external request). The m1 full `rer verify` passed on
`cd5f7ba0a579f5554a5ecb16b5c03b87e5f708f2`, which differs from that head only in
one test runtime budget and the browser journey's expectations. The full-size
3,000/20,000/6,000/4,000 histories, the final merged SHA and its exact-head
receipts are recorded in the release-review evidence kept outside this tree.

The importer remains **documented format, synthetic-only**, with a real owner
export **not supplied**. P3 documents Ideas categories rather than guaranteed
literal headings or a stable ID/URL; the owner must classify actual headings and
supply that key. No source key or individual history is manufactured from counts.
The private trial is [TRIAL.md](docs/TRIAL.md).

Privacy follow-up `3a6a003172f0512d38b0020fbfbcf8e0ebb4dbd4` extends the
existing custody flow to evidence and streamed-evidence roots with later
independent request wording and a native note. All four Ideas privacy variants
passed through the public routes after build. The parent's separate actual
SQLite/Base proof compared before/after native and custody counts, scanned every
table for selected wording, preserved the complete independent request and
finished idle with originals removed and opaque replay fences. A pending
operation produced by the prior adapter also recovered under the same ID and
unchanged manifest. Surviving native rows are fenced by complete current values,
SQL NULLs, exact cardinality and the native revision; erased members retain
absence guards. No additional migration or Base change was needed. Final
clean-head combined verification remains part of the integration evidence.

The review of `a620b8530f931485b9d0c846ed486d0291c1c196` found a second
encoded original in retained `source.options.files`; declared-chunk removal and
a plain-text scan did not prove complete erasure. Correction source
`e4d409f3b5b82237eaa25edb70c11d428f258634`, integrated as
`8e679a317d5fbd7fdc3fd7a5de280842b8a1e577`, excludes mapper input from new
plans and adds installation-only migration 0036 cleanup cursors. The existing
custody/upgrade flows cover compatible legacy cleanup, completed-erasure export
and restore, native survivor fences and current-authority rollback. The parent's
independent 15-case SQLite/production-service check and actual Hono journey pass,
including raw, base64, compressed and joined-copy scans. Populated prior data
remains unchanged until an authorized privacy operation.

Both blocking legacy failures found in that review are corrected. A legacy
metadata rewrite that does not fit one batch now publishes through Base's
bounded private staging (admitted in full before its first write, prior erasure
stages for the job cleared), so both genuine interrupted legacy stage fixtures
resume the same operation to completion with no private stage, creation or work
row and clean decoded storage and archive scans. The work-manifest guard now
fences namespace and source completion, and a resume that finds an undeleted
work row refuses with `feedback_erasure_work_changed`; the real transaction
probe that changed the completion marker now rolls back with the installation
still locked instead of reporting completion. Separately, a 20,048,495-byte old
flat plan reproduces immutable Base's whole-invocation admission limit. Its new
pre-write check refuses before any native row, file or operation changes. The
same new source uses bounded stream pages and completes erasure. The exact
scope and recommended default belong in the external Penny R1 report; full
legacy erasure acceptance stays open for that oversized old flat plan class.

CI compatibility correction source `9e2f8d6eadcccbcea1a0cf2033935af53807c06f`
adds append-only migration 0037 for retained product maintenance fences. Its
`feedback-import-upgrade.test.ts` populated-0036 flow preserves prior cells,
originals, saved work, receipts and fences. Existing predecessor claim, isolation
and upload-race flows retain their authority and no-write assertions. Independent
current Base admission, private API/document/generated-function, maintenance,
streamed erasure and restore checks passed; parent reruns also passed. This is
bounded correction evidence, not full CI or overall R1 acceptance.

The required 3,000-idea/20,000-vote/6,000-comment/4,000-person Ideas history
applied, survived an actual killed-runtime resume, replayed without duplication
and exported through the native command on `87ed4b0`. Its first undo preflight
timed out after 303 seconds without removing native rows; full undo, restore
equality and active full-history erasure remain unproven. Failed-call D1 timing
and local Worker memory were unavailable. No hosted capacity claim follows.

Reversal correction source `af4edd1aeedb10e4295fdc22f4391924f1fa898f`
materializes exact active ownership before checking native dependencies, keeping
the complete value, relationship, authority and revision fences. Its existing
custody flow also refuses a later transfer row sharing an imported identity.
Nine affected checks and typecheck pass on that source; the complete large undo
and independent correction review remain pending. This change adds no migration.

Receipt UI source `3fd93ca7c969a9e072fd31580e59f55dec3b74bf` refreshes the
selected job and list after conflicting undo. The persisted `preflighting`
direction stays visible rather than leaving the selected job at `completed`.
The existing browser journey now reopens and resumes the same conflicting job,
retaining its 409, no-deletion, original and receipt assertions. Its obsolete
completed-phase assertion was replaced by that lifecycle proof; fresh complete
browser evidence remains pending.

The realistic full histories, responsive browser captures, exact final-head m1
verify and private-main CI are separate integration evidence recorded in the release-review evidence kept
outside this tree. This source
paragraph does not claim those still-pending results, hosted isolate-memory
capacity, a live provider/account trial or real-export acceptance. Previously
dated acceptance above remains historical evidence.

## Saved UserVoice ideas with supporters — 12 October 2026

Source head `4bb3c94f75653eae283130ef3ba0792ae2166b88`: GitHub `Verify Penny`
run 38195978511 passed on that exact SHA, and the m1 full
`rer verify` passed there (1,017 s). These are local
emitted-Worker/D1/R2 proofs with synthetic sources built from UserVoice's
documented export headings.

| Clause | Bounded proof in the existing suites |
| --- | --- |
| IMP-008, IMP-007 | `feedback-import-uservoice.test.ts` "previews, applies, replays and reverses UserVoice ideas with their supporters and a filtered-history warning": BOM, CRLF, quoted commas/newlines and Unicode; partial-history scope and filter text; Voters Count 7 against 5 supplied supporters, 2 aggregate-only; proxy and unmarked supporter types in preview, receipt and the request context; identical replay creates nothing; a changed supporter row under the same key is refused. |
| IMP-008, IMP-002 | "refuses unmapped statuses, unknown headings, workbooks and undeclared scope by name before any write". |
| IMP-009, IMP-004, OWN-001 | `feedback-import-restored-owner.test.ts`: after export, reset, restore and a fresh owner's setup, the owner's jobs list shows the restored UserVoice imports, opens their originals and undoes one; a non-owner operator sees none and is refused originals, read and undo. |
| IMP-008, IMP-001, REQ-010 | "keeps 300 imported supporters inert, unmerged and private from requesters and public pages": zero addresses, sessions, permissions, follows, outbox or intents and no account; a shared address is never merged; public pages show only the published vote count. |
| IMP-008, IMP-004, IMP-005 | "fences undo behind later native votes and erases a UserVoice requesters/requests with its originals and a replay fence". |
| DATA-001 | `feedback-import-upgrade.test.ts` populated-main case from migration `0038_`: applied and undone Canny receipts, saved work and opaque erasure fences survive append-only 0038 unchanged with old receipts readable. |

The existing `tests/browser/feedback-import.mjs` journey passed on a fresh
clone of that head through `rer` at 1440×900 and 390×844 (62
captures, zero serious or critical axe findings, no overflow, no unexpected
console error or external request), including the UserVoice preview, receipts,
workbook refusal and the request's supporter list. The 3,000-idea,
20,000-supporter-row UserVoice history previewed, applied through a killed
runtime, replayed, undid, re-applied, round-tripped `rer export`/`reset`/
`import`/`export` with an equal content hash and erased an active request and
supporter at `a48b760`, which differs from this head only in the workbook
refusal's heading list. Its per-phase times are in the release-review evidence kept outside this tree.

The importer remains **documented format, synthetic-only**; a real UserVoice
export is **not supplied** and no replacement is claimed. The trial is
[USERVOICE-TRIAL.md](docs/USERVOICE-TRIAL.md).

## Package mode, complete erasure, mail events and archives (14 October 2026)

Source only; exact-head CI and the run-site workflow are recorded with the
landing, and none of this is hosted proof.

- `rer` is the published `@runeditrun/rer` 0.2.2 in package mode. `rer check
  --profile first-party` passes; first and repeat `rer setup`, `rer dev` and
  `rer deploy --dry-run` behave as on the vendored head. Penny's placement
  refusal runs from the seed adapter: `tests/installer/cli-policy.test.mjs`
  drives the installed `rer` against a copy of the checkout.
- DATA-003/BASE-DATA-003: removed operators are an erasure root
  (`tests/base/penny-erasure.test.ts`); a person inside a multi-megabyte legacy
  saved import is erased while everyone else in it stays
  (`tests/base/feedback-import-custody.test.ts`). Each record is retired by
  Base's journaled bounded step (`retireD1ImportCustodyStep`, legacy source
  rewrites through `stageD1ImportErasure`) under one operation key; its private
  stage continues across resume requests from the committed journal offset. The
  test erases a person from a 20 MB legacy plan across requests, kills one request
  after its staged batch commits, and proves the same generation resumes, one
  receipt and one restore checkpoint per retirement, no copy in any table or
  stored file, others unchanged and peers' undo intact. A step that cannot fit one
  request is still refused before any change with
  `feedback_legacy_erasure_upgrade_required`. Releases since `v0.0.0` stream
  large histories and never create such plans.
- REL-011/NOTIFY-005: `tests/base/review-provider-boundary.test.ts` and
  `tests/base/review-mail-events.test.ts` cover delayed id-less bounces,
  historical attempts, rejection notices, decision-review delivery and
  suppression, provider unsubscribe and mixed signed batches.
- DATA-001/BASE-DATA-001: `tests/e2e/worker/data-ownership.test.ts` restores an
  archive carrying embedding settings and a revoked integration destination into
  a fresh installation, re-exports it unchanged, and shows the next erasure there
  continuing the source journal while the older archive is refused;
  `tests/installer/portability.test.mjs` keeps the literal `rer
  export/reset/import/export` equivalence.

## Scoped cancellation learning boundary

`LEARN-001`–`LEARN-006` add the bounded private Stage 2–3 software path over native feedback and exact Orbit delegated evidence targets. `tests/base/learning-stage2.test.ts` exercises the native HTTP acquisition/interpretation/commitment path and refusal boundaries; `learning-stage3.test.ts` exercises the scheduled handler, quiet refresh, controls, native/source-person erasure, provider revocation and real archive restore; `upgrade.test.ts` exercises populated released-v0.1.4 upgrade and repeat. Network/model responses are fixtures only at the external port. Live source/model configuration, actual owner/customer usefulness, hosted scheduled execution, measured cost/attention and every Stage 4–5 outcome gate remain open. `FLAGSHIP-PLAN.md` and `docs/flagship-acceptance.md` retain that distinction.

## Target contract acceptance (18 October 2026)

CONTRACT.md is now Penny's target contract. Every clause's acceptance evidence and status below agree with CONTRACT.md's Status table, reconciled against main `e3292a8a87bc48a4f6981ffd3e241d76b44afc2e` (21 October 2026). The first buyer review (round 1) added OPS-007, CAP-019–CAP-022, WIDGET-007, AI-011, REQ-033–REQ-035, PRIO-006, DELIV-009, DELIV-010, NOTIFY-008–NOTIFY-010 and MIG-007 and sharpened the rows it names. The second buyer review (round 2) added OPS-008, REQ-036, REQ-037, ROAD-014, REL-018, NOTIFY-011 and NOTIFY-012, added OPS-005's timezone step, and sharpened REQ-016, PRIO-002, TRIAGE-002, ROAD-006, REL-001, REL-002, NOTIFY-001, NOTIFY-002 and MIG-001. The third buyer review (round 3) added WIDGET-008, REQ-038–REQ-040 and NOTIFY-013, expanded INT-007 to the full portal brand, and sharpened OPS-001, OPS-005, ROLE-004, WIDGET-002, WIDGET-006, REQ-033, REQ-012, ROAD-014, TRIAGE-005, NOTIFY-008, NOTIFY-009, NOTIFY-011 and MIG-006. `done` names the passing test through a public door; `partial` and `missing` name the journey or test that would close the clause. Provider fixtures stand only at the paid or network edge, and a replacement claim for any incumbent still requires a tested real owner export. This section adds requirements; it does not reopen the bounded receipts above.

Current entries include the shipped setup and workspace clocks, request status controls and status roadmap, board categories and participation, requester subscriptions and sender identity, ownership, aging and private discussion. REQ-017 now includes repeated-decline reversal to the prior direct or mapped status; REQ-022 includes the private requester directory, existing-session refusal, contribution hiding and restoration, and atomic audit refusal. The installed board is served at `/` and `/portal/feedback`; HOME-002 remains the separate run-site landing. Local dev enters as the owner and suppresses outgoing mail without retaining or displaying captured messages (BASE-DATA-002). Each partial entry keeps its remaining acceptance work separate; dated receipts above retain their historical scope.

REL-014 adds operator-scheduled releases and ROAD-008 status updates with a retained UTC instant and entered IANA timezone, cancellation, current publication checks, scheduler audit and durable in-app author notices on failure. Clock-advanced Worker proof and the 1440/390 browser controls are named below; hosted Cron execution and inbox delivery still need their own receipts. REL-018 inherits the scheduling, cancellation and failure behavior for announcements and request targets when those entry types ship, and remains missing.

**Counts:** 111 done, 68 partial, 68 missing (247 clauses).

| Clause | Status | Acceptance evidence | Current proof |
| --- | --- | --- | --- |
| HOME-001 | partial | The installed board answers at `/` and `/portal/feedback` with the configured description and no operator data (route review, both widths). Gap: `route-review.mjs` is not loaded by push Verify or the named nightly job; full acceptance for configured portal identity, description and public-only content is not asserted by the running tests. | `tests/browser/route-review.mjs` |
| HOME-002 | partial | The run site's built landing page at both widths with no cross-origin request, cookie or workspace read; no test reads the built site yet. | `src/site/pages.tsx` |
| DOCS-001 | partial | Docs routes render from the manifest; an unlisted Markdown file or broken link fails the build. Gap: `route-review.mjs` is not loaded by push Verify or the named nightly job; full acceptance for public documentation navigation, content and privacy is not asserted by the running tests. | `tests/browser/route-review.mjs`; `docs/site.json` |
| OPS-001 | partial | Operators share product access; Owners and Admins can configure workspace clocks, while other settings remain owner-only. Required: one operator per role attempts every guarded action through its route and UI; a Viewer is refused every write with 403; a Contributor captures evidence, records a proxy vote and comments internally but is refused moderation, publication, commitment, settings and commercial fields; a Product manager is refused settings, integrations and roles; an Admin is refused handover, export and erasure; each refusal changes nothing; a role change applies on the next request. | `tests/base/auth.test.ts:83` |
| OPS-002 | done | Invite, remove and owner handover with revocation and audit. | `tests/base/auth.test.ts:83`; `tests/base/auth.test.ts:132`; `tests/base/auth.test.ts:160` |
| OPS-003 | partial | Overview figures link to their records; empty sections name the creating action. Gap: `operator-pages.mjs full mode` is not loaded by push Verify or the named nightly job; full acceptance for all overview figures, linked records and empty-state actions is not asserted by the running tests. | `tests/browser/operator-pages.mjs` |
| OPS-005 | done | Local dev automatically opens as the owner without an outbox. Setup requires company, postal address and a valid workspace timezone, displays requester quiet hours, commits installation-only completion once and redirects unfinished owner visits. The 1440/390 journeys complete the real form. | `tests/base/first-run.test.ts`; `tests/base/mail-identity.test.ts`; `tests/base/workspace-clock.test.ts`; `tests/browser/workspace-clock.mjs` |
| OPS-004 | partial | Search across request, evidence, decision, roadmap, release, requester and account fields works; the 500 ms first page at declared capacity is not load-tested. Product, component and feature names (PRIO-001) remain to be searched with the same permission filtering and ranking: searching one of each by full and by partial name returns it linked to its record, and an operator who cannot open it does not see it. | `tests/browser/operator-completeness-requester.mjs` |
| ROLE-001 | missing | AI-006 inherits restricted commercial-field roles here, including draft context and publication checks. A base test signs in under a role without commercial permission and reads requests, accounts, prioritization views, CSV exports and Ask Penny answers through their routes: no revenue, opportunity or health value appears; granting the permission reveals them on the next request; each role change is in the audit log (ROLE-004). | — |
| ROLE-002 | partial | A browser journey against SAML and OIDC test identity providers at the network edge: a first sign-in creates a Contributor, a group claim maps another user to Admin, an enforced domain refuses an email link, and an IdP-side deactivation ends access at the next session check. Inherited from REQ-039: an address on an SSO-enforced domain that signs in through REQ-039 stays only a requester, and REQ-039's unverified fallback link obeys the domain's email-link refusal. | `src/core/features/auth/dependencies.ts` |
| ROLE-003 | missing | Okta and Entra SCIM request fixtures through the public endpoint create, patch and deactivate a user; the deactivated user's session and API key are refused on their next request, as `tests/base/auth.test.ts` asserts for removal. | — |
| ROLE-004 | partial | Perform each listed action (including REQ-038's edit, removal, restore and permanent delete and INT-007 and NOTIFY-013 changes), then read and export the log through the UI and API; erase an operator and see their entries anonymized while the events remain. | `tests/base/board.test.ts:58` |
| OPS-006 | missing | A browser test saves a filtered, sorted view, then a second operator opens the shared view and gets the same result set; a private view is not listed for them. | — |
| OPS-007 | partial | A fixture requester with two posts, three votes, a comment, captured Zendesk evidence and an account: the profile lists each with a link to its record; a role without commercial permission sees no ARR or MRR; the profile path answers 404 to a portal visitor and appears in no public payload. | `src/core/features/requests/operator-context.ts`; `src/core/features/accounts/read-context.ts` |
| OPS-008 | done | Setup preselects the browser timezone or deployment input and requires an IANA choice. Owners and Admins save timezone and requester business hours through configurable quiet hours or off in Admin settings; an ordinary operator is refused with 403. Changes govern subsequent queued-mail and calendar-review clock checks, while operator mail has no quiet hours. An older installation confirms once. Route/provider-fixture tests and 1440/390 journeys cover these paths. | `tests/base/workspace-clock.test.ts`; `tests/base/notifications.test.ts`; `tests/browser/workspace-clock.mjs` |
| EVID-001 | done | Records and reads back all five source kinds and the free-text label; missing free-text label returns 422 and creates nothing; a failed evidence insert rolls back the entire requester submission. Accepted submissions create exactly one item and refused submissions create none. | `tests/base/penny-evidence.test.ts` — "captures source provenance atomically and keeps originals private with durable replay and upload custody"; `tests/base/no-mail-identity.test.ts` |
| EVID-002 | partial | Provenance fields stored as supplied, identity never inferred. Gap: `operator-pages.mjs full mode via operator-pages-decisions.mjs` is not loaded by push Verify or the named nightly job; full acceptance for complete recorded provenance and nullable attribution is not asserted by the running tests. | `tests/browser/operator-pages-decisions.mjs` |
| EVID-003 | partial | Link, create, mark reviewed with reason and return to unreviewed. Gap: `operator-pages.mjs full mode` is not loaded by push Verify or the named nightly job; full acceptance for link/create/review/unreview lifecycle without implicit review is not asserted by the running tests. | `tests/browser/operator-pages.mjs` |
| EVID-004 | done | Linking the compared item to a further bet, tagging and untagging it, merging and unmerging its linked request, committing and unlinking each preserve the evidence row and every existing version row. | `tests/base/decision-loop-commit.test.ts` — "derives hand-computable dimensions and immutable current-version snapshots" |
| EVID-005 | done | Account context with transaction-linked requests and decisions in observed-time order. | `tests/base/penny-evidence.test.ts:61` |
| EVID-006 | done | No commercial field, source attribution or note in public APIs, documents, metadata, sitemap or requester mail. | `tests/base/penny-evidence.test.ts:157` |
| EVID-007 | done | Deterministic published-only lexical suggestions within 500 ms; actions create no draft. | `tests/base/penny-evidence.test.ts:112` |
| EVID-008 | done | Evidence attachment bytes stay operator-only. | `tests/base/penny-evidence.test.ts:132` |
| EVID-009 | done | Private tags survive merge and are exported. | `tests/base/board.test.ts:41` |
| EVID-010 | done | Edits append immutable versions; stale edits refused. | `tests/base/penny-evidence.test.ts:100` |
| CAP-001 | partial | A browser journey at 1440 and 390 pixels: items from three connector fixtures arrive, are triaged by keyboard (link, create, dismiss with reason, snooze), each linked request shows the item with its source link, and the overview counts match the inbox. | `src/core/features/evidence/repository.ts`; `tests/browser/operator-pages.mjs` |
| CAP-002 | partial | A connector fixture test captures a record, edits it at the source and deletes it at the source: Penny shows changed and removed states, purges the excerpt at the window, and the deep link opens the original record. | `src/core/features/evidence/write-service.ts`; `tests/browser/operator-pages-decisions.mjs` |
| CAP-003 | missing | Zendesk OAuth, API and webhook fixtures at the network edge: install, link, create and proxy-vote from the sidebar; tag-triggered capture creates one item per ticket however often the webhook replays; the status appears in the sidebar; uninstalling revokes and deletes the tokens.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| CAP-004 | missing | Intercom API and webhook fixtures run CAP-003's journey and show company attributes arriving as private segment attributes.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| CAP-005 | missing | A journey against a running HappyToHelp test installation links a ticket, captures one by tag and receives the drafted status reply on that ticket.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| CAP-006 | missing | Help Scout API fixtures: link, create, tag capture and mapping, each once per conversation.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| CAP-007 | missing | Gong API fixtures: filtered calls are ingested, proposals carry exact transcript spans and timestamps, accounts map through Gong's CRM association, and the fixture records no request for an out-of-filter call. | — |
| CAP-008 | missing | Fathom, Zoom, Google Meet, Fireflies, Grain and tl;dv fixtures each ingest one filtered call with timestamped spans and ignore an out-of-filter call; a VTT upload produces a searchable transcript whose highlight becomes evidence with a timestamp link; an audio upload shows progress, reserved and metered cost, and a visible failure when the provider fails. | — |
| CAP-009 | done | done against provider-edge fixtures (22 October 2026). Direct or BCC copies without recoverable forwarded headers are attributed to the admitted sender and marked not forwarded. Message-ID digests stay after erasure so a replay cannot recreate an item. Refusals keep only non-personal reason counts. Hosted Email Routing, a real domain and live mail acceptance: NOT RUN. Admission depends on the `Authentication-Results: mx.cloudflare.net;` header, which only a hosted receipt can confirm. HTML-only mail is refused (`excerpt_size_or_plain_text_required`). Captured source provenance records "Forwarded by <admitted sender>"; a recovered body address is labeled "Sender stated in forward". | `tests/base/penny-evidence.test.ts` — “[EVID-001 CAP-009 EVID-008] captures source provenance atomically and keeps originals private with durable replay and upload custody”; `tests/base/notifications.test.ts` — “[NOTIFY-004 CAP-009] notification replies create nothing through HTTP or the dedicated email door”; `tests/browser/operator-pages.mjs`, PENNY_CAPTURE_ONLY=1, capture settings and original-sender item at 1440/390. |
| CAP-010 | missing | Signed Slack Events and Interactivity fixtures: the shortcut and the reaction each capture a message once, a bad signature is refused, and a Slack Connect channel maps to its account; the same capture runs against a Nook test installation. | — |
| CAP-011 | missing | Bot Framework fixtures with token validation capture a message once and refuse an unsigned request. | — |
| CAP-012 | missing | A Playwright extension journey on a fixture page creates an inbox item with the URL, excerpt and screenshot attachment; a signed-out extension is refused. | — |
| CAP-013 | missing | HubSpot and Salesforce fixtures render the panel for a record's company, capture feedback tied to an opportunity amount and attribute a proxy vote to the right customer. | — |
| CAP-014 | done | Inbox/request controls and the private Zendesk sidebar explicitly select an existing customer or confirm a new unverified contact, retain source/recorder, count once through later direct voting and merges, create no permission, export individual voter attribution and preserve archive/restore/erasure custody. Current authority, foreign origins, scope and key revocation refuse writes; an audit failure rolls back. Real app assets run at 1440/390 with the Zendesk SDK/proxy fixture only at the network edge. Imported UserVoice supporters also retain historical proxy marks. Live Zendesk installation is unclaimed. | `tests/base/proxy-votes.test.ts`; `tests/browser/proxy-votes.mjs`; `tests/browser/zendesk-proxy-votes.mjs` |
| CAP-015 | partial | A Zapier CLI test against a running installation fires each trigger once per event and runs each action within its key's scopes; an out-of-scope action is refused. | `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts` |
| CAP-016 | partial | A clock-advanced fixture with an expired token and a rate limit shows the connector failing with its reason once an hour passes without a successful sync (or after the owner's shorter setting), notifies the owner once, and after reconnect resumes from its cursor without duplicate items. | `tests/browser/integration-states.mjs` |
| CAP-017 | partial | Connector fixtures assert that no request is made for out-of-scope records, that redaction precedes the write, and that captured people hold no permission record (NOTIFY-009 sends create none either). | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| CAP-018 | missing | A conditional question renders and validates on the portal and the widget at both widths; poll answers aggregate per request and by segment and stay operator-only. | — |
| CAP-019 | missing | Freshdesk API and webhook fixtures run CAP-003's journey: install, link, create and proxy-vote from the sidebar; tag-triggered capture creates one item per ticket however often the webhook replays; company fields arrive as private attributes; a shipped request drafts one reply on the linked ticket; uninstalling revokes and deletes the API key.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| CAP-020 | missing | Recorded fixtures from G2, Capterra, TrustRadius, Trustpilot, Product Hunt, the App Store and Google Play produce one inbox item per review however often the feed is re-read, each with its rating, date and a deep link that opens that review; an edited fixture review shows changed; AI-004 proposals from a review carry byte-exact spans. | — |
| CAP-021 | missing | Signed interaction and gateway fixtures: the command and the reaction each capture a message once with its jump link, a bad signature is refused, and a message in an unselected channel is never read. | — |
| CAP-022 | missing | Typeform, SurveyMonkey, Google Forms and Pencil fixtures produce one inbox item per response with its link and mapped attributes; a replayed webhook creates nothing; a bad Typeform signature is refused; an unmapped question's answer is absent from D1 and the archive. | — |
| WIDGET-001 | partial | A browser test on a fixture host page at both widths: an identified user submits, votes and follows, and on an auto-publish board sees their post listed at once; the page URL appears only in private evidence; the documented CSP directives suffice; no third-party cookie is set. | `src/core/features/settings/frame-settings.ts`; `tests/browser/operator-completeness-security.mjs` |
| WIDGET-002 | partial | Host-identity tests extended to JWT and to the widget origin: a valid token identifies the user and links the account with private attributes; expired, future-dated and forged tokens are refused and change nothing. | `src/core/features/auth/host-identity.ts`; `tests/base/host-identity.test.ts` |
| WIDGET-003 | missing | A browser test: the unread count falls after viewing; a segment-targeted announcement shows only to matching identified users; an unpublished release never appears. | — |
| WIDGET-004 | missing | SDK sample apps run XCTest and Espresso UI tests against a test installation: identified submit, vote and changelog read, and a queued offline submission sent once on reconnect. | — |
| WIDGET-005 | missing | A fixture host triggers two moments; their answers arrive as evidence tagged with the moment; the widget sends nothing to Penny until a call is made. | — |
| WIDGET-006 | missing | A browser test: a segment member sees the restricted board while a non-member and a signed-out visitor get 404 and no count; on an SSO-required portal, a signed-out request to a request page, the board, the public API, the feed and an attachment returns no request content (WIDGET-008's redirect or the sign-in page for documents, 401 for the rest); a custom hostname configured through the deployment path serves the portal over TLS (an owner-run receipt). Inherited from REQ-039: on an SSO-required portal, REQ-023's emailed link and REQ-039's provider buttons are absent, and their start and callback routes refuse without issuing state or a session. | — |
| WIDGET-007 | missing | A browser test renders the portal and widget in Spanish once through Accept-Language and once through an identify locale, with no English interface string left; a catalog missing a key fails the build; a status email to a requester identified with `es` arrives in Spanish. | — |
| WIDGET-008 | missing | At both widths against a fixture host: a signed-out visitor to `/portal/feedback/<request>` on an SSO-required portal is redirected to the login URL, returns with a valid token and lands on that request identified, with no cookie and no token left in the address bar; a vote chosen before sign-in is applied once after return; an expired token, a forged token, a reused state, a tampered return path and a return path on another origin are each refused and change nothing; with SSO required and no token the request page response carries no request content; with Open requests in my product on, a status email's request link follows the owner's pattern and the fixture host's widget opens that request; the unsubscribe link works signed out. Today host identity arrives only by `postMessage` from an allow-listed parent frame (`src/core/features/auth/ui/host-identity-bridge.tsx`). | — |
| AI-001 | partial | `eval:ai --set duplicates-v1` meets the AI-001 bars below (precision ≥ 0.90, recall ≥ 0.85, top-five ≥ 0.90, paraphrase recall ≥ lexical + 0.15); requester suggestions contain only published requests; with the model disabled, lexical suggestions still return within EVID-007's limit. | `src/core/features/requests/suggestions.ts`; `tests/base/penny-evidence.test.ts:112` |
| AI-002 | missing | `eval:ai --set links-v1` meets the AI-002 bars below; an inbox journey accepts and rejects suggestions; an auto-link rule on one fixture source links only above its threshold, marks and can undo each link, and changes no public payload. | — |
| AI-003 | partial | `eval:ai --set merges-v1` meets the AI-003 bars below, including at most 0.5% wrongful automatic merges and none across boards; a sweep lists proposals; accepting one collapses votes as REQ-008 requires; the auto-merge rule logs each merge and REQ-009 restores it. | `src/core/features/requests/merge-repository.ts`; `tests/base/board.test.ts:14` |
| AI-004 | partial | `eval:ai --set extraction-v1` meets the AI-004 bars below; fixture conversations yield proposals whose spans match their source byte for byte; auto-creation produces unpublished requests only; re-running the same conversation creates nothing new. | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| AI-005 | missing | `eval:ai --set themes-v1` meets the AI-005 bars below; a fixture corpus gets an initial taxonomy; new feedback is classified in the next run; an operator split reclassifies with history; themes filter the inbox and the request queue; a captured item on a board with no default owner, classified into a theme that has one, takes the theme's owner (TRIAGE-001). | — |
| AI-006 | done | Every summary citation resolves to a stored request, discussion or evidence record; unknown citations are dropped and disclosed; a private account value is flagged before publication, and only an operator-edited reply is posted through the existing comment path. AI-011 carries measured quality (no evaluation bars apply here); ROLE-001 carries missing role-limited commercial fields, including draft context and publication checks. | `src/core/features/ai/`; `tests/base/penny-evidence.test.ts`; `tests/browser/learning-journey.mjs`; `visual/ai-drafts/` |
| AI-007 | missing | `eval:ai --set spam-v1` meets the AI-007 bars below; a fixture spam batch is flagged with reasons and stays in moderation (held on an auto-publish board); a false positive is approved normally. | — |
| AI-008 | partial | `eval:ai --set redaction-v1` meets the AI-008 bars below; a fixture ticket containing an SSN and a card number is stored redacted in D1, search and the archive; a new rule applies to new captures and, on request, re-applies to stored ones. This is a deterministic rule-only implementation; optional model detection is not built and AI-010 is unchanged. Binary attachments are not rewritten. Operator evidence, CAP-009 email capture and native portal submission use guarded before-storage rules. AI-011 remains missing and inherits extending the minimal redaction-v1 runner. Gap: saved-import originals and learning source envelopes are not redacted before storage. Explicit reapplication currently covers at most 200 evidence wording versions, not every stored transcript or copied request field; larger stores need paged reapplication. The full before-storage and reapplication promises remain open. | `tests/base/penny-evidence.test.ts` — “[AI-008 EVID-010] edits retain wording versions and reject stale authority; explicit owner redaction irreversibly removes sensitive wording”; pnpm run eval:ai -- --set redaction-v1; `tests/browser/operator-pages.mjs`, PENNY_REDACTION_ONLY=1, rules and redacted/reapplied items at 1440/390. |
| AI-009 | missing | A question over a fixture corpus returns an answer whose every citation resolves; a role without commercial permission receives no revenue figures; a Slack answer posts only where the asker chose. | — |
| AI-010 | done | Exhausting a fixture budget refuses new AI runs with a visible reason while lexical suggestions, manual capture and triage keep working; the cost report matches metered fixture usage. | `src/core/features/ai/`; `tests/base/learning-stage2.test.ts`; `tests/base/upgrade.test.ts`; `tests/browser/learning-journey.mjs`; `visual/ai-models/` |
| AI-011 | missing | AI-011's named evaluation sets remain to be added with their documented size and label mix; `pnpm run eval:ai -- --set <name>` reports set version and hash, model and prompt version, counts, precision, recall, F1 or agreement, confusion matrix and cost against the AI quality bars below, and exits non-zero on a deliberately degraded fixture model; the lexical baseline run needs no model; enabling auto-merge for a model with no passing evaluation is refused with the reason, and a passing evaluation allows it. The minimal runner still lacks `--model`, the model and prompt version, cost, a non-zero exit on a degraded fixture model, the other six sets, and reading its bars from the "AI quality bars" table (currently duplicated inline in `scripts/ai-eval/run.mjs`). | — |
| SEG-001 | missing | HubSpot API fixtures map companies, contacts and deals; a webhook update changes segment membership within 5 minutes and a property changed without a webhook arrives at the next 6-hour (or owner-set) refresh; nothing is written to HubSpot by default. | — |
| SEG-002 | missing | Salesforce REST fixtures with sandbox OAuth: mapping, opportunity-linked evidence summing open amounts in USD, and closed-lost opportunities excluded from revenue at stake. | — |
| SEG-003 | partial | A journey against an Orbit test installation shows Orbit account attributes as Penny segment attributes and Orbit deals in revenue at stake. | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| SEG-004 | missing | Stripe API fixtures compute MRR from subscriptions with discounts and several items, flag churned customers and convert a non-USD subscription with its recorded rate. | — |
| SEG-005 | missing | Signed Segment webhook fixtures set traits that move an account into a segment; a Buoy health change does the same. | — |
| SEG-006 | missing | A base test changes an attribute and sees the account enter and leave a segment within 5 minutes; request, inbox and report filters agree on membership; no segment name or attribute appears in any public payload (DATA-002). | — |
| SEG-007 | partial | Private per-account vote totals, separate vote/evidence/distinct-account counts, every verified address/account association and complete expandable supporter history ship (REQ-026); revenue is available on account records (EVID-005). Feature demand counting each person and account once with recorded revenue and evidence ships (PRIO-001). Remaining: aggregate request and feature ARR/MRR, opportunity and churn value figures, theme demand and segment/date filtering. Native proxy recording ships from the inbox, request page and Zendesk edge (CAP-014). Acceptance still requires a fixture with several voters from one account counting that account’s ARR once, opportunity and churn figures reconciling with fixture CRM data and appearing beside REQ-026’s separate counts, and none appearing publicly. | `src/core/features/requests/operator-context.ts`; `src/core/features/accounts/read-context.ts`; `tests/base/penny-evidence.test.ts:61` |
| REQ-001 | done | Visitors read published requests, discussion, roadmap and releases without signing in. | `tests/base/board.test.ts` (line 16); `tests/base/board-categories.test.ts` (line 15); `tests/base/penny-evidence.test.ts`; `tests/browser/requester-blocking.mjs`; `tests/browser/roadmap-public-eta.mjs`; `tests/browser/rich-changelog.mjs` |
| REQ-002 | done | Identity-required actions need verified email or host identity; email never shown. | `tests/base/no-mail-identity.test.ts` |
| REQ-003 | done | Submission creates one unreviewed evidence item and one held request on a board without auto-publish (auto-publish is REQ-033). | `tests/base/board.test.ts:14` |
| REQ-004 | done | Choosing a suggestion votes or follows and creates no draft. | `tests/base/penny-evidence.test.ts:112` |
| REQ-005 | done | Publication carries only approved fields. | `tests/base/board.test.ts:14` |
| REQ-006 | done | One vote per identity; vote eligibility by public status. | `tests/base/board.test.ts:14` |
| REQ-007 | done | Requester comments are held until approved on a board without auto-publish (REQ-033). | `tests/base/notifications.test.ts:40` |
| REQ-008 | done | Merge moves links, comments and followers, collapses votes and redirects. | `tests/base/board.test.ts:14` |
| REQ-009 | done | Unmerge restores the duplicate and keeps later canonical additions. | `tests/base/board.test.ts:14`; `tests/base/notifications.test.ts:244` |
| REQ-010 | done | Follow and the unticked control are the only consent paths on a board without vote subscriptions (NOTIFY-008). | `tests/base/board.test.ts:14` |
| REQ-011 | done | Attachments are private until separately approved. | `tests/base/board.test.ts:41` |
| REQ-012 | partial | Category filtering, newest and recency-weighted last-14-day trending are implemented alongside search, board, status and existing sorts. Gap: the 500 ms first page at declared capacity is not measured. | `tests/base/board-categories.test.ts`; `visual/board-categories/REQ-012/` |
| REQ-013 | done | A repeated idempotency key returns the original result; a changed body returns 409. | `tests/base/board.test.ts`; `tests/browser/requester-repair.mjs` |
| REQ-014 | done | Expired, future or forged host identity is refused and changes nothing. | `tests/base/host-identity.test.ts` |
| REQ-015 | done | Status updates render distinctly, pin and notify followers. | `tests/base/board.test.ts:14` |
| REQ-016 | done | The latest-change rule, decline/reversal and withdrawal pass the public API journey; direct statuses and roadmap movement pass at both browser widths. | `tests/base/request-status-workflow.test.ts`; `tests/base/decision-loop-roadmap.test.ts`; `visual/request-status-workflow/REQ-016/` |
| REQ-017 | done | Decline requires a public reason, retains existing votes and comments, closes new votes/comments, and reversal restores the prior direct or mapped status even after another decline reason. API rules and 1440/390 customer/operator journeys pass. | `tests/base/request-status-workflow.test.ts`; `tests/browser/request-decline.mjs` |
| REQ-018 | done | Board create, rename, archive and move keep votes, comments and links. | `tests/base/board.test.ts:41` |
| REQ-019 | done | Internal boards withdraw requests from every public read. | `tests/base/board.test.ts:41` |
| REQ-020 | partial | Edits to public text re-enter moderation while the approved text stays, on a board without auto-publish (REQ-033). Gap: `requester-repair.mjs` is not loaded by push Verify or the named nightly job; full acceptance for own request and comment edits, retained approved text and auto-publish history is not asserted by the running tests. | `tests/browser/requester-repair.mjs` |
| REQ-021 | done | The author withdraws pending and published requests through activity; pending items leave moderation, public URLs return 410, projected votes stop counting and original evidence versions survive. Unauthenticated, foreign-origin and other-requester attempts are refused; failed audit rolls back withdrawal. Route and 1440/390 browser journeys pass. | `tests/base/request-withdrawal.test.ts`; `tests/browser/request-withdrawal.mjs` |
| REQ-022 | done | Operators block/unblock in the private requester directory. Existing sessions receive 403 for submission, vote, comment, follow and outcome writes; public requests/comments hide and votes stop counting, while operator records survive. Unblocking restores visibility, counts and participation. Audit refusal rolls back. API and 1440/390 journeys pass. | `tests/base/requester-blocking.test.ts`; `tests/browser/requester-blocking.mjs` |
| REQ-023 | done | Single-use 30-minute link and held pre-verification action. | `tests/base/auth.test.ts:46`; `tests/browser/no-mail-journey.mjs` |
| REQ-024 | done | Identity merge keeps both addresses, collapses votes and keeps mutes. | `tests/base/notifications.test.ts:229` |
| REQ-025 | done | Requester activity shows own requests and moderation/public states, votes, follows and held/rejected comments; unfollow, mute and release-subscription controls work in place. Route tests preserve contributions through unsubscribe; 1440/390 browser journeys cover subscription persistence, failure/retry, expired sessions and no cookies. | `tests/base/penny-releases.test.ts`; `tests/browser/requester-activity.mjs` |
| REQ-026 | done | Separate voter, evidence and distinct-account counts; account vote breakdown; every verified address/account association; complete supporter history including native and historical proxy marks, initially 50 people with Show more revealing 50 more at a time and no 100-person cap. Routes and 1440/390 browser journeys cover multiple addresses/accounts, evidence-only accounts, vote removal, blocking and public privacy. Native proxy recording ships from the inbox, request page and Zendesk edge (CAP-014). The demand payload holds exactly the three figures and no score. SEG-007 inherits the ARR/MRR, opportunity and churn value figures shown beside these counts. | `tests/base/request-demand.test.ts`; `tests/base/feedback-import-uservoice.test.ts`; `tests/browser/request-demand.mjs` |
| REQ-027 | done | Framing allowed only from allow-listed origins. | `tests/browser/operator-completeness-security.mjs`; `tests/base/board.test.ts:58` |
| REQ-028 | partial | Queue filters and sorts work; the 500 ms first page at declared capacity is not load-tested. | `tests/browser/operator-completeness-read.mjs` |
| REQ-029 | partial | A request created from evidence skips moderation and publishes only through REQ-005. Gap: `operator-pages.mjs full mode via operator-pages-decisions.mjs` is not loaded by push Verify or the named nightly job; full acceptance for operator authorship, evidence links and explicit publication is not asserted by the running tests. | `tests/browser/operator-pages-decisions.mjs` |
| REQ-030 | done | Approve, edit-then-approve and reject with optional private notice. | `tests/base/notifications.test.ts:279` |
| REQ-031 | done | Host claims verify the address and link the account; commercial fields stay private. | `tests/base/host-identity.test.ts` |
| REQ-032 | done | Internal notes never appear in public payloads or mail. | `tests/base/penny-evidence.test.ts:157` |
| REQ-033 | missing | With auto-publish on, a verified requester's post and comment are public on submission and a widget-identified user's post is listed at once; an AI-007-flagged post and a hold-rule match are held with their reason; a PDF post is held while an image post publishes with its image; a takedown (REQ-038's removal) removes the post from every public read within 5 seconds and its URL answers 404; with the model unavailable, posts publish marked not screened, or are held when the board chooses hold; with the setting off, REQ-003's holding applies unchanged. | — |
| REQ-034 | partial | Board categories/subcategories, rename/order/archive/merge, required submission, moderation and later assignment, visible-only counts/filtering, canonical merge custody, CSV/API/archive and roadmap cards are implemented; route and 1440/390 browser journeys pass. Gap: incumbent category imports, category automation rules and a standalone SDK interface remain missing. | `tests/base/board-categories.test.ts`; `visual/board-categories/REQ-034/` |
| REQ-035 | partial | Board-configured three/four labels, optional choose/change/clear, private per-request importance counts, native and Zendesk source-stated proxy importance, CSV and Canny saved votePriority mapping/receipt/replay/undo ship. This clause is done only when its remaining dependencies are complete. Importance counts now sort saved prioritization views; SEG-007 commercial-value figures, complete PRIO-003 inputs and MIG-002 Productboard importance remain. Route tests cover consent independence, current owner authority, origin refusal, audit rollback, merge/unmerge and held-verification replay. Browser journeys cover all controls and Canny preview/apply at 1440/390. | `tests/base/vote-importance.test.ts`; `tests/base/import-vote-importance.test.ts`; `tests/browser/vote-importance.mjs`; `tests/browser/zendesk-proxy-votes.mjs` |
| REQ-036 | partial | Six direct statuses, optional comments, public month/quarter ETA, internal statuses, templates and unchanged-save deduplication are proved through the API and browser at 1440/390. Vote/author subscriptions (NOTIFY-008/011), captured-contact sends and bulk status actions remain separate gaps. | `tests/base/request-status-workflow.test.ts`; `visual/request-status-workflow/REQ-036/` |
| REQ-037 | missing | At both widths: a requester's reply to an operator comment is held, then shown under its parent once approved; an operator's reply is public at once and notifies followers once; a comment image on a holding board stays hidden until approved and on an auto-publish board publishes with the comment; a reply to a rejected comment is refused; a Canny fixture reply lands under its parent with its image. | — |
| REQ-038 | missing | On a holding board and an auto-publish board: a retitled published request shows the new title in the request page, board list, search and API within 5 seconds while the old title appears only in the operator history; an edited operator comment shows the new wording marked Edited and keeps the old for operators; a removed published request answers 404 and leaves the vote total, category counts, search and the status roadmap column within 5 seconds, and restoring it brings each back; a removed requester comment leaves the portal and its author's activity view shows the reason; removing a status update leaves the status unchanged; no action sends mail except one author notice when ticked; a Contributor is refused each action with 403; each action has one audit entry. Edit-then-approve before publication ships (REQ-030); nothing edits or removes published content (`src/core/features/requests/operator-routes.ts`). | — |
| REQ-039 | done | Against Google and GitHub OAuth fixtures: a signed-out visitor votes, chooses Continue with Google and returns to the request with the vote applied and no cookie set; a GitHub account with no verified email is sent to the emailed link; a forged or replayed OAuth state is refused and changes nothing; with both providers off neither button appears. Inherited duty of WIDGET-006/WIDGET-008: on an SSO-required portal only WIDGET-008 applies; current Penny has no portal SSO-required state. ROLE-002 retains its own status. Google/GitHub authorize, token and identity proof uses network-edge fixtures only; real consent, an owner OAuth client and hosted redirect URIs are NOT RUN. | `tests/base/auth.test.ts` — “[REQ-039 BASE-ACCESS-001 REQ-023] requester OAuth verifies at the provider edge without cookies or operator authority; missing mail fails closed”; `tests/browser/operator-pages.mjs`, PENNY_OAUTH_ONLY=1 — owner switches, provider-off verification, Google held-vote return and GitHub emailed-link fallback at 1440/390. |
| REQ-040 | done | Posting/comment policy, hidden public vote totals, disclosed voter lists and anonymity apply to portal, roadmap and API projections; operators retain attribution and totals. Canny saved-file imports automatically map board visibility (`isPrivate`) and historical comment visibility (`privateComments`), the fields exposed by [Canny’s API reference](https://developers.canny.io/api-reference). Posting permission, vote-count visibility, voter visibility and anonymity require a reviewed mapping for each board, with Canny dashboard values entered or confirmed by the owner; comment participation is also explicitly reviewed. Unverified settings are not imported, and the mapping is bound to the preview and retained originals. Replay, undo, later-edit conflict and 1440/390 import-to-portal journeys pass. Live migration remains MIG-001. | `tests/base/board-categories.test.ts`; `tests/base/import-board-policy.test.ts`; `tests/browser/import-board-policy.mjs`; `visual/board-categories/REQ-040/` |
| TRIAGE-001 | done | Native request and evidence assignment, active board defaults on capture, personal queues, requester-comment handling after moderation, reassignment, unassignment, archive/restore and erasure are covered through routes and the 1440/390 UI. AI-005 inherits theme default owners when native themes ship. | `tests/base/ownership.test.ts`; `tests/browser/ownership-journey.mjs` |
| TRIAGE-002 | done | Overdue inbox, unanswered comments, no-response requests and stale effective statuses; configurable ages, durable per-owner reminders, snooze return, direct/mapped clearing and archive/erasure custody pass through routes and built pages at 1440/390. | `tests/base/triage-aging.test.ts`; `tests/browser/triage-aging.mjs` |
| TRIAGE-003 | missing | A rule dry-runs against a fixture inbox, then applies once per item with one audit entry each; a hold rule keeps a matching auto-publish submission in moderation with the rule as its reason; the rule editor offers no publication, vote, customer-notification or commitment action. | — |
| TRIAGE-004 | done | Private one-level note replies and selected operator @mentions create one durable in-app notice per note and recipient by default, with idempotent save, dismissal, active-member admission and archive, restore and erasure custody (a reply restores after its parent even when its id sorts first). API and 1440/390 browser journeys pass. NOTIFY-006 inherits channel preferences and email/chat/push/digest delivery of mention notices. | `tests/base/internal-discussion.test.ts`; `tests/browser/internal-discussion.mjs` |
| TRIAGE-005 | missing | Tagging and assigning 200 fixture items writes one audited batch; undo restores every item; a bulk removal (REQ-038) records one reason per batch. | — |
| TRIAGE-006 | partial | For each worker type, a kill-and-restart test resumes without duplicates and shows the failure state until resolved. | `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts`; `tests/base/notifications.test.ts:87` |
| PRIO-001 | done | Products contain components and features; three requests from two accounts roll up once per account, moves preserve all links, and private authority, archive and public boundaries hold at both widths. | `tests/base/product-hierarchy.test.ts`; `tests/browser/product-hierarchy.mjs` |
| PRIO-002 | done | Reviewed saved Canny API/CSV status names become native internal statuses with mapped public labels, private names by default, remapping without mail, replay, undo and later-edit conflict custody. Browser journeys at 1440/390 exercise import and native editing. | `tests/base/request-status-workflow.test.ts`; `tests/base/import-statuses.test.ts`; `tests/browser/import-statuses.mjs` |
| PRIO-003 | partial | Private/shared request and feature comparisons, explicit RICE/value-over-effort/manual segment demand/weighted-sum inputs, live native demand and importance, unknown inputs, stale-edit refusal and score-free decisions/public payloads pass through routes and both-width browser journeys. Remaining: commercial/segment/date and custom-field columns, scorecards and delivery-sourced effort. | `tests/base/prioritisation.test.ts`; `tests/browser/prioritisation.mjs` |
| PRIO-004 | missing | Two operators' inputs are both visible on a card; the weighted rank is computed; changing the criteria keeps earlier scores readable. | — |
| PRIO-005 | missing | A Linear, a ClickUp and an Asana fixture estimate each appear as effort on the linked feature with their source; a manual override is marked as such. | — |
| PRIO-006 | missing | Features linked to an objective appear grouped under it on a roadmap view and filter a prioritization view; a key result reads its value from an Amplitude fixture; a Productboard fixture's objectives land with their feature links. | — |
| DEC-001 | done | Draft, ready, committed and review-due states in one queue. | `tests/base/decision-loop-commit.test.ts` |
| DEC-002 | done | Brief holds question, owner, evidence, bets, confidence, review date and eligible requesters. | `tests/base/decision-loop-dimensions.test.ts` |
| DEC-003 | done | Every bet shows the same dimensions and no combined score. | `tests/base/decision-loop-dimensions.test.ts` |
| DEC-004 | done | Commitment requires rationale, owner, confidence and date and snapshots evidence. | `tests/base/decision-loop-commit.test.ts` |
| DEC-005 | done | Commitment creates the internal Planned item and writes no public field. | `tests/base/decision-loop-roadmap.test.ts` |
| DEC-006 | done | Revisions keep the original snapshot and withdraw superseded approvals. | `tests/base/penny-decisions.test.ts` |
| DEC-007 | done | Review due within an hour of the date; owner notified once. | `tests/base/penny-decisions.test.ts` |
| DEC-008 | done | Post-release evidence and outcomes appear without changing the snapshot. | `tests/base/penny-releases.test.ts`; `tests/base/penny-decisions.test.ts` |
| ROAD-001 | done | Transitions record actor, time and reason. | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-002 | partial | Internal roadmap record fields. Gap: `operator-pages.mjs full mode via operator-pages-decisions.mjs` is not loaded by push Verify or the named nightly job; full acceptance for all internal roadmap fields and linked context is not asserted by the running tests. | `tests/browser/operator-pages-decisions.mjs` |
| ROAD-003 | done | Public projection follows internal status and exposes only approved fields. | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-004 | done | Approval alone publishes; withdrawal answers 404. | `tests/base/decision-loop-roadmap.test.ts` (line 9); `tests/base/decision-loop-roadmap.test.ts` (line 17); `tests/base/request-status-workflow.test.ts` (line 7) |
| ROAD-005 | done | Commitment never grants approval. | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-006 | done | At 1440 and 390, a signed-out approved-items roadmap shows Under review, Planned, In progress and Shipped; the approved item moves from Planned to Shipped with counts of 1, the unapproved item contributes no title or count, and its card links to the mapped public request. Published release targets appear as release links on the card and detail; a draft release stays absent. | `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/roadmap-public-eta.mjs` — approved-only columns and counts, mapped request, published release on card and detail at 1440/390 |
| ROAD-007 | done | Approved moves and declines prepare customer-safe drafts. | `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/operator-pages-status.mjs` |
| ROAD-008 | partial | Publishing a draft queues one notification per version per eligible follower. Gap: `operator-pages.mjs full mode via operator-pages-status.mjs` is not loaded by push Verify or the named nightly job; full acceptance for all mapped histories, eligible follower deduplication and repeat-publication refusal is not asserted by the running tests. | `tests/browser/operator-pages-status.mjs` |
| ROAD-009 | missing | A browser journey switches the three views with the same filters and gets the same items; moving an item records a ROAD-001 transition. | — |
| ROAD-010 | missing | Two public roadmaps each show only their own approved items; an audience roadmap answers 404 to non-members. | — |
| ROAD-011 | done | Dated internal plans list live item states; overdue, dropped and conflicting blockers flag downstream active work and approved public ETAs without publishing. Route/Worker tests cover cycle/stale-edit/origin refusal, atomic audit rollback, populated upgrade and portable/public boundaries. The 1440/390 browser journey creates, edits and reloads plans, links dependencies and clears warnings through a normal Shipped move. | `tests/base/release-planning.test.ts`; `tests/browser/release-planning.mjs` |
| ROAD-012 | done | Explicit month/quarter approval on an approved item; change/removal drafts one safe update, unchanged approval does not; API and 1440/390 built-page journeys exclude private target dates. Stale/unauthorized writes and late-draft rollback, populated previous-head upgrade and repeat are covered. | `tests/base/roadmap-public-eta.test.ts`; `tests/browser/roadmap-public-eta.mjs` |
| ROAD-013 | missing | An export contains only fields the exporter's role may see; the shared link refuses a signed-out visitor. | — |
| ROAD-014 | done | Status-roadmap settings and visibility projections, plus reviewed saved-Canny reconstruction of board selection, column visibility/headings and the Shipped limit, preserved direct statuses on moderation, stale-preview refusal, replay, before/after settings custody, undo and later-edit conflicts. Browser journeys at 1440/390 rebuild, move cards, hide/rename columns and apply the Shipped limit. Live source acquisition remains MIG-001. | `tests/base/request-status-workflow.test.ts`; `tests/base/import-roadmap.test.ts`; `tests/browser/import-roadmap.mjs` |
| REL-001 | done | Targeted release drafts with roadmap targets and fields (request targets and announcements are REL-018). | `tests/browser/loopjourney-release.mjs` |
| REL-002 | done | Targeted publication requires Shipped roadmap targets and records the snapshot first. | `tests/browser/loopjourney-release.mjs` |
| REL-003 | done | Corrections version wording and need explicit delivery. | `tests/base/penny-releases.test.ts`; `tests/base/release-custody.test.ts` |
| REL-004 | done | Eligible identities appear once in a fixed snapshot. | `tests/base/release-custody.test.ts` |
| REL-005 | done | Release mail and pages carry only published fields and the recipient's own context. | `tests/browser/loopjourney-release.mjs` |
| REL-006 | done | Bounded retry before acceptance; ambiguous outcomes held. | `tests/base/notifications.test.ts:133`; `tests/base/release-custody.test.ts` |
| REL-007 | partial | Resend idempotency key and signed event dedupe ship; SendGrid has no provider duplicate suppression. | `tests/base/release-custody.test.ts` |
| REL-008 | done | Snapshot recipients answer per target; changes append revisions. | `tests/base/penny-releases.test.ts` |
| REL-009 | done | Coverage over original recipients with private links. | `tests/base/penny-releases.test.ts` |
| REL-010 | partial | Empty feed shows no placeholder entry. Gap: `route-review.mjs` is not loaded by push Verify or the named nightly job; full acceptance for empty public updates feed with no draft or placeholder is not asserted by the running tests. | `tests/browser/route-review.mjs` |
| REL-011 | done | Hard bounce and complaint suppress; soft bounce fails one delivery. | `tests/runtime/mail-events-restart.test.mjs` |
| REL-012 | done | Subscribe and unsubscribe keep votes and follows. | `tests/base/penny-releases.test.ts` |
| REL-013 | done | Delivery states never move backward or double count. | `tests/base/release-custody.test.ts` |
| REL-014 | done | Clock-advanced scheduled-handler proof publishes release and ROAD-008 status-update versions once at their due times, never early; cancellation prevents publication. Current eligibility is rechecked, and a non-Shipped target or stale status-update approval leaves the draft with a durable author notice. UTC instant, entered IANA zone and scheduler audit are retained; the 1440/390 browser journey schedules and cancels through the real controls. REL-018 inherits these guarantees for announcements and request targets when they ship. | `tests/base/penny-releases.test.ts` (REL-014); `tests/browser/loopjourney-release.mjs` |
| REL-015 | done | Markdown and visible escaped HTML, release-owned approved images, custom public labels, explicit public product names and changelog filters; approved-host video loads only on the reader’s choice. Native route tests cover pending-image refusal, source-byte recovery, publication/correction snapshots, both archive formats, restore and populated upgrade. The 1440/390 browser journey creates and edits a release, recovers/approves its image, publishes, filters and explicitly loads the video fixture. | `tests/base/rich-changelog.test.ts`; `tests/browser/rich-changelog.mjs` |
| REL-016 | partial | The feeds validate and list only published versions; a segment send reaches exactly the intersection of consent and segment. | `src/core/features/releases/recipients.ts`; `tests/base/penny-releases.test.ts` |
| REL-017 | missing | A Linear fixture completion drafts a release containing only approved wording and marked items. | — |
| REL-018 | missing | Announcements and request targets inherit REL-014’s scheduling, cancellation, due-time eligibility checks and durable author failure notices when those entry types ship. An entry with no target publishes, appears on the changelog page, both feeds and the widget, and emails each updates subscriber once and nobody else; with Notify subscribers unticked it emails nobody; it shows no outcome prompt; a release whose roadmap target is Planned is still refused; a release with an Open request target is refused unless Mark linked requests Shipped is ticked, which makes the request Shipped and adds its subscribed voters to the snapshot once each. | — |
| DELIV-001 | missing | A journey against a Vector test installation creates an issue, maps its state change to the roadmap item and shows Penny's demand inside Vector. | — |
| DELIV-002 | partial | Linear fixtures: create, link, state mapping, and the attachment updated when votes change. | `src/core/features/integrations/tracker-service.ts`; `src/core/features/integrations/tracker-receiver.ts`; `tests/browser/integration-states.mjs` |
| DELIV-003 | partial | Jira fixtures: create, link, status-category mapping, and panel content restricted for a role without commercial permission. | `src/core/features/integrations/tracker-service.ts`; `tests/browser/integration-states.mjs` |
| DELIV-004 | missing | Signed GitHub webhook fixtures: an issue closed by a merged pull request proposes Shipped; a bad signature is refused. | — |
| DELIV-005 | missing | Azure DevOps fixtures create a work item and map its state change. | — |
| DELIV-006 | missing | A Linear fixture Done moves the item to Shipped, the public status to Shipped and creates a draft; with auto-update on, each follower and NOTIFY-008 voter gets one notification and a replayed webhook sends nothing more; the same mapping runs for ClickUp and Asana fixtures (DELIV-009, DELIV-010). | — |
| DELIV-007 | missing | A new vote updates the tracker attachment once; with commercial permission off, no revenue band is sent. | — |
| DELIV-008 | partial | A drift fixture is shown and resolved by resync; an ambiguous create is reconciled to the known issue without a duplicate. | `tests/browser/integration-states.mjs` |
| DELIV-009 | missing | ClickUp API and webhook fixtures create a task from a request, link an existing one and map a status change to Shipped with its ROAD-001 transition and follower draft; the task's demand field updates once when a vote arrives; a bad signature is refused and a replayed webhook changes nothing. | — |
| DELIV-010 | missing | Asana API and webhook fixtures complete the X-Hook-Secret handshake, create and link a task and map its completion to Shipped with its follower draft; the task's demand field updates once when a vote arrives; a bad signature is refused and a replayed event changes nothing. | — |
| NOTIFY-001 | done | Followers notified for the named public events only (vote-subscribed voters, subscribed authors and merge notices are NOTIFY-008, NOTIFY-011 and NOTIFY-012). | `tests/base/notifications.test.ts:40`; `tests/base/notifications.test.ts:68` |
| NOTIFY-002 | done | Default quiet hours, coalescing, Queue wakeup and unsubscribe (owner-set quiet hours and the setup timezone are OPS-008). | `tests/base/notifications.test.ts:122`; `tests/base/notifications.test.ts:213` |
| NOTIFY-003 | done | One owner email and in-app notice per review-due schedule. | `tests/base/penny-decisions.test.ts` |
| NOTIFY-004 | done | A follower's status notification has the deployment sender, no reply-to and `Auto-Submitted: auto-generated`; its reply, posted as a raw message, an Inbound Parse form and a JSON inbound webhook to the provider event route and plausible capture paths, is refused and changes no table except the per-IP request counters. CAP-009’s dedicated platform-invoked email handler also refuses Penny’s deployment sender, tested notification sender, configured reply-to and notification replies. The only additional refusal state is a non-personal reason count. NOTIFY-013 retains its remaining sender-identity obligations. | `src/core/features/notifications/delivery.ts`; `tests/base/notifications.test.ts` |
| NOTIFY-005 | done | Durable keys, bounded retries and failure states for requester and operator mail. | `tests/base/notifications.test.ts:87`; `tests/base/notifications.test.ts:269` |
| NOTIFY-006 | partial | A preference-matrix test delivers each event, a TRIAGE-004 mention among them, once on each chosen channel and nowhere else; a digest coalesces a day's events into one message. | `src/core/features/integrations/destinations.ts`; `tests/base/egress-delivery.test.ts:35`; `tests/base/penny-decisions.test.ts` |
| NOTIFY-007 | missing | Zendesk and Freshdesk fixtures: a shipped request drafts one reply per linked ticket; nothing is sent until an agent sends it.  Future AI-006 connector/mail replies require operator editing and sending, never auto-send, and a fresh private-value check before publication. | — |
| NOTIFY-008 | partial | Disclosed votes create versioned, board-scoped permission; postal admission, stale-disclosure refusal, status delivery/unsubscribe, vote removal, explicit-follow retention, off-setting retention and reasoned bulk withdrawal are implemented. API/provider-fixture and 1440/390 journeys pass. CAP-014’s native proxy controls create a supporter without permission. Acceptance includes recording that supporter on a vote-subscription board and proving no status-update email without an independent subscription. Gap: Admin-role configuration and live provider/inbox acceptance remain unproved. | `tests/base/requester-subscriptions.test.ts`; `visual/requester-subscriptions/NOTIFY-008/`; `tests/base/vote-importance.test.ts` |
| NOTIFY-009 | missing | With "Also email people linked through captured evidence" ticked, a captured contact linked through Zendesk evidence gets one email, a contact who is also a follower gets one in total, and a suppressed or previously unsubscribed contact gets none; unticked, no captured contact is emailed; neither creates a permission record; the audit entry records the choice and the count. | — |
| NOTIFY-010 | missing | A clock-advanced test sends one digest per opted-in requester per week containing only their requests' public changes, sends nothing for an empty week, and the unsubscribe link stops the next digest. | — |
| NOTIFY-011 | partial | Verified submissions record the author vote and disclosed submission permission; publication notifies once, replies/status/release/rejection use the durable permission path, removing the vote retains it, and withdrawal/unsubscribe revoke it. Held-verification and board-off cases pass through routes; 1440/390 journeys pass. Gap: a separate SDK disclosure journey and live inbox acceptance remain unproved. | `tests/base/requester-subscriptions.test.ts`; `visual/requester-subscriptions/NOTIFY-011/` |
| NOTIFY-012 | done | Merge preview counts the duplicate’s eligible subscribers, excludes canonical subscribers, and offers an opt-out. Address-bound custody, one notification per eligible identity, opt-out, quiet hours/consent/unsubscribe, private-canonical deferral, silent reversal, atomic audit rollback, populated event/intent/batch upgrade, restore holds and erasure pass through routes/provider fixtures. Browser journeys at 1440/390 prove preview, default and unticked choices, saved merges, unmerge and canonical redirects without identity leakage. | `tests/base/merge-notices.test.ts`; `tests/browser/merge-notices.mjs` |
| NOTIFY-013 | partial | Company/postal setup and legacy prompt, provider-tested sender acceptance/refusal, sender/reply-to headers, postal footer and automatic-subscription admission are implemented; real provider clients use HTTP-edge fixtures. API and 1440/390 browser proof pass. CAP-009 proves the inherited reciprocal capture-address exclusion through tests/base/notifications.test.ts; this does not complete NOTIFY-013. Gap: Admin-role settings, unsupported carry-over/captured-contact/digest choices, and live verified-domain/reply/inbox acceptance remain missing. | `tests/base/mail-identity.test.ts`; `visual/requester-subscriptions/NOTIFY-013/`; `visual/requester-subscriptions/OPS-005/` |
| MEAS-001 | missing | Amplitude API fixtures return a feature's event counts over a window and a cohort that becomes a segment. | — |
| MEAS-002 | missing | Mixpanel API fixtures match MEAS-001's journey. | — |
| MEAS-003 | missing | PostHog, Vane and Segment fixtures produce the same feature usage counts for a linked roadmap item. | — |
| MEAS-004 | partial | Report totals reconcile with record counts on fixture data; response and resolution times on a fixture with a public comment, a status update, a snooze and a decline equal the hand-computed median and 90th percentile; a scheduled report sends once per period. | `src/core/features/releases/outcomes.ts`; `src/core/features/requests/operator-context.ts` |
| MEAS-005 | partial | Fixture usage yields adoption with its denominator and baseline; removing the usage data reports unknown. | `src/core/features/releases/outcomes.ts`; `tests/base/penny-releases.test.ts` |
| MEAS-006 | done | Fixture records reconcile current canonical request ownership, median seconds from capture to the first public comment or status update (held comments ignored; ROAD-008 included), shipped-request coverage by fully delivered nonempty recipient snapshots (accepted alone does not count), and distinct active items at risk from approved past-due public ETAs or ROAD-011 slipped blockers. Each overview figure opens its counted records at 1440/390. AGENT-006 remains partial and inherits the remaining detection kinds, including a Planned reply on a dropped item and a ticket told "soon" whose issue slipped, plus its correction/reminder requirements. | `tests/browser/operator-pages.mjs` (MEAS-006); `visual/loop-health/` |
| DATA-001 | done | Archive contains every classified record and original bytes. | `tests/base/hosted-export.test.ts:83`; `tests/installer/portability.test.mjs` |
| DATA-002 | done | No operator-only field name or value in public payloads. | `tests/base/host-identity.test.ts`; `tests/base/no-mail-identity.test.ts` |
| DATA-003 | done | Erasure outranks history and unmerge. | `tests/base/penny-erasure.test.ts:137`; `tests/base/penny-erasure.test.ts:178` |
| DATA-004 | partial | Custom fields are operator-only and editable where shown. Gap: `operator-pages.mjs full mode via operator-completeness-fields.mjs` is not loaded by push Verify or the named nightly job; full acceptance for editing each custom-field entity and public exclusion is not asserted by the running tests. | `tests/browser/operator-completeness-fields.mjs` |
| DATA-005 | partial | A CSV export of fixture data reconciles its vote totals with its individual voter rows and with record counts. | `src/core/features/data/archive.ts`; `tests/base/hosted-export.test.ts:83` |
| DATA-006 | partial | Requests, comments, status and releases ship, along with proxy-vote customer lookup and recording under `votes:write`. Remaining: the other record types, full pagination/filter coverage and OpenAPI acceptance. OpenAPI contract tests exercise every resource through the public API; each webhook's signature verifies and replays are rejected. | `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts:19` |
| DATA-007 | missing | An MCP conformance client lists the tools and runs search and capture; a call outside the key's scope is refused. | — |
| LEARN-001 | done | Selected native and Orbit originals with purpose and authorization. | `tests/base/learning-stage2.test.ts` |
| LEARN-002 | done | Contestable comparison with validated spans and a no-build option. | `tests/base/learning-stage2.test.ts` |
| LEARN-003 | done | Accountable choice with a complete measurement protocol. | `tests/base/learning-stage3.test.ts` |
| LEARN-004 | done | Bounded recurring work with claims, cursors, budgets and controls. | `tests/base/learning-stage3.test.ts` |
| LEARN-005 | done | Erasure and revocation close derived work. | `tests/base/learning-stage3.test.ts` |
| LEARN-006 | done | Absent source, model or transport refuses visibly; cost reserved and reported. | `tests/base/upgrade.test.ts`; `tests/base/learning-stage2.test.ts` |
| IMP-001 | done | Saved Canny boards, posts, votes, comments and merges preview and apply with non-authorizing history. | `tests/base/feedback-import.test.ts:35` |
| IMP-002 | done | Reviewed mapping refuses unknown headings and unresolved references by name. | `tests/base/feedback-import.test.ts` |
| IMP-003 | done | Atomic, resumable, idempotent application. | `tests/base/feedback-import-custody.test.ts` |
| IMP-004 | done | Undo removes only owned effects and conflicts on later work. | `tests/base/feedback-import-custody.test.ts` |
| IMP-005 | done | Erasure purges originals and fences replay. | `tests/base/feedback-import-custody.test.ts` |
| IMP-006 | done | Canny Ideas aggregates never manufacture individuals. | `tests/base/feedback-import.test.ts` |
| IMP-007 | done | Receipts with counts, omissions and zero job-created mail. | `tests/base/feedback-import.test.ts`; `tests/base/feedback-import-uservoice.test.ts` |
| IMP-008 | done | UserVoice ideas and supporters with proxy marks and scope warnings. | `tests/base/feedback-import-uservoice.test.ts` |
| MIG-001 | partial | Saved-file board settings, custom statuses, votePriority importance and status-roadmap reconstruction ship with reviewed mappings and reversible custody. Remaining: live Canny API acquisition and the full migration acceptance below. A recorded Canny API fixture containing every listed kind migrates each into its destination: categories as categories (REQ-034), insights and Autopilot captures as evidence with source link and company (CAP-002), custom post fields as request fields (DATA-004), `votePriority` as importance (REQ-035), custom statuses as mapped internal statuses (PRIO-002), user and company fields as segment attributes (SEG-006), subscribers as MIG-007 records only with carry-over; a post in `planned` and one in `complete` read Planned and Shipped after the owner approves the preview and appear in those columns of the rebuilt status roadmap (REQ-036, ROAD-014); a changelog with an unlinked and a linked entry lands both as published with original dates and labels, the linked one targeting its request (REL-018); a reply lands under its comment (REQ-037); the IMP-007 receipt counts each kind and names every omitted field; a second run adds only the delta; the migration queues zero deliveries, sends no mail and creates no notification. | `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts:35`; `tests/base/import-vote-importance.test.ts` |
| MIG-002 | missing | Productboard API and CSV fixtures rebuild the hierarchy, keep every note-to-feature link, land objectives with their feature links (PRIO-006) and importance on each vote (REQ-035), and name each omitted field in the receipt. | — |
| MIG-003 | missing | An Aha! API fixture migrates with proxy votes marked proxy and portal visibility mapped to boards. | — |
| MIG-004 | partial | A UserVoice API fixture produces the same requests and supporters as IMP-008 for overlapping data and adds the comments and notes. | `tests/base/feedback-import-uservoice.test.ts` |
| MIG-005 | missing | A Featurebase fixture migrates with counts reconciling to its receipt. | — |
| MIG-006 | partial | The dry-run receipt equals the apply receipt; each imported post URL answers 301 to its request; the owner chooses carry-over (MIG-007) or re-consent, and a re-consent invitation creates a permission record only on the customer's click; imported boards get vote-subscription, auto-publish and participation settings (REQ-040) matching the source; the cutover checklist names each unset branding (INT-007), SSO login (WIDGET-008) and sender (NOTIFY-013) item. | `src/core/features/imports/service.ts`; `tests/base/feedback-import.test.ts:71` |
| MIG-007 | missing | A Canny fixture voter subscribed to a post, migrated with carry-over, gets the next status email on the mapped request without re-consent and the email names the move; a changelog subscriber gets the next release; an unsubscribed source row is skipped with its reason; the receipt counts carried-over and skipped subscriptions; without carry-over the same voter gets nothing until they accept the re-consent invitation; undo removes the carried records. | — |
| OWN-001 | done | Signed first-owner claim with expiry, replay and second-claim refusal. | `tests/base/owner-claim.test.ts` |
| EDIT-001 | done | Owner editor lease after native owner admission. | `tests/base/editor-admission.test.ts` |
| API-001 | done | Reveal-once hashed keys with route-selected request, comment, status and release scopes plus `votes:write` for proxy-vote customer lookup and recording. A token without `votes:write` is refused a vote write without changing votes or permissions; revocation refuses the next write. | `tests/base/integration-api.test.ts:19` |
| API-002 | done | Revocation and expiry fence each request and transaction. | `tests/base/integration-api.test.ts:36`; `tests/base/integration-api.test.ts:54` |
| API-003 | done | API writes reuse native validation, moderation and approval. | `tests/base/integration-api.test.ts:73` |
| INT-001 | partial | Selected public events and immutable destinations; restored history sends nothing. Gap: `integration-states.mjs` is not loaded by push Verify or the named nightly job; full acceptance for selected public events, immutable destinations and held restored history is not asserted by the running tests. | `tests/browser/integration-states.mjs` |
| INT-002 | done | Dispatch only through the enforcing egress transport. | `tests/base/egress-delivery.test.ts:35` |
| INT-003 | partial | Attempt identity, finite retry and explicit reconciliation survive restart. Gap: `integration-states.mjs` is not loaded by push Verify or the named nightly job; full acceptance for durable attempt identity, bounded retries and explicit reconciliation is not asserted by the running tests. | `tests/browser/integration-states.mjs` |
| INT-004 | partial | Signed inbound notes verify bytes before parsing. Gap: `integration-states.mjs` is not loaded by push Verify or the named nightly job; full acceptance for raw-byte signature admission and idempotent private inbound notes is not asserted by the running tests. | `tests/browser/integration-states.mjs` |
| INT-005 | partial | Deliberate Linear or Jira create and link with held uncertain outcomes. Gap: `integration-states.mjs` is not loaded by push Verify or the named nightly job; full acceptance for Linear and Jira create/link and uncertain-outcome reconciliation is not asserted by the running tests. | `tests/browser/integration-states.mjs` |
| INT-006 | partial | Authenticated tracker receipts in source order never regress. Gap: `integration-states.mjs` is not loaded by push Verify or the named nightly job; full acceptance for authenticated source-ordered tracker receipts and private state is not asserted by the running tests. | `tests/browser/integration-states.mjs` |
| INT-007 | partial | At 1440 and 390 pixels: the owner uploads a PNG logo and an ICO favicon and sets the name Acme and dark theme; the portal header shows the logo and Acme in dark theme; the document icon link is the uploaded favicon on the same origin; the widget panel and changelog page show the logo; a follower's status email carries Acme and the logo; a PDF, an oversize PNG and an SVG with a script are refused; Product manager and Viewer branding writes answer 403; the portal makes no cross-origin request; export and restore keep the logo bytes and settings. The accent, description and Penny mark controls ship; company name is collected at setup and used by sender identity (OPS-005, NOTIFY-013). Applying it throughout the portal, uploaded branding, the website link, themes and Admin branding controls remain unproved. | `src/core/features/settings/branding.ts`; `tests/browser/integration-states.mjs` |
| MOB-001 | done | The browser journeys run at 1440 and 390 pixels with axe and layout checks (`tests/browser/acceptance-audit.mjs` viewports), and each new surface is added to them. | `tests/browser/acceptance-audit.mjs:7`; `tests/browser/operator-pages.mjs`; `tests/browser/requester-board.mjs` |
| MOB-002 | missing | A PWA install check passes; a push fixture delivers once; an offline capture syncs once on reconnect. | — |
| MOB-003 | missing | XCTest and Espresso UI tests against a test installation triage an item, and a share-sheet capture creates exactly one inbox item. | — |
| A11Y-001 | partial | Axe reports no serious or critical violation on every journey page at both widths; keyboard-only journeys submit, vote and triage; a recorded screen-reader review precedes the VPAT. | `tests/browser/acceptance-audit.mjs` |
| AGENT-001 | partial | A fixture problem with planted disconfirming evidence: both explanations cite real spans, the planted counter-evidence is surfaced, and rejecting an explanation keeps its evidence and history. | `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-002 | partial | With contradicting fixture tickets, proposals attach with spans; accepting links them as contradicting (EVID-004); crossing the threshold raises one review suggestion. | `src/core/features/learning/run.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-003 | partial | The proposal lists only consenting contacts; approval sends exactly the approved messages; poll answers return as evidence linked to the explanation. | `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-004 | partial | A fixture where loud small-business voters differ from silent Enterprise renewals: the report names the gap with cited records and no contact happens without approval. | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-005 | partial | Three fixture outcomes (adopted, shipped but unused, negative follow-up) produce keep, change and reverse recommendations citing their data; missing usage produces unknown. | `src/core/features/decisions/reviews.ts`; `tests/base/penny-decisions.test.ts`; `tests/base/learning-stage3.test.ts` |
| AGENT-006 | partial | A fixture slipped issue with a public ETA yields one draft and one owner reminder; dismissal records its reason; nothing is published. | `src/core/features/roadmap/update-drafts.ts`; `tests/browser/operator-pages-status.mjs` |
| AGENT-007 | missing | A fixture opportunity's brief cites that account's requests and uses only approved public wording in its suggested customer language. | — |
| AGENT-008 | partial | A scheduled run over a fixture week produces one brief per subscriber with resolvable citations; an unchanged week produces none and no model call. | `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts` |
| AGENT-009 | partial | For each agent, revoking mid-run stops further reads and model calls, erasure removes its derived work, and the audit log shows each action. | `src/core/features/learning/audit.ts`; `tests/base/learning-stage3.test.ts` |

### AI quality bars

`pnpm run eval:ai -- --set <name>` (AI-011) passes a capability only when every bar in its row is met on the named set. Figures are computed at the capability's default threshold unless the row says otherwise. Each model evaluation is recorded in this section as a dated receipt naming the set version and hash, model and prompt version; none is recorded yet.

| Clause | Set | Bars |
| --- | --- | --- |
| AI-001 | `duplicates-v1` | Precision ≥ 0.90 and recall ≥ 0.85 at the suggestion threshold; the true duplicate among the top five suggestions for ≥ 0.90 of positive pairs; recall on the paraphrase subset at least 0.15 above the lexical EVID-007 baseline on the same set. |
| AI-002 | `links-v1` | The labeled request among the three suggestions for ≥ 0.85 of items that have one; no suggestion above the threshold for ≥ 0.80 of items labeled none; auto-link precision ≥ 0.97 at the default auto-link threshold. |
| AI-003 | `merges-v1` | Sweep proposals cover ≥ 0.80 of labeled duplicate pairs with precision ≥ 0.85; automatic merges at the default `request.auto-merge.v1` threshold are wrongful in ≤ 0.5% of merges, and none crosses a board. |
| AI-004 | `extraction-v1` | Span-level precision ≥ 0.85 and recall ≥ 0.80 against labeled request moments; 100% of proposed spans byte-exact. |
| AI-005 | `themes-v1` | Macro-F1 ≥ 0.80 at area and theme level and ≥ 0.70 at sub-theme level against adjudicated labels; Cohen's kappa ≥ 90% of the recorded agreement between the two human labelers. |
| AI-007 | `spam-v1` | Spam and abuse precision ≥ 0.95 and recall ≥ 0.90; exposed personal data recall ≥ 0.95. |
| AI-008 | `redaction-v1` | Recall ≥ 0.99 for Social Security and payment card numbers and ≥ 0.95 for the other default kinds; precision ≥ 0.90. |

## AI configuration and cost · 21 October 2026

AI-010 uses owner-only `/api/operator/settings/ai` and the existing enforcing `PENNY_LEARNING_EGRESS` RPC for OpenAI Chat Completions and Anthropic Messages. Every configured capability selects a provider/catalog model, default Claude. Keys, optional Anthropic workspace ID, prices and output bounds remain installation bindings. The default monthly cap is $0; UTC calendar months reserve before egress and report metered input/output tokens at declared prices, rounded up once using exact decimal arithmetic. Ambiguous calls retain reservations. Learning's entire per-check ceiling, including declared source reads, fits inside both budgets before acquisition. Private notes, account names and commercial values are excluded at prompt construction by default; the owner's explicit private-context setting never grants role access.

The retitled `[AI-010 LEARN-002] configures providers, meters the monthly cap, preserves manual work and refuses invalid or revoked learning` extends the existing route integration case. It proves the Anthropic default, selected OpenAI, exact fixture usage (100 input / 500 output), prompt privacy, visible exhaustion, working lexical/manual/triage paths and secret-safe failure/revocation. The existing learning browser journey extends settings, reload persistence, exact metering, exhausted and unconfigured states at 1440/390 with accessibility and layout checks. Migration 0087 adds only product configuration and nonpersonal usage metadata, with no secret or prompt, and the existing populated release-upgrade journey preserves every prior row and original byte on repeat. Export/restore retains choices and usage, marks in-flight reservations uncertain, and leaves no personal usage copy to erase.

Test-budget reconciliation removes five redundant cases: the learning-only previous-head upgrade (the populated release-upgrade and authority-upgrade journeys cover its preservation assertions); the manually seeded verified/no-mail and unverified/no-mail cases in `local-capabilities.test.ts` (the complete `no-mail-identity.test.ts` routes cover them); the local archive-authority exclusion case in `custody.test.ts` (the complete hosted export covers it); and the private quiet-hours helper pin in `notifications.test.ts` (the real workspace-clock route/drain journey retains the boundaries and Sydney daylight-saving check). No required input refusal or user flow is dropped. No exception file is added.

Vitest collection corrected the initial inventory: 227 runnable cases (the reported 205 omitted generated variants), reduced to 200. Repeated matrix setup was consolidated in feedback-import, feedback-import-custody, feedback-import-uservoice, notifications, hosted-export, decision-loop-commit, local-capabilities and penny-erasure; every prior input variant and assertion still runs. Three additional duplicates were removed: the isolated pre-0009 Base upgrade (its legacy-session revocation assertions now run in the populated release upgrade), custody's inspect-only maintenance case (covered by the recovery and hosted-authority journeys), and local-adoption's no-provider capture case (its capabilities read now joins the existing deployed-mode journey). No budget exception is claimed.

Live AI-010 check, 21 October 2026 Australia/Brisbane (20 October 18:31Z): the held Anthropic key listed `claude-haiku-5-5` as its newest Haiku model in the existing RER workspace. Five read requests total (including workspace discovery and two refused model-list requests before supplying the required workspace header); zero Messages calls, zero input/output tokens, USD 0.000000. A public learning-run POST on the production-built local Worker, configured with that actual model/key and `max_tokens=600`, refused with `ai_budget_exhausted` before egress at a $0 installation cap. No key, response wording, provider object, hosted installation or CI secret was retained. The proof-only egress harness remains outside product source. Total run limits remain USD 0.50 and 30 requests; subsequent AI-006 usage is recorded separately below.

The same AI-010 integration case also covers a selected Orbit company whose name is absent from Penny accounts: with private context off neither that observation nor its copied purpose value reaches the model; the explicit owner setting permits it. Private learning corrections are likewise withheld by default. The existing learning fixtures explicitly enable private context when they exercise commercial CRM records and internal corrections; the browser makes that owner choice after proving the default-private and capped states. This retains the shipped learning flow under the installation policy.

Fresh installations represent the $0/private-off defaults without inserting a product settings row; the owner’s save creates or updates the singleton. The existing hosted Base archive journey also preserves an explicitly saved AI budget and private-context choice through empty-target restore. The build-derived deployment specification includes migration 0087.

## Cited summaries and reply drafts · 21 October 2026

AI-006 drafts summaries for requests, decisions and accounts from their evidence and discussion, and reply/status wording for comments and inbox evidence. Only native operator-authorized records enter context; AI-010 withholds private notes/account/commercial values by default. Every returned reference is resolved again against current stored records after the model call. Unknown references and model-supplied links are removed with a visible notice. A revoked native session, changed operator version or changed data epoch refuses a completed result while retaining its metered cost.

The retitled existing `[AI-006 EVID-006] resolves cited summaries and editable reply drafts while keeping private records out of publication and requester mail` integration case retains its entire public API/document/metadata/sitemap/mail isolation proof and adds all five contexts, stored citations, dropped unknown references, exact fixture cost (103 input / 211 output at 0.1/0.5 micro-dollars per token = 116 micro-dollars rounded once), private-name flags, refused private publication, explicit edited posting, zero automatic sends and in-flight revocation. The existing learning browser journey extends the same five draft screens and private-refused/edited/posted/public end states at 1440/390 with layout/accessibility checks. No new test case was added: collection remains200.

Draft wording is client state and never stored as a conversation or provider-side object. No additional migration is needed beyond0087: only its nonpersonal usage totals persist, and posted replies reuse native comment archive/erasure custody. Replies today are public request comments; this draft feature sends no email or connector reply. An unlinked inbox item can draft/edit immediately and uses existing linking/publication before posting to a public request discussion. NOTIFY-007 and connector/capture clauses CAP-003, CAP-004, CAP-005, CAP-006, CAP-019 and CAP-009 retain future connector/mail replies with explicit operator editing and sending, never auto-send, and a fresh private-value check before publication (ct ruling, 20 October 19:58Z). Current evidence and future obligations: AI-011 measured quality remains missing and none of its evaluation bars applies to AI-006; ROLE-001 remains missing and inherits restricted commercial-field roles, including this context and publication boundary. Current native operators share product access; the installation setting never grants a role new read access.

Live AI-006 / AI-010 check, 21 October 2026 Australia/Brisbane (20 October 19:52Z): `claude-haiku-5-5`, two Anthropic Messages calls through the public production-built local Worker, max_tokens600 each; 1,812 input tokens and 672 output tokens; USD 0.000518 from provider usage at USD0.10/MTok input and USD0.50/MTok output, rounded up once per call to micro-dollars. One summary and one reply draft had citations resolved to stored records; no reply was sent. Including the five earlier discovery reads, the whole run used 7 provider requests of the30 limit and USD 0.000518 of the USD0.50 cap. The earlier real-key $0-budget refusal remains recorded above. The forwarding harness stayed outside product code; no key, response wording, provider conversation object, hosted installation or CI secret was retained.
