# Managed delivery preparation

Penny's managed candidate uses the maintained Base delivery producer, exported
from `eca838d6659f47f99338b8e638345bfe9191f3ba` with its documented `export`
command. `scripts/delivery/base/` contains its runtime and setup validators,
without Base tests or fixtures. Product policy is `packaging.json` in that
directory. The installer and producer both read the committed, canonical root
`rer-setup.json`; the generated project descriptor binds its exact bytes through
`setup.path` and `setup.sha256`.

The managed workflow selects the reviewed immutable delivery workflow
`runeditrun/delivery/.github/workflows/trusted-build.yml@6d77ec14e366eb9f4acc0eac41fac40b61e2e10a`,
project mode and full verification. That workflow separates the credential-free
source build from attestation, supports schema-2 raw payloads and uploads both
the manifest and `delivery-artifact/payload/`. It is dispatch-only. Committing
this caller does not dispatch it, register a project or deploy an installation.

`rer-project.json` setup installs local Node 22.20.0/pnpm 10.12.4 tooling, frozen
dependencies and Chromium for verification. Its environment contains only
process/path inputs; it neither creates an application owner nor provisions
hosting. Build and verify dispatch the pinned `@runeditrun/rer` package's `rer`
commands.
The artifact command packages the actual `dist/server/`, `dist/client/` and exact
SQL selected by the build's Wrangler configuration. It requires a fresh output
directory and never overwrites a previous candidate.

After a production build, the thin artifact caller is:

```sh
node scripts/build-delivery-artifact.mjs
```

To emit a fresh review package including the generated setup, project and
workflow files, use the same maintained runtime:

```sh
node scripts/delivery/base/cli.mjs package \
  --config scripts/delivery/base/packaging.json --output rer-package
```

Review those generated files before updating their committed copies. A changed
setup document requires regeneration of the project descriptor; an invalid or
noncanonical root setup file refuses packaging. The immutable management
project's separate `setupDigest`, when registered, must match this exact input;
no extra descriptor `setupDigest` field is used here.

The package retains DB (D1), FILES (R2), JOBS (producer queue) and minute Cron
from Penny's real build. There is no queue consumer, egress service or custom
domain declaration. Public defaults select production and UTC; local setup's
saved variables select local mode. The owner runtime still requires its explicit
origin, owner and authority configuration, and hosted mail requires the selected
real provider and sender. Optional enforcing outbound transport remains
unprovisioned. The public source repository is `just-every/run-penny`; source publishing,
workers.dev deployment, owner-account setup and disposable artifact deployment
remain separate actions. Remote project creation remains disabled.

The existing persistent owner path (`deploy.json`) and separate disposable
artifact controller (`artifact:prepare`, `artifact:deploy`, `artifact:health`)
retain their own contracts. This managed schema-2 artifact is not an input
substitute for the disposable controller's different artifact format.

Focused proof after production build:

```sh
node --test --test-concurrency=1 tests/deployment/delivery-package.test.mjs
pnpm exec vitest run --config vitest.base.config.ts \
  tests/base/owner-claim.test.ts tests/base/editor-admission.test.ts --maxWorkers=2
pnpm run test:browser:editor
```

On 2026-10-10 the delivery-package check passed 1/1 against the actual built
payload; the owner-claim/editor suites passed 6/6; `rer
check --profile first-party` exited 0; and Platform's unmodified integration inspector exited 0 after
checking the committed 23-file bundle. The package check runs both producer
commands on built bytes, compares repeated output, checks payload/migration
integrity and setup identity, and refuses an invalid installer document. These
are bounded local/source receipts; they do not prove a newly run production
build, workflow dispatch, stage or live installation. Final-source CI and M1 browser acceptance remain
pending; the browser command above is not a passing receipt for this candidate.

The platform's maintained `scripts/projects/integrations.mjs check` inspects
retained integration bundles, not native route semantics. For offline review,
export the actual committed `src/core/features/integrations` subtree with Base's
`generateIntegrationBundle`, retain it only in a disposable local platform
checkout and run that checkout's unmodified inspector. This checks the complete
candidate bundle bytes without installing or registering an integration. Native
API/webhook/Slack/tracker tests and the separate owner/editor tests establish
their own semantic claims. No management implementation or live registry
admission is implied by the bundle receipt.

## Source admission checks

The product-owned `scripts/delivery/base/packaging.json` declares the source
verification policy emitted in `rer-project.json`. Its security-sensitive paths
cover native auth, integrations, data, saved imports and owner-editor
implementation under `src/core/features/`, all `migrations/core/**` SQL,
`src/server.ts`, `src/base/**`, `base/**`, installer/onboarding/CLI adapters,
`scripts/delivery/**`, `rer-setup.json` and the managed caller.
Imports enforce provenance, current authority and erasure custody; editor code
controls owner admission and configuration leases. SQL can change authority,
revocation and custody fences, so it is sensitive as well as being listed under
`verification.migrationDirectories`. Applied SQL still must remain byte-identical;
this declaration does not authorize changing applied migrations.

Descriptor-only source review can use the maintained producer's
`packagingConfig` API and `loadSetupManifest` on the actual root setup file,
then emit the validated project with that loader's `setup.path` and
`setup.sha256`, as `producePackage` does. Compare the resulting complete
descriptor and generated managed workflow with their committed copies. This
requires no build or network call and proves only source declaration consistency.
The caller still selects full verification at its reviewed 40-character workflow
pin. No stage/production deployment, live admission or runtime acceptance follows
from this check; actual artifact packaging and the full verification remain
separate required evidence.

Run `rer check --profile first-party` in Penny before packaging. This is the
credential-free structural check; a named hosted readiness profile still
requires that profile's real inputs. It does not dispatch the managed workflow.

After exporting the committed integration bundle as described above, run
`node scripts/projects/integrations.mjs check --id penny` in the isolated
Platform checkout. The inspector must read that exported bundle, including its
committed revision and all 23 retained files. No stage or production installation
is part of this source check.

The first native owner claim uses operator-auth on an unclaimed installation;
a second claim is refused. A claim is not a general editor session: editor
configuration requires a current owner and an admitted, bounded configuration
lease. The response retains the configured `frame-ancestors` CSP. Use the native
owner-claim/editor checks above and the 1440/390 browser journey to validate this
boundary after changing admission or editor policy.

Earlier integration receipts belong to their named finished slices and do not
accept this final candidate. Hosted Cron/inbox delivery, live project admission,
platform signing-key transport, public publication, SendGrid REL-007 and excluded
REL-011 callbacks remain separate open boundaries.
