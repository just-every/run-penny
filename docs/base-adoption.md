# Maintained Base adoption

## Current inventory, 14 October 2026

Base selections retain immutable comparison origins in `edition.json`; individual
verbatim copies record their actual revisions in `base/PROVENANCE.json`. The CLI
comparison now includes Base's root `cli` at
`8981bc2c4d9e61feca5787c83b4ed44056659dd9`, matching the source adopted by Penny.
Other selections retain their recorded origins. The retained runtime excludes Base test suites, fixture trees, and
one-off proof harnesses. Base owns its shared suite; Penny retains tests of its
product and adapters.

`edition.json` selects the source paths and mappings. `base/PROVENANCE.json`
records every byte-exact copy, its origin path, revision, file hashes and modes;
`sources.lock.json` binds current tracked source and retained comparison archives.
The root provenance revision is historical; each copy entry names its own origin.
Historical receipts below do not describe the current inventory.

The source retains 133 byte-exact copy groups (1,012 files), 16 Base components
and their selected comparison archives. Two CLI files are Penny adaptations,
described below, and make no byte-equality claim. Refresh with Base's own commands, from a
Base checkout at the chosen commit:

```sh
node "$BASE/scripts/export-cli.mjs" .
node scripts/edition-authoring/cli.mjs refresh-base <commit> \
  --record base/PROVENANCE.json --base "$BASE"
```

The exporter rewrites `scripts/rer.mjs`; restore Penny's own entry point
afterwards, because it applies Penny's placement policy before the shared CLI.
Reapply and review the two documented CLI adaptations after exporting; do not
record their changed bytes as verbatim Base source.
Update the component revisions in `edition.json`, stage the result, and run
`pnpm source:lock`.

Use the existing `record-base`, `verify-base` and `compare` commands for source
work. Stage intentional changes before `pnpm source:lock`, then run
`pnpm source:check` and `pnpm verify:base-source`. The last command verifies the
shipped bytes offline. An independent comparison with the private upstream
requires an explicitly supplied authorized Base checkout; it is not a public
fetch promise. See [source provenance](SOURCE-PROVENANCE.md) for the exact
verification boundary and transformed delivery exports.

## Hydration verification scheduling

Penny owns deliberate adaptations of `scripts/base-cli/cli/lifecycle.mjs` and
`scripts/base-cli/cli/hydration/check.mjs`. Their comparison origin is Base's
root `cli` at `8981bc2c4d9e61feca5787c83b4ed44056659dd9`; the more-specific
`edition.json` mapping preserves that baseline. The other 67 CLI files retain
their original byte hashes and modes as individual exact-copy records. The CLI
inventory hashes all local files and explicitly records these two adaptations
and their original hashes; its local integrity hashes do not claim upstream
equality. This follows the source author's documented adaptation boundary.

The command adapter's `hydrationLoadDelayMs` option defaults to zero. A positive
integer selects serial loads and waits that many milliseconds before every
load, including the first after page discovery. Penny declares 61,000 ms so
the actual 60-second public admission window expires naturally between fresh
asset loads. The same hosted Worker, database, IP identity and limiter remain
in use. No failure is retried. The lifecycle signal cancels a pending wait.

The exported `checkHydration` function accepts the corresponding `loadDelayMs`
and `signal` options. Delay values must be integers from zero through
2,147,483,647 ms. The standalone command reads the same adapter policy:

```sh
node scripts/base-cli/cli/hydration/check.mjs . --details
```

Run it against the current production build. Every baseline, discovered section,
tamper case, script hold, recovery assertion, intro and reduced-motion check is
retained. HTTP 429 and hydration errors still fail. Load counts depend on the
successful page surveys. This focused check does not replace full `rer verify`;
final exact-source CI remains required. The pacing adds roughly one minute per
load. It changes no product limits, migrations, deployment or local settings.

## Product adapters and authority

