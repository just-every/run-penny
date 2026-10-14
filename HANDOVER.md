# Penny implementation and release status

Penny is a 0.0.0 customer-feedback decision source candidate. Its requester
board, the operator evidence → decision → approved roadmap → status → changelog
loop, saved-feedback import, native owner claim and host sign-in, scoped API keys
and tracker/webhook/Slack composition, and a bounded product archive are
implemented. A named passing test proves its stated scope only. CONTRACT.md,
BASELINE.md and ACCEPTANCE.md retain the wider unmet obligations.

## Running and checking it

README.md has the commands: `rer install`, `setup`, `dev`, then
`verify`, `reset`, `export`/`import` and `deploy`. Setup claims the first owner,
and the owner finishes first-run setup at `/setup` after the outbox sign-in. The
unit of verification is `rer verify` (the same run CI makes on
every push); it ends with the literal README journey in a fresh clone at 1440×900
and 390×844. The other browser scripts (`test:browser`, `:routes`, `:no-mail`,
`:operator-pages`, `:decision-loop`, `:feedback-import`, `:host-identity`,
`:editor`, `:integration-api`, `:integrations`) exercise their flows at both
widths against a local server; they prove local Worker and interface behavior,
not hosted mail, Cron delivery, a deployment or a public release.

`.wrangler/state` is the only local data location, and an ambiguous second store
is refused before any change (OPERATIONS.md, "Local state placement"). Worker
tests select the explicit `test` environment, so production defaults cannot start
them, and the retained predecessor Worker suite keeps its historical credential
transport with all product migrations.

## Source and custody

Every Base copy uses `1077a2e4fd6b1ead9ae312f1b72cc0ee21270665`: the shared CLI,
onboarding, authoring tools, delivery producer and the selected native modules
(operator auth, owner claim, mail, import kit, integrations, editor, deploy kit)
and Base's first-run runtime (`src/base/setup.ts` and `theme-frame.ts`). Shared tests and fixtures stay
in Base; Penny keeps its product and adapter checks. `scripts/rer.mjs` is Penny's
own thin dispatcher: it applies state-placement policy before any mutating
command, then calls the shared CLI. `edition.json`, the per-copy hashes and modes
in `base/PROVENANCE.json`, the comparison archives and `sources.lock.json`
identify the shipped source; public readers can verify the bytes offline. The
public repository is `https://github.com/just-every/run-penny`, version 0.0.0
([source provenance](docs/SOURCE-PROVENANCE.md), [releasing](RELEASE.md)).

The first release is a parentless export of the exact verified tree with the
annotated tag `v0.0.0` on it.
Matching blobs and executable modes and an accepted name do not satisfy the
secret-environment or retained-container/visual inspection; a publication
preparation must record every unavailable guarantee, and no listing or local test
authorizes a public repository action. Private history and existing tags stay.

## Data, migrations and recovery

Authenticated HTTPS export/journal downloads use current native operator
authority, private/no-store responses and export maintenance fences. The schema
inventory classifies every table (product tables are archived; installation tables
such as authority, sessions, outbox and `oa_first_run` are not), and unknown
schema, untracked/missing files, overflow and interrupted custody refuse
completion. Local archives use Base's streaming engine with Penny's native schema,
effect-hold and latest-journal policy: an archive that precedes an erasure is
refused even with a later journal, completed import staging is removed through
Base's cleanup API, and native erasure includes that cleanup in its deletion
transaction. Hosted restore and supported-root erasure now have guarded,
authenticated API and CLI source paths; the Data screen presents state and exact
commands without destructive buttons. Their current proof is source-only over
local TLS, with native authority, same-origin mutation, maintenance, empty-target,
latest-journal and preview-hash fences. Real hosted restore/erasure and universal
DATA-001/003 and BASE-DATA-001/003 remain unmet; see docs/data-ownership.md for
bounds, destination journal continuity and exclusions.

Reviewed main's applied migrations 0001–0029 stay byte-identical. 0016 holds restored batched and
unbatched notification history so it cannot send; never run an older mail drain
against it. 0025 adds the maintained portability schema, 0026 composes the import
kit's erasure, stream-origin, staging and custody exports with Penny's maintenance
guards (all its tables are classified), and 0027 adds the installation-owned
first-run record and marks setup finished for an installation that already has an
active owner. 0028 adds native dev sessions and installation-only credential
custody; 0029 records dev-minted API keys atomically, retaining their local gate
and production refusal. New clause migrations 0030–0033 add evidence custody,
release corrections/outcomes and decision review/completion after that inventory.
The populated-0029 test compares all prior columns after each migration and a
repeat; the populated-0015 test remains separate. Final integrated receipts are
in the release-review evidence referenced by ACCEPTANCE.md. Keep expanded
schema on source rollback, stop old workers before an upgrade and reconcile
uncertain effects explicitly.

## Product decisions recorded by the owner

- The public board is `/portal/feedback`; `/` is the product landing and `/portal`
  redirects. A `/` request with the board's old `q`, `status`, `board` or `sort`
  redirects there with the same query. First-party documentation is `/docs`, the
  Markdown `docs/site.json` publishes, rendered at build time with every other
  in-scope Markdown file listed there as GitHub-only. `pnpm test:docs` checks
  coverage, link resolution and that a broken link fails the build. Known
  cosmetic defect: when an absolute machine path ends a paragraph, the build
  message includes the closing `</p>` in the reported path; the build still fails.
