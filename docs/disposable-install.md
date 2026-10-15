# Disposable artifact controller

The default `pnpm run setup`, `pnpm run deploy` and `pnpm deploy:health` use
Penny’s persistent owner account, described in [OPERATIONS.md](../OPERATIONS.md).
The commands here preserve the separate disposable artifact/controller protocol.
Managed Penny gets mail from RER without a provider account or key entry
([email guide](EMAIL.md)); this controller keeps its own SendGrid/Resend inputs
and does not issue Managed relay credentials.
Current copied sources are listed in `edition.json` and `base/PROVENANCE.json`;
deploy-kit is pinned at `5885264dd9d04b340a4d7218b31e5ad127d8484a`.

These commands use the actual Base deploy kit copied under `base/modules/deploy-kit`;
its pin, and the separate operator-auth and mail pins, are in `base/PROVENANCE.json`. `pnpm verify:base-source` verifies every
copied file against that module-level manifest. `artifact:prepare` packages and
validates an already built candidate; it creates no Cloudflare resources.
`artifact:deploy` provisions/reuses declared resources, applies hash-ledger migrations,
uploads the reviewed artifact and verifies deployment identity and health.
Nothing deploys on push. No production domain or arbitrary resource name is
accepted by the Penny plan.

Prepare in a credential-free checkout/process, after committing source:

```sh
pnpm install --frozen-lockfile
pnpm verify
RER_DEPLOY_ARTIFACT=/absolute/outside-checkout/penny.json \
RER_DEPLOY_RUN_ID=117 RER_DEPLOY_RUN_ATTEMPT=1 pnpm run artifact:prepare
```

Setup refuses any credential-like environment variable, dirty tracked source,
an existing output file, or invalid migration SQL. Record its SHA-256 and source
SHA independently with the artifact. Source installation and build must finish before
provider secrets are introduced. For unattended deployment, use a fresh trusted
controller job with only inert artifact bytes and the reviewed controller/module
source; never execute candidate scripts in the provider job.

Deploy/health consume the following environment from that trusted controller:

* `CF_THROWAWAY_ACCOUNT_ID`, `CF_THROWAWAY_API_TOKEN` (explicit account-scoped inputs).
* `RER_DEPLOY_ARTIFACT`, `RER_DEPLOY_ARTIFACT_SHA256`, `RER_DEPLOY_SOURCE_SHA`,
  `RER_DEPLOY_RUN_ID`, `RER_DEPLOY_RUN_ATTEMPT`, `RER_DEPLOY_RECEIPT` (absolute
  artifact/receipt paths; receipt must be private and absent on first deployment).
* `MAIL_PROVIDER` (`sendgrid` or `resend`) and `MAIL_FROM` (sender verified with
  that provider) for both commands. First deployment needs `AUTH_SECRET` and
  `SETUP_TOKEN` (independent random secrets, at least 32 characters), plus the
  provider's key as `MAIL_API_KEY`. Deploy preserves existing opaque
  secrets by binding name and only requires a value for a missing binding; health
  checks binding presence without requiring secret values.
* `OPERATOR_EMAIL` defaults to `operator@example.com`.
  Optional `PENNY_DEPLOY_SUFFIX` is limited to 1–20 lowercase letters/digits/hyphens.

```sh
pnpm run artifact:deploy
pnpm run artifact:health
pnpm run artifact:deploy  # same artifact/run/receipt: authenticated no-mutation repeat
```

The default Worker is `rer-seedproof-penny`; resources are
`rer-seedproof-penny-db`, `rer-seedproof-penny-files`, and
`rer-seedproof-penny-jobs`. A suffix applies consistently to all names. The origin
is obtained from the authenticated account workers.dev subdomain, never from an
arbitrary supplied URL. `APP_ORIGIN`, the explicitly selected `MAIL_PROVIDER`, and environment
identity variables are controller-owned. Mail has no Cloudflare accountId option.
The current profile provisions the Queue and its mail consumer, with a minute Cron trigger
(`* * * * *`) as the delivery backstop.
Use `pnpm run operations -- check --profile artifact-sendgrid` or `artifact-resend`
for the selected controller inputs. Use `pnpm run operations -- doctor --profile
runtime-sendgrid` or `runtime-resend` for hosted application input formats,
including explicit `OPERATOR_EMAIL` even though this controller has a default.
Profiles select the declared provider without editing `OPERATIONS.json`; a key
for the other provider does not satisfy selection. Local inspection does not
prove credential validity, sender verification, Cron execution, inbox delivery
or first-deployment secret availability. `OPERATIONS.json` stays declarative, with
no executable configuration module, for the maintained Base deploy-kit check.

The kit's persistent D1 migration ledger refuses changed history, ambiguous
partial migrations and automatic adoption of un-hashed Wrangler history. Do not
run remote Wrangler migrations before deploy. An existing installation with only
Wrangler's old ledger requires separately reviewed migration-history adoption.
Resource reconciliation never deletes owner data; opaque existing secrets are
preserved. Rotation is a separate operation.

After first deployment, submit the one-time setup token in a same-origin POST
JSON body to `/auth/bootstrap` with `displayName` and `returnTo: "/app"`, retaining
its cookie privately. Then use `/signin`, open the received mail link and press
Confirm. Token values belong neither in shell history, logs nor proof artifacts.
The public portal remains empty until an authenticated operator creates a public
board and explicitly approves requester content. These commands do not seed
synthetic sample data remotely.
