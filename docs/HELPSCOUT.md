# Help Scout capture

Penny connects one Help Scout mailbox to one accountable Penny owner. The owner
chooses an automatic capture tag and delegates the sidebar to their Help Scout
user ID. The supported sidebar is Help Scout's documented **legacy Dynamic App**;
it is not a Marketplace listing or a claim of acceptance on the new App Developer
Platform. A live Help Scout account is needed to install it.

## Connect

1. Deploy a method-aware enforcing RPC service as `PENNY_HELPSCOUT_EGRESS`.
   Its `send({url,method,headers,body})` response is
   `{status,headers,body}`. It must pin public DNS/IP at connection time, verify
   TLS, refuse redirects, preserve GET/POST exactly, and enforce request/response
   byte and time limits. Only `https://api.helpscout.net/v2` is used. The older
   POST-only `PENNY_EGRESS` service cannot substitute for this port. Missing
   transport visibly refuses connection; there is no ordinary-fetch fallback.
2. In Help Scout, create an OAuth application owned by the installation owner.
   Penny uses Help Scout's documented OAuth2 **client credentials** flow at
   `/v2/oauth2/token`. It refreshes an expired access token with that same flow;
   an unexpected 401 clears the cached token and requires explicit job retry.
3. In Penny's **Feedback settings → Help Scout capture**, enter the mailbox ID,
   capture tag, your Help Scout user ID, retention window, OAuth application ID
   and secret, and distinct Dynamic App and webhook secrets (16–40 characters).
   Connecting tests OAuth before saving. It authorizes that one Help Scout user
   to capture, link, create, proxy-vote and explicitly send reviewed replies as
   you. It grants no general Penny session, owner settings or archive access.
4. In Help Scout's legacy Custom Apps, configure a Dynamic App with callback
   `https://YOUR-PENNY-HOST/api/integrations/helpscout/sidebar` and the matching
   Dynamic App secret. Penny verifies Help Scout's base64 HMAC-SHA1 of the raw
   request and returns an embedded conversation panel. Only the chosen mailbox
   and user are admitted. Draft conversations without a ticket ID are refused.
5. Configure Help Scout conversation-created and conversation-tags-updated
   webhooks, restricted to that mailbox, to
   `https://YOUR-PENNY-HOST/api/integrations/helpscout/webhook`, with the matching
   webhook secret. Webhook bodies use the documented conversation shape
   `{id,mailboxId,tags:[{id,tag}]}`. All other fields are ignored. Signed
   metadata outside the configured mailbox/tag causes no provider read.

Never put OAuth or signing secrets in a sidebar script. They live in
installation-only D1 tables, never in archives, HTML, browser storage, logs or
status responses. The iframe receives a random ten-minute, hashed-at-rest
capability bound to the selected conversation, delegated user and current owner
revision. Reopen a conversation when its panel expires. The provider's signature
does not contain a timestamp; replay safety comes from durable conversation
custody, while disconnection/secret replacement revokes old sidebar admission.

## Capture and follow up

The sidebar can explicitly select one conversation in the chosen mailbox;
automatic background capture additionally requires the chosen tag. Minute Cron
reads at most ten captures/checks per run. Penny rechecks the source mailbox and
current tag before reading customer threads automatically. It stores only the
first available customer-thread excerpt across newest-first pages (at most 100
pages, each with a bounded response), its source time, the selected thread's named customer author (nullable), the conversation's
primary-customer attribution, account mapping and a deep link. It omits private
notes, attachments, previews, company descriptions and other custom fields.
Redaction runs before wording, names and new company names are saved. Customer
email (from the conversation or the customer’s embedded email list) is used only
for identity attribution and remains private, unverified and without an email permission record. A blocked or retired requester is not mapped.
Organization IDs map to private Penny accounts; names alone never merge companies.

A replay or restart cannot create another evidence item for a conversation.
Linking attaches that evidence to one request. Creating makes one unpublished
request awaiting native moderation. A proxy vote uses Penny's native attribution,
counts once and creates no verified identity or subscription. The sidebar shows
only approved public request wording and status; private evidence and commercial
fields do not enter the public portal.

Approved status changes prepare one unsent plain-text draft per linked
conversation and public status revision, visible in its sidebar. No model account
is required, and preparing a draft sends no provider request. **Send reviewed
reply** is a separate explicit action with the edited text and an approval
checkbox. Penny checks current public status and private account values/internal
notes again before POSTing a reply to the original conversation. Sent or ambiguous
attempts cannot be replayed. A network failure or non-201 result stays unknown:
the sidebar keeps this delivery state visible after refresh or restart, including
when a newer public status prepares another draft. Inspect
the actual Help Scout thread and reconcile there. Penny does not offer a
blind resend, and restored drafts are held.

## Pause, recovery and removal

Settings show the last success, capture states, attempt counts and failures with
reconnect/retry guidance. Pause invalidates sidebar capabilities and running
completion claims immediately; resume assigns the current owner and revision.
An expired credential, rate limit, malformed response or interrupted read stays
failed across restarts until **Retry conversation** is selected. An owner removed
or whose membership version changes stops further provider work and commits.

Hourly source checks preserve the captured version when the selected excerpt
changes and mark it changed. Missing, forbidden, moved or out-of-scope sources
are removed. At the chosen retention window, Cron purges every stored excerpt
version and holds that conversation's reply drafts. It never follows a provider
redirect. Original IDs/deep links and a non-personal replay digest remain.

Disconnect revokes Penny's grant and capabilities, deletes all locally stored
OAuth/signing credentials, stops capture and marks retained sources removed for
the same purge policy. **Also delete/revoke the OAuth application in Help Scout**:
Help Scout's documented client-credentials flow has no token-revocation endpoint
for Penny to call. This provider-account step is required to revoke the upstream
application itself. Penny cannot claim that account action was performed.

Product archives include captures, source custody, account mappings and reply
state. Credentials and sidebar capabilities never travel. A restore disables the
connection and holds unfinished captures and drafts until the owner reconnects
and explicitly retries; it never resumes a possibly sent reply. Erasing linked
requesters/evidence/accounts includes connector dependents through the native
erasure graph. Independent source digests prevent erased conversations from
being captured again.

## Verification boundary

`tests/browser/helpscout-capture.mjs` is one sanity journey through the emitted
Worker's HTTP routes and browser UI, with synthetic Help Scout OAuth, API and
signed callback fixtures only at the network edge. It also records settings and
sidebar views at 1440 and 390 pixels. Live Help Scout consent/application setup,
upstream app revocation, deployed enforcing transport, real inbox delivery and
provider-rendered iframe behavior require the owner's account. No paid service,
provider account, deployment or Marketplace listing is implied by local fixtures.
