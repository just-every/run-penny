# Install and deploy

This page takes you from the Penny source to a running copy: first on your own computer, where nothing leaves your machine, then on Cloudflare. Start locally. It takes a few minutes and you can look around before you decide anything.

## What you need

- **Node 22.20.0 and pnpm 10.12.4.** The commands below select the pinned Node themselves and never change your global tools.
- **The Penny source** in a folder on your computer.
- **For Cloudflare only:** a Cloudflare account, an API token for it, and an email provider (SendGrid or Resend) with a verified sender address. Running locally needs none of these.

## Run it on your computer

From the project folder:

```bash
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email you@example.com
node scripts/rer.mjs dev
```

`install` installs the locked dependencies. `setup` creates private local credentials, applies the database migrations and creates the first owner, with an empty workspace and no sample records. The first run needs `--owner-email`. It checks a fresh sign-in message, then stops its temporary app before returning. `dev` keeps the app running in the foreground.

A few things to know about setup:

- It writes `.dev.vars` with fresh secrets and never prints them. Running setup again keeps the owner, your data, the saved address and those private settings exactly as they are.
- To use a different port, add `--port 8788` to the first setup command and use the URLs it prints. The default is 8787.
- Your local data lives in `.wrangler/state` inside your project folder. A second copy kept in a sibling `.penny-local-state-` folder is refused before anything changes; Penny never moves or deletes it.

### Sign in locally

Local mode needs no email provider and `dev` signs you straight in.

1. Open the `RER_OPEN` link that `dev` prints. It holds this copy's private dev key, so keep it to yourself.
2. You land on **Finish setup**, the first-run page. Review the owner, tick the confirmation and press **Finish setup**.
3. You arrive on the empty operator Overview, ready for your first board or evidence item.

Until you finish setup, every operator page sends you back to it; afterwards the setup address opens the app. The badge in the corner switches to a dev teammate or signs you out. To try the emailed link instead, run `dev --login`: Penny captures every message it would send in a local outbox, and the `RER_OPEN` link it prints opens that outbox; select the newest message, choose **Open this link**, then press **Confirm**. Requester verification on the public portal uses the same outbox, so you can try the customer side too.

To start over, stop the app and run `node scripts/rer.mjs reset --yes`. It lists what it removes, keeps your source and exports, and a new `setup` creates a fresh owner. To move your data, `node scripts/rer.mjs export --output exports/penny.rer` writes an archive and its erasure journal, and `node scripts/rer.mjs import --input exports/penny.rer --yes` restores them into an empty installation.

## Make it yours

Two small files hold the choices most people change first.

In `src/ext/config.ts`, set the name customers see, the one-line description in the portal footer, and whether the footer credit shows:

```ts
export const publicLandingConfig = {
  ownerName: 'Penny',
  portalDescription: 'Share feedback, follow the roadmap, and see published customer updates.',
  showPoweredByCredit: true,
} as const
```

`ownerName` is also the browser tab title. In `src/ext/config.server.ts`, which never reaches the browser, you can change the workspace timezone (default Australia/Brisbane), the operator allow-list and the origins you permit. See [Make it yours](/docs/customise) for more, including the one extra step that checking your changes needs.

## Email

Local mode needs no provider. A deployed copy does, because sign-in links, requester verification and notifications all go out by email. Choose SendGrid or Resend, verify a sender address and have the key ready before you deploy. [Email and notifications](/docs/email) covers both.

## Deploy to Cloudflare

Penny's deployment flow is a workers.dev installation in your own Cloudflare account. It creates a Worker, a D1 database, an R2 bucket and a queue, and serves Penny at a `workers.dev` address. It does not deploy on a push, and it does not support a custom domain yet. Local checks cover the application itself. Mail delivery and the one-minute schedule on a live Cloudflare deployment are things to confirm yourself after you deploy.

Set these in the shell you deploy from, and keep them out of files and history:

