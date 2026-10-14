# Working on Penny

## Run it locally

Everything runs through one dispatcher, `rer`, from the checkout
root. It selects the pinned Node (22.20.0; pnpm 10.12.4 comes from
`packageManager`), never changes global tools, and every command accepts
`--help`, `--json` and `--non-interactive`.

```bash
rer install
rer setup --owner-email you@example.com
rer dev
```

`install` is the frozen dependency install. `setup` builds, applies every
migration, saves private settings (mode 0600) and claims the first owner, then
exits with no server running; the first run needs the owner email, `--port`
(default 8787) belongs to that first run, and a repeat run keeps the owner, the
data, the saved origin and the exact private settings. `dev` stays in the
foreground and opens signed in: it prints `RER_READY`, `RER_SIGNED_IN EMAIL` and
`RER_OPEN http://127.0.0.1:8787/#rer-dev=KEY&as=owner`. `RER_OPEN` carries the
checkout's dev key (`.rer/local/dev-key.env`, 0600) in its fragment; opening it
trades the key for a local gate cookie and signs the browser in as the owner,
who lands on `/setup`, the first-run setup. Until its **Finish setup** is
pressed, every `/app` page sends the owner back to `/setup`; afterwards `/setup`
opens the app. `--as teammate` (the dev persona `teammate@dev.localhost`) or
`--as signed-out` starts as another identity, and the dev badge switches between
them; `--login` turns dev identity off and prints `RER_SIGN_IN` plus a
`RER_OPEN` link to the key-gated outbox, where the newest message's link and
**Confirm** sign in exactly as mail does. Without the key the outbox, dev sign-in
and dev sessions answer 404, and an API key minted in a dev session is refused
and never exported.

Then, from the same root:

```bash
rer verify
rer reset --yes
rer export --output exports/penny.rer
rer import --input exports/penny.rer --yes
rer deploy --dry-run
rer describe
```

`verify` is the full verification (stop dev first with `dev --stop`). `reset`
lists and removes only the local data, owner, generated settings and installer
state, keeps source, exports and `.rer/deploy` receipts, and refuses while
anything is running. `export` writes an archive and its erasure journal;
`import` restores both into an empty installation, which then needs `setup`.
`deploy` is the owner-account deployment described in OPERATIONS.md; without
`--dry-run` it changes the Cloudflare account its inputs name. `describe` lists
every other command, flag and effect. `pnpm run VERB -- FLAGS` is the same
dispatcher (use `pnpm run deploy` and `pnpm run import`: bare `pnpm deploy` and
`pnpm import` are pnpm's own commands).

## What Penny is

Penny is a customer-feedback decision system for one software business. It keeps
attributed requests and evidence, compares and commits accountable bets, and
publishes separately approved roadmap and release wording. Commercial context,
private rationale, held submissions and requester identity stay out of public
projections. Wider outcome and account requirements remain in CONTRACT.md and
must not be represented as shipped merely because related tables exist.

Read CONTRACT.md, BASELINE.md, ACCEPTANCE.md, HANDOVER.md, OPERATIONS.md and the
package scripts before changing behavior. The public source repository is
https://github.com/just-every/run-penny, version 0.0.0 (tag `v0.0.0`). Keep source
custody records truthful and preserve all repository history and existing tags.

## Runtime and trust boundaries

One Cloudflare Worker serves Hono APIs and TanStack Start documents/server
functions, with D1, original files in R2, a producer Queue and minute Cron.
Native Base operator authority admits every private document, API and generated
function independently. Requester email verification and signed host identity
are separate authority. Same-origin writes, session revocation, moderation and
immutable public snapshots remain required. Unknown documents/assets/hosts
return genuine 404 responses, and hydration retains client navigation.

First-run setup (`/setup`) is Base's first-run runtime, copied byte-exact to
`src/base/setup.ts` with its `theme-frame.ts`, and Penny's own
`src/core/ui/brand/font-head.ts`. Base's sign-in confirmation and `/setup` wear Penny's
look through Base's theme hook: `public/rer-theme.css` (brand tokens, Inter Tight
and `public/brand/penny-mark.svg`), declared in the operator-auth branding and
passed to `firstRunResponse`. Its record is the installation-owned `oa_first_run` row,
excluded from portable archives. Penny's self-hosted fonts live in `public/fonts`
and are linked once from the root document; Base's default font does not apply.

The local Base development outbox is restricted to explicit loopback local or
development mode. GET confirmation does not consume a sign-in link. Production
never accepts a local outbox or invented signer/provider. Mail providers are
selected explicitly with their real fields. Both provider and sender may be
absent in the documented unconfigured-mail mode; partial configuration fails.
No placeholder credentials, mock application paths or silent transport fallback.

