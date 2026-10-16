# Product archive and guarded recovery

Native operators can download the complete bounded product archive and separate
erasure journal over authenticated HTTPS. Restore, erasure preview, erasure,
resume and cancel use the same maintenance and custody fences locally and
hosted. Every mutation requires a current native operator session, an explicit
Origin matching the configured APP_ORIGIN, and a request URL at that exact
origin. Requester tokens never grant operator authority. The private Data screen
and every API route independently require native operator authority. Downloads
use private/no-store headers.

The Data screen, local and hosted alike, does every step in the browser with your
signed-in session: download a backup (one file holding the archive and its
journal), restore one into an empty workspace, erase a person, request, evidence
item or account chosen by name after reviewing everything it removes, and move
saved Canny or UserVoice feedback in. No session file, copied cookie or command
is needed there, including when something stops. The `data:*` commands below are
the same operations for scripts and agents; they need an owner-only session file.

## Confirmed work finishes on the server

Once you confirm an erasure, a restore or a saved-feedback import, Penny finishes
it on the server; the tab can close at any point. The request that confirms it
runs the first steps, and Penny's runner does the rest: a Queue message wakes it
right away, the minute Cron checks for anything left, and opening the Data page
wakes it too. Coming back to the Data page shows what it is doing now (removing
the records, removing them from saved imports, deleting original files, or
restoring) or how it ended.

Each step runs under one claim with a 90-second lease. A step that stops
mid-way, for example when its Worker is cut off, keeps its claim until the lease
passes; the next runner then takes the claim over and returns the step to where
it can safely resume. Every write a step makes first checks its own claim in the
same transaction, so a stopped runner that wakes up late changes nothing, and no
step is applied twice. Erasure steps are single transactions or journaled Base
steps, file deletion is idempotent, and a restore applies its records in one
transaction.

The server continues the work as the operator who confirmed it, for as long as
that operator stays active at the same role and version; signing out or closing
the tab does not stop it. If that operator is removed or their role changes, or
a step fails three times in a row, the work stops and the Data page says so in
plain words with **Resume** (and **Cancel** while nothing has changed yet: an
erasure before any record is removed, or a restore before its records are
applied). Resuming continues it as the operator who pressed it. An erasure that
already removed the records can only be finished, never cancelled. A restore
keeps the uploaded backup on the server (its own file in R2, never treated as
an original file) until it ends; if that upload never finished, the restore ends
with nothing restored and the page asks for the backup again.

For a separate reversible saved-Canny trial, see [TRIAL.md](TRIAL.md).

## Archive and restoration

Use the script form of pnpm commands. Bare `pnpm import` is pnpm's lockfile
conversion command and does not restore Penny data.

```
npm run data:export -- private/archive.json --origin https://penny.example --session-file private/session.json
npm run data:journal -- private/latest-journal.json --origin https://penny.example --session-file private/session.json
```

Replace the example origin with the installation's exact HTTPS origin. Local
HTTP is accepted only for localhost, 127.0.0.1 or ::1. Paths, query strings,
fragments, URL credentials, foreign redirects and TLS downgrade are refused.
Only these commands need a session file; the Data page never does. The session file is a regular, owner-owned 0600 JSON file with exactly one
`cookie` property containing the existing native operator cookie. To obtain it, sign in to this installation as the owner. Open browser developer
tools, then Application (or Storage) → Cookies → the installation’s exact origin.
Find `__Host-operator_session` (local HTTP uses `operator_session_local`). Create
a private directory with mode 0700 and an empty session file with mode 0600
before opening it in a local text editor. Save `{"cookie":"__Host-operator_session=PASTE_VALUE_HERE"}`,
replacing only the placeholder with the cookie’s value. Do not use a requester
cookie or a bare value. Delete the file when finished; signing out or session
expiry invalidates it. Do not put the cookie in a command,
URL, environment variable, screenshot or archive. Never commit the session file.
Symlink/hard-link inputs, unsafe parents and permissive file modes are refused.
The CLI reports canned error codes, counts, hashes and paths, never session values.

Export writes original attachment bytes and all classified product tables, plus
`.erasure-journal.json`. Files are 0600; newly created parent directories are 0700.
Archives contain private evidence: retain them privately, never publish them.
`src/core/features/data/schema-inventory.json` classifies product, journal and
installation tables. New/unclassified tables, missing product tables or changed
column inventories refuse export. New product migrations must extend this
inventory and retain export/erasure coverage.