| Variable | What it is |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. |
| `CLOUDFLARE_API_TOKEN` | An API token for that account with Workers Scripts, D1, R2 Storage and Queues edit permissions. |
| `OPERATOR_EMAIL` | Your operator address. |
| `MAIL_PROVIDER` | `sendgrid`, `resend` or `later` (public reading without email sign-in). |
| `MAIL_FROM` | A sender address verified with that provider; not used with `later`. |
| `SENDGRID_API_KEY` or `RESEND_API_KEY` | The key for the provider you chose. |

Optional: `WORKSPACE_TIMEZONE`, an IANA timezone such as Europe/London for requester quiet hours (default UTC). Set it before you deploy and keep it for that workspace.

Then:

```bash
node scripts/rer.mjs deploy --dry-run
node scripts/rer.mjs deploy
pnpm run deploy:health
```

The dry run builds and validates locally and makes no request to Cloudflare. Deploy builds first, then creates or reuses the Worker, D1 database, R2 bucket and queue, applies the database migrations, uploads the build and checks it. Deploy health reads the deployed Worker's identity and `/health`, which confirms the database, file bucket and queue can be reached; it does not prove that mail is working. Running deploy again reuses the saved resources and secrets and rotates nothing. Use `pnpm run deploy` rather than bare `pnpm deploy`, which is a different built-in pnpm command.

The deploy prints a notice after it registers the schedule: Cloudflare may take up to about two hours to start the first scheduled run on some accounts, because a new schedule only starts at the account's next provider refresh. Judge delivery by Penny's own rows, not by Cloudflare's scheduled-analytics (which can list a new Worker as `__unknown__`): after the first run, `notification_batches` holds one row per delivery the schedule handled, with its state and any failure reason.

The first deploy generates `AUTH_SECRET` and `SETUP_TOKEN` once and saves them in `.rer/deploy/production-secrets.json`, mode 0600, with a ledger of what it created under `.rer/deploy/`. Resource names begin with `penny-production`, and the address comes from your account's workers.dev subdomain.

> [!WARNING]
> Deploy changes the Cloudflare account that the token belongs to. Check which account that is first. Do not run remote Wrangler migrations yourself before deploying: Penny keeps its own record of applied migrations and will refuse a history it cannot trust.

### Create the first operator session

After the first deploy, submit your `SETUP_TOKEN` once to `/auth/bootstrap`. Penny's own screens have no form for this step, so send a JSON POST from your terminal. The property that carries the token is named `token`:

```json
{"token": "<SETUP_TOKEN>", "displayName": "Your name", "returnTo": "/setup"}
```

Read the token from `.rer/deploy/production-secrets.json`. Send it with a `Content-Type: application/json` header and an `Origin` header equal to your deployment's exact origin, such as `https://your-worker.your-subdomain.workers.dev`. Penny refuses a POST without a matching `Origin`. Keep the cookie it returns private. This creates the one owner, using your `OPERATOR_EMAIL`. Open `/setup` with that session and finish first-run setup, then use `/signin` for later visits: request a link for your `OPERATOR_EMAIL`, open the message you receive and press **Confirm**. Keep the token out of shell history, logs and screenshots.

Your public portal stays empty until you create a public board and approve requester content. Deployment never loads sample data.

## Check your inputs

Before you deploy, ask Penny which inputs are missing:

```bash
pnpm run operations -- check --profile owner-sendgrid
```

It exits with 1 while inputs are missing, which is expected before you have configured hosting. It checks names and formats only: it does not contact Cloudflare or your email provider, and it does not prove a credential is valid. Use `owner-resend` or `owner-later` for the other mail choices; see [Email and notifications](/docs/email). `node scripts/rer.mjs doctor` reports your local tools and saved settings.

## If something goes wrong

- **Sign-in says email delivery is unavailable.** The deployment has no complete mail configuration. Public reading still works. Add the provider, key and sender, then deploy again.
- **A command says another store is present and exits 4.** You have a sibling `.penny-local-state-` folder or a `PENNY_LOCAL_STATE` setting. Penny will not read, move or delete it: back it up, move it into `.wrangler/state` yourself if it is the one you want, or remove it, then run the command again.
- **`dev` or `setup` says the port is held.** Another program owns the saved local port. Stop it, or use `node scripts/rer.mjs dev --stop` if it is a Penny server you started.
