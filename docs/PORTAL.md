# The public portal

The portal is the customer-facing half of Penny. Visitors read your feedback board, see what you are working on and read your product updates. Verified customers can also ask for things, vote, comment and follow. Everything a customer sees has been approved by one of your operators.

The portal has four places:

| Page | Address | What it shows |
|---|---|---|
| Feedback board | `/portal/feedback` | Published requests, with search, board and status filters. |
| Roadmap | `/portal/roadmap` | Published request statuses, or separately approved roadmap items, grouped by status. |
| Updates | `/portal/updates` | Your published releases. |
| Your feedback | `/portal/feedback/activity` | A requester's own requests, votes, follows and comments. |

Reading is open to anyone. You do not need an account to browse.

## Boards

Every request belongs to exactly one board, such as "Product" or "Integrations". Operators create, rename, reorder and archive boards in **Feedback settings** in the operator app, and each board is either public or internal.

- **Public boards** appear in the portal's board list. Visitors can browse one board at a time.
- **Internal boards** never appear in any portal page, on the roadmap, in a release or in a requester email. Use one for requests you want to track privately.
- **Archived boards** leave the navigation and stop taking new submissions. Requests already published on them stay reachable at their addresses.

Public boards also choose who may post, whether requester comments are allowed, whether vote totals or voter names are public, and whether requester names appear as Anonymous. Operators retain attribution and totals. Canny imports can copy these choices through reviewed board-settings mappings.

Visitors can search request titles and descriptions, filter by status and sort by recent activity or most votes.

## Submitting a request

A visitor chooses **Submit feedback**. Before anything else, Penny asks them to verify their email address.

1. **Verify.** The visitor gives a display name and an email address. Penny emails a single-use link, which expires after 30 minutes. Once it is used, that browser stays verified for 30 days. The display name is what the public will see. The email address is never shown.
2. **Write the request.** A title, a problem description and a board are required. A proposed solution, an impact statement and one attachment are optional. Attachments can be PNG, JPEG, GIF or PDF, up to 10 MB.
3. **Send for review.** The request is saved and waits for an operator. It is not public.

If email delivery is not configured on your deployment, new visitors cannot verify, so they cannot submit. Public reading keeps working.

### Moderation comes first

Nothing a visitor submits goes public on its own. An operator reviews each new request in **Moderation** and approves the public title, description, board and display name, or rejects it with a reason. Attachments are private until an operator approves each file separately. Rejecting a file does not reject the request.

Each submission also becomes an evidence item for your team, with the visitor's original wording, whether or not it is ever published. See [The decision loop](/docs/decisions).

The visitor can follow what happens on **Your feedback**. It shows their request as awaiting review, published or not published, and gives the reason when one is recorded. A visitor can edit or withdraw their own request, and can ask for another review of anything that was rejected. An edit to published text goes back through moderation, and the approved text stays public until the edit is approved.

### Duplicate suggestions

As the visitor types a title, Penny suggests similar published requests and names the words that matched. Each suggestion has **Vote** and **Follow** buttons. Choosing one applies the vote or follow and discards the draft, so no new request is created. Matching is plain word overlap. Penny never merges anything by itself, and suggestions only ever come from published requests.

## Votes, following and email

A verified visitor can vote on a request once and can remove the vote. A request can take votes until it is Shipped or Declined.

Voting alone grants no permission to email anyone. Each vote and submission form has an **Email me updates** box, unticked by default. Following a request, or ticking that box, records the visitor's permission to be emailed about it. Release updates also accept a separate subscription from Updates; that permission is described below.

Visitors can unfollow, mute a single request, or mute all requester email from **Your feedback**, and every email carries a one-click unsubscribe link. What they are sent, and when, is covered in [Email and notifications](/docs/email).

## Comments

Verified visitors can comment on a published request. A visitor's comment is held until an operator approves it, and the visitor sees it marked as awaiting review in the meantime. Operator replies are public when posted. Held and rejected comments never appear in the portal and never go out in email.

## Statuses

Every published request shows one of six statuses.

| Status | What it means |
|---|---|
| **Open** | Published, and not yet on your roadmap. Every new published request starts here. |
| **Under review** | You are looking into it. Set by an operator's status update, or by an approved roadmap item that is still Exploring. |
| **Planned** | You have committed to it. |
| **In progress** | Work has started. |
| **Shipped** | It is done. New votes are closed. |
| **Declined** | You have decided not to do it, and gave a public reason. New votes are closed, and existing votes and comments stay visible. |

Operators set any of the six statuses directly from a published request’s controls in **Moderation**. The public comment is optional unless declining. A status can also carry a public ETA such as `2027-03` or `2027-Q1`; leaving it blank clears the ETA. Saving the current status with no comment or ETA change creates no update or notification.