Version 1 carries exact current schema identity, canonical SHA256 integrity,
origin, erasure epoch, table/column inventory, primary keys, and original R2 file
bytes with SHA256, MIME type and size. Every tracked attachment must have bytes;
untracked R2 objects block export. Hashes detect corruption, not malicious
rewriting or authenticity. Credentials are deliberately disabled in the archive:
operator/requester sessions are revoked, links consumed, and synthetic outbox
capabilities disabled. Pending requester actions are claimed/disabled, and queued notification batches/outbox effects are held as unknown for explicit review; restore does not replay them. Business identity/history remains. Migration ledger and
operational lock/runner bookkeeping belong to the target, not the business
archive. The separate journal preserves erasure fences.

Public entry rate limits and ordinary sign-in/verification mail attempt history
also belong to the installation. Migration 0055 gives them independent tables,
so rate admission and durable mail receipts continue during product maintenance.
The mail history retains only an opaque attempt reference, feature, transport,
outcome and timestamps; product exports do not transfer this authentication custody.

Authenticated archive limits: 2,000 business rows, 4 MiB record JSON, 10 MiB per file, 20 MiB original
files total, 32 MiB request/archive input and 33 MiB combined CLI response. These are bounded local review limits,
not tested production capacities. Reads stop on an overflow row; no truncated success is returned. Unknown versions/schema, invalid keys/FKs,
corrupt/missing bytes and unsafe native public slugs fail before application.
The separate erasure journal refuses above 20,000 tombstones or 24 MiB JSON.
Export and restore both refuse unfinished request or evidence upload reservations;
recover or discard those uploads before taking a restorable archive.

Local setup and import apply additive migrations without seeding records or creating
remote resources, and every local command uses the canonical `.wrangler/state`. Start the
emitted Worker against that same store and sign in through the native owner
path documented in README.md. Restore requires an otherwise empty business
target and empty R2 bucket. Destination Base authority and credentials remain
in installation custody; they are never replaced with source authority. For
hosted operations use the destination's exact configured HTTPS origin in the same
`data:*` commands below; the source-only, local TLS proof covers this source path.
The local `import` dispatcher and authenticated `data:import` remain distinct
archive formats.

```
npm run data:import -- private/archive.json --journal private/latest-source-journal.json --origin http://localhost:15300 --session-file private/destination-session.json
# Interrupted cleanup / restore:
npm run data:status -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
npm run data:import -- private/archive.json --journal private/latest-source-journal.json --resume <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
npm run data:abort-restore -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
```

A mandatory separately supplied *latest* source journal must match the archive.
Known destinations reject older epochs/journal rollback and tombstoned keys.
A fresh destination cannot independently prove that an operator-carried journal
is the latest source journal: independently retain/obtain the latest journal
before disaster restoration. An old archive plus its old journal on a brand new
store is not globally prevented. Cryptographic external continuity is not
implemented; DATA-003 remains open beyond the verified local fence behavior.
Raw Wrangler SQL import bypasses these product fences and is not this workflow.

A durable maintenance lock prevents ordinary application writes while exporting
or applying data. Operator session use remains available for recovery admission.
Original R2 files are staged before one atomic D1 graph application. Fault cleanup
removes only files owned by that operation. Ownership is durably recorded only
after empty-target/bucket validation; interruption before validation never grants
permission to overwrite or delete pre-existing bytes. Incomplete cleanup keeps the lock and
operation metadata; no completion is reported. A committed D1 operation survives
an ambiguous response without deleting its valid R2 bytes. Restored credentials
cannot transfer admission; sign in again.

## Bounded erasure

Roots supported: requesters, requests, evidence items, accounts and removed
operators. Preview shows dependent row counts, file counts and ambiguous
copies. Erasure checks the preview hash again, follows FK/opaque-ID provenance,
removes linked evidence/history/custom fields, anonymises retained audit references
and nested details, appends opaque PK tombstones, and removes original R2 files.
The UI and CLI report complete only after file cleanup; faults keep a resumable
operation. Auth links/outbox and requester sessions associated with selected
identities are included. Any overlap with a current operator's identity blocks
erasure.

