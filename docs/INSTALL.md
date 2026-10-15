# Install and deploy

This page takes you from the Penny source to a running copy: first on your own computer, where nothing leaves your machine, then on Cloudflare. Start locally. It takes a few minutes and you can look around before you decide anything.

## What you need

- **Node.js 22 or newer.** Check with `node --version`; if it is missing, install the LTS from [nodejs.org](https://nodejs.org/en/download) or run `nvm install 22`. `rer` then fetches the exact Node (22.20.0) and pnpm (10.12.4) Penny pins into its own cache, so you never install pnpm and your global tools are not changed.
- **`rer`**, installed once: `curl -fsSL https://runeditrun.com/install.sh | sh` (or `npm install -g @runeditrun/rer`).
- **For Cloudflare only:** a Cloudflare account, an API token for it, and an email provider (SendGrid or Resend) with a verified sender address. Running locally needs none of these.

## Run it on your computer

```bash
git clone https://github.com/just-every/run-penny.git
cd run-penny && rer dev
```

`rer dev` installs the locked dependencies, sets up a local owner (`owner@run-penny.test`) with an empty workspace and no sample records, and starts Penny on the first free port from 8787. In a terminal it stays in the foreground; from a script it returns once Penny is ready and keeps it running until `rer dev --stop`. To be the owner under your own address, run `rer setup --owner-email you@example.com` once before the first `rer dev`.

A few things to know about setup:

- It writes `.dev.vars` with fresh secrets and never prints them. Running setup again keeps the owner, your data, the saved address and those private settings exactly as they are.
- To choose the port, add `--port 8788` to `rer dev` (or to the first `rer setup`) and use the URLs it prints.
- Your local data lives in `.wrangler/state` inside your project folder. A second copy kept in a sibling `.penny-local-state-` folder is refused before anything changes; Penny never moves or deletes it.

### Sign in locally

Local mode needs no email provider and `dev` signs you straight in.

1. Open the `RER_OPEN` link that `dev` prints. It holds this copy's private dev key, so keep it to yourself.
2. You land on **Finish setup**, the first-run page. Review the owner, tick the confirmation and press **Finish setup**.
3. You arrive on the empty operator Overview, ready for your first board or evidence item.

Until you finish setup, every operator page sends you back to it; afterwards the setup address opens the app. The badge in the corner switches to a dev teammate or signs you out. To try the emailed link instead, run `dev --login`: Penny captures every message it would send in a local outbox, and the `RER_OPEN` link it prints opens that outbox; select the newest message, choose **Open this link**, then press **Confirm**. Requester verification on the public portal uses the same outbox, so you can try the customer side too.

To start over, stop the app and run `rer reset --yes`. It lists what it removes, keeps your source and exports, and a new `setup` creates a fresh owner. To move your data, `rer export --output exports/penny.rer` writes an archive and its erasure journal, and `rer import --input exports/penny.rer --yes` restores them into an empty installation.

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

`ownerName` is also the browser tab title. In `src/ext/config.server.ts`, which never reaches the browser, you can change the fallback workspace timezone (setup and deploy save UTC unless you set `WORKSPACE_TIMEZONE`), the operator allow-list and the origins you permit. See [Make it yours](/docs/customise) for more, including the one extra step that checking your changes needs.

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
rer deploy --dry-run
rer deploy
npm run deploy:health
```

The dry run builds and validates locally and makes no request to Cloudflare. Deploy builds first, then creates or reuses the Worker, D1 database, R2 bucket and queue, applies the database migrations, uploads the build and checks it. Deploy health reads the deployed Worker's identity and `/health`, which confirms the database, file bucket and queue can be reached; it does not prove that mail is working. Running deploy again reuses the saved resources and secrets and rotates nothing. Use `pnpm run deploy` rather than bare `pnpm deploy`, which is a different built-in pnpm command.

The deploy prints a notice after it registers the schedule: Cloudflare may take up to about two hours to start the first scheduled run on some accounts, because a new schedule only starts at the account's next provider refresh. Judge delivery by Penny's own rows, not by Cloudflare's scheduled-analytics (which can list a new Worker as `__unknown__`): after the first run, `notification_batches` holds one row per delivery the schedule handled, with its state and any failure reason.

The first deploy generates `AUTH_SECRET` and `SETUP_TOKEN` once and saves them in `.rer/deploy/production-secrets.json`, mode 0600, with a ledger of what it created under `.rer/deploy/`. Resource names begin with `penny-production`, and the address comes from your account's workers.dev subdomain.

> [!WARNING]
> Deploy changes the Cloudflare account that the token belongs to. Check which account that is first. Do not run remote Wrangler migrations yourself before deploying: Penny keeps its own record of applied migrations and will refuse a history it cannot trust.

### Sign in to the deployed copy

The first `rer deploy` claims the owner for you: it uses the one-time `SETUP_TOKEN`, then removes it and prints "Claimed the hosted owner". Open `/signin`, request a link for your `OPERATOR_EMAIL`, open the message and press **Confirm**; the first sign-in ends at **Finish setup**. If mail is not working yet, `rer signin` prints a single-use sign-in link for the owner to your terminal (it expires within 15 minutes and is recorded in the owner's audit log).

Only if a deploy stopped after the Worker went live but before that claim do you claim by hand: POST `{"token": "<SETUP_TOKEN>", "displayName": "Your name", "returnTo": "/setup"}` to `/auth/bootstrap` with `Content-Type: application/json` and an `Origin` header equal to the deployment's exact origin, reading the token from `.rer/deploy/production-secrets.json`. Keep the token and the returned cookie out of shell history, logs and screenshots.

### Remove a deployment

`rer deploy --remove --yes` deletes the Worker, D1 database, R2 bucket and queue that the deploy record says `rer` created, reads back that each is gone and touches nothing else. Add `--environment NAME` if you deployed with one. Export your data first (see [Your data](/docs/data)); removal deletes it.

Your public portal stays empty until you create a public board and approve requester content. Deployment never loads sample data.

## Check your inputs

Before you deploy, ask Penny which inputs are missing:

```bash
pnpm run operations -- check --profile owner-sendgrid
```

It exits with 1 while inputs are missing, which is expected before you have configured hosting. It checks names and formats only: it does not contact Cloudflare or your email provider, and it does not prove a credential is valid. Use `owner-resend` or `owner-later` for the other mail choices; see [Email and notifications](/docs/email). `rer doctor` reports your local tools and saved settings.

## If something goes wrong

- **Sign-in says email delivery is unavailable.** The deployment has no complete mail configuration. Public reading still works. Add the provider, key and sender, then deploy again.
- **A command says another store is present and exits 4.** You have a sibling `.penny-local-state-` folder or a `PENNY_LOCAL_STATE` setting. Penny will not read, move or delete it: back it up, move it into `.wrangler/state` yourself if it is the one you want, or remove it, then run the command again.
- **`dev` or `setup` says the port is held.** Another program owns the saved local port. Stop it, or use `rer dev --stop` if it is a Penny server you started.
