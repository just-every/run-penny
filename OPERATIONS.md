# Penny operations

`OPERATIONS.json` v2 describes the shipped commands and their input files, and
opts Penny into the first-party seed command contract through
`scripts/installer/local.mjs`. `rer describe`, `check --profile
first-party` and `doctor` work without installed dependencies or configuration;
Base's maintained inspector checks the declared files, environment sources and
loops. The descriptor has no executable `configuration.module`. Local
development capture needs no hosted mail provider.

Hosted input readiness is a separate, offline inspection of a named profile:
`pnpm run operations -- check --profile owner-sendgrid` (or `owner-resend`,
`owner-later`) for the owner-account path, `runtime-sendgrid` or `runtime-resend`
for configured application bindings, `local` for local use, and
`artifact-prepare`, `artifact-sendgrid` or `artifact-resend` for the separate
artifact controller. `check --profile NAME` and `doctor --profile NAME` are the
same inspection: JSON on stdout, a plain summary on stderr, exit 0 when the
selected inputs pass and 1 when any is missing or invalid. Runtime profiles
validate a credential-free HTTPS origin and an explicit production/preview mode.
Missing-input guidance names every input and its source without values. The
`owner-later` profile declares its worker drain only, because no mail provider
loop exists until one is configured, and still rejects partial sender/key
configuration. A key for another provider cannot satisfy the selected provider;
partial or conflicting mail configuration is refused and there is no provider
fallback. Inputs, provider authority, remote health, inboxes and Cron execution
need separate proof.