A removed operator (`operators` root) is redacted in place so the work they
attributed keeps one anonymous author: the product and Base operator rows keep
only their IDs under the label "Erased operator", copies of their name in release,
comment and request attribution take that label, their sign-in links, sessions,
rate entries, identity-provider links, mail-event receipts and review-mail
suppression are deleted, mail attempts lose the address, and audit details that
hold their address, or that are by or about them and name them, are cleared.
Another person's audit row that only repeats their display name is listed in the
preview with its action and time; the owner decides each one in the erase request
(`auditCopies`: `unrelated` keeps it unchanged, `clear` clears its details), and the
erasure's audit entry records both lists. Erasure waits until every listed row has
a decision; more than 20 such rows, or any other copy of the address, still block. Their notes, decisions and other records stay. A current
operator is refused with `erasure_operator_active`: remove them in Settings
first. Any other row holding their address is an ambiguous copy that blocks the
erasure. An opaque redaction checkpoint advances the journal, so the latest
journal refuses any older archive.

The selected native graph is read in bounded SQL frontiers; unrelated import
plans and original bodies are not loaded into JavaScript. Refusal limits are
20,000 selected/candidate rows, 24 MiB row JSON, 512 KiB frontier metadata and
2,000 candidates from any one table per scan. A large unrelated history does
not consume the whole-product authenticated archive allowance. Import privacy
cleanup withdraws the complete affected original bundle, then redacts normalized
copies and installs opaque replay fences in bounded resumable steps. The workspace
stays locked between steps. A receipt explicitly reports withdrawn originals.

New saved imports keep mapping inputs out of retained plans and use byte-bounded
stream pages for larger normalized histories, including small record counts.
Compatible older jobs remove the extra encoded input copy in a guarded atomic
custody update. Authenticated export and restore also clean completed historical
erasures whose native target is already absent; un-erased historical jobs keep
their original custody bytes. A cleanup too large for one batch publishes
through Base's bounded private staging; a resume clears any stage left by an
interrupted attempt before starting again.

Older Penny versions kept large saved imports as one flat plan with a copy of
the supplied files. Base's import kit (rer 0.2.20) erases a person from such a
plan in journaled bounded steps: its private stage continues across resume
requests from a durable progress journal, so a plan near the 24 MiB limit
completes, and only the final publication changes custody, once. A step that
cannot fit one request is refused by a read-only admission check with
`feedback_legacy_erasure_upgrade_required` before any operation, row or file
changes; raising limits or dropping custody checks is not a supported recovery.
Releases since `v0.0.0` stream large histories in bounded pages and never create
such plans.

Sensitive literal matches in unrelated rows block erasure instead of deleting
unrelated business data. Known text/JSON copies, filenames and source labels are
checked, including short values. Legacy encoded file copies are checked for literal matches as well. This does not infer arbitrary semantic aliases,
transformed copies or data outside current tables. Resolve ambiguous provenance
before erasing. Universal per-entity erasure and timed production cleanup are
unverified and BASE-DATA-003 remains open.

```
npm run data:erase-preview -- <table> <id> private/plan.json --origin http://localhost:15300 --session-file private/session.json
npm run data:erase -- private/plan.json --journal-out private/latest-journal.json --origin http://localhost:15300 --session-file private/session.json
npm run data:resume-erasure -- <operation-id> --journal-out private/latest-journal.json --origin http://localhost:15300 --session-file private/session.json
```

A large preview may return HTTP 202 with an encrypted `continuation`. The app and
`data:erase-preview` command follow it automatically until the complete HTTP 200
preview is ready. Other HTTP clients send the same table and ID with that
continuation. It carries the already reviewed native scope and copy-search
results, bound to the current session, installation secret and selected root.
It expires after one hour and works across Worker restarts. A changed record,
schema, import custody or session invalidates the scan; start a new preview in
that case. The final review hash and copy holds retain the same meaning, and
erasure still checks the complete plan before removal. Migration 0050 tracks
Penny's import metadata changes in an installation-only counter; it preserves
portable product rows and their archive schema.

A stopped step is taken over automatically once its lease passes (see
*Confirmed work finishes on the server*); the Data page's Resume does the same on
request. For scripts, `data:resume-erasure` and `data:import --resume` resume an
operation and `data:abort-pending-erasure` / `data:abort-restore` cancel one that
has not changed anything yet. `data:recover-runner` remains for a hosted export,
whose download is driven by the owner's browser:

```
npm run data:recover-runner -- <id> --expected-status running --prior-runner-stopped --origin http://localhost:15300 --session-file private/session.json
npm run data:abort-export -- <id> --prior-runner-stopped --origin http://localhost:15300 --session-file private/session.json
npm run data:abort-pending-erasure -- <id> --prior-runner-stopped --origin http://localhost:15300 --session-file private/session.json
```

