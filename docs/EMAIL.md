# Email and notifications

Penny sends email so that people can sign in and so that the customers who asked for something hear what happened. This page explains how to choose a provider, how to connect delivery events, what requesters are sent and when, and what Penny cannot promise.

## What Penny sends

- **Operator sign-in links.** A single-use link to sign in to the operator app.
- **Requester verification links.** A single-use link, valid for 30 minutes, that proves a visitor owns their address.
- **Request updates.** An email to followers when you publish a status update on a request, decline it, publish a roadmap status update mapped to it, post a public reply or approve a requester's comment.
- **Release emails.** One email to each eligible recipient when you publish a release.

Messages come from the sender address RER supplies for Managed hosting, or the verified sender you configure for your own provider, with automatic-mail headers when using SendGrid or Resend. Penny has no inbound mail route, so a reply to one of its emails creates nothing: no comment, no request, no evidence. Sign-in and verification both depend on email, so set it up before you deploy.

## Choose a provider

### Managed Penny

**RER provides Managed Penny's email.** You need no email provider account, sender verification or API key entry. RER fills and hides these settings during Managed configuration:

| Variable | Supplied by RER |
|---|---|
| `MAIL_PROVIDER` | `rer`. |
| `MAIL_FROM` | RER's verified application sender. |
| `MAIL_RELAY_URL` | RER's managed mail relay endpoint. |
| `MAIL_API_KEY` | A private credential for this installation and environment, issued by RER. |

Penny uses Base's relay adapter from pinned rer 0.2.22. It sends the recipient, subject and message body to RER over authenticated HTTPS. RER supplies the sender and forwards the message to its provider; the upstream provider key never reaches Penny or its build. Replies go to the owner's verified account email, but create no record in Penny.

Production and preview share an allowance of 20 messages per minute, 200 per hour and 1,000 per day per installation. Valid attempts count even if the provider fails. RER checks paid Managed access and active hosting on every send. A rate limit, unavailable configuration or revoked credential remains a visible delivery failure under Penny's normal delivery policy; Penny does not switch providers.

RER manages credential rotation and revocation. After rotation, build and publish again to bind the new credential; an ordinary configuration save preserves the existing credential and does not revive a revoked one. Disconnecting or ending hosting revokes access. Scheduled cancellation retains mail through the paid period. These source/configuration details do not establish a hosted installation or inbox delivery.

### Free and Assisted hosting

The choices remain **SendGrid**, **Resend** or **set up later**. With your own provider, you pick one explicitly: Penny never falls back from one provider to the other.

| Variable | What it does |
|---|---|
| `MAIL_PROVIDER` | `sendgrid`, `resend` or `later` (email actions unavailable). `rer deploy` refuses `later`, because the owner could not sign in. |
| `MAIL_FROM` | The sender address verified with your selected provider; not used with `later`. |
| `MAIL_API_KEY` | Your SendGrid or Resend API key; required unless `MAIL_PROVIDER=later`. |

Penny sends only through the provider you name, so the key must belong to that provider. `MAIL_API_KEY` is the same name RER uses for Managed mail; older `SENDGRID_API_KEY` and `RESEND_API_KEY` settings are refused, so rename them when you upgrade. Set these as described in [Install and deploy](/docs/install). If the provider, key or sender is missing, deployed sign-in and requester verification say that email delivery is unavailable. Visitors can still read your public pages.

### On your computer

Locally you need none of this. Penny Dev sends no email at all: there is no outbox, no captured message and no printed link. A customer therefore cannot verify an address locally, and the public **Submit feedback** page says so.

To do the customer jobs locally (submit, vote, follow and comment), sign in as an operator, open **Feedback settings → Test customers (Penny Dev)**, enter a display name and email, and press **Add and open the board as them**. Penny records that address as verified and opens the public board in the same browser, signed in as that customer; your operator session stays signed in, so you can approve their feedback, map it to the roadmap and publish a release from the operator app. Deployed copies never show this section: there, customers verify by email. Delivery counts in Penny Dev read “not emailed (local)”, because nobody receives the messages.

