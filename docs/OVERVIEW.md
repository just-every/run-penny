# Overview

Penny is a self-hosted feedback and decision tool for one B2B software business. Your customers ask for things and vote on a public board. You record what you hear on calls, in support and in email, then decide what to build with that evidence in front of you. Penny keeps the reasoning private, publishes only the wording you approve, and tells the people who asked what happened.

It runs on your own Cloudflare account as one Worker, with your data in your own database. The source is yours, MIT licensed, and Penny has no telemetry.

## Who it is for

Penny is built for a single software business listening to its own customers. One workspace and one public portal, with an owner and invited operators who share product access. Invite operators in Feedback settings; each has a private queue of assigned requests, evidence and requester comments. Product roles and separate tenants are not available yet. If you need many businesses in one install, or a place for customers to chat with each other, Penny is not that.

## The loop

Penny is organised around one loop. Each step feeds the next.

1. **Customers ask and vote.** Anyone can read your public board. To submit a request, vote, comment or follow, a visitor verifies their email address. Nothing a visitor submits becomes public until one of your operators approves it. See [The public portal](/docs/portal).
2. **Your team records evidence.** Operators write down what they hear: a sales call, a support conversation, an interview, an email. Each item keeps its source, the original wording and when it was observed. Every portal submission also becomes an evidence item automatically.
3. **A decision compares options.** An operator opens a decision with a question, adds candidate bets, links evidence to each one as supporting or contradicting, and compares the bets side by side on the same dimensions. Then they commit to one, with a rationale, an owner, a confidence level and a review date. Penny never scores or ranks the bets for you. See [The decision loop](/docs/decisions).
4. **The roadmap and a customer-safe release follow.** Committing a decision creates an internal roadmap item. It stays private until you approve customer-safe wording and the requests it maps to. As the item moves from Exploring to Planned, In progress and Shipped, you publish status updates and, when it ships, a release.
5. **The people who asked are told.** Followers of a mapped request get an email when you publish a status update, and eligible requesters get an email when you publish a release. See [Email and notifications](/docs/email).

## What stays private

The public side shows only what an operator has explicitly published. These stay inside your operator app:

- **Accounts and commercial context.** The customers behind requests, and anything you record about them.
- **Evidence and its sources.** Who said what, on which call or in which email.
- **Decisions.** Questions, bets, rationale, declined options and confidence.
- **Internal notes and internal boards.** A request on an internal board never appears in the portal.
- **Requester email addresses.** The public sees a display name, never an address.

Committing a decision publishes nothing. Publication is a separate, deliberate act.

## What you own

- **One Cloudflare Worker.** The public portal, the operator app and the API are served by a single Worker, with D1 for data, R2 for files and a one-minute schedule that sends notifications.
- **Your data.** It lives in your Cloudflare account. You can download a full product archive from the operator app. See [Export and restore](/docs/data).
- **The source.** Penny is MIT licensed. Change anything with your own coding agent. See [Make it yours](/docs/customise).
- **No telemetry.** Penny does not phone home and has no kill switch.

## What Penny does not do yet

Penny does not read your helpdesk, CRM or call recordings. Your team records evidence by hand. It does not use AI to classify, summarise or rank anything. It does not measure whether a shipped change worked, and it does not yet ask requesters for a response after a release. Email can be delivered through SendGrid or Resend, and Penny is honest about the limits of that; see [Email and notifications](/docs/email).

Penny is an early release. This documentation describes what it does today.

## Where next

- [Install and deploy](/docs/install): run Penny on your computer, then put it on Cloudflare.
- [The public portal](/docs/portal): what your customers see and can do.
- [The decision loop](/docs/decisions): the operator's path from first evidence to a published release.
- [Email and notifications](/docs/email): provider setup, what requesters are sent and when.
- [Export and restore](/docs/data): your data archive, restoring it and erasing personal data.
- [Make it yours](/docs/customise): where to change the name, theme and behaviour, and how updates arrive.