Penny supplies branding, selected settings, bindings, schema, policy and product
routes. Vendor bytes remain unchanged. The shared local installer runs settings,
dependencies, protected build, migrations, app startup, /health, first-owner
bootstrap and development-outbox sign-in. Every child uses the shared command
store; app registration follows spawn immediately. Terminal setup, development, build,
export, import and deploy use that same runner and saved state; Penny keeps no
second process runner.

`/auth/bootstrap` uses the one-time `SETUP_TOKEN` and configured `OPERATOR_EMAIL`
to create the first native Base owner on an empty installation. A populated
upgrade preserves installed authority and refuses another bootstrap. `/signin`
requests mail; `/auth/confirm` GET is read-only and an explicit same-origin POST
consumes the link. Both private Hono APIs and generated Start functions require
current native Base admission independently. `/api/auth/session` is the small
product projection; `/auth/session` is the Base response. Product attribution
keeps its own ULIDs, linked through authoritative operator email. Equal product
operators do not remove native last-owner protection.

The Base development outbox serves both operator and requester links only in
explicit local/development mode with a matching loopback origin and Host.
Production and preview never expose it. Requester verification is separate,
returns requester authority and does not grant operator power. SendGrid and
Resend require explicit selection, their matching key and verified sender.
Without mail, public reading remains available and email sign-in/verification
fail visibly. Existing verified requester sessions retain permitted actions;
a valid host signature alone cannot provision a first unverified requester.
Consent, suppression, block state and public privacy remain product boundaries.

The owner-account declaration uses maintained `ownerTarget`, `ownerPlan`,
`ownerDeploy` and `ownerHealth`, with durable private state and explicit account
credentials. Its browser hook uses the same definitions. Dependencies and build
run without provider credentials. The separate `artifact:*` commands retain the
disposable artifact/controller protocol and hash-ledger guarantees. Local
provider fixtures establish those command paths, not a deployment.

## Migrations, archive and effects

Reviewed main's applied migrations 0001–0029 remain byte-identical. Migration 0009 imports
operator identity and revokes predecessor operator/requester sessions and
synthetic links; migration 0012 adds native cancellation and development outbox
storage. No predecessor token or unkeyed session hash becomes Base authority.
Stop old workers before upgrade and reissue credentials rather than restoring
an obsolete authentication implementation.

Additive `0016_restored_notification_hold.sql` preserves prior rows and holds
restored notification history. Product export retains safe attribution and
original R2 bytes but excludes the Base authority/session/token/outbox store and
provider secrets. Restoration preserves destination authority, requires the
latest separate erasure journal and never replays mail. Unknown schema, missing
or untracked files, bounds overflow and interrupted custody refuse completion.
Hosted HTTPS export/journal is supported. Hosted restore and supported-root
erasure have guarded native API and CLI source paths, with current operator
and same-origin admission, maintenance, empty-target, latest-journal and
preview-hash fences. The Data screen presents state and exact commands without
destructive buttons. Evidence remains source-only over local TLS; real hosted
acceptance and journal continuity at a brand-new destination remain owner
obligations. This is a declared product archive, not universal DATA-001/003 or
BASE-DATA-001/003 acceptance. See [data ownership](data-ownership.md).

Main's 0028 native dev-session and 0029 dev-minted API-credential migrations
retain installation-only authority and the local gate. Penny's four unmerged
clause migrations follow as 0030–0033. The populated-0029 preservation case and
separate populated-0015 restoration case are defined in the existing native
suite; final integrated pass/fail receipts are in the release-review evidence
referenced by ACCEPTANCE.md, not inferred from the historical evidence below.

Notification intent retains consent, public-only projection, fixed first-event
hourly coalescing and workspace quiet hours. Minute Cron drains requester and
release commands. Ambiguous sends stay unknown; SendGrid correlation does not
satisfy REL-007 duplicate suppression. REL-011 unmatched callbacks remain an
explicit boundary. Local fixtures do not establish inbox delivery or hosted Cron.