Only an unapplied erasure can be cancelled. Once its records are removed, the
saved-import and file cleanup always run to completion.

Migration 0004 adds fences and repairs native slugs using durable submission
audit provenance even after submission-key expiry. Existing 0001–0003 remain
unchanged. Stage 0 curated URLs and evidence identity are preserved.

## Verification boundary

Worker tests cover exact original bytes and all-table roundtrip, invalid archives,
empty-target custody, FK validation, R2 and D1 late faults/rollback, post-commit
response faults, exclusive runners and controlled interruption recovery,
erasure dependencies/audit/custom fields, ambiguous-copy and operator holds,
old-journal/tombstone rejection, private admission and CSRF. See the final archive
handoff for actual command/browser receipts. This is partial evidence for
BASE-DATA-001/003 and DATA-001/003; it does not complete the universal clauses.

## Attachment writers and maintenance admission

Migration 0008 makes file-writer admission mutually exclusive with maintenance.
An upload or recovery claims its reservation before calling R2 and retains that
claim until the storage promise settles. Export, restore and erasure refuse
`attachment_writer_active` while any upload is active; no erasure operation is
reported complete or applied in that case. After it settles, preview again and
run erasure against the current graph. Original pending file keys remain in custody.

If an upload process genuinely stopped before releasing its claim, the operator
recovery form requires explicit confirmation that it can no longer write. This
manual recovery has no timed takeover, and ordinary erasure does not release
writers. See [the final repair record](requester-final-repair.md).

## Base authentication store boundary — 7 October 2026

The bounded local archive contains product data and product operator attribution;
`oa_*` Base identity, bootstrap, session, token, issuer-association and rate-limit
rows are excluded. Restoring product data keeps the destination's independently
bootstrapped Base authority, so source Base credentials and privileges never move
with an archive. A fresh destination must complete its own Base bootstrap before
an operator can restore. Historical product attribution survives; existing
operator email admission remains in the owner-controlled server configuration.
This is not an installation-level identity backup: operator memberships, roles
and sign-in history are authority, re-established by invitation at the
destination, while every product record (including each operator's identity in
`operators`) travels. A restored installation adopts the source's erasure origin,
epoch and tombstones, so its next erasure continues the same journal and an
archive older than that erasure is refused with the latest journal. Migration 0009 separately imports predecessor
operator identities and revokes all preceding synthetic auth credentials.
Authenticated read/recovery admission reuses existing product attribution without
writing the maintenance-fenced `operators` table.

## Notification event custody

Migration 0011 adds personal-data tables `notification_link_epochs` (address and
scope generations) and `mail_event_records` (Base event receipts and recipient
state, including recipient addresses in JSON). Both carry address foreign keys;
mail records also reference their notification batch. The schema-discovered
archive includes both. Requester erasure follows these foreign keys, removes
recipient snapshots and event-message bindings on `notification_attempts`, and
erases the retained JSON with the owning address/batch. These are durable records,
not a process cache. Maintenance guards fence writes during archive/erasure.
Permission rows carry `suppressed_at` without revoking or deleting consent.
Successful native email re-verification clears both markers atomically and advances
an address verification generation; late facts from an earlier send generation
cannot suppress it again. Replayed Base receipts never reapply suppression.

Development capture uses `rer_mail_development_outbox` for recipient addresses and sign-in message bodies. It is local-only (production never stores it), limited by Base to 100 messages and seven days as expiring credential state (BASELINE.md, BASE-DATA-002 scope), excluded entirely from product archives and restore input, and every capture containing an erased requester's or operator's address, as a recipient or in a body, is deleted in the erasure transaction. It must never transfer or resurrect sign-in credentials. `oa_invitation_cancellations` is Base admission history and stays in the non-portable Base authority store with all other `oa_*` tables.

## Decision-loop records

Evidence provenance includes nullable `evidence_items.named_speaker`. It is recorded only when supplied, included in private archives, and treated as personal literal context during erasure. It is absent from public projections.

Migration 0013 adds `decision_bet_snapshots` (private titles, comparison dimensions and disposition), `roadmap_mapping_history` (request provenance), `roadmap_evidence_links` (internal evidence provenance), `roadmap_update_versions` (approved safe wording and approval witnesses, with operator attribution), and `roadmap_update_targets` (the exact approved request-mapping witnesses). These tables participate in schema-discovered export/restore and carry maintenance guards. Decision revisions retain the committed owner and item reference. Public roadmap identities are independently generated publication slugs, never internal item slugs.

