# Signed receivers and outbound events

Feedback settings lets a native operator create or revoke named webhook, Slack
or internal-note receiver configurations. Signing keys appear once in a masked
field. Endpoints and keys stay in installation storage, outside product archives.
Revoking the issuer or connection prevents future use. Recreate the configuration
and re-enter its secrets after moving product data to another installation.

Outbound events are request publication, published comments, public status
updates and sealed release publication. The native business transaction records
the event and selected destinations together. Only current approved public
fields enter the immutable delivery body; private rationale, accounts, identities,
held/internal feedback and imported history do not. Restored events are held,
and restored queued/sending attempts become uncertain for explicit reconciliation.

The minute Cron uses Base's durable delivery repository. A rate-limit rejection
can retry with bounded backoff, at most four attempts. Ambiguous responses or
expired sending claims become uncertain. They do not automatically resend.
Settings shows safe attempt codes and permits an operator to reconcile a known
receipt as accepted or rejected with an evidence code. Reconciliation schedules
no new send. The same business event and destination cannot enqueue twice.

## Required outbound transport

The optional `PENNY_EGRESS` binding implements `send({url,headers,body})` as an
installation-owned Worker RPC service. It must enforce public DNS/IP policy at
connection time, verified TLS, no redirects, a bounded connection duration,
request size and response size. Penny validates public HTTPS destinations and
payload bounds before crossing that port. It never falls back to ordinary fetch
or loads a Node transport into the Worker. Without the binding, Settings says
outbound delivery is disabled and Cron does not enqueue or send integration work.

Base's egress service, copied at `base/modules/egress-service`, is that
service: its `EgressRestricted` entrypoint is the `PENNY_EGRESS` binding. It
validates the destination, applies the service-owned host grant and
account-ownership exclusions, resolves the name once and refuses any answer
that is not public, never follows a redirect and bounds the exchange. A name
whose answers are all Cloudflare addresses is sent with platform fetch, which
resolves again and relies on the platform's private-address refusal and TLS;
edge-to-origin TLS then follows the destination zone's policy. Every other
destination is pinned to its validated address over verified TLS.

Outbound integrations stay off by default. To turn them on, the owner deploys
the egress service once per account and environment (its README, *Deploy*),
then adds the binding to `deploy.json` with the grant from that deployment's
receipt:
`"services": [{ "binding": "PENNY_EGRESS", "project": "runeditrun/egress-service", "entrypoint": "EgressRestricted", "grant": … }]`.
The owner deploy refuses until the service exists and checks the binding
strictly. `tests/base/egress-delivery.test.ts` drives the minute Cron through
this entrypoint with test network ports and shows a private answer refused
before any connection and a redirect returned without being followed. That is
local proof of Penny's wiring, not a deployed installation or a Slack
workspace connection.

## Signed internal-note receiver

Create a signed receiver in Settings and save its key. Send an exact UTF-8 JSON
body `{ "requestId": "…", "note": "…" }` to the displayed receiver path with
Base `integrations.webhook.v1` headers. Its tenant is `penny-inbound`, destination
is the receiver ID, and event is `request.note`. The HMAC covers the versioned
tuple of tenant, destination, event, delivery ID, timestamp and exact body.
Use the maintained Base sender/receiver protocol; do not reserialize received
JSON before verifying it. Requests are bounded to 32 KiB and a five-minute
signature timestamp window. Original bytes verify before parsing.

The receiver appends an internal note attributed to its issuing product operator.
Operators read it on its request in Moderation, under Internal notes, with the
receiver's name and the time it arrived; Send a test links straight there.
Its replay fingerprint, note and processed receipt commit in one D1 transaction
under current native issuer/connection authority. An identical retry is a no-op;
a changed payload under the same identity conflicts. No receiver can publish
content, sign a requester in, grant email permission or claim installation
authority. Receipts and note copies participate in product export and erasure.

