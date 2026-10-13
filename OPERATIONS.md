# Penny operations

`OPERATIONS.json` v2 describes the shipped commands and their input files, and
opts Penny into the first-party seed command contract through
`scripts/installer/local.mjs`. `node scripts/rer.mjs describe`, `check --profile
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
| `node scripts/rer.mjs install` | Frozen dependency install with the pinned pnpm and lockfile; no setup. |
| `node scripts/rer.mjs setup --owner-email EMAIL` | Build, apply every migration, save private settings and claim the first native owner with an empty workspace, then stop the temporary app. Repeats preserve the owner, origin, exact private settings and data. |
| `node scripts/rer.mjs dev` | Foreground Vite with assets and HMR on the saved loopback origin; prints `RER_READY` and the outbox sign-in line once health passes. |
| `node scripts/rer.mjs preview` | Fixed production output on the same state; managed, with idle timeout and explicit `--stop`. |
| `node scripts/rer.mjs build` | Production Worker and assets with private local settings excluded and restored. |
| `node scripts/rer.mjs verify` | The full verification: structural check, source and Base custody, tests, type, lint, build and the literal README journey; no deployment. |
| `node scripts/rer.mjs reset --yes` | Confirmed removal of the printed local inventory only; refuses while anything runs. |
| `node scripts/rer.mjs export --output FILE`, `import --input FILE --yes` | Local archive of Penny's domain data and original files with a separate latest erasure journal, and its restore into an empty installation. |
| `node scripts/rer.mjs deploy [--environment NAME] [--dry-run]` | Owner-account build, reconcile, migrate and health; a dry run builds and validates locally and makes no provider request. |
| `node scripts/rer.mjs outbox [--owner-email EMAIL]` | The local outbox address; an explicit owner requests a fresh ordinary sign-in message. |
| `node scripts/rer.mjs doctor`, `describe`, `check`, `release` | Local diagnostics, capability description, structural check and the maintained Base release producer, which needs explicit authorized inputs. |
| `pnpm run deploy:health` | Owner-account identity, configuration and health against the private saved state; accepts `--environment NAME`. |
| `pnpm run artifact:prepare`, `artifact:deploy`, `artifact:health` | The separate disposable controller: credential-free packaging of built committed source, scoped resources with hash-ledger migrations and upload, and its health. |
| `pnpm run data:export -- …`, `data:import -- …`, `data:journal -- …` and the erasure and recovery commands in [data ownership](docs/data-ownership.md) | Authenticated archive, journal and erasure operations against a running installation. |
| `pnpm run feedback:import -- …`, `pnpm feedback:status` | Saved feedback history (below) and the documented-format entry check. |
| `pnpm source:lock`, `source:check`, `verify:base-source` | Capture and check the actual tracked bytes, modes, tool identity and Base comparison snapshots. |

The package scripts `setup dev build verify reset deploy export import release
outbox doctor describe check` are exactly `node scripts/rer.mjs VERB`;
`deps` is `install` and `rer` is the bare dispatcher. Use `pnpm run VERB --
FLAGS`.

## Local state

Terminal setup uses `http://127.0.0.1:8787`; an initial `--port` changes it.
`dev` prints `RER_OPEN`, which carries the checkout's dev key
(`.rer/local/dev-key.env`) in its fragment and signs the browser in as the owner
(`--as teammate|signed-out` for another identity, `--login` for the outbox
sign-in). The outbox at `/__dev/outbox`, dev sign-in and dev sessions answer only
behind that key; `reset --yes` removes it and the next `setup` makes a new one.
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
`MAIL_PROVIDER` (`later`, `sendgrid` or `resend`). SendGrid requires a verified
`MAIL_FROM` and `SENDGRID_API_KEY`; Resend requires `MAIL_FROM` and
`RESEND_API_KEY`. Optional `WORKSPACE_TIMEZONE` is an IANA name and defaults to UTC.
Deploy also checks the expected account workers.dev origin before writes. Only
dependency and build commands see the credential-stripped build environment;
provider credentials reach the deployment command after those finish.