Erasure follows evidence/version snapshot foreign keys and removes the corresponding bet comparison snapshot even after evidence has been unlinked. Snapshot immutability does not override erasure. Request erasure removes its mapping history and draft target witness; independent approved roadmap wording remains. Ambiguous personal literal copies still block erasure rather than deleting unrelated records. The existing all-table ownership suite remains unchanged; populated loop-table roundtrip and snapshot erasure have additional Worker coverage in `decision-loop-data.test.ts`. Executed proof is recorded separately in [the decision-loop acceptance record](decision-loop-acceptance.md).

## Status versions and release delivery

The additive release migration retains earlier migrations and prior notification rows. `roadmap_update_versions` holds approved public wording and its transition/approval witness; it contains no recipient identifiers. `roadmap_update_targets` preserves each approved mapping witness, and `roadmap_update_histories` links the explicitly published version to each request, including a true Withdrawn projection. `roadmap_update_contexts` is personal: it owns the chosen identity/address and that identity's eligible request contexts. A version's operator counts follow its actual notification intent and eventual batch, not historical outbox aliases.

Releases reuse `release_recipient_snapshots`. Its address/email/verification header and `release_recipient_contexts` children contain personal delivery custody. `release_draft_mappings` holds the draft's explicit mapping witnesses; `release_target_snapshots` freezes the publication's complete targets. Public release/version rows contain no recipient/context lists. Publication inserts every header and child before dispatcher-visible commands in the same atomic batch. Later follow, identity merge, mapping and preference edits do not rewrite a published snapshot; current eligibility may suppress a delivery or remove a context from its mail. Erasure takes precedence over snapshot immutability.

`notification_outbox` owns each release's stable recipient command, and `notification_outbox_attempts` owns its claims, exact recipient email/verification generation, provider receipts and failure states. Genuine Base `mail_event_records` now has either batch or release-outbox custody, always with the recipient address FK. Its signed receipt/state JSON is personal. `notification_delivery_facts` belongs to the original request batch and records provider outcomes for status counts. Existing `notification_link_epochs` remains address-owned and is erased with that address. Schema discovery exports and restores all these tables, including populated child rows. Requester erasure follows their FKs and copied identifiers, removes all headers, contexts, attempts and receipt JSON, and retains safe published parent wording. The unchanged generic ambiguous-copy refusal still protects unowned private copies.

Maintenance/restore/erasure and identity merge cannot overlap an active release sending claim. Interrupted claims become unknown without retry. Export normalizes queued release commands to `unknown` with `restored_delivery_review_required`, preventing restore from replaying a provider effect; the source queue is unchanged. Archives retain exact schema identity and the erasure journal; stale archives cannot restore erased authority. Historical outbox rows lack the new release-snapshot ownership link and never become live commands during upgrade.

An explicitly approved public request title/description or roadmap title/summary may also appear in a published release or status body. Erasure retains that independently published public phrase; this narrowly applies to published public title/body/problem fields. Private literals, addresses and copied opaque identity IDs remain subject to the generic copy refusal. The archive schema fingerprint continues to describe table SQL and shape, as before this migration. The deployment migration ledger hashes the complete migration SQL (including every trigger/index); upgrade tests assert that ledger and exercise the new guards. No archive format change is introduced solely to duplicate that ledger.

Migration 0015 adds `snapshot_sealed_at` on release and roadmap-update versions and `discarded_at` on stale roadmap drafts. These timestamps carry no new recipient data. Schema discovery includes them in archives. Every published pre-upgrade aggregate is sealed without changing its original fields; completed publication refuses later child insertions as well as updates and deletions. Controlled restore and erasure retain their existing applying-phase authority. Discarding a stale draft retains its wording, witnesses and operator audit record rather than deleting history.

Migration 0016 adds `notification_intents.restoration_hold_at`. Export stamps
archived intents, and restore retains that hold; unbatched historical intents
cannot form a new send batch. Queued batches carry an explicit restore-review hold. A drain moves eligible
held batches to unknown without an attempt; ineligible batches become suppressed.
Release outbox entries become unknown. Reconciliation is explicit. New native events retain their
normal consent checks. Never run a source version predating this migration
against a restored installation with a mail drain enabled.

