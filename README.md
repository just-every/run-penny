<p align="center">
  <a href="https://run-penny.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.webp">
      <img src=".github/assets/banner-light.webp" width="100%" alt="Penny: Every customer, heard. 100% free, open source alternative to Canny, UserVoice and Productboard.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://run-penny.com">run-penny.com</a> · <a href="https://justevery.com">Part of Just Every</a> · <a href="LICENSE">MIT licensed</a></p>

<p align="center">
  <a href="https://justevery.com/#vol-penny"><img src=".github/assets/media/preview.gif" width="800" alt="Penny: Export invoices to CSV is published, thirteen emails go out to everyone who asked, and Marco's page reads Shipped"></a>
</p>
<p align="center"><a href="https://justevery.com/#vol-penny"><b>Watch the full demo</b></a> · 45 seconds</p>

<p align="center">
  <img src=".github/assets/media/flow.webp" width="800" alt="Marco's duplicate is matched to Export invoices to CSV, the release email is sent to 13 people, and his request reads Shipped with 13 votes">
</p>

<p align="center">
  <img src=".github/assets/media/screen-1.webp" width="800" alt="Penny's Evidence and alternatives: CSV export with four supporting customer quotes beside Accounting API with one contradicting quote"><br>
  <sub>Compare bets side by side, with the customers' own words as evidence.</sub>
</p>

<p align="center">
  <img src=".github/assets/media/screen-2.webp" width="800" alt="Penny's release detail for Export invoices to CSV: the published customer-safe update and its publication readiness, 13 recipients"><br>
  <sub>Publish the release and tell everyone who asked.</sub>
</p>

# Penny