Slack uses the maintained minimal plain-text Block Kit section surface, with
escaped content, disabled formatting and disabled link/media unfurls. Its
incoming-webhook URL stays private. Provider documentation:
[Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/)
and [section blocks](https://docs.slack.dev/reference/block-kit/blocks/section-block/).

## Capture selected Slack messages

An owner installs their own Slack app using
[`integrations/slack/manifest.json`](../integrations/slack/manifest.json), replacing
`YOUR-PENNY` and `CONNECTION-ID` after configuration. Slack supplies the App ID,
workspace ID, bot token and signing secret in the owner's Slack app settings.
Invite the bot to each selected public, private or Slack Connect channel. The
egress service must grant `https://slack.com`; no ordinary-fetch fallback exists.
The app requests source-read scopes and `commands`, which Slack requires to
expose the message shortcut. It sends no Slack post or customer message.
For an existing app, add `commands` in its OAuth scopes and reinstall it into
the workspace to grant the new permission; saving the manifest alone does not
update an installation's grants. Then confirm **Send to Penny** appears on a
selected channel message.
Slack App Directory publication remains separate field proof (R-8).

Configure through same-origin, native-owner-authenticated
`POST /api/operator/integrations/chat` with this JSON shape (use private values
for the two credentials, never a public script or URL):

```json
{
  "teamId": "TWORKSPACE",
  "appId": "APENNY",
  "channels": ["CSELECTED"],
  "reaction": "penny",
  "purgeDays": 30,
  "workspaceAccounts": [{"teamId": "TCUSTOMER", "accountId": "EXISTING-PENNY-ACCOUNT-ID"}],
  "botToken": "YOUR-PRIVATE-BOT-TOKEN",
  "signingSecret": "YOUR-PRIVATE-SIGNING-SECRET"
}
```

The response names the two request paths to paste into Slack's Event
Subscriptions and Interactivity settings. Slack URL verification also requires a
valid signature. Use **Send to Penny** on a message or add the chosen emoji. The
receiver checks the raw-body HMAC, five-minute timestamp, app, workspace and
selected channel before queuing IDs. It acknowledges before source reads; the
minute Cron resumes durable work. An excerpt appears once even when either
trigger replays or both target the same message. Only that message is stored,
redacted under current owner rules before its write; files and the remaining
thread are omitted. Source provenance keeps Slack author and capturer IDs, plus the author’s
source display name when available; it creates no native operator, verified
requester or mail subscriber. Slack Connect maps an
external author's workspace to an existing account only when Slack confirms the
channel's shared-team relationship. If the message omits its team, Penny uses
the author workspace returned by `users.info` and still checks that shared-team
membership. A missing author, membership or mapping leaves the account empty.

`GET /api/operator/integrations/chat` shows scope, last successful work, safe
failure codes, an `unresolved_failure_count` per connection, and the latest 100
jobs. Follow `nextCursor` as the `cursor` query parameter for older jobs;
`limit` accepts 1–100. Filter by `connectionId` and by `state` (pending, running,
failed, succeeded, stopped or `unresolved`). The unresolved filter includes
retrying jobs carrying a failure, so newer successful checks cannot hide them.
Credentials and event envelopes are never returned. Jobs have due times, leases, attempts and pending/running/failed/
succeeded/stopped states; an interrupted lease is recoverable. Read failures
retry at most eight times, respecting rate-limit delays. A failure remains
visible across restarts until that job succeeds or the owner explicitly stops
it. Requesting a retry retains the failure while that attempt is pending.
`POST /api/operator/integrations/chat/jobs/JOB-ID` with `{"action":"retry"}` or
`{"action":"stop"}` is the owner's explicit recovery control. The accountable
owner's removal, role change or authority-version change stops pending work.

`POST /api/operator/integrations/chat/CONNECTION-ID/state` accepts
`{"state":"paused"}`, `{"state":"active"}` or `{"state":"revoked"}`.
Paused capture admits no new events and resumes pending work when active.
Revocation deletes Penny's local credentials and stops work; also uninstall the
app in Slack to revoke its provider token. Slack's signed uninstall/token-revoke
event performs local revocation too. To change scope, mappings or credentials,
pause the old connection and create a new one for the same verified workspace.
Creation transfers supervision of existing sources in the newly selected
channels from paused, revoked or missing connections. No recapture is needed:
the new connection's signed events and hourly checks monitor the stable
workspace/channel/message identity. Superseded jobs for transferred sources
stop explicitly. Sources outside the replacement's selected channels keep their
previous supervisor; leave those connections active if monitoring must continue.
Another active connection's sources are not taken over. Evidence, capturer,
captured wording and existing removal deadlines remain intact; the replacement's
policy applies to future removals. Update both request URLs in Slack to the new
paths, then revoke the old connection. Revoking before replacing starts the old
removal policy window, and replacement never cancels or extends that deadline.

Inbox cards link to the original thread and show the Slack capturer and source
state. Source edit/delete events and bounded hourly rechecks retain the captured
version while marking changes or removal. Lost source access also marks removal.
After `purgeDays` from removal, Cron purges every stored excerpt version and its
source-person attribution. No Slack message is edited or deleted. Configuration,
secrets and unfinished jobs stay out of archives; source provenance travels
with evidence and is included in its erasure graph. A restore needs a new
connection and cannot resume the old installation's jobs.

Nook currently exposes only notification posting, update/delete and permalink
methods through its Slack-compatible API. Its published API explicitly excludes
events and interactive messages, and app tokens cannot read messages. Penny does
not treat it as a Slack capture provider or invent an unsupported endpoint.
CAP-010's Nook shortcut/reaction journey requires those public capabilities in
Nook before it can be exercised against a Nook installation.
