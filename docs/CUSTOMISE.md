# Make it yours

Penny is not a service you rent. It is source code you own, under the MIT licence, running in your own Cloudflare account. If you want it to work differently, change it. You can do that yourself or with your own coding agent: point it at the source, say what you want and have it verify the result.

This page shows where the common things live and how to keep your changes safe when new versions of Penny arrive.

## Start with configuration

Two small files hold the settings most owners change first.

**`src/ext/config.ts`** is what your customers see.

| Setting | What it changes |
|---|---|
| `ownerName` | The name in the portal header and footer, and the browser tab title. |
| `portalDescription` | The one-line description in the portal footer. |
| `showPoweredByCredit` | Whether the "Powered by" credit shows in the portal footer. |

**`src/ext/config.server.ts`** holds server-only choices. It is kept out of the browser, so it can hold addresses safely.

| Setting | What it changes |
|---|---|
| Operator membership | Managed in **Feedback settings → Operators**. Source configuration cannot reinstate a removed operator. |
| `workspaceTimezone` | The timezone for requester quiet hours. The default is Australia/Brisbane. A `WORKSPACE_TIMEZONE` value set at deploy overrides it. |
| `publicOriginAllowlist` | Initial exact parent origins for public portal embedding; defaults to empty. **Feedback settings → Portal embedding** saves the installation’s current list. |

The `OPERATOR_EMAIL` owner is created during setup. In **Feedback settings → Operators**, any operator can invite an email address and remove peers. The invitee confirms the email link to join with equal product access. Removal immediately revokes sessions, pending links and API keys. Only the setup owner can remove themselves; the confirmation names the verified active peer who will receive installation controls. Removing the last usable owner is refused. Development invitations arrive in the gated local outbox.

## Things you change inside the app

You do not need code for these. They live in the operator app, under **Feedback settings**:

- **Operators:** invite people by email, cancel invitations and remove operators.
- **Portal embedding:** save exact allowed parent origins.
- **Private custom fields:** create and edit definitions for accounts, requesters, evidence, requests, decisions, roadmap items and releases; edit typed values on their operator views.
- **Boards:** create, rename, reorder, archive, and set each one public or internal.
- **Tags:** create, rename, merge and delete private tags. A release needs at least one of these tags; like every tag, it stays inside the app and never appears on the public updates page or in emails.
- **Custom fields:** add private fields to requests, of type text, number, boolean or date. They are never shown to the public.

## Things you change in code

These are all in the source, so they are a short conversation with your agent.

- **Status labels.** The public status names (Open, Under review, Planned, In progress, Shipped, Declined) are set in `src/core/features/portal/ui/public-primitives.tsx`. Renaming a label is simple. Adding a status touches the database and the rules behind it, so it also needs a new forward migration.
- **Email wording.** Penny's emails are plain text assembled in code, not template files. Request updates are built in `src/core/features/notifications/delivery.ts`, release emails in `src/core/features/releases/delivery.ts`, and the requester verification message in `src/core/features/auth/native-service.ts`. Operator sign-in emails come from the bundled mail module under `base/modules/`.
- **Theme.** Penny's palette (paper, ink, copper, sand) and its type, Inter Tight, are set once in `src/core/ui/brand/tokens.css` and shared by the landing, the docs, the portal and the operator app. `src/index.css` turns them into the `--color-penny-*` Tailwind tokens the app's screens use, and the shared buttons, fields, cards and status chips live in `src/core/ui/app/`. Change a token and every page follows.
- **Quiet hours and batching.** The 20:00 to 08:00 quiet hours are written in `quietHours` in `src/core/features/notifications/eligibility.ts`, and the one-hour batching window lives in the notifications code. They are fixed behaviour rather than settings. Your agent can change them, but this is a change to how Penny treats your customers' inboxes, so ask it to update the matching tests.
- **Anything else.** Pages are TanStack Start routes in `src/routes/`. Features, each with its own routes, services and screens, live in `src/core/features/`. The database is D1 with SQL migrations in `migrations/core/`.

## Rules for changing Penny safely

Your agent is working with these in mind, and it helps to ask for them by name:

- **Keep the public and private boundary.** Never expose accounts, evidence, notes or operator fields on a public page, and keep server secrets out of the browser.
- **Migrate forwards.** Never edit a migration that has already been applied. Change the schema with a new migration, and verify it against existing data. Penny's deploy step refuses a changed migration history.
- **No mock fallbacks.** Missing configuration should fail visibly, naming what is missing. Do not add fake data or silent fallbacks.
- **Remove what you replace.** Delete old code rather than hiding it, and keep files small.
- **Write down what you want to keep.** If there are rules of your own, such as "committing a decision must never publish anything", put them in `.seed/intent.md` if you like. Penny's agent guidance tells your agent to read that file and treat it as binding.

Then check your work. Try the change locally with `pnpm dev` and walk through the real screens. Penny records a fingerprint of its source in `sources.lock.json`, and `pnpm verify` starts by checking it, so after any edit under `src/`, `scripts/`, `migrations/` or the deploy files it fails until you refresh the lock:

```bash
pnpm source:changes   # see what differs from the lock, and confirm it is only your edits
pnpm source:lock      # accept your edits into the lock
pnpm verify           # type, lint, migration and test checks
```

Commit your changes together with the updated `sources.lock.json` before you deploy. A new file must be added to git first, because the lock covers tracked files only. See [Install and deploy](/docs/install).

## How updates arrive

Penny does not come with an update command. When a new version is available, your own agent brings it into your copy, and you stay in control of how.

Your changes belong to you. An update never overwrites your customisations, and the guidance your agent follows says so directly: never regenerate over your fork or discard conflicting work wholesale. A good update looks like this:

1. Read the new version's release notes and what changed in the data model.
2. Prepare the update away from your live deployment, on a branch or a fresh copy.
3. Merge, rebase, reapply your changes or rewrite them. The method is your agent's choice. The outcome is what matters.
4. Refresh the source lock (`pnpm source:changes`, then `pnpm source:lock`), run `pnpm verify`, then try your own customisations in the running app, not only Penny's tests.
5. Keep your applied migration history and take a data export before you deploy. See [Export and restore](/docs/data).
6. Record what changed, what passed and anything left over.

Keep your own work in recognisable places, for example `src/ext/`, so an update has less to untangle. Those folders are conventions that make updates easier. They are not a limit on what you may change, and they are not a promise that updates apply automatically.

If you change Penny deeply, you can still take later improvements. Your agent can read what changed upstream and adapt it to your version.

For what Penny is and does today, see the [overview](/docs).

## Finding and filtering operator records

**Search** in the operator navigation searches request titles/descriptions, evidence wording, decision questions/rationales, roadmap titles/summaries, release titles/bodies, requester names/email addresses and account names. Public visitors cannot use this private search. A result opens its record; list-backed records open a focused record in the existing view.

Operator lists keep search, tags, sort and page in the URL. Request queues also filter moderation, board, public status, linked decision and account, and sort by votes, recent activity or age. Requests and evidence use their direct tags. Decisions inherit linked evidence and active mapped-request tags; roadmap items inherit mapped-request and linked-evidence tags; releases include their subject tags and target context. Accounts inherit tags from their evidence and linked requesters’ requests; requesters inherit tags from their evidence and authored requests. Tag filters never make these private tags public.

Requester records and their fields are available under the requester directory on **Accounts**. Custom fields preserve zero, false, empty text and a cleared value distinctly. An incompatible definition type change is refused while stored values use the old type.