| Command | Actual effect |
| --- | --- |
| `rer install` | Frozen dependency install with the pinned pnpm and lockfile; no setup. |
| `rer setup --owner-email EMAIL` | Build, apply every migration, save private settings and claim the first native owner with an empty workspace, then stop the temporary app. Repeats preserve the owner, origin, exact private settings and data. |
| `rer dev` | Foreground Vite with assets and HMR on the saved loopback origin; prints `RER_READY` and one-click `RER_OPEN` sign-in once health passes. |
| `rer preview` | Fixed production output on the same state; managed, with idle timeout and explicit `--stop`. |
| `rer build` | Production Worker and assets with private local settings excluded and restored. |
| `rer verify` | The full verification: structural check, source and Base custody, tests, type, lint, build and the literal README journey; no deployment. |
| `rer reset --yes` | Confirmed removal of the printed local inventory only; refuses while anything runs. |
| `rer export --output FILE`, `import --input FILE --yes` | Local archive of Penny's domain data and original files with a separate latest erasure journal, and its restore into an empty installation. |
| `node scripts/portability/remote-export.mjs ORIGIN SESSION_FILE OUTPUT_FILE` | From a checkout with dependencies installed, Penny’s existing helper uses a private 0600 raw native-owner cookie file to download hosted D1 records and actual R2 file bytes into the verified archive and paired erasure journal. Local installs use package-mode `rer export` / `rer import`; `rer export` is local-only and refuses a hosted origin, per [Base’s hosted-data rule](https://github.com/runeditrun/base/blob/main/export/RUN-LOCALLY.md#if-hosted-deployment-stops). Restore remains local. See [data ownership](docs/data-ownership.md#maintained-archive-commands) for session-file custody. |
| `rer deploy [--environment NAME] [--dry-run]` | Owner-account build, reconcile, migrate and health; a dry run builds locally and reads target configuration without a provider write. |
| `rer doctor`, `describe`, `check`, `release` | Local diagnostics, capability description, structural check and the maintained Base release producer, which needs explicit authorized inputs. |
| `npm run deploy:health` | Owner-account identity, configuration and health against the private saved state; accepts `--environment NAME`. |
| `pnpm run artifact:prepare`, `artifact:deploy`, `artifact:health` | The separate disposable controller: credential-free packaging of built committed source, scoped resources with hash-ledger migrations and upload, and its health. |
| `npm run data:export -- …`, `data:import -- …`, `data:journal -- …` and the erasure and recovery commands in [data ownership](docs/data-ownership.md) | Authenticated archive, journal and erasure operations against a running installation. |
| `pnpm run feedback:import -- …`, `pnpm feedback:status` | Saved feedback history (below) and the documented-format entry check. |
| `pnpm source:lock`, `source:check`, `verify:base-source` | Capture and check the actual tracked bytes, modes, tool identity and Base comparison snapshots. |

The package scripts `setup dev build verify reset deploy export import release
doctor describe check` are exactly `rer VERB`;
`deps` is `install` and `rer` is the bare dispatcher. Use `pnpm run VERB --
FLAGS`.

## Local state

Terminal setup uses `http://127.0.0.1:8787`; an initial `--port` changes it.
`dev` prints `RER_OPEN`, which carries the checkout's dev key
(`.rer/local/dev-key.env`) in its fragment and signs the browser in as the owner
(`--as teammate|signed-out` for another identity). Dev sign-in and dev sessions
answer only behind that key; `reset --yes` removes it and the next `setup` makes a new one.
API keys minted in a dev session are recorded as dev-minted (migration 0029),
work only behind the key and never travel in an archive. The owner lands on
`/setup`, the first-run setup, until it is finished; afterwards `/setup` opens the
app.

Canonical local data is `.wrangler/state`. `.rer/local` holds the CLI's
bookkeeping and `.seed/installer` the installer's drafts and logs. `.dev.vars` is
0600; generated authority is saved once and there is no credential-rotating
force option. Repeat setup uses the saved owner, origin, timezone and data and
refuses conflicting owners or linked files and directories. Directories holding
secrets are 0700. No Cloudflare or provider account is needed locally, no remote
resource is created and default startup remains empty. `reset` removes the local
data, owner, sessions, outbox, `.rer/local`, `.seed/installer` and the generated
settings and their backups, and keeps source, lockfiles, `rer-setup.json`,
exports and `.rer/deploy` receipts.

### Local state placement

Penny keeps its local data only in `.wrangler/state`. A sibling
`.penny-local-state-<checkout-name>` folder, or a `PENNY_LOCAL_STATE` path
elsewhere, makes every command except help, describe, check, doctor and release
refuse before any change (exit 4). Penny never reads, moves or deletes that
store; place it yourself:

1. Stop every process that owns either store, and keep `.dev.vars` (and
   `.dev.vars.previous`) with their bytes and owner-only permissions.
2. Make an independent backup of the other store, including every D1 and R2
   directory, outside both stores. A D1 SQL dump alone cannot preserve original
   files.
3. If only the other store holds this installation and `.wrangler/state` does not
   exist, move the whole directory to `.wrangler/state`, preserving file modes.
   Do not do this if either path is a symlink or the destination exists, and
   unset `PENNY_LOCAL_STATE`.
4. If both stores exist, keep both and identify the authoritative installation by
   its owner, domain rows, erasure journal and original files. Never merge
   SQLite directories or delete one to unblock a command.

Then run `setup` again: it applies only unapplied migrations and checks the native
active owner before bootstrap, and a different owner or saved origin refuses.

Every setup, dev, build, export, import and deploy command uses Base's maintained
command store. Redaction happens before bounded diagnostic tails. Failure and
cancellation await captured output and birth-checked descendant cleanup,
including detached children that changed directory or outlived their leader; an
unverifiable owned process is a visible cleanup failure. The summary names the
private command log.

## Owner-account hosting

Owner-account hosting requires `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` explicitly; ambient Wrangler login is not used. Give the
account-scoped token Workers Scripts edit, D1 edit, R2 Storage edit and Queues edit
permissions for the chosen account. Supply the first `OPERATOR_EMAIL` and explicit
`MAIL_PROVIDER` (`sendgrid` or `resend` for `rer deploy`, which refuses a
deployment without sign-in email; the Assisted installer also accepts `later`).
Both providers need a verified `MAIL_FROM` and the provider's key as
`MAIL_API_KEY`. `deploy.json` declares these mail inputs as secrets, so rer's
sign-in preflight reads them before building. Optional `WORKSPACE_TIMEZONE` is an IANA name and defaults to UTC.
Deploy also checks the expected account workers.dev origin before writes. Only
dependency and build commands see the credential-stripped build environment;
provider credentials reach the deployment command after those finish.

`deploy.json` declares D1 `DB`, R2 `FILES`, Queue `JOBS` with its mail consumer and the minute
Cron (`* * * * *`), with no Durable Object. Publication wakes the Queue mail consumer immediately; it does not wait for the first Cron tick. The Cron is the recovery backstop. The first scheduled run can
take up to about two hours on some accounts, because a new schedule starts at the account's
next provider refresh (the deploy prints this). Judge delivery from the handler's own D1 rows,
`notification_batches`, not from Cloudflare's scheduled-analytics, which can name a new Worker
`__unknown__`. Cron registration and its readback are unchanged. Following Base's
owner-account declaration contract, it declares bindings rather than resource
names or an environment allowlist. `--environment NAME` selects a named install;
omitting it selects `production`. Production runs with `PENNY_ENVIRONMENT=production`;
`preview` and other named installs run with `PENNY_ENVIRONMENT=preview`, with the
same hosted HTTPS and authority requirements. Names derive from `just-every/penny`
and the chosen environment: Worker `penny-NAME`, D1 `penny-NAME-db`, R2
`penny-NAME-files` and Queue `penny-NAME-jobs`. Names must satisfy Base's environment
validation; invalid names refuse before build, private settings or provider calls.
The account supplies that Worker's `APP_ORIGIN`; `PENNY_EXPECTED_ORIGIN`, when
supplied, must match that environment's account workers.dev origin.

Runtime `AUTH_SECRET` and one-time `SETUP_TOKEN` are generated independently for
each install. Production keeps `.rer/deploy/production-secrets.json`,
`production-declaration.json` and `production.json` unchanged as its private paths.
Other environments use `.rer/deploy/environments/NAME/secrets.json`,
`declaration.json` and `state.json`, so even a name such as `production-secrets`
cannot collide with production's files. Credentials, declarations and native
state files remain private (0600) and uncommitted. The selected mail key and
optional matching callback verification key stay in that environment's credential
file. Back up each environment's credentials and state separately. A preview
uses real provider configuration when deployed; choosing a separate mail identity
is the owner's responsibility.

```bash
rer deploy --environment production --dry-run
rer deploy --environment preview --dry-run
rer deploy --environment staging --dry-run
npm run deploy:health -- --environment staging
```

Dry runs build and validate the actual declaration and artifact locally, print
the target resource names and private paths, and read the target account’s
subdomain and Worker secret bindings using the supplied Cloudflare credentials.
Without account inputs, Penny stops before the build or provider reads and
lists the missing inputs and their purposes. The standalone deployment and
health helpers also explain missing configuration in plain words and name the
next command, without printing internal failure codes.
They make no provider write and create no deployment credentials or state. For a real deploy, remove `--dry-run` only
with authorization to change the chosen account. Health selects the same
environment and never writes or rotates its saved credentials.

Repeated deploy and health use the saved owner and mail settings plus
freshly supplied account credentials; no later run rotates authority. Collisions,
changed identity, resource drift and uncertain creates refuse; reconcile provider
state before deliberately continuing.

The first `rer deploy` claims the owner itself: after a healthy deploy it submits
the one-time setup token to `/auth/bootstrap`, then removes the token from the
Worker and prints "Claimed the hosted owner". Then sign in at `/signin` with
`OPERATOR_EMAIL` and confirm the delivered link; the first sign-in ends at the
first-run setup. If that email does not arrive, fix the provider settings and
deploy again. A manual
`/auth/bootstrap` POST is recovery only, for a deploy that stopped after the
Worker went live but before the claim: read the setup token privately from the
environment's credential file and post it same-origin with `displayName` and
`returnTo: "/setup"`. Never put the token in argv, URLs, source, logs or receipts.

`rer deploy --environment NAME --remove --yes` takes a deployment down: it deletes
the Worker, D1 database, R2 bucket and Queue that environment's deploy record says
`rer` created, reads back that each is gone and touches nothing else. Export the
data first; removal deletes it.

The `later` mode leaves
deployed email actions unavailable and public reading available. It does not
silently substitute development capture. Reconfiguration must preserve the native
owner and generated secrets; provider and timezone drift is refused until an
explicit reviewed update is prepared.

The [disposable artifact procedure](docs/disposable-install.md) keeps its
separate `CF_THROWAWAY_*` and `RER_DEPLOY_*` inputs and private receipts, which are
not owner-account requirements. Its hash-ledger, collision, failed/uncertain and
repeat rules apply. Neither path deploys on push. Local fixture tests establish
the command composition; they do not establish a hosted deployment, provider
permission, Cron execution, inbox delivery or a real hostname.

## Source custody

`edition.json` is the selection and comparison authority.
`base-copies.json` records full copied-byte, executable-mode and pin custody.
Each retained Base copy records its own revision there (the import kit is Base
`38aa7ef`, rer 0.2.20), and `pnpm verify:base-source` is a thin alias to the shared verifier.
The `rer` command itself is the pinned `@runeditrun/rer` package, not a copy.
Stage intentional edits and removals, run `pnpm source:lock`, then
`pnpm source:check` and the shared verify-base before committing the lock and
`.edition/sources`. No copied bytes are patched locally; Penny's own
`src/base/font-head.ts` is declared outside the copy records.

## Quiet hours and provider events

The owner records the workspace timezone at **Finish setup**. Owners and Admins change it in
**Feedback settings → Workspace time and customer email**. Setup preselects the
browser timezone, or the optional validated `WORKSPACE_TIMEZONE` deployment input.
The saved choice takes precedence over deployment and source defaults. Older
installations prompt the owner to confirm their current timezone once.

Requester quiet hours default to **20:00–08:00** in that timezone. The owner may
choose different start/end hours or turn quiet hours off. Each send rechecks the
current setting; turning them off wakes queued requester mail, subject to the
existing one-minute coalescing window. Minute Cron remains the recovery backstop.
Daylight-saving conversion uses `Intl.DateTimeFormat`. Decision calendar reviews
use the saved timezone; operator email has no quiet hours. These installation
preferences are excluded from portable product archives and survive restores.

Provider suppression uses `POST /api/public/mail/events`. Configure SendGrid's
signed Event Webhook for this deployment URL, enable bounce and spam-report
events, and set `SENDGRID_EVENT_PUBLIC_KEY` to its base64 P-256 public key. For
Resend, select Resend as the mail provider and set `RESEND_WEBHOOK_SECRET` to its
Svix signing secret. Without the selected verification key the intake returns
503; provider setup and actual hosted callback delivery require separate proof.
A signed batch carries every message the provider account sent. Penny applies
the events that belong to its own mail and acknowledges the rest without storing
them; only a bad signature, a stale timestamp, a malformed body or a second
provider message for one Penny attempt refuses the batch. Hard bounces,
complaints and provider suppressions suppress the address; soft bounces mark one
delivery failed and suppress nothing; a provider unsubscribe withdraws all
requester email exactly as Penny's own global link does.

The deployment CLI includes the selected event-verification binding when its
matching environment value is present. Configure the provider webhook URL
separately; uploading a key does not register a provider webhook. No secret value
is emitted in an operation receipt. Callback failures return a generic 400
(invalid signature, schema or correlation), 413 (body over 1 MiB), 429 (rate limit)
or 503 (missing configuration, maintenance or event-storage failure); retry a 503
through the provider.

### Mail events

An event belongs to Penny's mail when it carries Penny's signed SendGrid
arguments (`rer_product=penny`, the attempt and the delivery ID), or when its
provider message ID matches an attempt Penny recorded (SendGrid's
`sg_message_id` begins with the send receipt's `X-Message-Id`; Resend's email ID
is the receipt itself). That covers request updates, releases, rejection notices
and decision-review mail, including attempts sent before Penny kept recipient
snapshots or correlation arguments. A hard bounce, complaint or unsubscribe that
names no message at all (SendGrid's delayed, asynchronous bounces arrive without
`sg_message_id`) belongs to the address when Penny has mailed it through that
provider (an attempt that may have reached it: sending, accepted, delivered or
unknown; refused, deferred and never-called attempts sent nothing). An event
naming another message, or carrying another product's `rer_product`, is another
sender's mail and changes nothing, unless Penny holds an interrupted attempt to
that address (sending or unknown) whose message ID it never learned. A verification of the address after the event outranks it. SendGrid's
`type: bounce` is a hard bounce and `type: blocked` a soft one; Resend uses
`bounce.type=Permanent`. See the [SendGrid event reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event),
[message ID definition](https://www.twilio.com/docs/sendgrid/glossary/message-id)
and [Resend bounce details](https://resend.com/changelog/email-bounce-details).

Decision-review mail to an operator shows delivered, suppressed or failed from
these events. A hard bounce or complaint stops further review mail to that
operator (the notification records `recipient_suppressed`) until they sign in
again by email.

REL-007 is met for Resend, which receives each delivery key as its
`Idempotency-Key` and suppresses a duplicate within 24 hours; SendGrid offers no
provider duplicate suppression, so its delivery key is correlation only. With
either provider an ambiguous or interrupted attempt stays `unknown` and is never
retried automatically; reconcile the provider outcome before an operator chooses
any further action.

## Saved feedback history

`pnpm run feedback:import -- …` prepares private saved files, previews mappings,
applies bounded native D1 history or reads, resumes and reverses a persisted job,
with an explicit origin and an owner-only session input file. Preparation and
preview are offline and read-only; apply, resume and undo change native product
rows under current authority and journal custody and use authenticated HTTPS or
loopback HTTP. See [MOVE-IN](docs/MOVE-IN.md) for the exact saved-file commands
and limits. This path never acquires live source data, creates consent or sends
provider effects. `pnpm feedback:status` validates only the documented-format
entry and its shipped guide bytes.

## Optional product integrations

Settings stores scoped API key hashes and installation-private webhook/tracker
configuration. Use docs/API.md, docs/INTEGRATIONS.md and docs/TRACKERS.md for
actual routes, selected events, signing protocols and safe reconciliation.
Native owners configure public description/accent/logo through Settings.

Outbound delivery requires the optional `PENNY_EGRESS` enforcing RPC binding:
Base's egress service (`base/modules/egress-service`), deployed by the owner and
declared in `deploy.json` `services` with the grant from its deployment receipt
(docs/INTEGRATIONS.md). Without it outbound delivery stays off. The owner
declaration has no custom-domain field and keeps the account workers.dev origin. No ordinary fetch fallback or ambient provider
identity is used. Inbound signed receipts and existing HTTPS issue linking work
without that outbound port. Missing transport is visibly configuration-disabled.
Restore omits API/provider/signing secrets, holds events/commands and requires
deliberate reconfiguration and reconciliation.

## Scoped learning configuration and recovery

Migration `0059_scoped_learning.sql` adds the private Stage 2–3 learning records and native correction triggers. Apply it before running this source; preserve the expanded database if rolling back source. It changes neither copied Base nor Worker/D1 identities. Restored source and investigation records are held, and any running claim becomes uncertain; they cannot silently resume under a restored operator identity.

The optional deployment secret `PENNY_LEARNING` is a JSON string with an optional `orbit` section. `orbit` names `origin` (HTTPS origin only), the real delegated `token`, the pinned `installationId`, the nonempty `audiencePrincipalIds` whose access the owner confirms covers every Penny operator, and `readCostMicros` for each exact-target read (explicit zero for a no-charge read). Acquire the token through Orbit's existing `rer-delegation/1` consent flow for `crm.evidence.read` and the exact selected targets; Penny does not request `crm.handoff.write`, enumerate the CRM or store this credential in product tables. Model access is separately installation-controlled in `PENNY_AI`: an object with optional `anthropic` and `openai` entries, each containing an `apiKey`, optional `workspaceId` (required by Anthropic for an all-workspaces key), and a `models` array. Each catalog model declares `id`, `inputMicrosPerToken`, `outputMicrosPerToken` and `maxOutputTokens` (1–16000). Prices are micro-USD per token and must cover the selected model’s maximum applicable input/output tariff; no caching, tools, images or thinking mode is enabled. Keep keys in deployment secret bindings, never D1, archives, browser state or build inputs. Move the former `PENNY_LEARNING.model` declaration into this catalog before upgrading; the retired shape is refused visibly. Settings select a provider/catalog model per capability, defaulting to the first configured Claude model, and a monthly USD cap. New installations start at $0. Private context is excluded by default, including Orbit company/opportunity fields and internal learning corrections; the owner may explicitly permit it without changing role access. Costs use UTC calendar months, conservative reservations before acquisition/calls, metered token usage at declared rates rounded up to the micro-dollar, and retained unknown reservations after ambiguous calls. No retry is automatic. These are usage reports, not provider invoice assertions. Configuration and nonpersonal cost metadata are portable; keys are not. Learning still requires its own smaller investigation ceiling.

`PENNY_LEARNING_EGRESS` is a deployment-owned enforcing RPC service implementing `send({url,method,headers,body}) -> {status,headers,body}`. It must enforce public DNS/IP at connection time, verified TLS, no redirects, exact GET/POST methods and response limits. Penny validates public destinations and bounds request/response bodies to 512 KiB. The source adapter uses only GET `/api/delegation/v1/evidence?target=<exact target>`; the model adapter uses OpenAI Chat Completions or Anthropic Messages with a strict structured schema. Anthropic receives its supported raw-schema subset, with remaining constraints in descriptions as its API requires; the complete original capability schema and citation checks still validate every response. Ordinary `fetch` and the existing POST-only integration transport are not substitutes for this service. No service or credential is invented when either section/port is absent: the API reports unconfigured and refuses execution. Owner-account configuration and a real account call remain deployment/pilot gates, not effects performed by this change.

The minute scheduled handler admits up to ten due investigations, reserves each maximum run cost before acquisition, and stores the event, claim and exact source revisions. An unchanged refresh retains the existing artifact and does not invoke the model. Known unspent reservations are refunded; ambiguous paid calls retain a visible reservation and uncertain receipt. Pause and resume are deliberate recovery controls, never hidden retries. Inspect runs and cost from the investigation detail; a pause invalidates in-flight completion. Scope expiry, unavailable authority, budget exhaustion and a revoked source stop only the affected investigation. Provider 401/403 revocation purges matching installation copies and derived work; a temporary provider outage does not masquerade as revocation. There is no automatic outreach, publication, tracker write or production action.

### Managed Configure from source

Penny publishes `management/integration/deployment-spec.json` at the same revision as `rer-project.json` and its bound `rer-setup.json`. RER Managed reads these files without a pasted specification. The app surface assigns `APP_ORIGIN`; owner email starts from the account email. The hidden generated setup token and signed owner-claim step use Penny's existing native owner authority. Direct owner-account `rer deploy` returns the token deployed by its custom hook to rer for `POST /auth/bootstrap`, which claims once (303) and preserves an initialized owner (409 `already_initialized`). “Set up later” needs no mail secret; choosing SendGrid or Resend requires its own key and verified sender.

After changing deployment inputs or setup, run `rer build`, then `pnpm delivery:spec`, and commit the generated specification, setup digest and workflow. Verify runs `pnpm check:deployment-spec` against the emitted Worker configuration and migration bytes. Build and deployment never invoke test suites.

## Direct request status upgrade

Migrations `0063_request_status_workflow.sql`, `0064_status_roadmap.sql` and `0065_request_status_terminal_states.sql` are additive. Apply them with `rer setup` locally or the existing hosted deployment path before running this source. They preserve prior public wording, status history and approved mappings. Existing roadmap data keeps the approved-item source; a new installation starts from request statuses. Internal status definitions, templates, explicit public ETAs and roadmap settings are portable product records. Source markers order direct and mapped changes without relying on millisecond timestamp ties. During a restore the projection triggers leave the archived source markers unchanged.

Keep the expanded schema if rolling source back; do not edit or undo applied SQL. Earlier code does not understand the new direct statuses or source choice, so retain this source when continuing status work and export data before any recovery. No provider, hostname or release configuration changes are required.

## Private discussion upgrade

Migration `0074_internal_discussion.sql` adds one-level note threads and durable operator mention notices. Apply it through `rer setup` or the existing hosted deployment path before running this source. Existing notes keep their text and authors and become top-level notes. Archives retain note threads and mention/dismissal history, without granting operator authority. Keep the expanded schema on source rollback. No provider or account configuration is required for in-app mentions.

## Aging and follow-up upgrade

Migration `0075_triage_aging.sql` adds portable age settings, effective-status clocks, evidence snoozes and durable in-app owner reminders. Apply it after 0074 using `rer setup` or the existing hosted deployment path. Existing requests initialize from their current direct/mapped status timestamp. Later real status changes reset the clock; wording and ETA edits do not. Minute Cron records one reminder per subject, owner, age origin and age step, with a wording-free audit entry. Repeated or restarted drains do not duplicate it. A resolved flag disappears immediately from the live projection. These reminders require no mail provider, and send no customer email. Settings, snoozes, clocks and reminder history travel in archives; current operator membership still controls access. Keep the expanded schema on source rollback.

## Public ETA and merge-notice upgrades

Migration `0076_roadmap_public_eta.sql` adds the separately approved public ETA and distinguishes ETA approval events from status transitions. Migration `0077_merge_notices.sql` expands the notification event kind and adds portable merge choices and address-bound audiences. Apply both through `rer setup` or the existing hosted deployment path before running this source; prior event, intent and delivery rows remain intact. No provider or account configuration changes are needed.

Keep the expanded schema on rollback. Do not run an older mail drain against queued merge events: retain this source until those deliveries are resolved. Restored pending merge audiences and delivery intent are held and never send automatically. Merge reversal cancels unsent notices through current eligibility; it does not recall an accepted email. Public ETA changes prepare drafts and require a separate publication action to notify followers.

## Imported internal-status custody

Migration `0078_import_status_custody.sql` invalidates import reversal preflights
when internal status definitions change. Apply it through `rer setup` or the
existing hosted deployment path. There are no provider or account changes;
retain the additive triggers on source rollback. Imported status definitions
and their links are included in the existing archive classification. Upgrade
rer to 0.2.60 in package mode and run `rer install` before use.

## Imported status-roadmap custody

Migration `0079_import_status_roadmap.sql` records before/after roadmap settings
for reviewed imports. Apply through `rer setup` or the existing hosted deployment
path; populated earlier imports keep their records. The setting transition and
its reversal commit with native import custody, and later roadmap edits invalidate
reversal preflights. Restore carries the history without replaying its effects.
Keep the expanded schema on source rollback; complete or undo an active roadmap
import with this source before using an older importer. No provider setup is needed.

## Native proxy votes

Apply additive migration `0080_native_proxy_votes.sql` through `rer setup` or the existing deployment path. Existing votes and contribution origins are unchanged. Proxy attribution follows its contribution through request merges and reversals; a customer's later direct vote counts once and marks the attribution as superseded. Product archives retain the source, recorder and unverified contact without granting authority or consent. Keep the expanded schema on rollback. The optional private Zendesk sidebar app uses a Zendesk secure setting for a Penny key with `requests:read` and `votes:write`; no Zendesk token or key is added to Penny archives. The wider Zendesk capture connector remains CAP-003.

## Vote importance

Apply additive migration `0081_vote_importance.sql` through `rer setup` or deployment. In Feedback settings, expand a board's **Vote importance**, enable it and save three or four distinct labels. Existing votes stay unspecified. Turning it off retains recorded choices; the API permits their owners to clear them. Settings and choices are product data in archives and erasure, not identity or permission. Request merges project each person's latest explicit choice; a later change updates their contribution origins so unmerge retains it. Keep the expanded schema on rollback.

Canny saved `votePriority` strings map Nice to have/Important/Must have to levels 1/2/3 and No priority to an explicit empty choice. Missing fields create nothing; unknown strings and numeric create-API parameters are refused, never inferred. Preview and completed receipts count every saved enum. Replay and conflict-aware undo retain original-file and native-row custody.

## Internal release planning

Apply additive migration `0084_release_planning.sql` through `rer setup` or the existing hosted deployment path. On **Roadmap → Release planning**, create a dated plan, select its delivery items, and record which item blocks another. The plan lists current states. Overdue or dropped blockers, and blockers scheduled beyond dependent delivery dates or approved public ETAs, flag downstream active items. ISO dates, months and quarters have explicit deadlines; free-text target windows are never guessed. Warnings use the workspace calendar and are internal. Shipping a blocker or removing its dependency clears the warning; neither action changes approved public wording or ETA. Cycle-producing links are refused in the write transaction. Plans and links are product archive data; retain the expanded schema on source rollback. No new account or provider setup is needed.

## Rich changelog upgrade

Apply `0085_rich_changelog.sql` through `rer setup` or the existing hosted path. Prior published releases keep their wording, recipients and empty custom-label/product snapshots. In **Releases**, choose public labels and optional public product names explicitly; private tags and unselected hierarchy names remain private. Upload and approve local images under **Release images**, then paste their Markdown into the draft or correction. Approval checks original bytes; publication checks approval in its sealing transaction. Missing or interrupted writes remain visible and can be recovered with the exact original file after confirming the original writer stopped. Data operations refuse active image writers. Both the native archive and `rer export` include the originals and verify their size, type and hash.

YouTube privacy-enhanced and Vimeo embeds are allowed only on changelog documents, and load only after the reader chooses **Load video**. No provider account is required to publish Markdown, labels or local images. Keep the expanded schema on source rollback.

## Evidence summaries and reply drafts

Expand **Evidence summary** on a request, decision or account, or **Reply draft** on a comment or inbox item. AI-010 selects the capability model, reserves the installation budget and applies the private-context policy. Drafts are editable client state, not stored conversations; only nonpersonal metered usage is retained. Every displayed citation is resolved again against current operator-visible records after the call. Unresolvable references are removed with a notice, and revoked authority or a changed data epoch refuses the result.

A reply posts only when the operator chooses a linked published public request and presses **Post public reply**. The existing comment route checks the edited AI wording again for stored private account values or internal notes. An unlinked inbox item remains editable until the existing linking/publication workflow supplies a public discussion target. Source links stay private in the editor. AI-011 retains measured-quality work (no evaluation bars apply to AI-006); ROLE-001 retains commercial-field role restrictions, including this context and publication boundary.

## Discord capture upgrade

Apply additive migrations `0096_discord_capture.sql` and `0097_discord_source_checks.sql` through `rer setup` or the existing hosted path. Configure the optional `PENNY_DISCORD` secret, enforcing GET service binding and owner-run Gateway relay only when enabling Discord. See [Discord capture](docs/DISCORD.md) for permissions, cursor recovery, source-removal policy and disconnect. Keep expanded schema on rollback. Restored capture stays disabled/held until deliberately reconfigured; never resume it under archived operator identity.


## Optional review capture

Apply additive migration `0098_review_capture.sql` through `rer setup` or the
existing hosted path. Provision `PENNY_REVIEWS_EGRESS` only to enable this optional
connector, then connect selected listings in owner settings. Read
[Review capture](docs/REVIEWS.md) for vendor scopes, token rotation, daily cursor
work, removal policy, paid extraction recovery and archive holds. Keep expanded
schema on rollback. Never resume restored work using archived operator identity;
reconnect with the new installation's credentials and current owner.