`pnpm run operations -- check --profile owner-sendgrid` (or `owner-resend`, `owner-later`) checks the selected owner-account inputs offline. These profiles do not provision Managed mail or prove delivery.

## Delivery events and suppression

The callback setup below applies to your own SendGrid or Resend account. Managed relay acceptance does not establish delivery-event forwarding to Penny. Do not configure a personal provider webhook for RER-provided mail.

Providers can tell Penny when a message bounces or is marked as spam. Penny listens at:

```
https://your-address/api/public/mail/events
```

Only signed callbacks are accepted, so give Penny the provider's verification key.

| Provider | Set up in the provider | Set in Penny |
|---|---|---|
| SendGrid | Turn on the signed Event Webhook for the URL above, with bounce and spam-report events enabled. | `SENDGRID_EVENT_PUBLIC_KEY`, the webhook's base64 P-256 public key. |
| Resend | Add a webhook for the URL above. | `RESEND_WEBHOOK_SECRET`, its signing secret. |

Add the matching variable to your deploy environment. Uploading the key does not register the webhook, so create the webhook in the provider yourself. Without the key, the endpoint answers 503 and the provider can retry.

A hard bounce or a spam complaint stops further Penny email to that address until the requester verifies it again. A soft bounce marks just that message failed and suppresses nothing. Only events that Penny can match to a message it recorded sending to that exact address can suppress an address.

One gap remains: SendGrid bounces that arrive later without a message ID are rejected, so Penny cannot suppress on them. Review SendGrid's own suppression lists as well.

## What requesters are sent, and when

Customers choose to hear from you. A requester becomes eligible for email by following a request, ticking **Email me updates** when they vote or submit, or subscribing to every release from Updates after verifying their address. Votes alone grant nothing, and an address an operator types in grants nothing.

**Request updates are batched.** When something email-worthy happens on a request, Penny starts a one-minute window for that requester and request. Everything that happens inside the window goes out as one message, and later events never extend the window.

**Quiet hours apply.** Choose the workspace timezone at setup and change it in **Feedback settings → Workspace time and customer email**. Requester quiet hours default to 20:00–08:00 in that timezone. The owner can choose different start and end hours or turn quiet hours off. Each send checks the current choice, including daylight-saving changes. Older installations ask the owner to confirm the timezone once.

**Release emails** have their own schedule. They are not batched. They go out straight away outside your configured quiet hours; ones published during quiet hours wait until those hours end. With quiet hours off, they become due immediately. If a follower's request updates are still being batched when a release email goes to them, the batch is sent first, in the same minute, so the release never arrives before the news that led to it.

Every link in these emails is a full address on your deployment, so it opens from any mail client. Private tags never appear in them.

**Penny checks again before every send.** Just before a message goes out, it confirms that the request is still public, the requester still has permission, they have not muted it and their address is not suppressed. Anything that no longer qualifies is dropped. Held comments, internal notes, internal boards and unpublished requests notify nobody. A roadmap move you have not published as a status update notifies nobody either.

Publishing queues the send immediately. A Queue consumer sends eligible mail, including the one-minute request batch, without waiting for a new Cloudflare Cron schedule to start. The minute Cron is the backstop for a failed Queue handoff. Approved comments are emailed to other eligible followers; their author does not receive their own comment as a public reply.

### Unsubscribing

Every requester email carries a link to unsubscribe from all requester email, and request updates also carry a link to mute just that request. The links work without signing in. Opening the link shows a confirmation, so mail scanners cannot unsubscribe anyone by accident. Hosted HTTPS messages support one-click unsubscribe in mail apps. Any notification's global unsubscribe link also withdraws the address's all-release subscription; “Mute this request” retains that subscription. Requesters can change preferences on **Your feedback** and their release subscription on Updates. Muting and unsubscribing remove no votes, requests, follows or portal access.

## Decision review reminders

A decision owner receives one email when a committed decision first becomes review due, plus an in-app notification that stays until dismissed. Operator review email has no requester quiet hours. Another reminder requires a new review schedule; two Cron passes do not create two reminders. Complete a review with a note and a new date or a decision revision. A local copy records the reminder without emailing it; live Cron execution and inbox delivery still need the owner's installation proof.