An approved roadmap mapping can also set a request’s status. The latest direct change, mapping approval or mapped item transition wins. Withdrawing the mapping restores the last direct status. Declined takes precedence until an operator reverses it. The operator controls show which source currently supplies the public status.

In **Feedback settings → Request statuses**, the owner defines internal statuses mapped to the six public statuses and a comment template for each public status. Internal names stay private unless the owner chooses to show one publicly. Changing a mapping updates its requests without publishing an update or sending email. A template is offered when selecting a status and can be edited before publication.

## The roadmap and updates

In **Feedback settings → Public roadmap**, the owner chooses request statuses or approved roadmap items. New installations start with request statuses; an existing roadmap keeps its approved-item source.

A status roadmap shows published requests from the selected public boards under Under review, Planned, In progress and Shipped. Each card links to its request and shows its board, vote total and optional public ETA. Open, Declined, held and internal-board requests are absent. The owner can hide or rename columns and show all Shipped requests or only the last 30, 90 or 365 days. The page refreshes current status automatically.

With approved roadmap items selected, only explicitly approved customer-safe item wording is shown, with links to mapped requests. A Dropped item leaves that roadmap. Neither source exposes internal target dates, accounts, confidence, reasoning or evidence.

The updates page lists your published releases, newest first. Until you publish one, it says there are no updates yet, and shows no placeholder.

After verifying your email, you can subscribe to all releases from Updates or Your feedback. You can unsubscribe in either place or with the unsubscribe link in any notification. Unsubscribing withdraws that permission and leaves your requests, votes and follows in place.

If you were included when a release was first published, its page lets you answer Adopted, Partly adopted or Not yet for each target. You can change your answer and can still answer after muting or unsubscribing. Your identity and individual answers are private to you and the operators. A corrected release shows its current wording without resetting your response.

## Embedding

In **Feedback settings → Portal embedding**, save one exact HTTPS parent origin per line. The saved `publicOriginAllowlist` controls the next portal response’s `frame-ancestors` policy; an empty list permits only Penny’s own origin. Local/test installations also accept explicit loopback HTTP origins. Operator, setup and sign-in pages remain protected. Before a list is saved, the server-only `publicOriginAllowlist` is the initial policy.

## Customer-safe by design

Only approved fields reach any portal page or the public API: a request's approved title and description, a display name, approved comments, and the customer-safe wording on roadmap items and releases. Requester email addresses, accounts, evidence, internal notes, internal boards and operator-only fields never appear there, including in fields the page does not display.


## Requester Google and GitHub sign-in

Owners can enable either provider under Feedback settings → Requester social
sign-in. Both are off by default. Configure the installation bindings
`REQUESTER_GOOGLE_CLIENT_ID`, `REQUESTER_GOOGLE_CLIENT_SECRET`,
`REQUESTER_GITHUB_CLIENT_ID` and `REQUESTER_GITHUB_CLIENT_SECRET` in the deployment,
plus the enforcing `PENNY_LEARNING_EGRESS` RPC service used for bounded GET/POST
network calls. It must enforce public DNS/IP at connect time, verified TLS,
no redirects and bounded requests/responses. The service makes no model call for
sign-in. Credentials never enter D1, settings forms, archives or logs.

The fixed redirects are `/api/portal/oauth/google/callback` and
`/api/portal/oauth/github/callback` on the installation origin. Google setup may
register localhost ports 8787, 8788 and 8789 plus the hosted installation's own
origin. Configure clients and consent/test-user membership in the provider's
console. Real Google/GitHub consent, credentials and hosted redirect acceptance
were **NOT RUN**; qualification uses synthetic network-edge fixtures only.

A signed-out vote or follow is held while the visitor verifies. Google’s verified
email and GitHub’s primary verified email enter the same requester-only address
and browser-local session path as emailed verification. Unverified addresses use
an emailed link; a provider with no primary address sends the visitor to enter an
address for that link. Sign-in grants no operator authority or subscription.
Existing explicit actions and board subscription disclosures retain their rules.

OAuth state expires after ten minutes, is single-use and requires the originating
browser's PKCE verifier. No cookie is set. Erasure removes the requester/address
and native session; no provider subject is stored. Portable provider switches
restore off; credentials and in-flight states are never portable.

Inherited duty: on an SSO-required portal (WIDGET-006), only WIDGET-008 applies.
Current Penny has no portal SSO-required state; those clauses retain this duty.
Operator SSO domain rules do not turn requester sign-in into operator access.


Owner-enabled deterministic redaction also applies to new requester submission
wording before its pending action, request, evidence and moderation copies are
stored. Existing captured copies require the explicitly bounded reapplication
work described in [data ownership](data-ownership.md); AI-008 remains partial.
