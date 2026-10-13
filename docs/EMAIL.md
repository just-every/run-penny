# Email and notifications

Penny sends email so that people can sign in and so that the customers who asked for something hear what happened. This page explains how to choose a provider, how to connect delivery events, what requesters are sent and when, and what Penny cannot promise.

## What Penny sends

- **Operator sign-in links.** A single-use link to sign in to the operator app.
- **Requester verification links.** A single-use link, valid for 30 minutes, that proves a visitor owns their address.
- **Request updates.** An email to followers when you publish a status update on a request, decline it, publish a roadmap status update mapped to it, post a public reply or approve a requester's comment.
- **Release emails.** One email to each eligible recipient when you publish a release.

Messages come from the sender address you configure and are marked as automatically generated. Penny has no inbound mail route, so a reply to one of its emails creates nothing: no comment, no request, no evidence. Sign-in and verification both depend on email, so set it up before you deploy.

## Choose a provider

Penny sends through **SendGrid** or **Resend**. You pick one, and the choice is explicit: Penny never falls back from one provider to the other.

| Variable | What it does |
|---|---|
| `MAIL_PROVIDER` | `sendgrid` or `resend`. |
| `MAIL_FROM` | The sender address. It must be a sender you have verified with the provider. |
| `SENDGRID_API_KEY` | Required when `MAIL_PROVIDER=sendgrid`. |
| `RESEND_API_KEY` | Required when `MAIL_PROVIDER=resend`. |

A key for the other provider does not satisfy your choice. Set these as described in [Install and deploy](/docs/install). If the provider, key or sender is missing, deployed sign-in and requester verification say that email delivery is unavailable. Visitors can still read your public pages.

Locally you need none of this. Penny captures messages in a local outbox instead of sending them.

`pnpm run operations -- check --profile owner-sendgrid` (or `owner-resend`) and `node scripts/rer.mjs check` read `OPERATIONS.json`, whose mail loop is declared as SendGrid by default. If you choose Resend, change that loop's `provider` to `resend` in `OPERATIONS.json` so the check and your `MAIL_PROVIDER` agree.

## Delivery events and suppression

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

**Request updates are batched.** When something email-worthy happens on a request, Penny starts a one-hour window for that requester and request. Everything that happens inside the window goes out as one message, and later events never extend the window.

**Quiet hours apply.** Requester email is held from 20:00 until 08:00 in your workspace timezone. The default is Australia/Brisbane. To choose another, set `WORKSPACE_TIMEZONE` to an IANA timezone name before you deploy, and keep it for that workspace. Locally, change `workspaceTimezone` in `src/ext/config.server.ts`. The hours themselves are fixed, and daylight-saving changes are handled.

**Release emails** have their own schedule. They are not batched. They go out straight away between 08:00 and 20:00, and ones published in quiet hours wait until 08:00.

**Penny checks again before every send.** Just before a message goes out, it confirms that the request is still public, the requester still has permission, they have not muted it and their address is not suppressed. Anything that no longer qualifies is dropped. Held comments, internal notes, internal boards and unpublished requests notify nobody. A roadmap move you have not published as a status update notifies nobody either.

A one-minute schedule runs the sending. Anything missed on one tick is picked up on the next.

### Unsubscribing

Every requester email carries a link to unsubscribe from all requester email, and request updates also carry a link to mute just that request. The links work without signing in. Opening the link shows a confirmation, so mail scanners cannot unsubscribe anyone by accident. Hosted HTTPS messages support one-click unsubscribe in mail apps; local HTTP outbox messages retain the confirmation link in their text. Any notification's global unsubscribe link also withdraws the address's all-release subscription; “Mute this request” retains that subscription. Requesters can change preferences on **Your feedback** and their release subscription on Updates. Muting and unsubscribing remove no votes, requests, follows or portal access.

## Decision review reminders

A decision owner receives one email when a committed decision first becomes review due, plus an in-app notification that stays until dismissed. Operator review email has no requester quiet hours. Another reminder requires a new review schedule; two Cron passes do not create two reminders. Complete a review with a note and a new date or a decision revision. Local outbox capture proves the message path; live Cron execution and inbox delivery still need the owner's installation proof.

## When something goes wrong

- **A known rejection or rate limit** from the provider is retried up to five more times, at 1, 2, 4, 8 and 16 minutes, then the message is marked failed.
- **Once a provider accepts a message,** Penny never sends it again.
- **An ambiguous result** is never retried automatically. If Penny cannot tell whether the provider accepted a message, for example after a network error or a timeout, it records the result as unknown and stops. SendGrid offers no protection against duplicates for these sends, so resending could email a customer twice.

Open **Feedback settings** in the operator app and look under **Requester email delivery**. Messages with an unknown or failed result are listed there with their provider, attempt count and message ID. For an unknown result, check the provider's own activity log before you decide what to do. A release page shows delivery counts for that release.

## Honest limits

- **Provider acceptance is not inbox delivery.** "Accepted" means the provider took the message. Penny cannot see whether it reached an inbox.
- **Local capture is not inbox proof.** The local outbox shows what Penny would send. It does not test a provider, your sender verification or your domain's reputation.
- **There is no exactly-once guarantee.** Penny records each send durably and avoids repeats where it can, but it does not claim a message is delivered once and only once.
- **Check your live deployment yourself.** Send a real verification link to an address you control, confirm your sender is verified, and watch the first notification arrive.
