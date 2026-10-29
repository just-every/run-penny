# Microsoft Teams capture

Penny's **Send to Penny** message action queues a selected Teams channel message
or reply as private, unreviewed evidence. The native inbox shows its deep link,
source time, nullable source author and separate capturing member. Source people
receive no sign-in authority or email permission. Only the selected message's
text is retained after redaction; HTML becomes inert text, and files, cards,
images and surrounding conversation are omitted.

## Connect your installation

1. Register an application in the owner's Microsoft Entra tenant and configure
   an Azure Bot with that application ID. Enable its Microsoft Teams channel.
   Configure its messaging endpoint as
   `<installation origin>/api/integrations/teams/messages`. This implementation
   supports the Microsoft public cloud, channel messages and replies; personal
   chats and sovereign clouds are outside this channel connector.
2. Grant the application's Microsoft Graph **application** permission
   `ChannelMessage.Read.All` with tenant administrator consent. Penny still reads
   only its configured team and channels. The app credential never reaches Teams
   message payloads or Penny's browser.
3. Store `PENNY_TEAMS` as a deployment secret containing a JSON object with
   `applicationId`, `tenantId` and `clientSecret`. The IDs are Entra UUIDs. An
   optional `notificationUrl` is described below. Keep secrets out of source,
   browser settings and exports. Rotate the Entra secret in the provider and
   update this deployment secret when it expires.
4. Bind an installation-owned enforcing RPC service as `PENNY_TEAMS_EGRESS`.
   Its contract is `send({url,method,headers,body})` returning
   `{status,headers,body}`. Enforce verified TLS, public DNS/IP at connection
   time, no redirects, a bounded timeout and a 128 KiB response limit. Allow only:
   - GET `https://login.botframework.com/v1/.well-known/openidconfiguration`
     and `/v1/.well-known/keys`;
   - POST `https://login.microsoftonline.com/<configured tenant>/oauth2/v2.0/token`;
   - GET `https://graph.microsoft.com/v1.0/teams/<selected group UUID>/channels/<selected channel ID>/messages/<message ID>`
     and the selected message's `/replies/<reply ID>` route;
   - optionally POST the exact privately configured notification URL.
   The port receives credentials only for the fixed provider that needs them.
   It must not log request headers, token request bodies or notification URLs.
   A plain fetch binding is insufficient. Missing transport fails visibly.
5. Generate a private Teams app package directory with
   `node scripts/teams-app.mjs <application UUID> <https-installation-origin> <new-output-directory>`.
   Review the generated developer/terms/privacy URLs for the business. Zip the
   generated `manifest.json`, `color.png` and `outline.png` together. Install
   through the tenant's Teams app management and grant the selected members
   access to the **Send to Penny** action in message context. The app definition
   is not a Marketplace listing.
6. In **Feedback settings → Microsoft Teams**, enter the team's Entra group
   UUID (the group's ID in Entra or the message link's `groupId`, not its conversation ID)
   and exact channel IDs. Message activities may omit the Entra UUID; Penny uses
   the configured group and verifies any supplied `aadGroupId`. Choose the removal window (0–365 days), enable capture
   and save. The current owner becomes the accountable connector owner.

Bot Framework admission uses Microsoft discovery and signing keys, RS256,
issuer, application audience, lifetime, key endorsements when present and the
signed service URL. The activity must name the configured tenant and the Teams
message-action command. User-supplied text, links and key URLs never determine a
provider read. Token failures create no capture job. Repeated actions for the
same source identity create one inbox item, including after restarts or erasure.

## Recovery and source changes

Minute Cron owns durable capture jobs and source-check leases. Settings show
the accountable owner, state, attempts and a safe failure with recovery guidance.
Explicitly retry a rejected or interrupted capture, stop unfinished work, or
forget a stopped/failed job. Forgetting retains only a hash replay receipt.

Penny checks captured sources hourly while enabled. An edit marks the source
changed while retaining the captured version. Deletion, a soft-deleted Graph
message, access revocation or removal from configured scope marks it removed.
Cron purges all captured wording versions after the chosen window and records
one wording-free audit entry. Purging continues while capture is disabled.
Interrupted source checks stay visible until the owner reviews and saves
settings to retry. Concurrent or stale checks cannot reverse removal or purge.

Saving settings stops unfinished jobs; disabling stops provider reads.
Disconnect by disabling capture, removing `PENNY_TEAMS` and its transport
binding from the installation, and revoking/deleting the app credential in
Entra. Already captured evidence remains subject to the removal and erasure
policies. Product archives include provenance and replay hashes, disable
restored capture settings and hold unfinished work; they exclude credentials.
A new active owner must deliberately reconfigure and retry restored work.

## Teams operator notifications

The owner may create a Teams **Workflows** incoming webhook for the destination
channel and save its complete private URL as `notificationUrl` in
`PENNY_TEAMS`. Supported endpoints are HTTPS `*.logic.azure.com/workflows/...`
and `*.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/...`.
The enforcing service must allow only that exact URL. The Workflow URL is a
credential; never paste it into browser settings or commit it. Channel access,
Workflow authentication and any Microsoft licensing remain owner prerequisites.

Each operator independently enables Teams and selects off, immediate, daily or
weekly for inbox items on their owned boards, mentions, assignments, aging,
decision reviews, connector failures, published releases and their chosen
vote-demand threshold. Mentions, assignments and reviews are the only initial
selections; outbound delivery stays disabled until the operator opts in.
Native in-app mention notices remain enabled. Other NOTIFY-006 channels keep
their separate implementations and contract status.

Messages contain only event counts and a link to Penny's authenticated operator
app. They contain no customer identity, source text, private title, account
value or internal note. Daily digests close the previous local calendar day;
weekly digests close Monday-to-Monday in the workspace timezone, including DST.
A digest claims its entire closed period atomically, across paged discovery.
Open digest periods do not delay immediate events.

Connector alerts use one durable episode per connection, shared by capture and
source-check failures. Retrying a failed capture does not resolve the episode:
all outstanding faults must succeed or be explicitly stopped or erased. A later
failure after recovery starts a new episode. The same custody covers Discord,
outbound Slack/webhook and tracker work, and Orbit source-read failures. Episode
and fault records contain no captured wording and never travel in archives.

Accepted posts never replay. Definite rejections are visible and may be retried
deliberately while the same preferences remain enabled. Ambiguous or interrupted
POSTs become unknown: check Teams and mark resolved; they cannot be retried.
Changing preferences stops pending work, and uncertain in-flight work remains
unknown. Demo mode suppresses outbound notifications. Preferences, event queues
and send custody are installation-owned and excluded from portable archives.

## Upgrade and proof boundary

Apply additive migrations `0098_teams_capture.sql`,
`0099_teams_notifications.sql` and `0100_teams_notification_episodes.sql` through `rer setup` or the documented hosted
deployment path. Keep the expanded schema on source rollback. Existing records,
authority, snapshots, receipts and original files remain intact. Migration 0100
replaces notification triggers, adds installation-only episode/fault custody and
seeds existing Teams/Discord failures without replaying historical alerts. No
owner reconfiguration is needed.

`tests/browser/teams-capture.mjs` and `tests/browser/teams-notifications.mjs`
exercise the built Worker through public HTTP routes, browser UI and actual
scheduled events. Microsoft discovery/JWT keys, Graph responses and Workflow
outcomes are recorded at the network edge. Live Entra consent, Teams package
admission, a hosted enforcing service and Cron, and real channel delivery remain
owner-account proof. No such live account was used by those journeys.