## Product integrations and restored effects

The inventory includes product integration events/targets, immutable delivery
attempts/resolutions/replay receipts, tracker links/source-state/commands and safe
portal branding, plus the portal embedding settings and the integration
destinations and tracker connections themselves. Destinations and connections
arrive revoked: their endpoints, provider keys and signing material stay in
installation tables, and their operator authority stays with the source, so a
restored installation creates new ones. API keys and their issuance/usage history
are credential custody and are excluded. Export marks product events and tracker
commands held and queued/sending shared deliveries uncertain; no import, repeat,
restore or undo initiates a provider effect. Original import files and provenance
remain private, hash-bound and governed by the latest erasure journal. Graph
references and copied identifiers participate in erasure; ambiguous unrelated
personal copies refuse erasure instead of being silently retained or deleted.
Restore preserves destination authority and requires provider reconfiguration
and deliberate uncertainty reconciliation. New native work has its own identity.

## Maintained archive commands

`pnpm run export -- --output exports/penny.rer` and `pnpm run import -- --input
exports/penny.rer --yes` use Base portability directly, with Penny's schema
classification, effect normalization, saved-import validation and erasure policy.
Every original FILES object must match attachment custody. A separate private
`exports/penny.rer.erasure-journal.json` is mandatory at import and must be the
source's latest journal; later erasure makes an older archive refuse. On a fresh
store, `--journal exports/later.rer` names a later archive of the same installation:
an archive made before any erasure that archive's journals record is refused whole
(`erasure_epoch`), and the later archive's own `.erasure-journal.json` must sit
beside it. Native journal identity and tombstones restore atomically with domain
rows. Install fresh owner authority after restore. A failed transfer prints its stage, the error codes and, for a code an
operator can act on, one fixed sentence saying why; never a name or a value.

A running installation also supports the same Base archive through:

```sh
rer export --target remote --origin https://penny.example --session-file private/owner.cookie --output exports/hosted-penny.rer
```

The session path is relative to this checkout. The private session file must be
an owner-owned regular file with mode 0600,
containing one raw native owner cookie (`__Host-operator_session=…`; loopback
uses its native local cookie). This differs from the JSON session input used by
`data:export`. Never paste a cookie into a command line. The command checks
current owner authority on every request, refuses redirects and creates both
the archive and its `.erasure-journal.json` sidecar from the same verified
snapshot. Keep both files together. `rer import --input exports/hosted-penny.rer
--yes` restores them into an empty local installation; remote import is not
exposed. No deployment/provider credentials are needed for export.

Hosted **Data → Export workspace** prepares this same archive and matching
journal, with separate download links visible to a signed-in native owner.
Snapshot preparation and verification can take about two minutes; larger workspaces
may take longer. The screen names the current stage, shows saved archive parts and
elapsed time, and the server retains completed parts across reloads. The browser
drives the export, so closing its tab mid-way leaves the operation holding the workspace. The owner who started it then sees **Export in
progress** on the Data page: **Resume export** finishes the same Base job,
verifies it and offers both downloads; **Abort export** removes the partial
snapshot and releases the workspace. Use them only when no other tab or device
is still preparing that export. A step whose Worker was cancelled mid-request
never released its runner; both buttons first release it, which is the same
owner confirmation `data:recover-runner --prior-runner-stopped` gives, and every
later write of the cancelled step stays fenced by its runner token. No partial
archive is offered: downloads appear only after the complete archive passes
verification. The completed snapshot also survives a reload: **Export ready to
download** lets the owner resume the same files. Save both files, then choose
**Finish export** to remove the snapshot and release the workspace. Data changes
stay paused until Finish export or Abort export; a failed browser request does not
discard the saved job. Browser download links themselves last only for that page
visit. While any data operation holds the workspace, guarded writes such
as **Publish release** answer 409 `data_operation_in_progress` naming the
operation and the next step. Restore and erasure remain the existing guarded
commands. The remote CLI removes its source snapshots after successful transfer;
the browser removes them on Finish export or Abort export. If a session expires or cleanup fails, the
workspace remains locked: preserve `archive.transfer.json` inside the unique
0700 `<output>.pending-*` staging directory (the error names the exact checkpoint
path), stop the prior exporter, and use the current owner's existing
`data:abort-export` recovery command for the active Data operation. Recovery
removes the Base snapshot before releasing maintenance. There is no timed
unlock of a possibly running exporter. Archive and journal publication each
refuse to overwrite existing files. If archive publication fails after the
journal was published, the command reports that partial result and preserves
the sidecar; inspect the existing files and choose a fresh output path for
another export. Cleanup only removes files inside this run's private directory.

