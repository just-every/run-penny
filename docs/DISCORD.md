# Discord capture

Penny's optional Discord app captures a message into the private evidence inbox
from the **Send to Penny** message command or a selected emoji reaction. The
triggering member is the capturer; the message author remains a nullable source
person. Neither becomes a verified requester or receives email permission.
Only the selected message's text is stored, after the installation's redaction
rules. Embeds, files and surrounding messages are omitted. The inbox retains a
jump link, source time and separate author/capturer attribution.

## Connect an installation

1. In Discord's Developer Portal, create an application and bot for the owner's
   community server. Enable **Message Content Intent** (Discord approval may be
   needed for a verified application). Install with `bot` and
   `applications.commands` scopes. Grant **View Channel** and **Read Message
   History** only in the channels to be captured. Penny never posts messages.
2. Store `PENNY_DISCORD` as an installation deployment secret: a JSON object with
   `applicationId`, the application's 64-character hexadecimal Ed25519
   `publicKey`, `botToken`, and a randomly generated `gatewaySecret` of at least
   32 characters. Keep the same gateway secret in the relay's private
   configuration. Do not commit either file or put secrets in browser settings.
3. Configure the optional `PENNY_DISCORD_EGRESS` service binding. It implements
   `send({url,method,headers,body}) -> {status,headers,body}` for GET only, limited
   to `https://discord.com/api/v10/channels/<id>/messages/<id>`. It must enforce
   public DNS/IP at connection time, verified TLS, no redirects, bounded timeouts,
   and a 64 KiB response limit. An ordinary fetch binding or the existing
   POST-only integration service does not implement this port. No provider call
   or alternative transport is used when it is absent.
4. Set the Discord application's Interactions Endpoint URL to
   `<installation origin>/api/integrations/discord/interactions`. Penny verifies
   Ed25519 over the timestamp and original body before JSON parsing, including
   Discord's PING probe. Signatures older than five minutes are refused.
5. In **Feedback settings → Discord capture**, enter the server ID, exact channel
   IDs and a Unicode reaction or custom emoji ID; choose the source-removal
   retention window (0–365 days), enable capture and save. Discord Developer Mode
   exposes **Copy ID**. Threads are separate channels and must be selected by
   their own IDs. Saving assigns the current owner as accountable and stops
   unfinished work; review and deliberately retry any that should continue.
6. Create a separate owner-only JSON configuration file (mode `0600`) for the
   relay with `appOrigin` (HTTPS origin, no trailing slash), `applicationId`,
   `botToken`, `gatewaySecret`, `guildId` and `channelIds` (array). Run
   `node scripts/discord/register.mjs <private-config.json>` once to install the
   message command in that server. It starts disabled for ordinary members;
   grant the chosen roles/members access in Discord's Integrations settings.
7. Under the owner's process supervisor, run
   `node scripts/discord/relay.mjs <private-config.json> <private-state.json>`.
   Use a POSIX host with Node 22.20 or later. Keep both files outside source control, in an
   owner-only directory. The relay subscribes only to guild reaction metadata,
   filters the configured server/channels and forwards a minimized event signed
   with HMAC-SHA256. Penny rechecks current channel scope before any message GET.
   Update the relay's scope when changing Penny's scope. Penny's scope is always
   the final authority; stale relay configuration cannot broaden it.

The configuration, bot and transport are owner-account prerequisites. Recorded
network-edge fixtures prove local protocol behavior; a live Discord installation,
Gateway continuity and hosted service/Cron execution still need the owner's
account proof. No account or paid service is created by the shipped commands.

## Progress, recovery and removal

The minute Worker schedule drains up to ten pending captures. Each job retains its accountable owner and native membership version. Each message has
one durable identity across both triggers, replays and restarts. The owner can
refresh progress, see failed reads and explicitly retry or stop them. **Forget capture** removes a failed, stopped or held job’s personal attribution and keeps only a hash replay guard. Completed evidence uses the existing Data erasure controls. Rate limits
and provider failures stay failed without an automatic replay. A killed claim
becomes visibly failed after five minutes; explicit retry uses the same identity
and an atomic evidence/receipt transaction prevents duplication. A pause or scope
change during a read prevents its completion.

The relay persists its Gateway session and sequence only after Penny accepts the
event. A crash before the save replays the same identity. Gateway reconnects are
bounded to five failures, with heartbeat acknowledgement and resume; invalid
sessions clear their cursor. Discord authentication or privileged-intent refusals
stop visibly. Inspect the supervisor's exit state and Penny's failed jobs before
restarting. If an unclean exit left `<private-state.json>.lock`, first confirm
that the old process is dead, then remove that lock. Never run two relays with
one state file. Discord can invalidate a resume session after a long outage;
Penny does not enumerate channel history to fill that gap. Stop capture and
explicitly select a missed message with the command after reconnecting.

Each captured source is rechecked hourly, up to ten per minute. An edit marks it
**changed** while retaining the captured text. A Discord 401, 403 or 404 marks it
**removed**. Removing a channel from the configured scope also marks its existing
sources removed without another read. When the owner's retention window expires,
all wording versions on that evidence item are replaced by a source-removed
marker and its named author is cleared; its provenance and links remain. Due
purges continue while capture is paused. Temporary outages keep the source and
show a check failure. Separately committed decision/publication history is
preserved history and uses the existing Data copy-resolution/erasure controls.

To disconnect, pause in Penny, stop the relay, remove the installation secret and
transport binding, then revoke/reset the bot token and remove the application
from the server in Discord. Captured evidence remains under the removal policy.
The app has no Discord account-revocation API substitute.

## Archives and upgrade

Apply additive migration `0096_discord_capture.sql` through `rer setup` or the
existing deployment path. Prior data and applied SQL remain unchanged. Keep the
expanded schema when rolling back source. The settings, job receipts and source
provenance are portable product records. Credentials and the relay's private
cursor are installation custody and are never included in a Penny archive.
Restored settings are disabled and unfinished work is held until a current owner
reconfigures the connection and deliberately retries it. Evidence erasure also
removes its Discord source and job attribution. A hash-only replay receipt remains, preventing a replay from resurrecting the erased evidence. No capture creates a
request, sends an email or publishes wording automatically.
