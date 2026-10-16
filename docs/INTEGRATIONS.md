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