The local command's refusal limits are 500,000 domain rows and 512 MiB record
JSON, with the same 10 MiB individual-file and 20 MiB total-original-file limits.
These command limits differ from the authenticated JSON archive above; neither
is a hosted capacity claim. Saved import pages and exact source chunks travel
with the job, receipt metadata and opaque fences.

The previous authenticated archive format remains available as `pnpm run
data:export -- FILE --origin ORIGIN --session-file FILE` and `npm run data:import
-- FILE --journal FILE --origin ORIGIN --session-file FILE`. These are distinct
formats. Existing journal and erasure commands are unchanged. Migration 0025
adds Base portability bookkeeping only; applied migrations remain byte-identical.
Local restore/archive equivalence and populated-upgrade proof are required
before accepting this candidate. Authenticated hosted `data:import` is covered
only by the source-only, local TLS proof; acceptance on a real hosted installation
requires the owner procedure. The local `import` dispatcher does not become a
remote command.
# Import custody schema evolution

Migration `0026_import_custody_evolution.sql` installs the maintained import-kit
erasure, stream-origin, preparation, staging and custody-revision schema exports,
plus Penny's maintenance admission on each new table. Existing migration bytes,
job fingerprints, source plans and original files are preserved. Apply the full
numbered migration inventory before starting this source. Source rollback keeps
the expanded schema; it must not run an older importer against new custody.

Penny continues to expose ordinary reviewed saved-file jobs. Product archives
include their exact original bytes, plans, indexes, custody revisions and opaque
erasure fences. Current jobs release creation-only witnesses after creation;
legacy jobs can retain their complete exact witnesses. Restore copies those
records in one admitted transaction and reinstalls the maintained custody
triggers before checking the result. It does not replay creation or fabricate
witnesses. Destination authority remains separate. Penny's reviewed large-history
streams carry their pages and product bundle metadata. Unowned streams or private
preparation/publication state refuse archive completion visibly. Re-export after migration: an older
archive has a different schema and is not silently upgraded during restore.

Migration 0034 adds reviewed bundle/receipt metadata, exact original chunks and
native revision fences for conflict-preserving undo. Migration 0035 adds the
withdrawn-original state, installation-only resumable erasure worklist and
revision-bound reversal scan progress. Neither
changes applied predecessor SQL. The worklist transfers no source authority.
The operation status constraint is extended for import-cleanup phases by copying
the existing operation rows and apply claims into the replacement schema.

## Penny clause history, 11 October 2026

The additive evidence, release and decision-review migrations retain all applied predecessors. `evidence_items.release_id` connects private post-release evidence. `evidence_attachment_uploads` owns pending originals and their digest and writer state; an active writer fences maintenance, and an unfinished upload refuses export until recovered. Final attachments reuse `attachments` and remain operator-only. Every evidence wording version is exported, and evidence erasure removes its versions, final and pending originals, and commitment snapshot copies.

Release corrections reuse `release_versions` with original-publication ancestry and a delivery-request timestamp. Earlier versions and original target/recipient contexts remain private history; a new correction queues no mail until explicitly sent. `release_outcomes` holds immutable answer revisions, with only the latest answer counted per original release, requester and target. Subscribe-all reuses timestamped `requester_update_permissions` for the verified address. Requester erasure removes these permissions, all answer revisions, sessions and owned notification custody without removing independent public wording.

`decision_reviews` stores the private review note and next date or revision. `decision_review_notifications` stores one reminder generation, owner attribution, durable email state and dismissal. Both are classified product records. Restored queued, sending or unknown reminders become held with no replay. Decision erasure follows their declared dependencies; operator authority remains installation-owned and protected.

Penny's dependent closure follows erasure-1's memo: declare the new personal edges, fence every selected row with its own tombstone before any deletion cascades, delete rows before original files, and mark completion only after file cleanup. A random surviving audit reference replaces erased identity and private audit details. Interrupted file cleanup keeps maintenance active and needs authenticated resume. Older journals, stale archives and tombstoned records are refused; neither unmerge nor later decision/release revision can recreate them. Ambiguous unrelated private copies and protected operator attribution still refuse erasure. These are Penny's bounded roots and existing journal rules, not universal cross-installation journal continuity.