## Base 479094f (13 October 2026)

Migration 0039 installs `d1ReversalFenceSchema` and 0040 `d1RetirementSchema` (with
Penny's maintenance admission on the four new custody tables); 0041 gives queued legacy
`request_status_update` and `moderation_rejected` outbox rows a visible state; 0042 to 0049
add Base's identity-provider, domain-rule/step-up, provider-control, dependency, owner-grant,
provider-pin, setup and approval tables, classified as installation data and never exported.
Applied 0001–0038 stay byte-identical. Person erasure calls `retireD1ImportCustody` with
portability's redaction checkpoint; the erasure journal and retirement rows travel in archives
and an archive made before an erasure is refused whole with the later journal. The Worker
serves built files through `staticAssetResponse` and answers `/health` with `deploymentHealth`;
`deploy.json` declares the vars `rer verify`'s hosted check needs. Local session and dev-gate
cookies carry the port (`operator_session_local_8787`, `rer_dev_gate_8787`).

## Base c8e64851 (13 October 2026)

Base's `rer setup` now keys the dependency-setup proof with the seed's declared
`sessionSecretKey` (`AUTH_SECRET`), so `rer-setup.json` declares the optional
`oidc-provider@1` dependency on the `IDENTITY_PROVIDER` field (group `identity`, optional
url) and `src/core/features/auth/operator.ts` admits `/auth/setup-complete`. Penny's own
sign-in page still offers email links only and has no provider button. The refresh also brings
Base's bounded erasure steps, the development outbox's retryable storage failure, the
import-kit rule that unfenced native statements in a retirement batch are refused
(`IMPORT_RETIREMENT_NATIVE_REQUIRES_CHECKPOINT`; Penny's batches always carry the
checkpoint) and the publication-scan and legacy-backup fixes. No migration changes.

## Verification and historical evidence

Ordinary `pnpm verify` checks source custody, Penny installer/command flows,
metadata/deployment and UI behavior, typechecks/lints, native data commands,
predecessor behavior, production Base admission and fast installer journeys.
The predecessor profile applies the complete product migration inventory,
including native authority prerequisites. Historical credential fixtures and their
resolver remain test-only. The production profile applies the complete inventory
and emits the actual Worker used by native/browser tests.

The existing browser journeys named in HANDOVER.md retain real sign-in, privacy, same-origin
admission, genuine 404s, hydrated navigation, axe/layout and owned-process
teardown. Expected negative HTTP diagnostics are counted narrowly; successful
journeys still allow no unexpected errors or external requests. Final proof
needs a genuine frozen clone with its own install/gate, and inspected desktop
and mobile captures. Current merged-head evidence belongs in
[ACCEPTANCE](../ACCEPTANCE.md) and [HANDOVER](../HANDOVER.md).

Earlier adoption milestones used different module pins and runners. Their
receipts remain historical in [acceptance history](acceptance-history.md); they
do not describe the current source inventory or establish changed-head delivery.
Historical hosted receipts are for their named installation only. Registry
admission, final-head provider/Cron proof, public release and applicable-prefix
teardown remain separate obligations. Base's publish-check PERFORMANCE.md is
absent at the adopted runner pin; that documentation handoff is not a scan PASS.

## Saved-file import composition

The complete import-kit copy lives at base/modules/import-kit. Product adapters
under src/core/features/imports supply explicit saved-format mapping, native D1
row/relationship fences, same-database operator admission, privacy and erasure
classification. The original kit SQL and preserved-undo evolution are applied
once in migration 0017. Installation authority remains excluded from product
archives; import originals/journals and opaque erasure fences are classified.

The consumer also omits `base/modules/import-kit/proof/zendesk/`: nine synthetic
Lily branch-proof files are Base test evidence, with no Penny runtime caller.
Retained import-kit runtime bytes and modes stay exact.