- Penny's mark is a hand-inked copper penny alone (no thought bubbles, no ¢, no
  cloud). It is the one `CoinMark`
  component in `src/core/ui/brand`, the only logo on every surface, drawn as inline
  SVG in tiers: `full` for the landing drawings' large coins (via the single
  `CoinSprite` symbol, which throws if missing so a page cannot silently draw
  nothing), `medium` for the header, footer, portal, sign-in, 404 and operator
  marks, and the 16-unit drawing for the favicon only. Each drawing fills its grid,
  so a lockup sets `--coin-slot` (the height it gives the mark) and `coin.css`
  narrows the box to the coin; Base's 32px logo square is narrowed the same way in
  `public/rer-theme.css`. The owner dislikes
  pixel-snapped art on the large coins. The copper stamp is a freehand
  five-point star; the eight-arm asterisk was dropped because it read as another
  company's logo.
- The portal, sign-in and operator app share one visual kit in `src/core/ui/app/`
  (`BrandRoot`, `classes.ts`, `Chip`, `PageTitle`, `DataField`, `EmptyState`).
  Typed text in inputs is normal weight, labels are semibold, and every app
  `<details>` uses the chevron summary classes. The accent reads
  `--penny-brand-accent`, set from `src/branding.json` (copper text tone
  `#ad4a1f`) and the owner's portal branding. `/auth/confirm` and `/setup`
  wear Penny's look through Base's theme hook (`public/rer-theme.css`);
  `/__dev/outbox` keeps Base's layout.
- Fonts are Penny's own: Inter Tight (and Kalam for the drawings), self-hosted in
  `public/fonts`, linked from the root document and from the first-run page. Base's
  default font does not apply, and the type stacks are declared in
  `src/core/ui/brand/tokens.css`.
- Operators are equals; only native owners configure the embedded editor and portal
  branding. SendGrid has no provider duplicate suppression, so ambiguous sends stay
  unknown and are never retried automatically (REL-006/REL-007).

## Integrations

Optional `/auth/owner-claim` precedes native auth dispatch; the trusted issuer,
installation ID, exact application audience and public verification keys are
installation inputs, and the existing `AUTH_SECRET` maps to native Base session
authority at that single boundary. Owner-only editor configuration uses the
current owner session, a short no-store lease and a validated management origin.
Requester host sign-in uses server-signed exact-audience claims and the native
business transaction with replay, conflict, block, removal and erasure fences;
signing material stays out of browser source and archives, and identity grants no
email permission or operator authority (docs/HOST-IDENTITY.md,
examples/host-identity).

API keys are hashed, revocable and scope-selected per route, and never admit
operator documents, generated functions, exports or owner configuration. Public
snapshots still require deliberate approval. Delivery uses native D1 and Cron with
Base's repository and DeliveryService; unknown effects stay uncertain for explicit
reconciliation, import batches suppress enqueue in the same transaction, and
portable restores hold events/commands and never carry installation credentials.
Signed inbound notes and Linear/Jira state receipts verify exact bounded bytes
before parsing and commit replay custody with their business mutation; tracker
state never changes public Penny status. The `PENNY_EGRESS` RPC port must enforce
connect-time public DNS/IP, TLS, redirect refusal and request/response bounds,
there is no fetch fallback. Base's egress service (`base/modules/egress-service`)
implements that port; outbound services stay disabled until the owner deploys it
and declares the `PENNY_EGRESS` service binding with its receipt grant
(docs/INTEGRATIONS.md).

The saved-file importer reads Canny v2 comments, derives merge relationships from
saved `mergeHistory` only with complete source and target posts, and needs an
explicit Tags-cell mapping for classic CSV (docs/CANNY-MIGRATION.md). Imported
history sends no mail and cannot manufacture verification, consent, operator
authority or public approval; checkpoints survive restart and undo refuses later
native work. No real owner export exists, so `seed.json.replaces` stays empty.

The maintained schema-2 delivery producer, canonical setup binding and the
dispatch-only trusted-build caller are in source: the generated project
descriptor binds the `rer-setup.json` bytes with `setup.path` and `setup.sha256`,
and a registered project's separate `setupDigest` must match. Remote project
creation stays disabled, and this is not a workflow dispatch, registration,
installation or deployment (docs/delivery-preparation.md).

## Open obligations and owner-only steps

Unmet or partial: REL-007 (provider duplicate suppression), REL-011 (events
without `sg_message_id`, uncorrelated historical attempts), universal portability,
real hosted restore/erasure and customer-outcome/economic acceptance. The
EVID-005/007/008/010, DEC-006/007/008 with NOTIFY-003 and REL-003/008/009/012
source paths now have the bounded historical feature evidence in ACCEPTANCE.md;
that evidence does not certify this integrated head or live provider effects.
General tracker sync, passive ingestion, autonomous publication and wider
requirements remain excluded or unmet as CONTRACT.md records. Hosted health,
provider inbox and Cron delivery, applicable-prefix teardown, registry admission, platform signing-key
transport and public-release inspection need their own receipts.

Owner-only and unperformed: custom-domain or egress provisioning, Resend sender
configuration, stage installation, preview and production deployment, registry
admission, the public visibility flip, the version tag and the site pin. No
deploy, tag, public push, repository creation or visibility change has been made.