## Commands, deployment and source custody

Local data lives only in `.wrangler/state`; `.rer/local` and `.seed/installer`
hold command bookkeeping and installer state; private settings are `.dev.vars`
(0600). A sibling `.penny-local-state-<checkout>` folder or a `PENNY_LOCAL_STATE`
path elsewhere is refused before any change (exit 4): preserve it and place or
remove it yourself. Preserve settings/credential bytes, private file permissions,
owner identity and process-custody diagnostics on every repeat.

`pnpm run deploy` uses the persistent owner-account declaration in `deploy.json`,
explicit account/token inputs and private durable files under `.rer/deploy`.
`pnpm run deploy:health` reads that deployment's identity and health. The
separate tested artifact/disposable controller uses `artifact:prepare`,
`artifact:deploy` and `artifact:health`. Do not claim a public preview or a
deployment from command names, fixture composition, source integration or CI.
Use only a deployment path actually described by OPERATIONS.json and authorized
for the installation. Dependencies/build must not receive provider credentials.

`edition.json`, `base/PROVENANCE.json`, retained source snapshots and
`sources.lock.json` record adopted source custody. Run `pnpm source:lock` only
for staged intentional inputs, then `pnpm source:check` and
`pnpm verify:base-source`. Do not edit copied module bytes while claiming exact
custody, mix convenient revisions or hide copied drift. Product policy/bindings
belong in product adapters. Future shared adoption must preserve per-file modes
and hashes and replace duplicate implementations without losing assertions.

## Data, migration and integration policy

Use `pnpm run export -- …` and `pnpm run import -- …` for local archives, and
`pnpm run data:export -- …` / `data:import -- …` for authenticated archives of a
running installation, exactly as documented in `docs/data-ownership.md`.
Hosted HTTPS export/journal downloads require current native operator authority
and an owner-only session input file. Local restore requires an empty isolated
installation and its latest separate erasure journal. Original R2 bytes retain
hashes. Installation authority, first-run state, sessions/tokens/outbox and
provider secrets are not a portable identity backup. Unknown schema,
untracked/missing files, overflow, stale journal or interrupted custody refuse
completion visibly.

All applied SQL remains byte-identical. Append numbered migrations, prove a
populated previous-head upgrade and repeated no-op, and preserve authority,
revocation, relationships, original files, snapshots/seals, receipts and erasure
custody. Expanded schema stays on source rollback. Restored pending or unknown
effects stay held for explicit reconciliation. Never run an older mail drain
against restored notification intents added by migration 0016.

A saved-file importer cannot manufacture verified identity, consent, operator
authority or an outreach audience. Replacement claims require tested real owner
exports; fixture evidence alone leaves `seed.json.replaces` empty. Scoped API
keys, owner claim/editor admission, tracker receipts and webhook/Slack delivery
must meet their named native authority, replay and custody checks before they
are advertised. Outbound Worker integrations require an enforcing deployment
transport; ordinary fetch is not a substitute. General tracker sync, automatic
publication and passive ingestion remain outside current supported scope.

## Change and verification rules

Keep files small by responsibility and remove retired code. Validate inputs at
trust boundaries, check current authority in the business transaction, and make
failure visible. Tests belong to the change: replace or remove tests for retired
behavior and record their replacements, additions and removals. Preserve tests
for required behavior. Do not special-case test inputs, alter applied SQL or
hide an old path behind a flag. Production mocks and semantic fallbacks are
forbidden; provider fixtures belong only in tests.

Run affected-flow checks while iterating; CI is the full verification wall.
Keep product tests small and meaningful, through commands, routes, transports or
built pages, with fakes only at the paid/network edge. Prove one-off fixes with
before/after evidence. Avoid fixed pin, version, file/environment-list, wording
or threshold-value assertions. Exercise affected real local/browser paths and
frozen clean-clone setup, including both widths, privacy, 404, same-origin
admission, axe/layout and owned-process teardown. A named passing receipt proves
only its bounded claim. Keep local proof, provider fixtures, export-file proof,
hosted Cron/inbox delivery, registry admission and public release separate.
SendGrid REL-007 duplicate suppression and excluded REL-011 callbacks remain open.

Record clause changes, migration/reconfiguration/recovery steps and Unreleased
changes accurately. Keep the version consistent across package, seed and release metadata. Later
releases use the maintained Base release tool and a reviewed export; never
expose private source ancestry or make a tag/public action merely because
preparation passed. AGENTS.consumer.md is an owner guide shipped at its
own path; the current source distribution does not silently replace this file.