`deploy.json` declares D1 `DB`, R2 `FILES`, producer Queue `JOBS` and the minute
Cron (`* * * * *`), with no Queue consumer or Durable Object. The first scheduled run can
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
node scripts/rer.mjs deploy --environment production --dry-run
node scripts/rer.mjs deploy --environment preview --dry-run
node scripts/rer.mjs deploy --environment staging --dry-run
pnpm run deploy:health -- --environment staging
```

Dry runs build and validate the actual declaration and artifact locally, print
the target resource names and private paths, make no provider request and create
no deployment credentials or state. For a real deploy, remove `--dry-run` only
with authorization to change the chosen account. Health selects the same
environment and never writes or rotates its saved credentials.

Repeated deploy and health use the saved owner and mail settings plus
freshly supplied account credentials; no later run rotates authority. Collisions,
changed identity, resource drift and uncertain creates refuse; reconcile provider
state before deliberately continuing.

After the first deployment, read the setup token privately from the owner file and
submit it in a same-origin JSON POST to `/auth/bootstrap` with `displayName` and
`returnTo: "/setup"`. Keep its response cookie private, then use `/signin` and
confirm the delivered link; the first sign-in ends at the first-run setup. Never
put the token in argv, URLs, source, logs or receipts. The `later` mode leaves
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
`base/PROVENANCE.json` records full copied-byte, executable-mode and pin custody.
All retained Base copies use the reviewed `1077a2e4fd6b1ead9ae312f1b72cc0ee21270665`
revision, and `pnpm verify:base-source` is a thin alias to the shared verifier.
Stage intentional edits and removals, run `pnpm source:lock`, then
`pnpm source:check` and the shared verify-base before committing the lock and
`.edition/sources`. No copied bytes are patched locally; Penny's own
`src/base/font-head.ts` is declared outside the copy records.

## Quiet hours and provider events

Requester email quiet hours are fixed at **20:00–08:00**, using the IANA
`workspaceTimezone` in `src/ext/config.server.ts`. Owner-account setup defaults to
UTC; the artifact controller keeps the product fallback Australia/Brisbane.
`WORKSPACE_TIMEZONE` is an optional server-only IANA timezone supplied through the
deployment environment. Deployment passes it to the Worker after validation;
invalid or empty supplied values fail. The hours, the fixed one-hour coalescing
window and the minute Cron do not change; conversion uses `Intl.DateTimeFormat`,
including daylight-saving rules.

Provider suppression uses `POST /api/public/mail/events`. Configure SendGrid's
signed Event Webhook for this deployment URL, enable bounce and spam-report
events, and set `SENDGRID_EVENT_PUBLIC_KEY` to its base64 P-256 public key. For
Resend, select Resend as the mail provider and set `RESEND_WEBHOOK_SECRET` to its
Svix signing secret. Without the selected verification key the intake returns
503; provider setup and actual hosted callback delivery require separate proof.
Only authenticated events correlated to a recorded Penny notification attempt
and its exact recipient can suppress that address for hard bounces or complaints.
Soft bounces do not suppress.

The deployment CLI includes the selected event-verification binding when its
matching environment value is present. Configure the provider webhook URL
separately; uploading a key does not register a provider webhook. No secret value
is emitted in an operation receipt. Callback failures return a generic 400
(invalid signature, schema or correlation), 413 (body over 1 MiB), 429 (rate limit)
or 503 (missing configuration, maintenance or event-storage failure); retry a 503
through the provider.

SendGrid's signed `type: bounce` distinguishes a hard bounce from `type: blocked`.
Its webhook message ID differs from the send API receipt; Penny emits a batch ID,
`rer_product=penny` and a per-attempt correlation, and binds the first authenticated
callback message ID to that attempt. See the [SendGrid event reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event)
and [message ID definition](https://www.twilio.com/docs/sendgrid/glossary/message-id).
Resend uses the exact stored provider receipt and `bounce.type=Permanent`; see
[Resend bounce details](https://resend.com/changelog/email-bounce-details).

REL-011 is not fully satisfied: delayed or asynchronous bounces without
`sg_message_id` are rejected by the retained Base intake. Historical accepted
attempts without the recipient snapshot or attempt correlation also cannot
authorize suppression. Review provider-side suppression separately for these
excluded events; the product does not implement suppression for them.

REL-007 remains unmet because SendGrid provides no provider duplicate suppression
for these sends. Ambiguous attempts stay `unknown` with no automatic retry;
reconcile the provider outcome before an operator chooses any further action.

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
