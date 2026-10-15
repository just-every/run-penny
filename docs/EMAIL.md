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

**Quiet hours apply.** Requester email is held from 20:00 until 08:00 in your workspace timezone, which is UTC unless you set `WORKSPACE_TIMEZONE` to an IANA timezone name (such as `Europe/London`) in the environment of your first `rer deploy`, and keep it for that workspace. A local copy uses UTC. The hours themselves are fixed, and daylight-saving changes are handled.

**Release emails** have their own schedule. They are not batched. They go out straight away between 08:00 and 20:00, and ones published in quiet hours wait until 08:00. If a follower's request updates are still being batched when a release email goes to them, the batch is sent first, in the same minute, so the release never arrives before the news that led to it.

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