Penny is a self-hosted customer-feedback decision product for one B2B software
business. Customers post and follow requests on a public board; operators record
evidence, compare and commit bets, approve what is public and publish status
updates and release notes. The requester board and the operator decision loop,
with maintained Base operator authentication and selectable SendGrid or Resend
mail, are implemented. The public source repository is
[just-every/run-penny](https://github.com/just-every/run-penny) and the current version
is 0.0.0, released as the annotated tag `v0.0.0` on the repository's first
commit ([RELEASE.md](RELEASE.md)). Wider release obligations are in
[ACCEPTANCE.md](ACCEPTANCE.md), and local checks do not establish hosted mail
delivery.

## Run it on your computer

Use Node **22.20.0** and pnpm **10.12.4**. The dispatcher selects the pinned
Node itself and Penny never changes global tools. The source
distribution is:

```bash
git clone https://github.com/just-every/run-penny.git
cd run-penny
```

<!-- penny-local-commands -->
```bash
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email you@example.com
node scripts/rer.mjs dev
```
<!-- /penny-local-commands -->

`install` is the frozen dependency install. `setup` needs an explicit owner on
the first run, builds, applies every migration, saves private settings (mode
0600), claims the first owner with an empty workspace and stops its temporary app
before returning. A repeat `setup` keeps the owner, the domain data, the saved
origin and the exact private settings. The default address is
`http://127.0.0.1:8787`; `--port 8788` on the first setup selects another
loopback port.

`dev` stays in the foreground and opens Penny already signed in: it prints
`RER_READY`, `RER_SIGNED_IN` with the owner's email, and `RER_OPEN`, a link with
this checkout's private dev key in its `#` fragment. Open `RER_OPEN` in your
browser; it trades the key for a local cookie and lands on `/setup`, the owner's
first-run setup: review the owner and press **Finish setup** to open the app.
Until you do, every `/app` page sends the owner back to `/setup`; afterwards
`/setup` opens the app. Keep `RER_OPEN` to yourself: anyone holding the key can
sign in to this local copy. A badge at the corner switches between the owner, a
dev teammate (`teammate@dev.localhost`, a real operator that exists only in local
data) and signed out. `dev --as teammate` or `dev --as signed-out` starts as one
of those instead, and `dev --login` turns dev sign-in off: open the outbox through
the printed `RER_OPEN` link, choose the newest message, **Open this link**, then
**Confirm**, exactly as an emailed link works. No email provider is needed and no
email is sent. In another terminal, `node scripts/rer.mjs outbox` prints the
outbox link again, and `outbox --owner-email EMAIL` requests a fresh sign-in
message for that owner. Without the key, the outbox, dev sign-in and anything
made in a dev session answer 404 or are refused, even through a tunnel or proxy;
`reset --yes` makes a new key and the old one stops working.

Verify, reset and move data from the same root:

```bash
node scripts/rer.mjs verify
node scripts/rer.mjs reset --yes
node scripts/rer.mjs export --output exports/penny.rer
node scripts/rer.mjs import --input exports/penny.rer --yes
node scripts/rer.mjs deploy --dry-run
node scripts/rer.mjs describe
```

`verify` is the bounded full check; stop dev first with `dev --stop`. `reset`
prints its contained inventory, refuses active operations, removes only local
data, owner, generated settings and installer state, and keeps exports, source
and deployment receipts. `export` produces a private archive and
`penny.jsonl.erasure-journal.json` beside it. `import` restores both into an
empty installation (run `setup` afterwards for a fresh owner). An archive
generated before an erasure is refused as stale, even with the latest journal:
generate a new archive and journal together. Unknown or pending effects stay
held, and source operator authority, first-run state, outbox and provider
credentials never transfer. `describe` lists every command, flag and effect.
`pnpm run VERB -- FLAGS` is the same dispatcher; use `pnpm run deploy` and
`pnpm run import`, because bare `pnpm deploy` and `pnpm import` are pnpm's own
commands.

`pnpm run preview` serves the fixed production output on the same state, and
`pnpm run preview -- --stop` stops it; a compatible repeated start reuses the
managed instance, conflicting modes refuse, and idle shutdown defaults to 30
minutes. See [RUN-LOCALLY.md](RUN-LOCALLY.md) for the shared queue and process
policy. Local data lives only in `.wrangler/state`; a sibling
`.penny-local-state-<checkout-name>` store or an external `PENNY_LOCAL_STATE` is
refused before any change. Startup never imports sample records.

## Connect your product and tools

Saved-file feedback imports use [MOVE-IN](docs/MOVE-IN.md). Server-signed host
identity signs requesters into the portal; [HOST-IDENTITY](docs/HOST-IDENTITY.md)
includes a working local host example. It grants no operator authority or email
consent. Native owners alone configure the embedded visual editor and portal
branding; other active operators retain equal product-operation access.

Settings manages named, scoped, optional-expiry API keys, reveals each token
once, and revokes it. [API](docs/API.md) describes the REST routes and explicit
publication approval. [INTEGRATIONS](docs/INTEGRATIONS.md) describes selected
public-event webhooks, Slack and signed inbound notes. [TRACKERS](docs/TRACKERS.md)
describes deliberate Linear/Jira issue creation or existing HTTPS issue linking,
provider-specific state receipts and uncertain-create reconciliation.

Outbound webhooks, Slack and remote issue creation remain configuration-disabled
until an installation-owned enforcing egress RPC service is provisioned. Local
composition tests use test-only transports. The owner-account deploy kit does not
provision that service or a custom domain; its declared origin is workers.dev.
Existing issue linking and authenticated inbound receipts need no outbound send.
Tracker state is private delivery evidence and never publishes a Penny status
automatically. Restored commands stay held and provider secrets must be
configured again.

## Set up your hosting account

You need a Cloudflare account with Workers, D1, R2 and Queues enabled, an explicit
account ID and an account-scoped API token. For deployed sign-in and requester
mail, choose SendGrid or Resend, verify a sender and supply that provider's key.
Choose `MAIL_PROVIDER=later` for public reading without email sign-in or new
requester verification; existing verified requester sessions keep their
permitted actions. Provider setup is your responsibility, and local tests do not
prove inboxes or hosted Cron delivery.

Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OPERATOR_EMAIL` and
`MAIL_PROVIDER` in your command environment. SendGrid additionally needs
`MAIL_FROM` and `SENDGRID_API_KEY`; Resend needs `MAIL_FROM` and `RESEND_API_KEY`.
`WORKSPACE_TIMEZONE` is optional and must be an IANA name; it defaults to UTC.
See [operations](OPERATIONS.md) for permissions and private file custody. Then:

```bash
node scripts/rer.mjs deploy --dry-run
node scripts/rer.mjs deploy
pnpm run deploy:health
```

Deploy builds before the provider credentials reach its deployment command. The
owner-account kit uses `deploy.json` for D1 `DB`, R2 `FILES`, producer Queue
`JOBS` and the minute Cron. Resource names start with `penny-production`; the
account supplies the workers.dev origin. The first run saves generated
`AUTH_SECRET` and `SETUP_TOKEN` once in `.rer/deploy/production-secrets.json`
(0600), and a durable ledger under `.rer/deploy/`. Repeat deploy and health reuse
saved settings and never rotate secrets. Conflicting identities, foreign
resources, drift and uncertain creates are refused. The output names the origin
and credential-file path, never values. After deploying, claim the first owner
through the same-origin native bootstrap procedure in [operations](OPERATIONS.md),
then use `/signin`; the owner's first sign-in ends at `/setup`.

Costs are estimates, not a measured Penny bill. Budget at least the account's
[Workers Paid minimum of USD 5/month](https://developers.cloudflare.com/workers/platform/pricing/)
when choosing that plan, plus storage/operations and separately billed
[SendGrid](https://www.twilio.com/en-us/products/email-api/pricing) or
[Resend](https://resend.com/pricing) mail usage. A domain may add registrar costs.
No subscription total, zero-cost installation or hosted service is promised.

## Move saved feedback in

Use [MOVE-IN](docs/MOVE-IN.md) to prepare private saved Canny classic CSV or
API-response files, review counts/omissions, then apply, resume or undo the saved
import on Workspace data through its persisted journal. Historical contributors
gain no sign-in or email permission; posts/comments await native moderation.
The importer is fixture verified; no real owner export or replacement is
claimed, and `pnpm feedback:status` validates the shipped documented-format
entry and its guide bytes. [CANNY-MIGRATION](docs/CANNY-MIGRATION.md) lists the
supported kinds and limits.

## Move your product archive

An operator can export the declared product tables and original R2 files from a
running installation over HTTPS using an owner-only session input file. Keep that
file separate from the private archive; never put a cookie in command arguments
or a URL.

```bash
pnpm run data:export -- --origin https://your-penny-origin --session-file ./private-session.json ./private-archive.json
pnpm run data:import -- --origin http://127.0.0.1:8787 --session-file ./destination-session.json ./private-archive.json --journal ./private-archive.json.erasure-journal.json
```

Restore targets an empty isolated local installation and needs the latest erasure
journal. It preserves the destination's native owner, holds restored delivery
work and never replays historical mail. Base sessions, authority and signing or
provider credentials are excluded; this is a product archive, not a portable
identity backup. Hosted restore and erasure remain disabled.
[Data ownership](docs/data-ownership.md) describes bounds, resume and recovery.

## The decision loop

An operator works from the first evidence to a published changelog without leaving the app:

1. **Record evidence** on the Evidence page: source, original wording, observed time, and optionally a named speaker and an existing account. Link it to a request or a candidate bet as supporting or contradicting, and mark it reviewed with a reason.
2. **Decide.** Create a decision with a question and an owner, add candidate bets, link evidence to each, and compare them on the same dimensions. Commit one bet with a rationale, owner, confidence and review date. Committing creates an internal Planned roadmap item and nothing public.
3. **Publish deliberately.** Approve the item's customer-safe title and summary and each request mapping. Approval alone puts the item on the public roadmap and shows the status on the mapped requests; withdrawing it removes them.
4. **Move and tell followers.** Move the item between Exploring, Planned, In progress, Shipped and Dropped with a reason. Each move of an approved item prepares a status update, available on Roadmap and Releases; publishing it adds it to every mapped request and queues one email per eligible follower. If approval or mappings change, the old draft is marked stale and can be deliberately discarded. The next roadmap move prepares a new draft from the current approval.
5. **Release.** Draft a release from Shipped items with a title, type, tags and body, then publish it. It appears on the public updates page and queues one delivery per eligible recipient; ambiguous provider outcomes remain unknown without automatic retry.

Approved roadmap transitions prepare private customer-safe status drafts in the
same transaction. Explicit grouped publication writes every approved request
history and one identity intent. Release drafts collect approved targets, tags,
type, title, body, author, date and an optional safe link; publication requires
every target still Shipped and the exact approved mapping set still valid.
Publication freezes one version and the complete deduplicated address-bound
audience before queueing. Public pages expose the approved wording only; mail
includes only that recipient's currently eligible snapshotted request contexts.
Release commands use the minute Cron independently of the request one-hour window
and honor workspace quiet hours. [Acceptance](ACCEPTANCE.md) lists the browser
checks and the parts of the contract that remain open.

## Screen and API map

| Client route | Screen | API |
| --- | --- | --- |
| `/` | product landing: what Penny does, with links to the docs, the public board, the source and sign-in; an old board link to `/` with `q`, `status`, `board` or `sort` redirects to `/portal/feedback` with the same query | none |
| `/portal/feedback` | published feedback and board browse (`/portal` redirects here) | `GET /api/public/boards`, `GET /api/public/requests` |
| `/portal/feedback/:slug` | published request, approved comments and the approved status | `GET /api/public/requests/:slug` |
| `/portal/roadmap` and `/:slug` | approved customer-safe roadmap | `GET /api/public/roadmap`, `GET /api/public/roadmap/:slug` |
| `/portal/updates` and `/:slug` | published releases, including the honest empty feed | `GET /api/public/releases`, `GET /api/public/releases/:slug` |
| `/docs` and `/docs/:slug` | documentation: the Markdown `docs/site.json` publishes, rendered at build time, in the landing's header, footer and paper style | none |
| `/signin` | operator sign-in by single-use emailed link | `/api/auth/*` |
| `/setup` | the owner's first-run setup; sends a signed-out visitor to sign-in and back, and a finished owner to the app | none |
| `/app/overview` | what needs you: moderation, unreviewed evidence, ready decisions, unpublished status updates, Shipped items without a release | `GET /api/operator/overview` |
| `/app/feedback` | evidence inbox: record, link and review evidence | `GET`, `POST /api/operator/evidence` and `/:id/links`, `/:id/review` |
| `/app/decisions` and `/:slug` | decision queue and comparable brief: add bets, link evidence, edit dimensions, commit | `/api/operator/decisions`, `/api/operator/decisions/:id/bets`, `/:id/commit` |
| `/app/roadmap` | internal roadmap: edit, approve, withdraw and move | `/api/operator/roadmap`, `/api/operator/roadmap/:id/approve`, `/:id/move` |
| `/app/releases` and `/:slug` | pending status updates, release drafts, publishing and delivery counts | `/api/operator/releases`, `/api/operator/roadmap-updates` |
| `/app/moderation` | feedback review, follower notification counts and request controls | `/api/operator/moderation`, `/api/operator/requests/:slug/context` |
| `/app/customers` and `/:slug` | operator-only account context | `GET /api/operator/accounts`, `GET /api/operator/accounts/:slug` |

All operator reads and writes require the same valid D1 session, and every write is same-origin and checked for maintenance. Loading, retryable failure, empty, missing-record, and expired-session states are deliberately rendered; no action is simulated with browser state or fixture data.

## Verify and build

```bash
node scripts/rer.mjs verify
```

The gate runs the structural command check, source and Base custody checks,
TypeScript and lint, the Worker trust-boundary, read-route and Start
session/SSR/privacy tests, the native Base suites, the data and installer
suites, and the Worker/Vite production build, and ends with the literal README
journey in a fresh clone. The browser scripts `pnpm test:browser`,
`pnpm test:browser:routes`, `pnpm test:browser:no-mail`,
`pnpm test:browser:operator-pages` and `pnpm test:browser:decision-loop` exercise
local Worker and interface behavior at 1440×900 and 390×844, including the
empty-store decision loop through status and release publication; they do not
establish hosted mail or Cron delivery. The read UI is exercised at all mounted
routes and representative widths, recorded in [`visual/README.md`](visual/README.md).

`node scripts/rer.mjs build` generates the Wrangler configuration, typechecks and
builds the Worker and assets with private settings excluded and restored.
`pnpm cf-typegen` generates binding types. `node scripts/rer.mjs check` and
`doctor` inspect the command contract and the local tools without installed
dependencies or provider accounts.

## Mail, quiet hours and suppression

Requester email quiet hours are fixed at **20:00–08:00**, using the IANA
`workspaceTimezone` in `src/ext/config.server.ts`. The shipped default is
Australia/Brisbane. Set the optional deployment environment input
`WORKSPACE_TIMEZONE` to a valid IANA timezone before deployment to select another
region, and retain it for that workspace; invalid or empty supplied values are
refused. The hours themselves, the one-hour first-event coalescing window and the
minute Cron are fixed; conversion uses `Intl.DateTimeFormat`, including
daylight-saving rules.

Provider suppression uses `POST /api/public/mail/events`. Configure SendGrid's
signed Event Webhook for this deployment URL, enable bounce and spam-report
events, and set `SENDGRID_EVENT_PUBLIC_KEY` to its base64 P-256 public key. For
Resend, select Resend as the mail provider and set `RESEND_WEBHOOK_SECRET` to its
Svix signing secret. Without the selected verification key the intake returns
503; provider setup and actual hosted callback delivery require separate proof.
Only authenticated events correlated to a recorded Penny notification attempt
and its exact recipient can suppress that address. Soft bounces do not suppress.

REL-011 is not fully satisfied: delayed or asynchronous bounces without
`sg_message_id` are rejected by the retained Base intake, although SendGrid
[documents that shape](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event).
Historical accepted attempts without the recipient snapshot or
attempt correlation also cannot authorize suppression.
Penny suppression for these excluded events is not implemented;
operators must review provider-side suppression separately. This limitation
applies even when the callback has a valid signature. SendGrid also lacks
provider duplicate suppression (REL-007); ambiguous sends remain unknown with
no automatic retry.

Still open are EVID-005 beyond choosing an existing account, EVID-007 duplicate
suggestions, EVID-008 evidence attachments and EVID-010 wording versions beyond
the preserved first version; DEC-006 revisions, DEC-007 review-due handling and
NOTIFY-003, and DEC-008 outcome evidence; and REL-003 post-publication
corrections, REL-008 outcome responses, REL-009 coverage and REL-012
subscribe-all. Published wording is immutable; no public outcome prompt or
outcome submission is offered. Version remains 0.0.0.

## How it is built

One Cloudflare Worker serves request-time TanStack Start React documents,
generated server functions, and the native Hono API. `/health` checks D1 through
Drizzle plus the required R2 and Queue bindings. The public portal reads only
customer-safe boards, published requests, approved roadmap projections, and
published releases. The operator app reads the D1 workspace only after the Worker
validates an allow-listed operator session. Buyer-owned public identity lives in
`src/ext/config.ts`; native admission and server-only settings live in
`src/ext/config.server.ts`. They supply the visible workspace name, portal
description, footer-credit toggle, browser title, and generic not-found branding
without exposing the server-only operator or origin configuration to the browser
bundle. Private research and copied competitor/prototype assets are excluded from
publication.

Read [the author guide](docs/AUTHORING.md) for source changes, `CONTRACT.md` for
the intended product guarantees, `docs/read-spine.md` for the route and
contract-area boundary, [Base adoption](docs/base-adoption.md) for the shared
sources and their proof boundary, and `HANDOVER.md` for the work still required
before a buyer-facing release. The [Penny flagship plan](FLAGSHIP-PLAN.md) and
its [user journeys](docs/user-journeys.md) describe future scope, not implemented
AI, source connectors, autonomous write workflows or outcome measurement;
[delivery and acceptance](docs/flagship-acceptance.md) sets its stage gates.
