# Penny demo

After the ordinary `rer setup`, run `rer demo` (`rer dev --demo`) and open its
private `RER_OPEN` link. It opens signed in as the saved owner, on a finished
first run, with Penny's sample workspace (`sample-data/penny.v1.json`: accounts,
attributed evidence, requests on two public boards, a committed decision, the
roadmap and a draft release) and a Demo bar on every page. `rer demo --stop`,
Ctrl-C or the demo's end (one hour) deletes its folder `.rer/demo/<start>/`; a
new demo starts afresh. The checkout's own `.wrangler/state` is never opened:
Penny's adapter migrates and claims the owner inside the demo's folder and skips
its usual read of the checkout's database.

## What a demo cannot send

| Effect | In a demo |
|---|---|
| Mail (SendGrid/Resend in production): operator invites, requester sign-in links, status, release, rejection and review mail | Captured in the development outbox and listed in the Demo bar, never sent. On the hosted demo, Base's operator sign-in and invite mail is captured but answers `mail_unavailable`, so nothing is described as delivered. |
| Webhook and Slack deliveries | Off: they need the enforcing egress binding (`PENNY_EGRESS`), which a demo never has. Connections save; Settings says "Outbound delivery is disabled" and no delivery is queued. |
| Linear (and Jira) issue creation | Off for the same reason: `tracker_creation_unconfigured` (503). Linking a known issue still works. |
| Public roadmap, status updates and releases | Publish normally, but only into the demo: locally on its loopback origin, and on the hosted demo behind the visitor's own `rer_demo` cookie, so nothing a visitor publishes is publicly reachable. |
| Anything else (`fetch`, sockets, beacons) | Base's guard (`base/modules/demo`, `withDemo` first in `src/server.ts`) answers loopback only and lists refusals; the hosted container also has no internet. |

## Hosted demo

`deploy-demo.json` puts the demo at `https://demo.run-penny.com/`;
`.github/workflows/run-demo.yml` deploys it (manual dispatch, or each push to
`main` once `RUN_DEMO_DEPLOY` is `true`) from the `run-demo` environment, and
with `test_only` deploys the separate test host `demo.test.run-penny.com` with
Turnstile's test keys; `remove` takes either down. Each visitor gets their own
container running Penny's image (`deploy.json` `platforms` includes `container`,
workerd engine), signed in through Penny's existing owner claim
(`/auth/owner-claim`). The demo front names the owner, session secret and claim
installation the Base way (`OWNER_EMAIL`, `SESSION_SECRET`,
`RER_OWNER_CLAIM_INSTALLATION_ID`); `src/demo.ts` maps the first two onto
Penny's `OPERATOR_EMAIL` and `AUTH_SECRET` only under `RER_DEMO=1`, and the
claim route accepts Base's installation name. `rer deploy` refuses any
declaration or settings carrying `RER_DEMO`. See Base's `export/DEMO.md` for
the host itself.

## Base copy

`base/modules/demo` is Base `modules/demo` at 3935139 with Base's
`modules/operator-auth/csp.mjs` beside it: Penny's operator-auth copy predates
that file, so `index.mjs` imports `./csp.mjs` (its only change; `edition.json`
maps it). The other files are recorded verbatim in `base/PROVENANCE.json`.