## When something goes wrong

- **A known rejection or rate limit** from the provider is retried up to five more times, at 1, 2, 4, 8 and 16 minutes, then the message is marked failed.
- **Once a provider accepts a message,** Penny never sends it again.
- **An ambiguous result** is never retried automatically. If Penny cannot tell whether the provider accepted a message, for example after a network error or a timeout, it records the result as unknown and stops. SendGrid offers no protection against duplicates for these sends, so resending could email a customer twice.

Open **Feedback settings** in the operator app and look under **Requester email delivery**. Messages with an unknown or failed result are listed there with their provider, attempt count and message ID. For an unknown result, check your provider’s activity log, or ask RER to reconcile a Managed relay send, before you decide what to do. A release page shows delivery counts for that release.

## Honest limits

- **Provider acceptance is not inbox delivery.** "Accepted" means the provider took the message. Penny cannot see whether it reached an inbox.
- **Local copies send nothing.** Penny Dev records what it would send but emails nobody. It does not test a provider, your sender verification or your domain's reputation.
- **There is no exactly-once guarantee.** Penny records each send durably and avoids repeats where it can, but it does not claim a message is delivered once and only once.
- **Check your live deployment yourself.** Send a real verification link to an address you control and watch the first notification arrive. With your own provider, also confirm your sender is verified. Managed stage validation and inbox proof remain separate from this source change.

## Merge notices

In a request’s controls, enter the canonical request’s slug and choose **Review merge**. The preview counts eligible subscribers from the duplicate who do not already follow the canonical request. **Notify subscribers about this merge** starts checked; untick it for a silent merge. The notice names and links the canonical request, and the duplicate’s subscribers follow that request after merging. If the canonical request is private, the notice waits until it is published on a public board. Current permission, suppression, mutes, quiet hours and unsubscribe are checked before sending. Unmerge sends no notice and cancels any unsent notice for that merge.

## Capturing forwarded customer email

The owner can configure a dedicated capture address and exact sender-domain
allowlist in **Feedback settings → Email identity and postal address**. The
allowlist starts empty; current operators are admitted only with aligned DMARC.
The address must differ from the deployment sender, tested notification sender
and monitored reply-to. Saving a conflicting reply-to is also refused.

Route this address to the Worker's `email()` handler using Cloudflare Email
Routing. There is no HTTP inbound-parse endpoint. The handler requires a single
receiving-platform Authentication-Results field with aligned DMARC and a
Message-ID. Missing, duplicate, malformed or unaligned results fail closed.
Forwarded headers are attribution only: they never authorize a sender. Gmail
forwarded blocks and Outlook header blocks recover the original sender; a direct
or BCC copy without one is attributed to the admitted sender and marked “not
forwarded”. No mail is sent or bounced by capture. Notification replies and mail
from Penny's senders or reply-to are refused.

Attachments use the existing private evidence store and `seed.json` type,
per-file and total-byte limits. A refused attachment leaves a visible limit note
on the created item. Oversize messages are refused before parsing. Refusals retain
only reason counts in owner settings, never sender, subject or body.

Capture configuration, domains and SHA-256 Message-ID digests join the portable
archive. Digests have no foreign key to evidence: deleting or erasing an item
cannot let an old message resurrect it. Restore copies records and files without
reprocessing mail or sending anything. Erasure of an identified requester removes
their captured evidence and attribution; ambiguous copies retain the existing
explicit erasure hold. Domain entries contain no personal addresses. Original
Message-IDs are not retained.

No live route, domain or mail provider was used to qualify this feature. Tests
invoke the platform email door with synthetic provider-edge messages. Hosted
routing and actual receiver authentication headers remain the owner's setup and
acceptance step, **NOT RUN**. Future AI-006 connector or mail reply drafts require
explicit operator editing and sending, never auto-send, and a fresh private-value
check before publication.


When owner-enabled sensitive-evidence rules are active, email excerpts use the
same pre-storage redaction function as operator evidence. Stable markers name
the kind and never contain its original value. Sender attribution remains
separate identity data under normal erasure custody. Binary attachments are not
rewritten. See [data ownership](data-ownership.md) for reapplication limits.
