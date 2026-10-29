<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Accept a Penny installation

The primary journey: customers post, vote and follow on the owner's branded board and their words arrive from every channel into one inbox; operators deduplicate, weigh and triage them, decide with evidence, publish the roadmap and release, and every customer who asked hears back.

## Progress

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 72 | 115 | 71 | 258 |
| Agent surface | 0 | 17 | 4 | 21 |
| Later | 0 | 0 | 2 | 2 |
| Full target | 72 | 132 | 77 | 281 |

Judged from the code and tests at commit `4249757c7f9914e47903ec3d53b68298317ed6c7` (23 October 2026). Field proof register: 17 rows; 0 passed, 0 failed, 17 not run.

## Core

### Landing

#### HOME-001 — Public feedback portal

Core · published · **partial**

**Requirement.** An installed Penny serves its public feedback board at `/`, with search, status, board, category and sort parameters, server rendering and customer-safe reads; `/portal/feedback` serves the same board as a compatibility address. The board's home identifies the workspace by the owner's company name and logo (INT-007) and gives the owner's configured one-line portal description; public feedback, roadmap and updates follow REQ-001, ROAD-006 and REL-010.

**Acceptance.**
1. `/` and `/portal/feedback` serve the same board, with the same search, status, board, category and sort parameters.
2. `/portal` and `/portal/` answer `302` to `/` with the same query, and `/` does not redirect a filtered board request to a landing page.
3. Portal navigation, board filters, the submission page's way back, sign-in's "Back to feedback" and the operator's "Open public board" link use `/`, and existing links to either address keep working.
4. At both addresses the home identifies the workspace by the owner's company name and logo and shows the owner's configured one-line description, and a changed description shows on the next load.
5. The home makes no vendor, pricing, testimonial or metric claims and exposes no operator-only data.

**Evidence.** `tests/browser/route-review.mjs`
**Gap.** Gap: owner-configured workspace identity and a changed portal description have no passing assertion.

#### HOME-002 — Public product landing

Core · published · **partial** · Cites BASE-PUBLIC-001, BASE-DATA-005

**Requirement.** Penny's public product page is the run site's home: `/` of run-penny.com, built from `src/site`, not a route of an installation. It is rendered on the server as the finished page, and its copy names only capabilities whose clauses are `done` in the Status table and shows no pricing, testimonials, customer logos, metrics or integrations Penny does not ship; drawn labels use the portal's own status and sort vocabulary.

**Acceptance.**
1. The header has Penny's coin mark and name and links to the documentation at `/docs`, the public board, the source repository and `/signin`.
2. A hero has the page's one heading, a supporting line and links to `/docs/install` and `/docs`.
3. Sections, each with a decorative paper-collage drawing of Penny's own screens, cover the moderated public board, evidence-based decisions, closing the loop with followers, private commercial context, and self-hosted ownership the owner may change with their own agents.
4. A closing call to action repeats the two links, and the footer repeats the navigation.
5. The public board, roadmap and updates remain the portal (REQ-001, ROAD-006, REL-010).
6. The page reads no workspace or operator data, and its fonts, styles, script and drawings are the site's own.
7. The optional footer credit, "Powered by Penny · runeditrun.com", is visible by default and `showPoweredByCredit` in `src/ext/config.ts` turns it off; the credit is a plain link.
8. Motion is optional and plays once on load; it never loops, is off under reduced motion, and never hides content: without script, with reduced motion and after motion ends, every section is fully visible.

**Evidence.** `src/site/pages.tsx`
**Gap.** The run site's built landing page at both widths with no cross-origin request, cookie or workspace read; no test reads the built site yet.

### Documentation

#### DOCS-001 — Public documentation

Core · published · **partial** · Cites BASE-DOCS-001, BASE-PUBLIC-001

**Requirement.** Penny's delta on Base's on-site docs duty: the public paths `/docs` and `/docs/<slug>` serve Penny's first-party documentation, the install, portal, decision-loop, email, data and customization guides, from the deployment itself. The pages are the Markdown files that `docs/site.json` lists as published, in the sections and order it gives, which is the only navigation.

**Acceptance.**
1. Pages are served as HTML rendered from the Markdown ahead of time, in a build and in development; no request and no browser renders Markdown, and a page loads only its own content.
2. A page has its title as its one top-level heading, under the same header as the product landing (HOME-002): Penny's coin mark and name linking to `/`, then links to the docs (marked as the current section), the public board at `/portal`, the source repository and `/signin`, of which a phone keeps the mark, the name and sign-in; the landing's footer repeats them.
3. A page has a section menu, an on-this-page list, previous and next links, tables in labeled scrollable regions and an Edit-on-GitHub link; after the page loads, moving between docs pages is client-side navigation.
4. Every Markdown file at the repository root, under `docs/` and as a top-level `<directory>/README.md` is either published or listed in the manifest as GitHub-only with a reason, and an unlisted file fails verification.
5. A broken internal link or anchor, an image outside `docs/media/` or an absolute build-machine path fails the build.
6. Raw HTML in the Markdown is shown as text, never rendered.
7. The documentation reads no workspace record and no requester or operator identity or session.
8. An unknown or nested slug answers a `404` with no article.

**Evidence.** `tests/browser/route-review.mjs`; `docs/site.json`
**Gap.** Gap: manifest navigation order; build/development rendering and rejection of unlisted Markdown, broken links and forbidden image paths; full header/footer and page-navigation semantics; client navigation and HTML escaping; nested-unknown-slug 404/article exclusion; and workspace/session/cookie isolation lack sentence-complete running assertions.

### Operators

#### OPS-001 — Roles

Core · published · **partial** · Cites BASE-ROLE-001

**Requirement.** Penny's five operator roles, each checked in the business transaction like current authority, with a role change applying to the next request. Contributor and Viewer seats are unlimited, and operators invited before the full roles system ships become Product managers. *Policy: `operator.roles.v1`; default: the five roles below.*

| Role | Rights |
| --- | --- |
| Owner | Everything, including installation configuration, ownership handover (OPS-002), integrations, export and erasure. |
| Admin | All product work plus settings (including branding, INT-007, and sender identity, NOTIFY-013), boards, integrations, automation rules and the roles below Owner. |
| Product manager | All product work on evidence, requests, moderation (including editing published content, REQ-038, and removing it, REQ-041), decisions, roadmap and releases. |
| Contributor | The seat for support, sales and success staff: capture evidence, record proxy votes (CAP-014), comment internally and read product records; no moderation, publication, commitment, settings or commercial fields unless granted (ROLE-001). |
| Viewer | Read-only. |

**Acceptance.** A base and browser journey signs in one operator per role and attempts every guarded action through its route and its UI:
1. A Viewer is refused every write.
2. A Contributor captures evidence, records a proxy vote and comments internally but is refused moderation, publication, commitment, settings and every commercial field.
3. A Product manager is refused settings, integrations and roles.
4. An Admin is refused ownership handover, export and erasure.
5. A role change takes effect on the operator's next request.

**Evidence.** `tests/base/auth.test.ts`
**Gap.** Current operators share product access, and workspace clock settings admit Owners and Admins (OPS-008) while other configuration remains owner-only. No journey yet signs in one operator per role: the Viewer, Contributor, Product manager and Admin refusals, unchanged state on refusal and next-request role change lack passing assertions.

#### OPS-002 — Management

Core · published · **done** · Cites BASE-ROLE-001

**Requirement.** Operators are invited and removed in settings.

**Acceptance.**
1. The operator configured at setup can be removed only by themselves.
2. *Policy: `operator.management.v1`; default: any operator may invite or remove any other operator.*

**Evidence.** `tests/base/auth.test.ts`
**Gap.** None.

#### OPS-003 — Overview

Core · published · **done**

**Requirement.** The operator home lists decisions that are ready or review due, evidence that is unreviewed, roadmap items that are Planned or In progress, and releases published in the last 30 days with their outcome totals.

**Acceptance.**
1. Every figure links to the records it counts, and a section with no records names what is absent and links to the action that creates one.

**Evidence.** `tests/browser/operator-pages.mjs`; `tests/browser/operator-overview-checks.mjs`
**Gap.** None.

#### OPS-005 — First-run setup

Core · published · **partial** · Cites BASE-INSTALL-001

**Requirement.** The signed-in owner whose setup is unfinished completes it at `/setup`, and every `/app` document and client-side app navigation sends that owner there first.

**Acceptance.**
1. Finishing setup opens the app, and later visits to `/setup` go to the app.
2. A signed-out visitor to `/setup` is sent to sign-in and back, and a signed-in operator who is not the owner is never sent there.
3. Setup completion is installation state recorded once by the owner under the same-origin and authority checks of the business transaction; it is not portable domain data and does not transfer in an archive.
4. An installation that already has an active owner is treated as finished.
5. After `rer setup`, local `rer dev` opens automatically signed in as the owner and returns them to `/setup` until it is finished; local development has no outbox and silently suppresses mail.
6. Setup cannot finish until the owner has chosen the workspace timezone and seen the requester quiet hours (OPS-008) and entered the company name (INT-007) and the business postal address (NOTIFY-014).

**Evidence.** `tests/base/first-run.test.ts`; `tests/base/mail-identity.test.ts`; `tests/base/workspace-clock.test.ts`; `tests/browser/workspace-clock.mjs`
**Gap.** A signed-in operator who is not the owner never being sent to `/setup`, setup completion staying out of archives, an installation with an active owner being treated as finished, and local `rer dev` opening signed in as the owner with mail suppressed have no passing assertion.

#### OPS-004 — Global search

Core · published · **partial** · Rules D-3

**Requirement.** Operators can search request titles and descriptions, evidence wording, decision questions and rationales, roadmap item titles and summaries, release titles and bodies, requester display names and email addresses, account names, and product, component and feature names (PRIO-001).

**Acceptance.**
1. Each named field is searchable, and a result links to its record.
2. Searching one product, one component and one feature, each by its full name and by a partial name, returns it with a link to its record and in the same ranking as other results.
3. Product, component and feature results pass the same permission filtering as every other searched record: an operator who cannot open one does not see its name.
4. The first page of results returns within 500ms.

**Evidence.** `tests/browser/operator-completeness-requester.mjs`
**Gap.** Search across every other named field ships; product, component and feature names are not yet searched (`src/core/features/workspace/list-repository.ts`), and the 500 ms first page has no seeded run at the `seed.json` limits (D-3).

### Evidence and accounts

#### EVID-001 — Capture

Core · published · **done**

**Requirement.** Every portal submission creates exactly one evidence item in the same transaction (REQ-003).

**Acceptance.**
1. An operator can also record an evidence item, whose source is one of sales call, support conversation, interview, email, or a free-text label the operator supplies.

**Evidence.** `tests/base/penny-evidence.test.ts`; `tests/base/no-mail-identity.test.ts`
**Gap.** None.

#### EVID-002 — Provenance

Core · published · **done**

**Requirement.** Every evidence item stores its source, its original wording, the observed time, and the operator or portal submission that created it. Observed times follow the precision rules in [docs/contract-mechanism.md](docs/contract-mechanism.md#observed-time-precision).

**Acceptance.**
1. The submitting requester or named speaker and the account are nullable, are set only from what the recorder supplies, and are never inferred.

**Evidence.** `tests/base/penny-evidence.test.ts`; `tests/browser/operator-pages-decisions.mjs`
**Gap.** None.

#### EVID-003 — Review lifecycle

Core · published · **done**

**Requirement.** New evidence is unreviewed.

**Acceptance.**
1. An operator can link it to a request or to a candidate bet in a decision brief (DEC-002), create a request or a decision from it, or mark it reviewed with a reason, and can return any reviewed item to unreviewed.
2. Linking alone does not mark it reviewed.

**Evidence.** `tests/browser/operator-evidence-flow.mjs`; `tests/browser/operator-pages.mjs`
**Gap.** None.

#### EVID-004 — Non-destructive linking

Core · published · **done**

**Requirement.** One evidence item can be linked to any number of candidate bets, and each link is recorded as supporting or contradicting that bet.

**Acceptance.**
1. Linking, unlinking, tagging, merging a request, and committing a decision never alter or remove an evidence item or any of its versions; only an operator deleting it does.

**Evidence.** `tests/base/decision-loop-commit.test.ts`
**Gap.** None.

#### EVID-005 — Account context

Core · published · **done**

**Requirement.** An account has a name, an internal owner, optional commercial fields for revenue, renewal date, and health, its requesters, its evidence in observed-time order, and its linked requests and decisions.

**Acceptance.**
1. Evidence recorded against an account appears on that account, and on every request and decision the same transaction linked it to, when that transaction commits.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** None.

#### EVID-006 — Private commercial data

Core · published · **done**

**Requirement.** No field of an account (EVID-005), no evidence source attribution, and no internal note (REQ-032) is ever public.

**Acceptance.**
1. None of them appears in a portal response, on a public page, in page metadata, in a sitemap, or in the subject or body of a requester notification.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** None.

#### EVID-007 — Duplicate suggestions

Core · published · **partial** · Rules D-3

**Requirement.** When an operator records evidence or a requester types a request title, Penny returns within 500ms up to 5 existing requests ranked by term overlap between the typed title and stored request titles and descriptions, and names the matched terms for each.

**Acceptance.**
1. A requester is shown published requests only.
2. Matching is lexical and deterministic and keeps working when no model is configured; AI-001 adds meaning-based suggestions beside it.
3. Penny never links or merges without an explicit operator or requester action, or an auto-link or auto-merge rule an owner enabled (AI-002, AI-003).

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** Penny making no link or merge without an explicit operator or requester action or an owner-enabled auto rule has no passing assertion: the cited counts are taken after the suggestion calls and cover requests, evidence and content submissions, never evidence links or merges; published-only suggestions for a requester and deterministic lexical matching with no model configured are asserted.

#### EVID-008 — Evidence attachments

Core · published · **done** · Cites BASE-INPUT-003

**Requirement.** An operator can attach files to an evidence item within the limits in `seed.json` under BASE-INPUT-003.

**Acceptance.**
1. An evidence attachment is readable only by an operator session and is never served from a public path, whatever the publication state of a linked request.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** None.

#### EVID-009 — Tags

Core · published · **partial**

**Requirement.** Operators create, rename, merge, and delete tags and apply them to evidence items and requests.

**Acceptance.**
1. A tag is operator-only, filterable in every operator list, survives a request merge, and is included in the export.

**Evidence.** `tests/base/board.test.ts`
**Gap.** Tags filtering every operator list, surviving a request merge and appearing in the export have no passing assertion; tag privacy is asserted.

#### EVID-010 — Versions

Core · published · **done**

**Requirement.** Editing an evidence item's wording writes a new version and leaves every earlier version readable to operators.

**Acceptance.**
1. The item's own ID never changes.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** None.

### Requests and portal

#### REQ-001 — Public portal

Core · published · **done**

**Requirement.** The portal serves published requests, a request detail page with its discussion, the public roadmap, and published releases.

**Acceptance.**
1. *Policy: `request.visibility.v1`; default: any visitor may read all four without signing in.*

**Evidence.** `tests/base/board.test.ts`; `tests/base/board-categories.test.ts`; `tests/base/penny-evidence.test.ts`; `tests/browser/requester-blocking.mjs`; `tests/browser/roadmap-public-eta.mjs`; `tests/browser/rich-changelog.mjs`
**Gap.** None.

#### REQ-002 — Requester identity

Core · published · **partial**

**Requirement.** Submitting, voting, commenting, following, subscribing, and recording an outcome each require either an email address verified under REQ-023 (by emailed link, or by Google or GitHub sign-in under REQ-039) or a host-signed identity under REQ-031 (from a parent frame, the widget, or WIDGET-008's sign-in redirect).

**Acceptance.**
1. A portal response shows the requester's chosen display name and never their email address or account.

**Evidence.** `tests/base/no-mail-identity.test.ts`
**Gap.** The requester's chosen display name in a portal response has no passing assertion, and the check that no email address or account appears reads the public request list while it holds no published request, so it checks an empty list; submissions under a valid host-signed identity, with and without outbound mail, and the refusal of invalid or new host identities without mail are asserted.

#### REQ-003 — Submission

Core · published · **partial**

**Requirement.** A requester submits a title, a problem description, an optional free-text proposed solution, an optional free-text impact statement, a board (REQ-018), a category where the board uses them (REQ-034), and optional attachments; on a board with vote subscriptions on, the form states before submission that the author will get updates (NOTIFY-011).

**Acceptance.**
1. The submission atomically creates one unreviewed evidence item and one request awaiting moderation; the request is not public until an operator publishes it, except on a board whose owner turned on auto-publish (REQ-033).
2. *Policy: `request.moderation.v1`; default: each board's moderation setting in settings (REQ-033); on a board without auto-publish an operator reviews every requester submission, edit, and comment before it becomes public.*

**Evidence.** `tests/base/board.test.ts`
**Gap.** The unreviewed evidence item created in the same transaction as the request, and requester edits held for moderation, have no passing assertion in this clause's evidence; the held submission and comment are asserted.

#### REQ-004 — Duplicate prevention

Core · published · **done**

**Requirement.** Before a requester submits, the portal shows the suggestions from EVID-007 with a vote control and a follow control on each.

**Acceptance.**
1. Choosing one applies that vote or follow and discards the draft, creating no request, evidence item, or moderation item.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** None.

#### REQ-005 — Publication

Core · published · **done**

**Requirement.** An operator publishes a moderated request by approving its public title, description, board, category (REQ-034), requester display name, and each attachment separately (REQ-011).

**Acceptance.**
1. The published record contains only the approved fields.

**Evidence.** `tests/base/board.test.ts`
**Gap.** None.

#### REQ-006 — Voting

Core · published · **partial**

**Requirement.** A requester identity has at most one vote on a request and can remove it.

**Acceptance.**
1. The vote total is the count of distinct current voters, and a vote is accepted only while the request's public status is Open, Under review, Planned, or In progress (REQ-016).
2. The author's vote recorded at submission is NOTIFY-011's and counts once like any other.
3. *Policy: `request.vote-eligibility.v1`; default: any verified requester may vote and every vote counts once.*

**Evidence.** `tests/base/board.test.ts`
**Gap.** Refusing a vote outside Open, Under review, Planned or In progress, and the author's vote recorded at submission counting once, have no passing assertion; one vote per identity and the distinct-voter total are asserted.

#### REQ-007 — Discussion

Core · published · **done**

**Requirement.** Verified requesters and operators can comment on a published request. Threaded replies and images in comments are REQ-037.

**Acceptance.**
1. A requester comment is held under `request.moderation.v1` and becomes public only when an operator approves it; an operator comment is public when posted.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** None.

#### REQ-008 — Merge

Core · published · **partial**

**Requirement.** An operator can merge a duplicate request into the canonical request, which is the one that survives.

**Acceptance.**
1. The operation atomically moves the duplicate's evidence links, approved attachments, comments, and followers, collapses the combined votes so each identity counts once, keeps the duplicate's title and source as merge history, and answers the duplicate's public URL with a 301 to the canonical request.
2. Merging a request that is itself a duplicate merges it into the canonical request at the end of its chain.

**Evidence.** `tests/base/board.test.ts`
**Gap.** Moving the duplicate's evidence links, approved attachments and followers, keeping its title and source as merge history, and merging a duplicate into the end of its chain have no passing assertion; the 301, moved comments and collapsed votes are asserted.

#### REQ-009 — Unmerge

Core · published · **partial**

**Requirement.** An operator can reverse a merge.

**Acceptance.**
1. Penny restores the duplicate request's own content, votes, comments, followers, and evidence links, leaves anything added to the canonical request after the merge on the canonical request, and records the reversal.

**Evidence.** `tests/base/board.test.ts`; `tests/base/notifications.test.ts`
**Gap.** Restoring the duplicate's votes, followers and evidence links, leaving post-merge additions on the canonical request and recording the reversal have no passing assertion; the duplicate's comment and status update reappearing are asserted.

#### REQ-010 — Follow and consent

Core · published · **partial**

**Requirement.** A verified requester can follow and unfollow a published request.

**Acceptance.**
1. Submitting and voting present an unticked "Email me updates" control and grant no email permission on their own, except that on a board whose owner turned on vote subscriptions (NOTIFY-008) the vote control says that voting subscribes and the vote itself follows, and submitting subscribes the author (NOTIFY-011).
2. Following, or ticking that control, stores a timestamped permission record for the verified address, which is what makes the identity eligible under REL-004.

**Evidence.** `tests/base/board.test.ts`
**Gap.** The unticked "Email me updates" control on submit and vote, the vote-subscription wording and its follow, the author's subscription, and the timestamped permission record from a follow or a tick have no passing assertion.

#### REQ-011 — Portal attachments

Core · published · **partial** · Cites BASE-INPUT-003

**Requirement.** A file submitted with a request is operator-only until an operator approves that file for publication. Supersedes `BASE-INPUT-003` for published image attachments only: while both the parent request and the file are published, `GET /api/public/attachments/:id` serves an image type in `seed.json → limits.uploadTypes` with an inline disposition so it renders on the request page, instead of the download disposition.

**Acceptance.**
1. Rejecting a file records a reason for operators and does not reject the request.
2. While both the parent request and the file are published, `GET /api/public/attachments/:id` serves it with its declared content type and, for the image types in `seed.json → limits.uploadTypes`, an inline disposition.
3. In every other state that path returns 404.

**Evidence.** `tests/base/board.test.ts`
**Gap.** Rejecting a file with a reason without rejecting the request, and the declared content type and inline disposition of a published image, have no passing assertion; approval, the 404 before it and the served bytes are asserted.

#### REQ-012 — Portal search and browse

Core · published · **partial** · Rules D-3

**Requirement.** Visitors can search published request titles and descriptions, browse one board at a time, filter by public status and by category (REQ-034), and sort by vote total, by most recent public activity (the request's latest published comment, status update, or vote), by newest, or by trending, meaning new votes and published comments in the last 14 days with each day's activity weighted by recency and ties broken by vote total.

**Acceptance.**
1. The first page returns within 500ms.
2. No result, count, or facet includes an internal board, an unpublished or removed request (REQ-041), or a held or removed comment.

**Evidence.** `tests/base/board-categories.test.ts`; `visual/board-categories/REQ-012/`
**Gap.** Category filtering, newest and recency-weighted last-14-day trending are implemented alongside search, board, status and existing sorts. Gap: the 500 ms first page has no seeded run at the `seed.json` limits (D-3).

#### REQ-013 — Submission idempotency

Core · published · **partial**

**Requirement.** A public submission accepts an idempotency key.

**Acceptance.**
1. Repeating the same submission with that key returns the original request and evidence result and creates no second record of any kind; the same key with a different body returns 409.
2. Keys are retained for 30 days and hold no personal data.

**Evidence.** `tests/base/board.test.ts`; `tests/browser/requester-repair.mjs`
**Gap.** No test repeats a submission with its idempotency key to get the original request and evidence result back, sends a changed body under the same key for 409, or checks 30-day key retention and keys holding no personal data.

#### REQ-014 — Identity failure

Core · published · **partial**

**Requirement.** A host-signed identity is expired when its signed issue time is more than 24 hours old or more than 5 minutes in the future.

**Acceptance.**
1. An identity that is expired, or whose signature does not verify, is rejected for every identity-required action, changes no data, and reveals no account or identity match; the visitor is offered email verification (REQ-023) instead.

**Evidence.** `tests/base/host-identity.test.ts`
**Gap.** The visitor being offered email verification (REQ-023) after a rejected identity has no passing assertion; the refusal of expired, future-dated and wrongly signed claims at the host-identity exchange with the identity-required error, no writes and no account or identity disclosure is asserted.

#### REQ-015 — Status updates

Core · published · **partial**

**Requirement.** An operator can publish a status update on a published request.

**Acceptance.**
1. It is rendered distinctly from comments, can be pinned above them, enters the request history, and notifies followers under NOTIFY-001.
2. Setting a request's status (REQ-036) publishes one.

**Evidence.** `tests/base/board.test.ts`
**Gap.** A status update rendered distinctly from comments, pinned above them and notifying followers under NOTIFY-001 has no passing assertion; posting a pinned update and its text on the request are asserted.

#### REQ-016 — Public status

Core · published · **done**

**Requirement.** A published request has exactly one public status: Open, Under review, Planned, In progress, Shipped, or Declined. A declined request is Declined (REQ-017). Otherwise two sources can set it: the direct status an operator sets on the request (REQ-036), including one a migration lands (MIG-008), and the status its approved roadmap mapping projects under ROAD-003. Whichever of the two changed most recently wins: approving a mapping (ROAD-004) and each later transition of the mapped item count as changes of the mapped status at that moment, and a later direct status overrides the mapped one until the mapped item's next transition, the rule DELIV-006 uses for tracker changes. Withdrawing the mapping or dropping its item leaves the direct status, or Open if none was ever set. A request with neither source is Open. The operator request page shows which source the current public status comes from.

**Acceptance.** A base test:
1. A request with no mapping reads Open, then Planned after a direct set.
2. Approving a mapping to an In progress item makes it In progress.
3. A later direct set to Planned wins until the item moves to Shipped, which then wins.
4. Withdrawing the mapping returns the last direct status.
5. Declining wins over both, and reversing the decline restores the status this rule gives.
6. Every public payload agrees within 5 seconds.

**Evidence.** `tests/base/request-status-workflow.test.ts`; `tests/base/decision-loop-roadmap.test.ts`; `visual/request-status-workflow/REQ-016/`
**Gap.** None.

#### REQ-017 — Decline

Core · published · **partial**

**Requirement.** An operator can decline a published request. A decline without a public reason is rejected. Declining sets the public status to Declined, adds the reason to the request history as a status update (REQ-015), and refuses new votes and requester comments while leaving existing ones visible and counted. Reversing a decline restores the request's previous public status. Decline and reversal ship through the operator request controls; repeating a decline with another reason preserves the prior direct or mapped status for reversal.

**Acceptance.**
1. Through the routes and the customer and operator screens at 1440 and 390, a decline without a public reason is refused.
2. A decline sets Declined and adds its reason to the request history.
3. New votes and comments are refused while existing votes and discussion stay visible and counted.
4. Reversing a repeated decline restores the earlier status.

**Evidence.** `tests/base/request-status-workflow.test.ts`; `tests/browser/request-decline.mjs`
**Gap.** The decline reason added to the request history has no passing assertion; refusing a decline without a public reason, setting Declined, refusing new votes and comments while existing ones stay visible and counted, and a reversal restoring the earlier status are asserted.

#### REQ-018 — Boards

Core · published · **partial**

**Requirement.** Every request belongs to exactly one board.

**Acceptance.**
1. Operators create, rename, reorder, and archive boards in settings and can move a request to another board, which keeps its votes, comments, followers, and evidence links.
2. An archived board leaves portal navigation, keeps its published requests reachable at their URLs, and refuses a new submission with 409.

**Evidence.** `tests/base/board.test.ts`
**Gap.** Renaming, reordering and archiving boards, moving a request with its votes, comments, followers and evidence links, and the 409 on submission to an archived board have no passing assertion.

#### REQ-019 — Internal boards

Core · published · **partial**

**Requirement.** Each board is public or internal.

**Acceptance.**
1. A request on an internal board never appears in a portal response, on the public roadmap, in a release, or in a requester notification, whatever its own publication state.
2. Moving a request to an internal board withdraws it from the portal within 5 seconds and its public URL returns 404.

**Evidence.** `tests/base/board.test.ts`
**Gap.** Keeping internal-board requests off the public roadmap, out of releases and out of requester notifications has no passing assertion in this clause's evidence; the request and attachment 404s are asserted.

#### REQ-020 — Requester's own content

Core · published · **partial**

**Requirement.** A requester can edit the title and description of their own request and the text of their own comment.

**Acceptance.**
1. An edit to already-public text re-enters moderation under `request.moderation.v1`, and the previously approved text stays public until the edit is approved or rejected; on an auto-publish board (REQ-033) an unflagged edit is public on submission and the earlier text stays in the request's history for operators.

**Evidence.** `tests/browser/requester-repair.mjs`
**Gap.** Gap: Own-comment editing, retention of approved public text during review, and auto-publish edit/history lack passing assertions.

#### REQ-021 — Requester withdrawal

Core · published · **done**

**Requirement.** A requester can withdraw their own request.

**Acceptance.**
1. A withdrawn request leaves moderation or the portal, its public URL returns 410, and its votes stop counting.
2. Its evidence item survives under EVID-004, marked withdrawn.

**Evidence.** `tests/base/request-withdrawal.test.ts`; `tests/browser/request-withdrawal.mjs`
**Gap.** None.

#### REQ-022 — Blocking a requester

Core · published · **done**

**Requirement.** An operator can block a requester identity. A blocked identity's submissions, votes, comments, follows, and outcome responses are refused with 403; their published requests and comments are hidden from the portal but kept for operators; and their votes stop counting toward totals. Unblocking restores all of it. Block and unblock ship in the private requester directory, and the server checks existing sessions on each participation write.

**Acceptance.**
1. Through the routes and the requester and operator screens at 1440 and 390, a blocked identity's submission, vote, comment, follow and outcome response are refused.
2. Its published requests and comments leave the portal and its votes leave the totals, while operators keep them.
3. Unblocking restores visibility, counts and participation.
4. Refusing the audit write rolls back the block or unblock.

**Evidence.** `tests/base/requester-blocking.test.ts`; `tests/browser/requester-blocking.mjs`
**Gap.** None.

#### REQ-023 — Email verification

Core · published · **partial**

**Requirement.** A requester verifies an email address by following a single-use link sent to it; the link expires 30 minutes after it is sent and fails after one use.

**Acceptance.**
1. The verified session is a browser-local token created at the requester's first interaction and expiring after 30 days without use, so no portal surface sets a cookie.
2. An identity-required action attempted before verification is held for 24 hours, applied on the first verification of that address, and otherwise discarded, and it creates no vote, public record, or notification while held.

**Evidence.** `tests/base/auth.test.ts`; `tests/browser/no-mail-journey.mjs`
**Gap.** The verified session expiring after 30 days without use, and a held action discarded after 24 hours without verification, have no passing assertion; held actions applied on verification are asserted.

#### REQ-024 — Requester identity merge

Core · published · **partial**

**Requirement.** An operator can merge two requester identities.

**Acceptance.**
1. The survivor keeps both verified addresses and all requests, comments, follows, permission records, and suppression state; votes for the same request collapse to one; and the merge is recorded.
2. A merge creates no new vote and no new permission record.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** The survivor keeping both verified addresses and all requests, comments, follows and permission records, votes collapsing to one, the recorded merge, and no new vote or permission record have no passing assertion; carried mutes and preferences and working old links are asserted.

#### REQ-025 — Requester activity

Core · published · **partial**

**Requirement.** A verified requester has one view of their own participation and can manage their updates from it.

**Acceptance.**
1. The view lists their own requests with their current moderation state and public status, their votes, their follows, and their own comments including held and rejected ones.
2. From that view they can unfollow, mute, or change their update subscription (REL-012).

**Evidence.** `tests/base/penny-releases.test.ts`; `tests/browser/requester-activity.mjs`
**Gap.** The current moderation state and public status of the requester's own requests in the view have no passing assertion; the view's counts of their requests, votes, follows and comments including held and rejected ones, and unfollow, mute and subscription changes from it, are asserted.

#### REQ-026 — Demand attribution

Core · published · **partial**

**Requirement.** For any request, operators can see every current voter's display name, verified address, and linked account, and the vote total broken down by account. None of it appears in a portal response.

**Acceptance.**
1. The operator view shows the vote total (proxy votes marked, CAP-014), the linked-evidence count, and the distinct-account count as separate figures, and combines them into no score; only a prioritization view an operator builds under PRIO-003 may combine them, with every input shown.
2. The private supporter view shows each current voter's display name, vote date, every verified address and linked account, with native and historical UserVoice proxy marks, and per-account vote totals.
3. The first 50 supporters appear on expansion; Show more reveals 50 more at a time until the complete history is visible, with no 100-person cap.
4. The operator demand payload holds exactly the three separate figures and no score, and the portal shows none of it.

**Evidence.** `tests/base/request-demand.test.ts`; `tests/base/feedback-import-uservoice.test.ts`; `tests/browser/request-demand.mjs`
**Gap.** The vote date in the private supporter view, and the first 50 supporters on expansion with Show more revealing 50 more at a time, have no passing assertion (the browser check clicks Show more until it is gone and counts only the full history); the separate vote, linked-evidence and distinct-account figures with no score, the supporter view's names, addresses, accounts, proxy marks and per-account totals, the complete history with no 100-person cap, and the portal showing none of it are asserted.

#### REQ-027 — Portal embedding

Core · published · **done** · Cites BASE-PUBLIC-002

**Requirement.** Penny's delta on BASE-PUBLIC-002: the portal is Penny's embeddable surface, and the owner lists its host origins in the `publicOriginAllowlist` setting.

**Acceptance.**
1. The portal's permitted host origins are exactly those in `publicOriginAllowlist`.

**Evidence.** `tests/browser/operator-completeness-security.mjs`; `tests/base/board.test.ts`
**Gap.** None.

#### REQ-028 — Request queue

Core · published · **partial** · Rules D-3

**Requirement.** Operators can list every request, including unpublished ones, filtered by moderation state, board, public status, tag, linked decision, and account, and sorted by vote total, most recent activity, or age.

**Acceptance.**
1. The first page returns within 500ms.

**Evidence.** `tests/browser/operator-completeness-read.mjs`
**Gap.** Queue filters and sorts work; the 500 ms first page has no seeded run at the `seed.json` limits (D-3).

#### REQ-029 — Operator-authored request

Core · published · **done**

**Requirement.** An operator can create a request from one or more evidence items.

**Acceptance.**
1. It skips moderation, records the operator as its author, links the evidence it was created from, and becomes public only through REQ-005.

**Evidence.** `tests/base/operator-request-publication.ts`; `tests/base/penny-evidence.test.ts`; `tests/browser/operator-evidence-flow.mjs`; `tests/browser/operator-pages.mjs`
**Gap.** None.

#### REQ-030 — Moderation verdicts

Core · published · **partial**

**Requirement.** An operator can approve, edit and then approve, or reject with a reason any request or comment awaiting moderation.

**Acceptance.**
1. A rejected item never becomes public, counts toward no public total, stays visible with its reason to its author and to operators, and notifies its author only when the operator chooses to.
2. This private author-only notice requires current verified request-specific email consent and respects suppression, mute, unsubscribe and quiet hours; it does not publish the rejected content or create follower notifications.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** A rejected item counting toward no public total and staying visible with its reason to its author and operators, and the author notice's consent, suppression, mute and quiet-hours checks, have no passing assertion; the unsubscribe link and the once-only send are asserted.

#### REQ-031 — Host identity claims

Core · published · **done**

**Requirement.** A host-signed identity may assert a display name, an email address, and an account identifier and name.

**Acceptance.**
1. A valid signature marks that address verified without a further challenge and links the requester to the matching or newly created account; any asserted commercial field is stored operator-only under EVID-006.

**Evidence.** `tests/base/host-identity.test.ts`
**Gap.** None.

#### REQ-032 — Internal notes

Core · published · **partial**

**Requirement.** Operators can add a note to any request.

**Acceptance.**
1. A note is rendered distinctly from an operator comment and never appears in a portal response, page metadata, a release, or a notification.

**Evidence.** `tests/base/penny-evidence.test.ts`
**Gap.** A note rendered distinctly from an operator comment has no passing assertion; its absence from portal responses, page metadata, releases and notifications is asserted.

### Decisions

#### DEC-001 — States and queue

Core · published · **partial**

**Requirement.** A decision is draft until its brief has a question, an owner, at least one candidate bet, and at least one linked evidence item, at which point it is ready; committing makes it committed, and DEC-007 makes a committed decision review due. A question that is blank as [docs/contract-mechanism.md](docs/contract-mechanism.md#blank-decision-questions) defines it does not count.

**Acceptance.**
1. The decision queue lists every decision in each state with its owner, last action, review date, and linked-evidence count, and a decision changes row rather than leaving the queue when its state changes.

**Evidence.** `tests/base/decision-loop-commit.test.ts`
**Gap.** The review date in the decision queue has no passing assertion; decisions in every state staying in the queue with their state and owner, and the last action and linked-evidence count, are asserted.

#### DEC-002 — Brief

Core · published · **partial**

**Requirement.** A candidate bet is one named option a decision could commit to, and a bet has at most one internal roadmap item.

**Acceptance.**
1. A decision brief holds a question, an accountable owner, its linked evidence and accounts, its candidate bets with the counter-evidence and assumptions for each, a confidence level of low, medium, or high, a review date, and the requesters currently eligible under REL-004 through its mapped requests.

**Evidence.** `tests/base/decision-loop-dimensions.test.ts`
**Gap.** Per-bet assumptions, the low, medium or high confidence level, the review date, and the requesters currently eligible under REL-004 through the mapped requests have no passing assertion, and the brief does not carry the eligible requesters yet; the question, accountable owner, candidate bets, linked evidence and accounts, and each bet's counter-evidence count are asserted.

#### DEC-003 — Comparable bets

Core · published · **partial**

**Requirement.** Every candidate bet in a brief shows the same dimensions: affected requesters and accounts, the count and most recent observed time of its supporting evidence, its contradicting evidence, urgency, delivery shape, and an observable success measure.

**Acceptance.**
1. Penny stores and displays no combined score and no automatic ranking of the bets.

**Evidence.** `tests/base/decision-loop-dimensions.test.ts`
**Gap.** The absence of a stored or displayed combined score and of an automatic ranking has no passing assertion: the bet record and the stored snapshot are checked in a way that allows extra fields, and bets are looked up by id, so their order is unchecked; each bet's metrics holding exactly the five dimension figures is asserted.

#### DEC-004 — Commitment

Core · published · **partial**

**Requirement.** Committing requires a selected bet, a rationale, an owner, a confidence level, and a review date, and committing a brief with fewer than two candidate bets additionally requires a recorded reason why no viable alternative exists.

**Acceptance.**
1. The operation records the declined bets and an evidence snapshot made of the evidence IDs, evidence-version IDs, and DEC-003 dimensions as they stood at that moment, without altering the evidence itself.
2. *Policy: `decision.commitment.v1`; default: any operator may commit.*

**Evidence.** `tests/base/decision-loop-commit.test.ts`
**Gap.** The `decision.commitment.v1` default that any operator may commit has no passing assertion, since every cited commit runs as the owner; the recorded declined bets and the evidence snapshot of evidence IDs, evidence-version IDs and DEC-003 dimensions, with the evidence itself unchanged, are asserted.

#### DEC-005 — Commitment effects

Core · published · **done**

**Requirement.** Committing atomically marks the decision committed, creates or updates the selected bet's internal roadmap item as Planned, leaves the declined bets' roadmap items unchanged, and links the decision to that roadmap item.

**Acceptance.**
1. Commitment writes no public field itself; whether the new status reaches the portal is decided entirely by ROAD-004 and ROAD-005.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`
**Gap.** None.

#### DEC-006 — Revision

Core · published · **done**

**Requirement.** A later change of selected bet or rationale under `decision.commitment.v1` supersedes the prior commitment as a new decision revision, and the original rationale, evidence snapshot, and declined bets stay readable.

**Acceptance.**
1. A revision that changes the selected bet returns the superseded bet's roadmap item to Exploring and, where that item was published, withdraws its approval under ROAD-004 and prepares a status update draft under ROAD-007.

**Evidence.** `tests/base/penny-decisions.test.ts`
**Gap.** None.

#### DEC-007 — Review due

Core · published · **done**

**Requirement.** A review is complete when an operator records a review note and either a new review date or a revision (DEC-006).

**Acceptance.**
1. A committed decision whose review date has passed in `workspaceTimezone` without a complete review becomes review due within 1 hour and its owner is notified under NOTIFY-003.
2. Becoming review due changes no roadmap status, no public status, and no selected bet.

**Evidence.** `tests/base/penny-decisions.test.ts`
**Gap.** None.

#### DEC-008 — Outcome evidence

Core · published · **done**

**Requirement.** Post-release evidence reaches the decision it informs without changing what supported the commitment.

**Acceptance.**
1. A requester outcome (REL-008) and any evidence recorded against a linked release appear on the decision as post-release evidence within 60 seconds.
2. Neither alters the evidence snapshot that supported the commitment.

**Evidence.** `tests/base/penny-releases.test.ts`; `tests/base/penny-decisions.test.ts`
**Gap.** None.

### Roadmap

#### ROAD-001 — Internal states

Core · published · **partial**

**Requirement.** A roadmap item is Exploring, Planned, In progress, Shipped, or Dropped.

**Acceptance.**
1. A status change records the actor, time, and reason and adds an activity entry to the linked decision without changing that decision's state.
2. Moving backward is allowed and is recorded as a further transition.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`
**Gap.** The activity entry a status change adds to the linked decision has no passing assertion in this clause's evidence; each transition's actor, reason and from and to status, the decision's unchanged state, and backward moves recorded as further transitions are asserted.

#### ROAD-002 — Internal record

Core · published · **done**

**Requirement.** A roadmap item keeps its internal planning record beside its customer-safe wording.

**Acceptance.**
1. A roadmap item holds its owner, target or release window, linked decision and evidence, account impact, confidence, delivery notes, and its customer-safe title, summary, and status.

**Evidence.** `tests/browser/operator-roadmap-record.mjs`; `tests/browser/operator-pages.mjs`
**Gap.** None.

#### ROAD-003 — Public projection

Core · published · **partial**

**Requirement.** An approved roadmap item's public status follows its internal status within 5 seconds of a transition: Exploring is shown as Under review; Planned, In progress, and Shipped keep their labels; a Dropped item is withdrawn from the public roadmap.

**Acceptance.**
1. The projection exposes only the approved title, summary, board, and public status; account names, revenue, internal dates, confidence, rationale, evidence, declined bets, and delivery notes are never projected.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`
**Gap.** The absence of account names, revenue, internal dates, confidence, rationale, evidence, declined bets and delivery notes from the projection has no passing assertion in this clause's evidence, whose check of the public item allows extra fields; the projected public status within 5 seconds and a dropped item's withdrawal are asserted.

#### ROAD-004 — Approval is publication

Core · published · **done**

**Requirement.** A roadmap item and each of its request mappings are internal until an operator approves their customer-safe fields, and that approval alone is what puts them on the public roadmap and on the mapped requests.

**Acceptance.**
1. A published request has at most one approved mapping; approving a second is rejected.
2. Withdrawing approval removes the projection from the portal within 5 seconds, makes its public roadmap URL return 404, and deletes no internal record.
3. *Policy: `roadmap.publication.v1`; default: an operator approves every public mapping explicitly.*

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`; `tests/base/request-status-workflow.test.ts`
**Gap.** None.

#### ROAD-005 — Commitment mapping

Core · published · **done**

**Requirement.** The roadmap item DEC-005 creates or updates is internal unless it already carries an approval under ROAD-004.

**Acceptance.**
1. An already-approved item projects its new Planned status under ROAD-003; an unapproved item and its mappings stay private, and commitment never grants an approval.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`
**Gap.** None.

#### ROAD-006 — Public roadmap

Core · published · **done**

**Requirement.** A public roadmap whose source is approved roadmap items groups them under Under review, Planned, In progress, and Shipped and links each to its public request or release. A public roadmap whose source is request statuses follows ROAD-014.

**Acceptance.**
1. It exposes no unapproved item and no count that includes one.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/roadmap-public-eta.mjs`
**Gap.** None.

#### ROAD-007 — Status update draft

Core · published · **partial**

**Requirement.** Every status change of a roadmap item that carries an approval under ROAD-004, and every request decline under REQ-017, prepares a draft customer-safe update naming the new public status and the problem it addresses.

**Acceptance.**
1. The draft carries no internal rationale, commercial context, declined bet, or outcome prompt, and is invisible on the portal until an operator publishes it.

**Evidence.** `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/operator-pages-status.mjs`
**Gap.** The draft's absence of internal rationale, commercial context, declined bets and outcome prompts has no passing assertion in this clause's evidence, whose check of the draft allows extra fields, and no cited case reads the portal before the draft is published; a draft prepared for each approved status change with the safe title, problem and new public status, unpublished until an operator publishes it, and no draft for an unapproved item are asserted.

#### ROAD-008 — Status update publication

Core · published · **done**

**Requirement.** Publishing that draft adds it to the history of every approved mapped request and queues one notification per update version for each requester eligible under REL-004 who follows one of those requests, deduplicated by identity and subject to the coalescing in NOTIFY-002.

**Acceptance.**
1. Republishing the same version queues nothing further.

**Evidence.** `tests/base/roadmap-update-publication.ts`; `tests/base/board.test.ts`; `tests/base/notifications.test.ts`; `tests/browser/operator-pages-status.mjs`; `tests/browser/operator-pages.mjs`
**Gap.** None.

### Releases and outcomes

#### REL-001 — Draft and targets

Core · published · **partial**

**Requirement.** A targeted release draft has one or more targets, each linking one roadmap item in any state to its decision and its approved public request mappings, or one published request directly (REL-019); a draft with no target is an announcement (REL-018).

**Acceptance.**
1. The draft also holds a customer-safe title, a type of New, Improved, or Fixed, one or more subject tags drawn from EVID-009, a body, a publication date, an optional setup or usage link, an author, and, for a targeted release, the wording of the outcome prompt shown with the REL-008 response.

**Evidence.** `tests/browser/loopjourney-release.mjs`
**Gap.** A saved draft holding its publication date, optional setup or usage link and outcome-prompt wording has no passing assertion; the title, type, tag, body, author and target are entered and saved.

#### REL-002 — Publication

Core · published · **done**

**Requirement.** An operator can publish a targeted draft only when it has a title, a body, at least one target, and every linked roadmap item at Shipped; publishing with any linked item in another state is rejected. Announcements publish under REL-018 and request targets under REL-019.

**Acceptance.**
1. Publication makes one versioned update visible on the portal and durably records the complete recipient snapshot (REL-004) before it queues any delivery.

**Evidence.** `tests/browser/loopjourney-release.mjs`
**Gap.** None.

#### REL-003 — Published wording

Core · published · **done**

**Requirement.** Published release wording is never overwritten.

**Acceptance.**
1. A correction creates a new version, keeps the earlier version readable by operators, and marks which version the portal shows.
2. A correction changes the portal only; sending it to recipients requires an operator to send it as a new delivery version.

**Evidence.** `tests/base/penny-releases.test.ts`; `tests/base/release-custody.test.ts`
**Gap.** None.

#### REL-004 — Recipient eligibility and snapshot

Core · published · **partial**

**Requirement.** A recipient is eligible when they hold a verified address and a current permission record, and each eligible identity appears exactly once in the snapshot however many target contexts it has.

**Acceptance.**
1. At publication Penny snapshots every release target and each recipient's linked request or evidence context, and a later merge, relink, or preference change does not alter that snapshot.
2. *Policy: `release.recipient-eligibility.v1`; default: a permission record comes only from following a request (REQ-010), subscribing to updates (REL-012), voting on a board with vote subscriptions on (NOTIFY-008), submitting a request on such a board (NOTIFY-011) or an owner-selected migration carry-over (MIG-007, which makes its address eligible for email without verifying it); voting elsewhere and an operator-entered address grant nothing, and an operator's per-update choice to email captured contacts (NOTIFY-009) adds them to that one snapshot without a permission record.*

**Evidence.** `tests/base/release-custody.test.ts`
**Gap.** The snapshot staying unchanged after a later merge, relink or preference change, and the `release.recipient-eligibility.v1` default (which actions grant a permission record, that voting elsewhere and an operator-entered address grant none, and NOTIFY-009's one-snapshot addition) have no passing assertion; export and restore of the snapshot tables, an identity merge fenced while a send is in flight, and follower erasure are asserted.

#### REL-005 — Customer-safe delivery

Core · published · **partial**

**Requirement.** Release email and release portal content carry only the published release fields and the recipient's own request context.

**Acceptance.**
1. Recipient lists, other requesters, account context, commercial impact, decision rationale, confidence, and declined bets never appear in either.
2. Release email carries the owner's brand header (INT-008), sender identity (NOTIFY-013) and postal address (NOTIFY-014).

**Evidence.** `tests/browser/loopjourney-release.mjs`
**Gap.** The owner's brand header (INT-008), sender identity (NOTIFY-013) and postal address (NOTIFY-014) in release email have no passing assertion in this clause's evidence; private context staying out of the public updates is asserted.

#### REL-006 — Acceptance and retry

Core · published · **partial** · Cites BASE-MAIL-001, BASE-OPS-004

**Requirement.** Publication queues each eligible delivery within 60 seconds of its permitted send time (NOTIFY-002), with the release scheduling and ordering rules in [docs/contract-mechanism.md](docs/contract-mechanism.md#release-scheduling).

**Acceptance.**
1. A failure returned before provider acceptance is retried up to 5 times with exponential backoff over 1 hour and then marked failed.
2. After acceptance Penny never resends automatically.
3. A result the provider leaves ambiguous, or a send interrupted before its outcome is known, is marked unknown and shown to operators, and Penny never replays it automatically with either provider (RULINGS.md RL-3): Resend suppresses a duplicate for its delivery key (REL-007), while SendGrid's delivery key is correlation only.
4. The published update stays visible on the portal in every failure state.

**Evidence.** `tests/base/notifications.test.ts`; `tests/base/release-custody.test.ts`
**Gap.** The published update staying visible on the portal in every failure state has no passing assertion, and an ambiguous or interrupted send held unknown with no replay (point 3, reconciled with RL-3) is asserted for requester status-update mail but not for a release delivery; bounded retry of known failures ending in failed, and a restored queued release held unknown and inert, are asserted.

#### REL-007 — Idempotent delivery and provider events

Core · published · **partial** · Cites BASE-MAIL-001, BASE-DATA-002

**Requirement.** Every release version and recipient has one durable delivery key that Penny passes to the mail provider as an idempotency key, and the accepted provider message ID is stored against it.

**Acceptance.**
1. Resend receives each delivery key as its `Idempotency-Key` and suppresses a duplicate within 24 hours.
2. SendGrid receives each delivery key as a provider idempotency key in the same way, so a duplicate send for that key is suppressed.
3. `/api/public/mail/events` accepts only signed provider callbacks and deduplicates their event IDs, which are retained for 30 days; signed event receipts are retained without automatic deletion, consistent with BASE-DATA-002.

**Evidence.** `tests/base/release-custody.test.ts`
**Gap.** Resend idempotency key and signed event dedupe ship; SendGrid has no provider duplicate suppression, so its delivery key is correlation only (RL-3).

#### REL-008 — Outcome response

Core · published · **done**

**Requirement.** A requester in a release's publication snapshot can answer Adopted, Partly adopted, or Not yet for each of its targets, whether or not they have muted or unsubscribed from email.

**Acceptance.**
1. Penny stores one current response per release, requester, and target; changing it records a revision and updates the aggregates without exposing the requester on any public surface.
2. Repeating the same response records no revision.

**Evidence.** `tests/base/penny-releases.test.ts`
**Gap.** None.

#### REL-009 — Outcome coverage

Core · published · **done**

**Requirement.** Operators can see, per target and for the whole release, the count of each response and the coverage, meaning current responses divided by snapshot recipients, and can see the individual responses.

**Acceptance.**
1. Each current response links through its snapshotted target and recipient context back to the applicable request or evidence, roadmap item, and decision.

**Evidence.** `tests/base/penny-releases.test.ts`
**Gap.** None.

#### REL-010 — Empty feed

Core · published · **done**

**Requirement.** The public updates surface tells the truth when nothing has been released.

**Acceptance.**
1. With no release published, the public updates surface states that there are no updates yet and renders no draft, example, or placeholder entry.

**Evidence.** `tests/browser/route-review.mjs`
**Gap.** None.

#### REL-011 — Bounces and complaints

Core · published · **partial** · Cites BASE-MAIL-001

**Requirement.** A hard bounce or a spam complaint suppresses the address: no further Penny email reaches it until the requester verifies it again, and its permission records are marked suppressed rather than deleted.

**Acceptance.**
1. A soft bounce marks that one delivery failed and suppresses nothing.
2. Suppression removes no vote, request, comment, or portal access.

**Evidence.** `tests/runtime/mail-events-restart.test.mjs`
**Gap.** A soft bounce marking one delivery failed and suppressing nothing, a spam complaint's suppression, and suppression removing no vote, request, comment or portal access have no passing assertion; hard-bounce suppression is asserted.

#### REL-012 — Update subscription

Core · published · **done**

**Requirement.** A verified requester can subscribe to every published release from the public updates surface and unsubscribe there or from any notification's unsubscribe link.

**Acceptance.**
1. Subscribing stores a timestamped permission record for that address; unsubscribing withdraws it without removing votes, requests, or follows.

**Evidence.** `tests/base/penny-releases.test.ts`
**Gap.** None.

#### REL-013 — Delivery states

Core · published · **partial** · Cites BASE-MAIL-001

**Requirement.** A delivery moves through queued, then accepted, then delivered, and can terminate at failed, suppressed, or unknown.

**Acceptance.**
1. An out-of-order provider event never moves a delivery backward along that order and never counts a result twice.

**Evidence.** `tests/base/release-custody.test.ts`
**Gap.** An out-of-order provider event never moving a delivery backward and never counting a result twice has no passing assertion.

### Notifications

#### NOTIFY-001 — Requester updates

Core · published · **partial**

**Requirement.** A follower of a published request is notified when an operator publishes a status update on it (REQ-015), including a status set under REQ-036, declines it (REQ-017), publishes a status update mapped to it (ROAD-008), posts a public reply on it, approves a requester comment on it (REQ-007) or receives an auto-published one (REQ-033), unless they have muted that request or their address is suppressed.

**Acceptance.**
1. Voters on vote-subscription boards (NOTIFY-008) and subscribed authors (NOTIFY-011) are notified as followers, and a merge notifies under NOTIFY-012.
2. Held or rejected comments, unpublished requests, internal boards, internal notes, and an internal roadmap transition with no published update notify nobody, and republishing the same update version notifies nobody again.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** Notifying voters on vote-subscription boards (NOTIFY-008) as followers has no passing assertion; the subscribed author's notice is asserted.

#### NOTIFY-002 — Preferences, timing, and unsubscribe

Core · published · **done**

**Requirement.** A notification's permitted send time is the first moment after it is queued at which the requester's preferences and the quiet hours below allow it. *Policy: `requester.notification.v1`; default: hold requester email during the requester quiet hours the owner sets under OPS-008 (by default 20:00 inclusive to 08:00 exclusive in `workspaceTimezone`; the owner may turn them off), and coalesce updates for the same requester and request in a fixed 1-minute window starting with the first pending event into one message, with later events never extending that boundary.* The deployment timezone input and the release ordering rule are in [docs/contract-mechanism.md](docs/contract-mechanism.md#notification-timing).

**Acceptance.**
1. Every requester notification carries a one-click unsubscribe link that works without signing in.
2. A requester can mute one request or all requester email; the preference is checked immediately before each send and removes no vote, evidence, or portal access.
3. An eligible notification sends as soon as its window and quiet hours allow, and a wakeup that comes earlier sends nothing.
4. A missed wakeup is recovered within a minute under the same delivery claims, and a repeated wakeup or recovery run never sends a notification twice.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** None.

#### NOTIFY-003 — Decision review

Core · published · **done**

**Requirement.** A decision owner receives one email and one in-app notification, which stays in their notification list until dismissed, the first time a decision becomes review due.

**Acceptance.**
1. Operator email carries no quiet hours and queues within 60 seconds of the decision becoming review due.
2. No repeat is sent until the review date changes or the operator completes the review and schedules another.

**Evidence.** `tests/base/penny-decisions.test.ts`
**Gap.** None.

#### NOTIFY-004 — No mail loops

Core · published · **partial**

**Requirement.** Notifications are sent from a no-reply address, and Penny reads no mail at any address it sends from. The only inbound-mail route is CAP-009's dedicated capture address, which accepts mail only from operators and allowlisted senders and never from Penny's own notification addresses.

**Acceptance.**
1. A reply to any notification creates no evidence item, comment, request, or other record.
2. Every notification, sign-in and verification message goes out from the deployment's `MAIL_FROM` or a NOTIFY-013 tested sender, carries `Auto-Submitted: auto-generated`, and has no reply-to unless the owner sets a monitored one under NOTIFY-013.
3. The Worker accepts inbound mail only through CAP-009’s dedicated platform-invoked email handler; no HTTP route accepts a posted mail message.
4. CAP-009’s handler refuses Penny’s own sender addresses, configured reply-to and notification replies, retaining only non-personal refusal counts; CAP-009 enforces reciprocal capture/reply-to exclusion, and NOTIFY-013 retains its other obligations.
5. A follower's status notification has its sender, no reply-to and the `Auto-Submitted` header; its reply, posted as a raw message, an Inbound Parse form and a JSON inbound webhook to the provider event route and each plausible capture path, is refused, and no table changes except the per-IP request counters every HTTP request charges.

**Evidence.** `src/core/features/notifications/delivery.ts`; `tests/base/notifications.test.ts`
**Gap.** Sign-in and verification mail going out from `MAIL_FROM` or a NOTIFY-013 sender, with `Auto-Submitted: auto-generated` and no reply-to, has no passing assertion; a follower's status notification's sender, header and absent reply-to, and the refusal of its reply at every door, are asserted.

#### NOTIFY-005 — Notification failure

Core · published · **partial** · Cites BASE-OPS-004

**Requirement.** Requester status-update email and operator decision-review email each use a durable recipient-and-event key and retry, suppress, and expose failure exactly as REL-006, REL-011, and REL-013 describe.

**Acceptance.**
1. The in-app or portal record of the same event stays available when the email fails.

**Evidence.** `tests/base/notifications.test.ts`
**Gap.** The in-app or portal record of the same event staying available when the email fails has no passing assertion; bounded retry, failed and unknown outcomes and the operator delivery list are asserted.

### Data

#### DATA-001 — Export contents

Core · published · **done** · Cites BASE-DATA-001 · Register R-11

**Requirement.** Penny's delta on Base export: the export names every Penny record kind.

**Acceptance.**
1. The export contains every durable record as JSON, including every operator, requester, identity merge, account, board, tag, request, moderation decision and reason, merge history, vote, comment, note, follower, block, evidence item and version, decision and revision, roadmap item and transition, release, release version and target, delivery with its key and provider message ID, outcome and revision, subscription, suppressed address, notification and preference, custom field, and audit entry, plus every attachment as its original file.

**Evidence.** `tests/base/hosted-export.test.ts`; `tests/installer/portability.test.mjs`
**Gap.** None.

#### DATA-002 — Public/private boundary

Core · published · **partial**

**Requirement.** Operator-only data never travels in a public response, rendered or not.

**Acceptance.**
1. No operator-only field name and no operator-only value appears anywhere in a public response payload, including in fields the portal does not render.

**Evidence.** `tests/base/host-identity.test.ts`; `tests/base/no-mail-identity.test.ts`
**Gap.** The absence of operator-only field names and values from a public payload has no passing assertion over a non-empty response: both cited checks read the public request list while it holds no published request (the non-empty public-surface scan in `tests/base/penny-evidence.test.ts` is not cited here); the refusal of invalid signed claims without writes or identity disclosure is asserted.

#### DATA-003 — Erasure outranks history

Core · published · **partial** · Cites BASE-DATA-003 · Register R-11

**Requirement.** Penny's delta on Base erasure: where a clause here says a record is preserved, versioned, immutable, or never overwritten, erasure under BASE-DATA-003 takes precedence: the record is deleted or anonymized and the surviving audit entry keeps an anonymized reference.

**Acceptance.**
1. Unmerging (REQ-009) and revision history never recreate erased data.

**Evidence.** `tests/base/penny-erasure.test.ts`; `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Native erasure retains its prior proof for installations without agent evidence. Base has no client-scoped retained-evidence erasure/fence contract; native erasure and restore now refuse before mutation while agent outcomes/audit/approvals exist, with transactional reservation fences preserving native sponsor bindings.

#### DATA-004 — Custom fields

Core · published · **done**

**Requirement.** Operators define custom fields in settings on each entity listed in `seed.json → customFields`, and can read and edit their values wherever that entity is shown.

**Acceptance.**
1. A custom field is operator-only and is never projected to a public surface.

**Evidence.** `tests/browser/operator-completeness-fields.mjs`; `tests/browser/operator-pages.mjs`
**Gap.** None.

### Scoped cancellation learning

#### LEARN-001 — Permitted originals

Core · published · **partial**

**Requirement.** Equal native operators select native evidence/requests and exact Orbit `rer-delegation/1` evidence targets with a recorded purpose/use basis and all-operator authorization.

**Acceptance.**
1. The deployment pins the source installation and permitted source principals.
2. The adapter only reads selected targets; original text, source revision, supplied record time and retrieval time remain separate.
3. Requester/account links come only from native records; Orbit identity remains source-local and nullable.
4. Model output cannot set identity or grants.

**Evidence.** `tests/base/learning-stage2.test.ts`
**Gap.** The deployment pinning the source installation and permitted source principals, and model output being unable to set identity or grants, have no passing assertion; separate original text, revision and time fields and nullable source identity are asserted.

#### LEARN-002 — Contestable learning

Core · published · **partial**

**Requirement.** A configured model prepares an evidence comparison, exact validated spans, contradictions, uncertainty, a distinguishing clarification when evidence is thin, and a usable internal implementation brief.

**Acceptance.**
1. Every option has the DEC-003 dimensions computed from originals, including a materially different no-build/process/support/onboarding option.
2. Native/source corrections invalidate current derived work; operator contests are versioned.
3. There is no automatic ranking, customer contact or publication.

**Evidence.** `tests/base/learning-stage2.test.ts`
**Gap.** Every option carrying the DEC-003 dimensions computed from originals, invalidation by native or source corrections with versioned operator contests, and the absence of automatic ranking, customer contact or publication have no passing assertion in this clause's evidence; validated spans, the clarification and the no-build option are asserted.

#### LEARN-003 — Accountable pre-action choice

Core · published · **partial**

**Requirement.** An operator selects an option, rationale, confidence and review date. Commitment is a decision record, not execution or an observed customer outcome.

**Acceptance.**
1. The immutable snapshot retains the exact interpretation, original evidence, comparable selected/declined options and owner, plus the predeclared cohort, denominator, baseline, window, measure, data source, comparison, limits, stop rule and budget.
2. Missing protocol fields are explicit nulls and prevent commitment.

**Evidence.** `tests/base/learning-stage3.test.ts`
**Gap.** The committed snapshot retaining the interpretation, original evidence, compared options, owner and full predeclared protocol, and missing protocol fields as explicit nulls that prevent commitment, have no passing assertion in this clause's evidence; commitment and its attributed audit are asserted.

#### LEARN-004 — Bounded recurring work

Core · published · **partial**

**Requirement.** Scheduled Worker events refresh selected sources and advance the authorized evidence comparison/internal brief.

**Acceptance.**
1. Every run has a durable event/claim, source revision cursor and budget reservation; unchanged inputs produce no new artifact/card/model call.
2. Source, purpose, native authority, expiry, budget, correction version and erasure epoch are checked before external work and in the result transaction.
3. No implicit contact, production or publication effect exists.
4. Pause one/all, resume within a valid grant, revoke and disconnect are native operator controls.
5. Interrupted/ambiguous calls retain visible uncertainty and reserved budget rather than automatic retries.

**Evidence.** `tests/base/learning-stage3.test.ts`
**Gap.** Expiry, budget, correction-version and erasure-epoch checks before external work and in the result transaction, the absence of any implicit contact, production or publication effect, and interrupted or ambiguous calls keeping their uncertainty and reserved budget without retry have no passing assertion in this clause's evidence; durable runs, unchanged-input deduplication, in-flight pause and revoke, and pause, resume, revoke and disconnect are asserted.

#### LEARN-005 — Privacy closure

Core · published · **partial** · Cites BASE-DATA-003

**Requirement.** Person/native contribution erasure deletes dependent interpretations, corrections, commitment snapshots and provenance copies. DATA-003 erasure precedence remains operative.

**Acceptance.**
1. Same-source external-person erasure covers duplicate connections.
2. Stable provider/installation/event and person hashes fence replay even under a fresh local source connection.
3. Source revocation purges copies and derived work; in-flight results cannot survive a changed scope or erasure epoch.
4. Archives carry this history and opaque fences, never credentials; restored sources/grants remain held and running claims become uncertain.

**Evidence.** `tests/base/learning-stage3.test.ts`
**Gap.** Running claims becoming uncertain after a restore has no passing assertion: no run is in flight at export and nothing reads an uncertain claim after the restore; same-source erasure across duplicate connections, hash fences under a fresh connection, revocation purging copies and derived work, and a restore that leaves no investigation active and refuses a restored run with `learning_scope_changed` are asserted.

#### LEARN-006 — Configuration and proof boundary

Core · published · **done** · Register R-10

**Requirement.** Absent source, model or enforcing RPC transport visibly refuses work.

**Acceptance.**
1. Installation-controlled configuration declares a model, token prices/output bound and source read cost.
2. The run reserves its ceiling before work, refunds known unused cost and separates metered cost from uncertain reservations.

**Evidence.** `tests/base/upgrade.test.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** None.

### Saved feedback history

#### IMP-001 — Saved records

Core · published · **done** · Register R-9

**Requirement.** A current native operator previews saved feedback boards, posts/status, individual votes/comments, explicitly supplied merge chains (saved post API mergeHistory with complete posts, or owner relationship sidecars) and private tags.

**Acceptance.**
1. Every mapped request receives one exact-provenance evidence item.
2. Historical contributors have a non-authorizing provenance representation; imports cannot grant verified identity, consent, authority, an outreach audience or commercial context.

**Evidence.** `tests/base/feedback-import.test.ts`
**Gap.** None.

#### IMP-002 — Review and mapping

Core · published · **done**

**Requirement.** Exact originals and explicit status/visibility choices bind the reviewed fingerprint.

**Acceptance.**
1. Unsupported fields, missing references and aggregate-only data are named before apply.
2. Rejected mapping prevents application; no row is silently dropped or guessed.
3. Publication/moderation remains a distinct native decision.

**Evidence.** `tests/base/feedback-import.test.ts`
**Gap.** None.

#### IMP-003 — Durable custody

Core · published · **done**

**Requirement.** Native D1 changes, original custody, provenance and checkpoints commit atomically under current session/installation authority and maintenance fences.

**Acceptance.**
1. Identical sources repeat without duplication; changed identities conflict.
2. Restart resumes the persisted plan rather than acquiring the source again.
3. Imports never send or enqueue external effects.

**Evidence.** `tests/base/feedback-import-custody.test.ts`
**Gap.** None.

#### IMP-004 — Safe reversal

Core · published · **done**

**Requirement.** Undo/rollback removes only owned effects under full native value, revision, relationship and cardinality fences.

**Acceptance.**
1. Later native work or shared dependencies cause a visible conflict without collateral deletion.
2. Reversal is durable and restartable; ordinary reversal retains originals.

**Evidence.** `tests/base/feedback-import-custody.test.ts`
**Gap.** None.

#### IMP-005 — Privacy precedence

Core · published · **done** · Cites BASE-DATA-003

**Requirement.** Erasure purges affected retained originals/creation copies and records opaque target fences.

**Acceptance.**
1. Old imports cannot recreate erased effects.
2. Historical identity and import metadata participate in product archive and erasure classification; installation credentials remain non-portable.

**Evidence.** `tests/base/feedback-import-custody.test.ts`
**Gap.** None.

#### IMP-006 — Ideas aggregates

Core · published · **done**

**Requirement.** Saved Ideas CSV rows become unpublished, unreviewed requests with one exact-provenance evidence item under explicit source-key, status and visibility mappings.

**Acceptance.**
1. Count, company, score, formula, owner and custom fields remain private source material, with aggregate columns named in preview, numeric totals and source-row coverage for textual company data.
2. Counts never manufacture individual voters, commenters, followers, accounts or commercial records.
3. Unknown headings and missing required headings are refused by name; an idea ID or URL must be supplied, never invented from a title or row number.

**Evidence.** `tests/base/feedback-import.test.ts`
**Gap.** None.

#### IMP-007 — Move-in receipt

Core · published · **done**

**Requirement.** Preview, apply and reversal expose a private operator receipt with per-kind source/read/applied/skipped counts and reasons, destination counts, named omissions and unresolved relationships, non-authorizing identity treatment, and job-created mail and notification counts (zero).

**Acceptance.**
1. Reversal names removed effects and conflicts preserving later native work, and reports retained originals.
2. Receipt contents, attribution and commercial/source fields remain outside public projections.

**Evidence.** `tests/base/feedback-import.test.ts`; `tests/base/feedback-import-uservoice.test.ts`
**Gap.** None.

#### IMP-008 — UserVoice saved source

Core · published · **done** · Register R-9

**Requirement.** Saved UserVoice ideas-only and Ideas & Voters CSV exports, read by the headings UserVoice documents, become unpublished, unreviewed requests with one exact-provenance evidence item keyed by Idea ID, under explicit status, board and forum mappings.

**Acceptance.**
1. Each idea and UserVoice User ID pair becomes one historical, non-authorizing vote attribution with its original link date; repeated rows for extra accounts or captured feedback fold into it and stay in the private original.
2. A supporter is marked proxy only from the documented feedback-capturer columns, the mark is shown in preview, receipt and the operator request page, and it never upgrades the supporter.
3. A Subscribed value creates no follow or permission unless the owner selects MIG-007 carry-over.
4. Names and email addresses never match, merge or link people; account, company, revenue, subscription and contact columns create no account, follow, consent, verified address or outreach audience.
5. Each file declares its export scope; an undeclared scope is refused, a filtered one shows a partial-history warning, and claimed vote counts beyond the supplied supporters are named aggregate-only and create nothing.
6. Unknown headings, unmapped statuses or forums, unzoned timestamps and spreadsheet workbooks are refused by name before any write.

**Evidence.** `tests/base/feedback-import-uservoice.test.ts`
**Gap.** None.

### Optional installation ownership and visual editing

#### OWN-001 — Signed first owner

Core · published · **done** · Cites BASE-ACCESS-004

**Requirement.** Penny's delta on native Base bootstrap: a trusted configured issuer, public signing key ring, installation ID and exact application audience can admit the first owner.

**Acceptance.**
1. Expiry, signature, audience, replay, concurrent second claim and any installed owner refuse authority.
2. The original setup token remains compatible.
3. Claims cannot supply trusted configuration or take over an existing workspace; raw credentials stay out of storage/archives.

**Evidence.** `tests/base/owner-claim.test.ts`
**Gap.** None.

#### EDIT-001 — Owner editor

Core · published · **partial** · Cites BASE-ACCESS-004

**Requirement.** The optional maintained editor receives only a short lease and validated management origin/installation ID after current native owner admission.

**Acceptance.**
1. Equal product operators remain equal for product work; this does not grant owner configuration.
2. Compiled data-only edits apply after the rendered destination hydrates and preserve native navigation/privacy.
3. The management service independently admits its owner and registered frame origin.

**Evidence.** `tests/base/editor-admission.test.ts`
**Gap.** Compiled data-only edits applying after the destination hydrates with native navigation and privacy preserved, and the management service's own admission of its owner and frame origin, have no passing assertion; the short owner-only lease and the refusal of other operators and foreign origins are asserted.

### Scoped server integrations

#### API-001 — Scoped keys

Core · published · **partial**

**Requirement.** A current native operator may issue a named optional-expiry REST key. Its random value is revealed once; only its hash persists. Route-selected scopes are `requests:read`, `requests:write`, `comments:read`, `comments:write`, `status:read`, `status:write`, `releases:read`, `releases:write` and `votes:write`. The first eight admit their documented resource reads and writes; `votes:write` authorizes customer lookup at `GET /api/v1/proxy-vote-contacts` and recording an attributed customer proxy vote at `POST /api/v1/requests/:slug/proxy-votes`, without verification or email permission. Bearers never grant operator HTML, generated-function, export or owner configuration authority.

**Acceptance.**
1. A current token with `votes:write` records a proxy vote.
2. A token without that scope is refused the same vote write and changes no vote or permission record.
3. Revocation refuses the next write.

**Evidence.** `tests/base/integration-api.test.ts`
**Gap.** Recording a proxy vote with a current `votes:write` token, and refusing that write to a token without the scope with no vote or permission record changed, have no passing assertion in this clause's evidence (`tests/base/proxy-votes.test.ts` asserts both and is not cited here); revocation refusing the next write is asserted.

#### API-002 — Current custody

Core · published · **partial** · Cites BASE-ACCESS-004

**Requirement.** Penny's delta on server-side authorisation for scoped keys: revocation, expiry and issuer authority changes fence every API request and its business transaction in the same native database.

**Acceptance.**
1. Authorization writes safe usage metadata durably before returning authority; storage failure refuses.
2. Credentials are installation custody and are not a portable identity backup.

**Evidence.** `tests/base/integration-api.test.ts`
**Gap.** Credentials staying out of portable archives, and a restore honouring none, have no passing assertion; usage metadata written before authority is returned with storage failure refusing, revocation, expiry and issuer removal fencing requests and business writes, and a bearer key refused at export are asserted.

#### API-003 — Native publication

Core · published · **partial**

**Requirement.** API writes reuse native validation, moderation, explicit customer-safe approval, consent, maintenance and immutable snapshots. Tracker synchronization follows the Delivery sync clauses (DELIV-001–DELIV-010), never an API side effect.

**Acceptance.**
1. Imported/restored history creates no new publication or integration effect.

**Evidence.** `tests/base/integration-api.test.ts`
**Gap.** That imported or restored history creates no new publication or integration effect has no passing assertion: the cited upgrade case snapshots its tables after the import and compares them only across migrations, and no cited case restores an archive; prior history, including imported feedback, staying unchanged across each new migration is asserted.

#### INT-001 — Explicit integration effects

Core · published · **partial**

**Requirement.** Operators select approved public request/comment/status/release events and immutable destinations.

**Acceptance.**
1. Native writes and event targets commit together.
2. Imported/restored history cannot create live outbound effects.
3. Product archives carry safe event/attempt/receipt history; installation credentials are nonportable.

**Evidence.** `tests/browser/integration-states.mjs`
**Gap.** Gap: Selected public event kinds, immutable destinations, atomic business-write/event-target capture, held restored history and portable safe integration history with nonportable credentials lack complete passing assertions.

#### INT-002 — Enforcing transport

Core · published · **done** · Cites BASE-DATA-004 · Register R-12

**Requirement.** Webhook/Slack dispatch uses the maintained Base delivery service through an installation-owned enforcing RPC transport.

**Acceptance.**
1. Missing transport disables outbound integrations.

**Evidence.** `tests/base/egress-delivery.test.ts`
**Gap.** None.

#### INT-003 — Durable uncertainty

Core · published · **partial**

**Requirement.** Attempt identity, finite retry, ambiguity and explicit reconciliation survive restart.

**Acceptance.**
1. An ambiguous effect does not resend under another identity.
2. Revoked configuration and private/blocked content cannot start a send.

**Evidence.** `tests/browser/integration-states.mjs`
**Gap.** Gap: Durable attempt identity, finite retry, ambiguity/reconciliation and revoked/private/blocked send fencing lack complete passing assertions.

#### INT-004 — Signed inbound notes

Core · published · **done**

**Requirement.** Original bounded bytes verify before parsing;
current native authority, replay identity, internal note and processed receipt
commit together.

**Acceptance.**
1. Notes do not publish content or grant identity or consent.

**Evidence.** `tests/browser/integration-receiver-checks.mjs`; `tests/browser/integration-states.mjs`
**Gap.** None.

#### INT-005 — Deliberate tracker issues

Core · published · **partial**

**Requirement.** Operators create or link a selected Linear or Jira issue from a request or decision. Ongoing state mapping, GitHub, Vector, Azure DevOps, ClickUp and Asana are DELIV-001–DELIV-010.

**Acceptance.**
1. Only entered wording is sent.
2. Native durable commands retain uncertain outcomes for explicit known-issue reconciliation and never create a duplicate automatically.

**Evidence.** `tests/browser/integration-states.mjs`
**Gap.** Gap: Complete Linear/Jira create and link from requests/decisions, entered-only wording and uncertain-outcome reconciliation lack passing assertions.

#### INT-006 — Private tracker receipts

Core · published · **done**

**Requirement.** Provider-specific raw-byte authentication, configured identity, durable replay and original source order guard state receipts in the same D1 transaction.

**Acceptance.**
1. Older or conflicting events cannot regress state.
2. Linked state remains private evidence until an operator separately chooses Penny status or publication, except for the tracker states an admin maps under DELIV-006.

**Evidence.** `tests/browser/integration-tracker-checks.mjs`; `tests/browser/integration-states.mjs`
**Gap.** None.

#### INT-007 — Owner portal branding

Core · published · **partial** · Cites BASE-INPUT-003 · Register R-7, R-12

**Requirement.** Owners and Admins (OPS-001) set the portal's brand in settings, as Canny's Branding settings do on every plan: a company name (required at first-run setup, OPS-005, and editable later; it replaces the build-time `publicLandingConfig.ownerName` everywhere an installation names itself), a square logo (PNG, JPEG, WebP or SVG sanitized to drop scripts and external references) and a favicon (ICO, PNG or SVG), each within `seed.json → limits` upload limits, an optional link back to the company website (an `https` URL), a readable public accent, the portal description, a light, dark or follow-the-system theme for the portal and widget, and whether Penny's own vector mark shows.

**Acceptance.** A browser journey at 1440 and 390 pixels:
1. The owner uploads a PNG logo and an ICO favicon and sets the name "Acme" and dark theme; the portal header shows the logo and "Acme" in dark theme.
2. The logo and favicon are stored in the installation's R2 and served from its own origin at stable versioned paths: the document's icon link is the uploaded favicon, served from the same origin, and the portal makes no request to another origin.
3. A PDF, an oversize PNG and an SVG with a script are refused before storage.
4. The accent, description, theme, website link and Penny mark controls save and apply to the next page load.

**Evidence.** `src/core/features/settings/branding.ts`; `tests/browser/integration-states.mjs`
**Gap.** The accent, description and Penny mark controls ship. Uploaded logos and favicons, their same-origin versioned serving and upload refusals, the website link and theme selection remain unproved.

#### INT-008 — Brand on every customer surface

Core · published · **partial** · From INT-007

**Requirement.** The brand reaches every customer-facing surface: the portal header (logo and name, linking to the company website when set, else to the board), the browser tab's icon and title on every portal page, the widget launcher and panel (WIDGET-001, WIDGET-003), the changelog page and feeds (REL-015, REL-016), the SSO sign-in page (WIDGET-008), and every requester and release email (NOTIFY-001, REL-005), whose header carries the logo and company name and whose sender name follows NOTIFY-013. A change applies to the next page load and the next message composed.

**Acceptance.** A browser journey at 1440 and 390 pixels:
1. The company name replaces `publicLandingConfig.ownerName` everywhere the installation names itself.
2. The portal header links to the company website when set, else to the board.
3. The widget panel and the changelog page show the logo.
4. A status email to a follower carries "Acme" and the logo from the installation's origin.
5. Without a logo the header shows the name alone and the tab shows a neutral default icon, never a customer's.

**Evidence.** `src/core/features/settings/branding.ts`; `tests/browser/integration-states.mjs`
**Gap.** The company name is collected at setup and used by sender identity (OPS-005, NOTIFY-013); applying it throughout the portal in place of `publicLandingConfig.ownerName`, the website link, the logo on the widget, the changelog, the sign-in page and email, and the neutral default icon remain unproved.

#### INT-009 — Branding permissions and portability

Core · published · **missing** · From INT-007 · Cites BASE-ROLE-001, BASE-DATA-001

**Requirement.** Only Owners and Admins change the brand, and the brand travels with the installation's data.

**Acceptance.**
1. Product managers, Contributors and Viewers are refused branding writes.
2. Branding (name, files, colors, theme, link) participates in product archives (DATA-001): an archive export and restore keeps the logo bytes and settings.

**Evidence.** None.
**Gap.** Admin branding controls remain unproved: the 403 refusals of branding writes by other roles and the archive round trip of logo bytes and branding settings have no passing assertion.

### Target: Operators

#### OPS-008 — Workspace timezone and requester quiet hours

Core · target · **done** · Cites BASE-ROLE-001

**Requirement.** First-run setup (OPS-005) asks the owner for the workspace timezone, an IANA timezone pre-selected from the owner's browser (or from the `WORKSPACE_TIMEZONE` deployment input when it is set), and refuses Finish without one. The choice is stored as installation state that Owners and Admins change later in settings; once stored it is the `workspaceTimezone` every clause uses (NOTIFY-002, DEC-007, REL-014), and no installation that has recorded a choice falls back to a built-in default. An installation that finished setup before this ships shows its owner a one-time prompt, on their next sign-in, to confirm or change the current timezone. Settings also hold the requester quiet hours, shown beside the timezone at setup: off, or a start and an end hour in the workspace timezone (default 20:00 to 08:00). Operator email never has quiet hours (NOTIFY-003). A change applies at the next send check, and turning quiet hours off makes every held requester message due at once. In Admin settings, Owners and Admins set the workspace timezone and requester business hours through the quiet-hours schedule. Changes take effect for clocks and SLAs from the change, including the next queued requester send check and calendar-based decision review check.

**Acceptance.** A base and browser journey:
1. Setup refuses Finish without a timezone.
2. Setup under an `America/New_York` browser timezone stores `America/New_York`.
3. With the default quiet hours, a status update published at 21:00 Eastern sends at 08:00 Eastern and one published at 14:00 Eastern sends within NOTIFY-002's coalescing window.
4. With quiet hours off, an update published at 23:00 Eastern sends within the coalescing window.
5. Changing the timezone in settings moves the next quiet period.
6. The confirmation prompt appears once for an installation set up before the change.
7. An Owner and an Admin each save the timezone and quiet-hours schedule in Admin, an ordinary operator is refused, and changing the timezone changes a calendar review's next due check while turning quiet hours off releases queued requester mail without delaying operator mail.

**Evidence.** `tests/base/workspace-clock.test.ts`; `tests/base/notifications.test.ts`; `tests/browser/workspace-clock.mjs`
**Gap.** None.

### Roles, sign-in and governance

#### ROLE-001 — Custom roles and restricted commercial fields

Core · target · **missing** · Cites BASE-ROLE-001

**Requirement.** Admins define custom roles from a fixed permission set (capture evidence and proxy votes, moderate, publish, commit decisions, manage roadmap, manage releases, manage integrations, manage automation, view commercial fields, export, erase) and assign them to operators. Commercial fields (revenue, MRR/ARR, opportunity amounts, health) are hidden from roles without "view commercial fields" in every screen, API response, export, agent answer and notification, including AI-006 draft context and publication checks.

**Acceptance.** A base test signs in under a role without commercial permission and reads requests, accounts, prioritization views, CSV exports and Ask Penny answers through their routes:
1. No revenue, opportunity or health value appears.
2. Granting the permission reveals them on the next request.
3. Each role change is in the audit log (ROLE-004).

**Evidence.** None.
**Gap.** A base test signs in under a role without commercial permission and reads requests, accounts, prioritization views, CSV exports and Ask Penny answers through their routes: no revenue, opportunity or health value appears; granting the permission reveals them on the next request; each role change is in the audit log (ROLE-004).

#### ROLE-002 — Operator single sign-on

Core · target · **partial** · Cites BASE-SIGNIN-001 · Register R-14

**Requirement.** Penny's delta on Base standards-based SSO: operators sign in with SAML 2.0 or OIDC from Okta, Microsoft Entra ID, Google Workspace or Auth (the sibling identity provider, https://github.com/just-every/run-auth). The owner can enforce SSO for a verified email domain (email links then refuse that domain), provision operators just in time with a default role, and map IdP groups to roles.

**Acceptance.** A browser journey against SAML and OIDC test identity providers at the network edge:
1. A first sign-in creates a Contributor.
2. A group claim maps another user to Admin.
3. An enforced domain refuses an email link.
4. An IdP-side deactivation ends access at the next session check.
5. An address on an SSO-enforced domain that signs in through REQ-039 stays only a requester, and REQ-039's unverified fallback link obeys the domain's email-link refusal.

**Evidence.** `src/core/features/auth/dependencies.ts`
**Gap.** Today only the optional `IDENTITY_PROVIDER` dependency is declared; sign-in remains email links. A browser journey against SAML and OIDC test identity providers at the network edge: a first sign-in creates a Contributor, a group claim maps another user to Admin, an enforced domain refuses an email link, and an IdP-side deactivation ends access at the next session check.

#### ROLE-004 — Audit log

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-OPS-005

**Requirement.** Penny's delta on Base audit: Owners and Admins read, filter (actor, action, subject, date) and export as CSV or JSON an audit log of every privileged action: publication, moderation verdict, edit (REQ-038), removal, restore and permanent delete (REQ-041) of published content, branding and sender changes (INT-007, NOTIFY-013), merge and unmerge, commitment, role and member change, integration connect and disconnect, automation rule change, export, erasure and every agent action, with the person or agent responsible.

**Acceptance.**
1. Perform each listed action, then read and export the log through the UI and API.
2. Entries contain no customer wording or commercial values.
3. Erase an operator and see their entries anonymized while the events remain (DATA-003).

**Evidence.** `tests/base/board.test.ts`
**Gap.** Durable actor audits are recorded and archived today; there is no audit screen or export. Perform each listed action (including REQ-038 and REQ-041 edits, removals, restores and permanent deletes and INT-007 and NOTIFY-013 changes), then read and export the log through the UI and API; erase an operator and see their entries anonymized while the events remain.

#### OPS-006 — Saved views and filters

Core · target · **missing**

**Requirement.** Every operator list (inbox, requests, features, evidence, accounts, roadmap, releases) filters on any field, custom field, tag, theme, segment, owner and date, chooses its columns and sort, and saves the result as a private or shared view.

**Acceptance.**
1. A browser test saves a filtered, sorted view, then a second operator opens the shared view and gets the same result set.
2. A private view is not listed for them.

**Evidence.** None.
**Gap.** A browser test saves a filtered, sorted view, then a second operator opens the shared view and gets the same result set; a private view is not listed for them.

#### OPS-007 — Person view

Core · target · **partial**

**Requirement.** Every requester and captured contact has an operator profile: display name, verified and carried-over addresses (MIG-007), company or account with its ARR and MRR (ROLE-001), segment membership (SEG-006), custom fields (DATA-004), every request they submitted, voted on (with importance, REQ-035, and proxy marks), followed or commented on, the evidence captured about them with its source links (CAP-002), their permission records and suppression state, and their outcome responses (REL-008). It is reachable from global search (OPS-004), request voter lists (REQ-026) and account pages (EVID-005), and offers merge (REQ-024), block (REQ-022), export and erasure (DATA-003).

**Acceptance.**
1. A fixture requester with two posts, three votes, a comment, captured Zendesk evidence and an account: the profile lists each with a link to its record.
2. A role without commercial permission sees no ARR or MRR.
3. The profile path answers 404 to a portal visitor and appears in no public payload.

**Evidence.** `src/core/features/requests/operator-context.ts`; `src/core/features/accounts/read-context.ts`
**Gap.** Voter lists and account requesters ship today; no per-person page exists. A fixture requester with two posts, three votes, a comment, captured Zendesk evidence and an account: the profile lists each with a link to its record; a role without commercial permission sees no ARR or MRR; the profile path answers 404 to a portal visitor and appears in no public payload.

### Capture from every channel

#### CAP-001 — Feedback inbox

Core · target · **partial**

**Requirement.** Every item captured from any channel (portal, widget, connectors, email, Slack, browser extension, API) lands once as unreviewed evidence (EVID-001) in one inbox that shows its source, customer, account, segment attributes, excerpt and suggested links (AI-002). From the inbox an operator links it to a request, creates a request (REQ-029), adds it to a decision, assigns an owner (TRIAGE-001), tags it, snoozes it until a date or marks it reviewed with a reason, by keyboard and in bulk (TRIAGE-005). The inbox filters by source, connector, owner, segment, theme, age and state.

**Acceptance.** A browser journey at 1440 and 390 pixels:
1. Items from three connector fixtures arrive, are triaged by keyboard (link, create, dismiss with reason, snooze), each linked request shows the item with its source link, and the overview counts match the inbox.

**Evidence.** `src/core/features/evidence/repository.ts`; `tests/browser/operator-pages.mjs`
**Gap.** Today the unreviewed evidence list does this for portal and manually recorded evidence only. A browser journey at 1440 and 390 pixels: items from three connector fixtures arrive, are triaged by keyboard (link, create, dismiss with reason, snooze), each linked request shows the item with its source link, and the overview counts match the inbox.

#### CAP-002 — Source provenance and link-back

Core · target · **partial**

**Requirement.** A captured item stores its connector, the source record's ID, a deep link to the original (ticket, conversation, call timestamp, Slack permalink, email message ID or page URL), the verbatim excerpt the operator or rule selected, the author or speaker as the source names them, the capturing person or rule and the source's own time. When the source record changes, the captured version stays and Penny shows that the source changed; when it is deleted or access is revoked at the source, the item is marked source-removed and its excerpt is purged after the owner's policy window.

**Acceptance.**
1. A connector fixture test captures a record, edits it at the source and deletes it at the source: Penny shows changed and removed states, purges the excerpt at the window, and the deep link opens the original record.

**Evidence.** `src/core/features/evidence/write-service.ts`; `tests/browser/operator-pages-decisions.mjs`
**Gap.** EVID-002 provenance ships today for manually recorded sources without deep links or source sync. A connector fixture test captures a record, edits it at the source and deletes it at the source: Penny shows changed and removed states, purges the excerpt at the window, and the deep link opens the original record.

#### CAP-003 — Zendesk

Core · target · **missing** · Rules D-1, D-2 · Register R-5, R-8

**Requirement.** A Zendesk app in the ticket sidebar lets an agent search requests, link the ticket to one, create a new request, record a proxy vote for the ticket's requester (CAP-014) and see the request's public status without leaving Zendesk. Tickets with a configured tag or in a configured view are captured automatically. The ticket requester and organization map to a Penny requester and account by email and organization ID. When a linked request changes status, the sidebar shows it and offers the drafted reply (NOTIFY-007).

**Acceptance.**
1. Zendesk OAuth, API and webhook fixtures at the network edge: install, link, create and proxy-vote from the sidebar.
2. Tag-triggered capture creates one item per ticket however often the webhook replays.
3. The status appears in the sidebar.
4. Uninstalling revokes and deletes the tokens.

**Evidence.** None.
**Gap.** Zendesk OAuth, API and webhook fixtures at the network edge: install, link, create and proxy-vote from the sidebar; tag-triggered capture creates one item per ticket however often the webhook replays; the status appears in the sidebar; uninstalling revokes and deletes the tokens.

#### CAP-004 — Intercom

Core · target · **missing** · Rules D-1, D-2

**Requirement.** An Intercom Inbox app (Canvas Kit) offers CAP-003's actions inside a conversation; conversations with a configured tag or topic are captured; Intercom contacts and companies map to requesters and accounts with their custom attributes (plan, MRR) feeding segments (SEG-006); NOTIFY-007 replies can go back through the conversation.

**Acceptance.**
1. Intercom API and webhook fixtures run CAP-003's journey and show company attributes arriving as private segment attributes.

**Evidence.** None.
**Gap.** Intercom API and webhook fixtures run CAP-003's journey and show company attributes arriving as private segment attributes.

#### CAP-005 — HappyToHelp

Core · target · **missing** · Rules D-1, D-2

**Requirement.** HappyToHelp, the sibling help desk (https://github.com/just-every/run-happytohelp), gets CAP-003's sidebar, tag capture and close-the-loop replies through its public API. Neither product keeps the other's records beyond the linked excerpt and IDs.

**Acceptance.**
1. A journey against a running HappyToHelp test installation links a ticket, captures one by tag and receives the drafted status reply on that ticket.

**Evidence.** None.
**Gap.** A journey against a running HappyToHelp test installation links a ticket, captures one by tag and receives the drafted status reply on that ticket.

#### CAP-006 — Help Scout

Core · target · **missing** · Rules D-1, D-2

**Requirement.** A Help Scout sidebar app and tag-based capture with customer and company mapping, on CAP-003's terms.

**Acceptance.** Help Scout API fixtures:
1. Link, create, tag capture and mapping, each once per conversation.

**Evidence.** `tests/browser/helpscout-capture.mjs`; `tests/base/upgrade.test.ts`
**Gap.** Help Scout API fixtures: link, create, tag capture and mapping, each once per conversation.

#### CAP-007 — Gong

Core · target · **missing** · Rules D-1

**Requirement.** For calls matching configured filters (workspace, tracker, deal stage, participants), Penny reads the transcript and call metadata, and the extraction agent (AI-004) proposes the feature-request moments as inbox items with the verbatim span, speaker, a timestamped deep link and the deal and account Gong associates. Calls outside the filters are never read.

**Acceptance.** Gong API fixtures:
1. Filtered calls are ingested, proposals carry exact transcript spans and timestamps, accounts map through Gong's CRM association, and the fixture records no request for an out-of-filter call.

**Evidence.** None.
**Gap.** Gong API fixtures: filtered calls are ingested, proposals carry exact transcript spans and timestamps, accounts map through Gong's CRM association, and the fixture records no request for an out-of-filter call.

#### CAP-008 — Call recorders, recordings and transcripts

Core · target · **missing** · Rules D-1

**Requirement.** Fathom, Zoom cloud recording, Google Meet (Workspace recordings and transcripts), Fireflies, Grain and tl;dv connectors work on CAP-007's terms. An operator can also upload a recording or a VTT, SRT or text transcript; audio is transcribed by the owner-configured transcription provider as a bounded background job with LEARN-006's cost rules. Transcripts are searchable, and a highlighted passage becomes evidence linked to its timestamp.

**Acceptance.**
1. Fathom, Zoom, Google Meet, Fireflies, Grain and tl;dv fixtures each ingest one filtered call with timestamped spans and ignore an out-of-filter call.
2. A VTT upload produces a searchable transcript whose highlight becomes evidence with a timestamp link.
3. An audio upload shows progress, reserved and metered cost, and a visible failure when the provider fails.

**Evidence.** None.
**Gap.** Fathom, Zoom, Google Meet, Fireflies, Grain and tl;dv fixtures each ingest one filtered call with timestamped spans and ignore an out-of-filter call; a VTT upload produces a searchable transcript whose highlight becomes evidence with a timestamp link; an audio upload shows progress, reserved and metered cost, and a visible failure when the provider fails.

#### CAP-009 — Email capture

Core · target · **done** · Rules D-2 · Register R-3

**Requirement.** Each installation has a dedicated capture address on the owner's domain (Cloudflare Email Routing or the configured mail provider's inbound parse). Operators forward or BCC customer emails to it. Penny accepts only mail from operator addresses or allowlisted domains with DMARC alignment, recovers the original sender from the forwarded message, keeps attachments within `seed.json` limits and creates one inbox item per message ID. Notification reply addresses never reach this route, and it refuses mail from Penny's own sender addresses (`MAIL_FROM` and any NOTIFY-013 sender), as NOTIFY-004 requires.

**Acceptance.** Inbound-mail fixtures:
1. Forwarded Gmail and Outlook messages each create one item attributed to the original sender.
2. A replayed message ID, an unaligned sender, mail from Penny's own sender address and a reply to a Penny notification create nothing.

**Evidence.** `tests/base/penny-evidence.test.ts`; `tests/base/notifications.test.ts`; `tests/browser/operator-pages.mjs`
**Gap.** None.

#### CAP-010 — Slack and Nook

Core · target · **missing** · Rules D-1 · Register R-8

**Requirement.** A Slack app adds a "Send to Penny" message shortcut and an emoji-reaction trigger in selected channels, including Slack Connect channels shared with customers. The message and its thread permalink become an inbox item, the Slack user who triggered it is the capturer, and a Slack Connect workspace maps to an account. Nook, the sibling team chat (https://github.com/just-every/run-nook), offers the same actions. Outbound Slack posts are NOTIFY-006 and INT-001.

**Acceptance.** Signed Slack Events and Interactivity fixtures:
1. The shortcut and the reaction each capture a message once, a bad signature is refused, and a Slack Connect channel maps to its account.
2. The same capture runs against a Nook test installation.

**Evidence.** None.
**Gap.** Signed Slack Events and Interactivity fixtures: the shortcut and the reaction each capture a message once, a bad signature is refused, and a Slack Connect channel maps to its account; the same capture runs against a Nook test installation.

#### CAP-011 — Microsoft Teams

Core · target · **missing** · Rules D-1

**Requirement.** A Teams message action captures a message and its link into the inbox; channel notifications follow NOTIFY-006.

**Acceptance.**
1. Bot Framework fixtures with token validation capture a message once and refuse an unsigned request.

**Evidence.** None.
**Gap.** Bot Framework fixtures with token validation capture a message once and refuse an unsigned request.

#### CAP-012 — Browser extension

Core · target · **missing** · Rules D-1 · Register R-8

**Requirement.** A Chrome and Edge extension (Manifest V3), signed in with the operator's Penny session, captures selected text or a screenshot from any page (a CRM record, a review site, a community thread) with its URL, picks the customer and the request, and can record a proxy vote.

**Acceptance.**
1. A Playwright extension journey on a fixture page creates an inbox item with the URL, excerpt and screenshot attachment.
2. A signed-out extension is refused.

**Evidence.** `tests/browser/browser-capture-review.mjs`; `tests/browser/browser-capture.mjs`
**Gap.** A Playwright extension journey on a fixture page creates an inbox item with the URL, excerpt and screenshot attachment; a signed-out extension is refused.

#### CAP-013 — CRM record panels

Core · target · **missing** · Rules D-1

**Requirement.** A HubSpot CRM card and a Salesforce Lightning component on contact, company or account and deal or opportunity records show that account's requests and their statuses, and let sales capture feedback or a proxy vote tied to the opportunity (SEG-002). Orbit gets the same panel through its extension point.

**Acceptance.**
1. HubSpot and Salesforce fixtures render the panel for a record's company, capture feedback tied to an opportunity amount and attribute a proxy vote to the right customer.

**Evidence.** None.
**Gap.** HubSpot and Salesforce fixtures render the panel for a record's company, capture feedback tied to an opportunity amount and attribute a proxy vote to the right customer.

#### CAP-014 — Proxy votes

Core · target · **partial** · Register R-5

**Requirement.** An operator records a vote on behalf of a customer (an existing requester, a connector contact, or a new unverified contact) with the source that justifies it.

**Acceptance.**
1. A proxy vote counts once per customer in demand (REQ-026, SEG-007), is marked proxy with who recorded it, and collapses with that customer's own later vote.
2. It grants no verified identity or email consent (REQ-010), and appears publicly only inside the vote total.
3. Native proxy recording works from the inbox, the request page and the private Zendesk sidebar at the connector edge, proved with a network-edge fixture.
4. Supporters imported from UserVoice (IMP-008) retain their historical proxy marks.
5. A base test records proxy votes from the inbox, the request page and a Zendesk sidebar fixture: each counts once, collapses with the customer's own later vote, creates no permission record, and appears in the CSV export with its recorder.

**Evidence.** `tests/base/proxy-votes.test.ts`; `tests/browser/proxy-votes.mjs`; `tests/browser/zendesk-proxy-votes.mjs`
**Gap.** UserVoice-imported supporters keeping their historical proxy marks (IMP-008) have no passing assertion in this clause's evidence (`tests/base/feedback-import-uservoice.test.ts` asserts them and is not cited here), and the CSV export is checked for the source text and the customer but never the recorder; counting once per customer, the proxy mark with who recorded it, collapse with the customer's own later vote, no verified identity, consent or permission record, public appearance only inside the vote total, and recording from the inbox, the request page and the Zendesk sidebar fixture are asserted.

#### CAP-015 — Automation platforms

Core · target · **partial** · Rules D-1 · Register R-8

**Requirement.** Zapier and Make apps offer triggers (new request, status change, new evidence, release published) and actions (create evidence, create request, record proxy vote, find request) over the scoped REST API (API-001) and signed webhooks (INT-001); Crank, the sibling automation seed (https://github.com/just-every/run-crank), uses the same surface. Owners install the app definitions Penny publishes against their own installation; a public directory listing is a register row.

**Acceptance.**
1. A Zapier CLI test against a running installation fires each trigger once per event.
2. It runs each action within its key's scopes.
3. An out-of-scope action is refused.

**Evidence.** `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts`
**Gap.** Scoped keys and outbound events ship today; no packaged app exists. A Zapier CLI test against a running installation fires each trigger once per event and runs each action within its key's scopes; an out-of-scope action is refused.

#### CAP-016 — Connector health

Core · target · **partial**

**Requirement.** Each connector shows the connected account, scope, last successful sync, items captured, backlog and its last failure with the reason and a fix (reconnect, grant scope). A connector with no successful sync for 1 hour (the owner may set 15 minutes to 24 hours per connector in its settings) is failing: it notifies the owner once per failure episode (NOTIFY-006) and appears on the overview until a sync succeeds. Disconnecting revokes and deletes its tokens and stops capture; captured evidence stays.

**Acceptance.**
1. A clock-advanced fixture with an expired token and a rate limit shows the connector failing with its reason once an hour passes without a successful sync (and after the owner's shorter setting when set), notifies the owner once, and after reconnect resumes from its cursor without duplicate items.

**Evidence.** `tests/browser/integration-states.mjs`
**Gap.** Delivery and tracker-receipt states are shown today for outbound integrations only. A clock-advanced fixture with an expired token and a rate limit shows the connector failing with its reason once an hour passes without a successful sync (or after the owner's shorter setting), notifies the owner once, and after reconnect resumes from its cursor without duplicate items.

#### CAP-017 — Capture scope, minimization and consent

Core · target · **partial**

**Requirement.** Connectors read only the configured scope (channels, tags, views, call filters, record types), store the selected excerpt rather than the whole record unless the operator chooses otherwise, apply redaction (AI-008) before storage, keep any source person nullable and non-authorizing (EVID-002), and never create an email permission record for a captured person (REQ-010); a captured contact is emailed only when an operator chooses so for one update under NOTIFY-009.

**Acceptance.**
1. Connector fixtures assert that no request is made for out-of-scope records, that redaction precedes the write, and that captured people hold no permission record.

**Evidence.** `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** Purpose-bound selected-record acquisition ships today for Orbit and native records (LEARN-001). Connector fixtures assert that no request is made for out-of-scope records, that redaction precedes the write, and that captured people hold no permission record (NOTIFY-009 sends create none either).

#### CAP-018 — Submission forms and polls

Core · target · **missing**

**Requirement.** Owners configure the portal and widget submission form per board: custom questions (text, single or multiple choice, number, rating), required and conditional fields, and a short poll attached to a request or a release ("How important is this to you?"). Answers are evidence linked to the request and filterable by segment. General surveys and NPS stay in Pencil, the sibling forms seed (https://github.com/just-every/run-pencil).

**Acceptance.**
1. A conditional question renders and validates on the portal and the widget at both widths.
2. Poll answers aggregate per request and by segment and stay operator-only.

**Evidence.** None.
**Gap.** A conditional question renders and validates on the portal and the widget at both widths; poll answers aggregate per request and by segment and stay operator-only.

#### CAP-019 — Freshdesk

Core · target · **missing** · Rules D-1, D-2

**Requirement.** A Freshdesk app (Freshworks developer kit) in the ticket sidebar offers CAP-003's actions: search, link the ticket to a request, create a request, record a proxy vote for the ticket's requester and see the request's public status. Tickets with a configured tag, or matched by a configured Freshdesk automation rule that calls Penny's signed webhook, are captured automatically. Freshdesk contacts and companies map to requesters and accounts by email and company ID, with their configured custom fields arriving as private segment attributes (SEG-006). NOTIFY-007 drafts the status reply on the ticket as a reply or a private note.

**Acceptance.** Freshdesk API and webhook fixtures run CAP-003's journey:
1. Install, link, create and proxy-vote from the sidebar.
2. Tag-triggered capture creates one item per ticket however often the webhook replays.
3. Company fields arrive as private attributes.
4. A shipped request drafts one reply on the linked ticket.
5. Uninstalling revokes and deletes the API key.

**Evidence.** None.
**Gap.** Freshdesk API and webhook fixtures run CAP-003's journey: install, link, create and proxy-vote from the sidebar; tag-triggered capture creates one item per ticket however often the webhook replays; company fields arrive as private attributes; a shipped request drafts one reply on the linked ticket; uninstalling revokes and deletes the API key.

#### CAP-020 — Review sites and app stores

Core · target · **missing** · Rules D-1

**Requirement.** The owner connects the product's listings on G2, Capterra, TrustRadius, Trustpilot, Product Hunt, the Apple App Store and Google Play. Penny reads new reviews on a schedule (default daily, never less often than Google Play's one-week review window allows) as accountable background work (TRIAGE-006), through the site's own vendor interface where it offers one (App Store Connect customer reviews, the Google Play Developer reply-to-reviews API, the Trustpilot Business API, the G2 API, the Product Hunt API) and otherwise from the listing's public review page within that site's terms. Each review lands once in the inbox, keyed by site and review ID, with the reviewer as the site names them (nullable and non-authorizing), rating, title, text, date, app version and country where given, and a deep link to the review. An edited review shows CAP-002's changed state and a removed one becomes source-removed. The extraction agent (AI-004) proposes requests from review text. A reviewer has no email permission and is never emailed (NOTIFY-009 skips them).

**Acceptance.**
1. Recorded fixtures from each of the seven sites produce one inbox item per review however often the feed is re-read, each with its rating, date and a deep link that opens that review.
2. An edited fixture review shows changed.
3. AI-004 proposals from a review carry byte-exact spans.

**Evidence.** None.
**Gap.** Recorded fixtures from G2, Capterra, TrustRadius, Trustpilot, Product Hunt, the App Store and Google Play produce one inbox item per review however often the feed is re-read, each with its rating, date and a deep link that opens that review; an edited fixture review shows changed;

#### CAP-021 — Discord

Core · target · **missing** · Rules D-1

**Requirement.** A Discord app adds a "Send to Penny" message command and an emoji-reaction trigger in selected channels of the customer's community server. The message and its jump link become an inbox item, the Discord member who triggered it is the capturer and the author is the source person (nullable, non-authorizing). Interactions are verified by their Ed25519 signature before parsing.

**Acceptance.** Signed interaction and gateway fixtures:
1. The command and the reaction each capture a message once with its jump link, a bad signature is refused, and a message in an unselected channel is never read.

**Evidence.** `tests/browser/discord-capture.mjs`; `tests/installer/discord-relay.test.mjs`
**Gap.** Signed interaction and gateway fixtures: the command and the reaction each capture a message once with its jump link, a bad signature is refused, and a message in an unselected channel is never read.

#### CAP-022 — Survey responses

Core · target · **missing** · Rules D-1

**Requirement.** Typeform, SurveyMonkey, Google Forms and Pencil connectors bring in responses to the forms the owner selects. The owner maps which open-text questions become evidence and which answers become private attributes; each new response lands once as an inbox item with a link to the response, and a respondent email or hidden field maps to a requester and account (nullable, never verified identity or consent). Typeform and SurveyMonkey deliver by signed webhook and Google Forms by scheduled read of the Forms API. Unmapped questions are not stored.

**Acceptance.**
1. Fixtures from each tool produce one inbox item per response with its link and mapped attributes.
2. A replayed webhook creates nothing.
3. A bad Typeform signature is refused.
4. An unmapped question's answer is absent from D1 and the archive.

**Evidence.** None.
**Gap.** Typeform, SurveyMonkey, Google Forms and Pencil fixtures produce one inbox item per response with its link and mapped attributes; a replayed webhook creates nothing; a bad Typeform signature is refused; an unmapped question's answer is absent from D1 and the archive.

### In-app widget and customer identity

#### WIDGET-001 — In-app feedback widget

Core · target · **partial** · Cites BASE-PUBLIC-001

**Requirement.** A JavaScript snippet and npm package embed Penny in the customer's own product as a launcher, modal or side panel: identified users submit, search, vote, comment and follow without leaving the product, and the current page URL and any metadata the host passes are attached as private context. It follows the board's moderation setting (REQ-003, REQ-033) so an identified user's post on an auto-publish board shows at once, keeps the portal's privacy, and shows the owner's brand (INT-008) in the host's colors or the brand accent, as the owner chooses.

**Acceptance.** A browser test on a fixture host page at both widths:
1. An identified user submits, votes and follows, and on an auto-publish board sees their post listed at once.
2. The page URL appears only in private evidence.
3. The documented CSP directives suffice.

**Evidence.** `src/core/features/settings/frame-settings.ts`; `tests/browser/operator-completeness-security.mjs`
**Gap.** Allow-listed iframe embedding of the portal (REQ-027) ships today. A browser test on a fixture host page at both widths: an identified user submits, votes and follows, and on an auto-publish board sees their post listed at once; the page URL appears only in private evidence; the documented CSP directives suffice; no third-party cookie is set.

#### WIDGET-002 — SSO identify

Core · target · **partial**

**Requirement.** The customer's server signs a user token (JWT with HS256 or RS256, or REQ-031's host identity) carrying user ID, email, name, company ID and name, and optional attributes such as plan, role and MRR in USD. The widget and portal accept it without email verification, from the widget's identify call, from REQ-031's allow-listed parent frame, or on the standalone portal through WIDGET-008's sign-in redirect, apply REQ-014's expiry and store the attributes operator-only for segments (SEG-006).

**Acceptance.**
1. Host-identity tests extended to JWT and to the widget origin: a valid token identifies the user and links the account with private attributes.
2. Expired, future-dated and forged tokens are refused and change nothing.

**Evidence.** `src/core/features/auth/host-identity.ts`; `tests/base/host-identity.test.ts`
**Gap.** REQ-031 host identity ships for the portal today, by `postMessage` from an allow-listed parent frame only. Host-identity tests extended to JWT and to the widget origin: a valid token identifies the user and links the account with private attributes; expired, future-dated and forged tokens are refused and change nothing.

#### WIDGET-003 — Changelog widget and announcements

Core · target · **missing**

**Requirement.** The same snippet shows a "What's new" panel with an unread badge of published releases, targeted and announcements alike (REL-018), optional in-app announcements of a release to a segment, and reactions; each entry opens its release.

**Acceptance.** A browser test:
1. The unread count falls after viewing.
2. A segment-targeted announcement shows only to matching identified users.
3. An unpublished release never appears.

**Evidence.** None.
**Gap.** A browser test: the unread count falls after viewing; a segment-targeted announcement shows only to matching identified users; an unpublished release never appears.

#### WIDGET-004 — Mobile SDKs

Core · target · **missing** · Register R-17

**Requirement.** iOS (Swift Package), Android (Kotlin, Maven Central) and React Native SDKs give the customer's app native feedback, voting and changelog screens with SSO identify, offline queueing of submissions and status-change hooks for the host app's own push.

**Acceptance.** SDK sample apps run XCTest and Espresso UI tests against a test installation:
1. Identified submit, vote and changelog read, and a queued offline submission sent once on reconnect.

**Evidence.** None.
**Gap.** SDK sample apps run XCTest and Espresso UI tests against a test installation: identified submit, vote and changelog read, and a queued offline submission sent once on reconnect.

#### WIDGET-005 — Moment capture

Core · target · **missing**

**Requirement.** The host product opens a short Penny prompt at a deliberate moment (`penny.capture({moment: 'cancellation'})`: cancellation, downgrade, failed search, feature-flag exit), and the answer becomes evidence tagged with that moment. There is no passive tracking, session replay or keystroke capture.

**Acceptance.**
1. A fixture host triggers two moments.
2. Their answers arrive as evidence tagged with the moment.
3. The widget sends nothing to Penny until a call is made.

**Evidence.** None.
**Gap.** A fixture host triggers two moments; their answers arrive as evidence tagged with the moment; the widget sends nothing to Penny until a call is made.

#### WIDGET-006 — Portal domain and audiences

Core · target · **missing** · Register R-7

**Requirement.** The owner can serve the portal at a custom domain (such as feedback.example.com through Cloudflare custom hostnames), require SSO identify for the whole portal (WIDGET-008), and restrict a board to identified users in a segment (an Enterprise beta board) or to employees signed in through ROLE-002. A restricted board never appears to anyone else, in counts, search or the sitemap. Internal boards (REQ-019) remain operator-only.

**Acceptance.**
1. A segment member sees the restricted board while a non-member and a signed-out visitor get 404 and no count.
2. On an SSO-required portal, every portal document (board, request, roadmap, changelog, activity) answers a not-yet-identified visitor with WIDGET-008's redirect to the owner's login URL, or, when no login URL is set, a sign-in page showing only the company name and logo (INT-007) and a note that the portal is for the company's customers.
3. On an SSO-required portal, every public API read, feed, sitemap and attachment answers 401 with no request, comment, release or count in the body.
4. Every response of an SSO-required portal carries `noindex`.
5. On an SSO-required portal, REQ-023's emailed link and REQ-039's provider buttons are absent, and their start and callback routes refuse without issuing state or a session.
6. A browser test: a signed-out request to a request page, the board, the public API, the feed and an attachment returns no request content (a redirect or the sign-in page for documents, 401 for the rest).
7. A custom hostname configured through the deployment path serves the portal.

**Evidence.** None.
**Gap.** A browser test: a segment member sees the restricted board while a non-member and a signed-out visitor get 404 and no count; on an SSO-required portal, a signed-out request to a request page, the board, the public API, the feed and an attachment returns no request content (WIDGET-008's redirect or the sign-in page for documents, 401 for the rest), and REQ-023's link and REQ-039's buttons are absent; a custom hostname configured through the deployment path serves the portal (its TLS receipt is R-7).

#### WIDGET-007 — Localized portal and widget

Core · target · **missing**

**Requirement.** The portal, widget, mobile SDK screens and requester email are available in English (default), Spanish, French, German, Brazilian Portuguese and Japanese, and in any further locale the owner adds as a message catalog. The locale comes from SSO identify (WIDGET-002), then the browser's Accept-Language, then the owner's default; dates and numbers follow it. Customer wording is shown as written; operators can read a machine translation of a post or comment under AI-010, labeled as translated, and the original stays authoritative.

**Acceptance.**
1. A browser test renders the portal and widget in Spanish once through Accept-Language and once through an identify locale, with no English interface string left.
2. A catalog missing a key fails the build.
3. A status email to a requester identified with `es` arrives in Spanish.

**Evidence.** None.
**Gap.** A browser test renders the portal and widget in Spanish once through Accept-Language and once through an identify locale, with no English interface string left; a catalog missing a key fails the build; a status email to a requester identified with `es` arrives in Spanish.

#### WIDGET-008 — SSO sign-in redirect

Core · target · **missing**

**Requirement.** As Canny's SSO redirect does, the owner sets a login URL on their own site (an `https` URL) in settings, beside WIDGET-002's signing key, and the portal signs visitors in through the owner's product. An unidentified visitor to any page of an SSO-required portal (WIDGET-006), or a visitor on any portal who chooses "Sign in with <company name>" (offered beside REQ-023 and REQ-039 when a login URL is set), is answered with a 302 to the login URL carrying a `redirect` parameter: Penny's callback path on the portal's own origin with a `state` value.

**Acceptance.** A browser journey against a fixture host at both widths:
1. The state is signed by the installation, single-use, expires 10 minutes after issue and binds the return path, which must be a same-origin portal path; any other return path is replaced by the board home.
2. A signed-out visitor to `/portal/feedback/<request>` on an SSO-required portal is redirected to the login URL.
3. With SSO required and no token, the response for the request page carries no request content.
4. No redirect leaves the portal's origin except to the configured login URL.

**Evidence.** None.
**Gap.** Today host identity reaches the portal only by `postMessage` from an allow-listed parent frame (`src/core/features/auth/ui/host-identity-bridge.tsx`); there is no login URL, redirect or state. At both widths against a fixture host: a signed-out visitor to `/portal/feedback/<request>` on an SSO-required portal is redirected to the login URL; with SSO required and no token the request page response carries no request content.

#### WIDGET-009 — SSO return and refusals

Core · target · **missing** · From WIDGET-008

**Requirement.** The owner's server authenticates the user in its own product and sends the browser to the callback with a WIDGET-002 token in the URL fragment or a form POST, never the query string, so the token reaches no request log. The callback verifies the token's signature and REQ-014's expiry and the state's signature, expiry and single use; consumes the state; establishes REQ-023's browser-local session for the identified requester (no cookie), linking the account and private attributes as WIDGET-002 does; removes the token from the address bar and history; applies any action held before sign-in (REQ-023); and lands the visitor on the page they asked for. A visitor already signed in to the owner's product passes through with no prompt.

**Acceptance.** A browser journey against a fixture host at both widths:
1. The fixture host returns a valid token, and the visitor lands on the request they asked for, identified, with no cookie set and no token left in the address bar.
2. A vote chosen before sign-in on a non-SSO-required portal is applied once after return.
3. An expired token, a forged token, a reused state, a tampered return path and a return path on another origin are each refused with a page that offers to try again, and change nothing.
4. A refusal reveals no identity match (REQ-014).

**Evidence.** None.
**Gap.** There is no login URL, callback or state today. At both widths against a fixture host: the visitor returns with a valid token and lands on the request identified, with no cookie and no token left in the address bar; a vote chosen before sign-in is applied once after return; an expired token, a forged token, a reused state, a tampered return path and a return path on another origin are each refused and change nothing.

#### WIDGET-010 — Links from email into the owner's product

Core · target · **missing** · From WIDGET-008

**Requirement.** The owner can turn on "Open requests in my product" and set a URL pattern on their own product's origin with `{request}` (the request's public ID) and optional `{board}` placeholders, such as `https://app.example.com/feedback?request={request}`. With it on, every link to a request in requester email (NOTIFY-001, NOTIFY-008, NOTIFY-010, NOTIFY-011, NOTIFY-012) and release email (REL-005) uses the pattern, and the widget (WIDGET-001) opens that request when the host page passes it (`penny.open({request})`), already identified. With it off, those links go to the portal, and on an SSO-required portal they pass through WIDGET-008's redirect.

**Acceptance.** A browser journey against a fixture host at both widths:
1. With "Open requests in my product" on, a status email's request link follows the owner's pattern.
2. The fixture host's widget opens that request, already identified.
3. With it off, the request links go to the portal.
4. Unsubscribe and mute links always go to Penny and work without signing in (NOTIFY-002): the unsubscribe link in the same email works signed out.

**Evidence.** None.
**Gap.** There is no in-app link pattern today. With Open requests in my product on, a status email's request link follows the owner's pattern and the fixture host's widget opens that request; the unsubscribe link works signed out.

### Deduplication, themes and AI organization

#### AI-001 — Semantic duplicate detection

Core · target · **partial** · Rules D-4

**Requirement.** Alongside EVID-007's lexical suggestions, Penny ranks existing requests by meaning (embeddings over titles, descriptions and linked evidence) for a requester typing a title, for each inbox item and for an operator viewing a request, and names the passages that matched. Requesters see published requests only. When the model is unavailable the lexical suggestions still appear.

**Acceptance.**
1. The `duplicates-v1` evaluation (AI-011) reports, at the suggestion threshold, precision of at least 0.90 and recall of at least 0.85, the true duplicate among the top five suggestions for at least 0.90 of positive pairs, and recall on the paraphrase subset at least 0.15 above the lexical EVID-007 baseline measured on the same set.
2. Requester suggestions contain only published requests.
3. With the model disabled, lexical suggestions still return within EVID-007's limit.

**Evidence.** `src/core/features/requests/suggestions.ts`; `tests/base/penny-evidence.test.ts`
**Gap.** The `duplicates-v1` evaluation meets the AI-001 bars (precision ≥ 0.90, recall ≥ 0.85, top-five ≥ 0.90, paraphrase recall ≥ lexical + 0.15); requester suggestions contain only published requests; with the model disabled, lexical suggestions still return within EVID-007's limit.

#### AI-002 — Auto-link suggestions

Core · target · **missing** · Rules D-4

**Requirement.** Each new inbox item gets up to three suggested requests and one suggested theme, each with a confidence and a reason; the operator accepts or rejects in one action, and a rejected suggestion is not offered again. An owner may enable a rule that links automatically above a confidence threshold for chosen sources; auto-links are marked, reversible, and never publish, vote or notify.

**Acceptance.**
1. The `links-v1` evaluation (AI-011) reports the labeled request among the three suggestions for at least 0.85 of items that have one, no suggestion above the threshold for at least 0.80 of items labeled none, and auto-link precision of at least 0.97 at the default threshold.
2. An inbox journey accepts and rejects suggestions.
3. An auto-link rule on one fixture source links only above its threshold, marks and can undo each link, and changes no public payload.

**Evidence.** None.
**Gap.** The `links-v1` evaluation meets the AI-002 bars; an inbox journey accepts and rejects suggestions; an auto-link rule on one fixture source links only above its threshold, marks and can undo each link, and changes no public payload.

#### AI-003 — Duplicate sweep and merge proposals

Core · target · **partial** · Rules D-4

**Requirement.** On demand or weekly, Penny sweeps open requests for likely duplicates and lists merge proposals with a suggested canonical request and the evidence; accepting runs REQ-008's merge. An optional auto-merge rule (*Policy: `request.auto-merge.v1`; default: off*) can be enabled only after a passing evaluation (AI-012), merges only above its threshold and only within one board, logs each merge, and can be undone by REQ-009.

**Acceptance.**
1. The `merges-v1` evaluation (AI-011) reports sweep proposals covering at least 0.80 of labeled duplicate pairs with precision of at least 0.85.
2. On that labelled fixture, `request.auto-merge.v1` at its default threshold makes zero wrongful merges and none across boards; the report publishes the wrongful-merge rate of automatic merges against the 0.5% target, which does not gate.
3. The auto-merge rule is off on a new installation, and enabling it for a model and prompt version with no passing evaluation is refused with the reason.
4. A sweep over the fixture backlog lists proposals with a suggested canonical request and the evidence.
5. Accepting a proposal collapses votes as REQ-008 requires.
6. The auto-merge rule logs each merge, never merges across boards, and REQ-009 restores it.

**Evidence.** `src/core/features/requests/merge-repository.ts`; `tests/base/board.test.ts`
**Gap.** Reversible explicit merge (REQ-008, REQ-009) ships today. The `merges-v1` evaluation with its 0.80 coverage and 0.85 precision sweep bar and zero wrongful automatic merges on the labelled fixture, the sweep and its proposals, and the evaluation-gated, off-by-default, one-board auto-merge rule that logs each merge for REQ-009 to restore are not built.

#### AI-004 — Request extraction from conversations

Core · target · **partial** · Rules D-4

**Requirement.** From connected tickets, chats, calls, emails and Slack threads in scope, the extraction agent proposes candidate requests or links: a problem statement, the verbatim spans, the customer and the closest existing request. Proposals land in the inbox as suggestions; an owner may let a source create unpublished requests automatically, and REQ-005 still governs publication.

**Acceptance.**
1. The `extraction-v1` evaluation (AI-011) reports span-level precision of at least 0.85 and recall of at least 0.80 against labeled request moments.
2. Fixture conversations yield proposals whose spans match their source byte for byte.
3. Auto-creation produces unpublished requests only.
4. Re-running the same conversation creates nothing new.

**Evidence.** `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** Selected Orbit and native evidence produce cited learning options today, not requests. The `extraction-v1` evaluation meets the AI-004 bars; fixture conversations yield proposals whose spans match their source byte for byte; auto-creation produces unpublished requests only; re-running the same conversation creates nothing new.

#### AI-005 — Themes and adaptive taxonomy

Core · target · **missing** · Rules D-4 · Register R-13

**Requirement.** Penny keeps a hierarchical taxonomy (area, theme, sub-theme) over all evidence and requests, classifies new feedback continuously, proposes new themes as volume emerges, and lets operators rename, merge, split, pin or retire themes; operator edits win and reclassification keeps history. Themes filter every list and appear in reports (MEAS-004). Each theme can have a default owner applied on capture (TRIAGE-001).

**Acceptance.**
1. The `themes-v1` evaluation (AI-011) reports agreement with the adjudicated labels of macro-F1 at least 0.80 at area and theme level and at least 0.70 at sub-theme level.
2. Where the set records the agreement between two human labelers, the report publishes Cohen's kappa against 90% of that agreement.
3. A fixture corpus gets an initial taxonomy, and new feedback is classified in the next run.
4. An operator split reclassifies with history.
5. Themes filter the inbox and the request queue.
6. A captured item on a board with no default owner, classified into a theme that has one, takes the theme's owner (TRIAGE-001).

**Evidence.** None.
**Gap.** The `themes-v1` evaluation meets the AI-005 macro-F1 bars; a fixture corpus gets an initial taxonomy; new feedback is classified in the next run; an operator split reclassifies with history; themes filter the inbox and the request queue; a captured item on a board with no default owner, classified into a theme that has one, takes the theme's owner (TRIAGE-001). Native themes do not exist yet.

#### AI-006 — Summaries and reply drafts

Core · target · **done** · Rules D-2, D-4

**Requirement.** For a request, decision or account, Penny drafts a cited summary of its evidence and discussion; for comments and inbox items it drafts a reply or status-update wording that is edited and then sent through the reply door (D-2). A draft carrying a private value (an account name, revenue, an internal note) is flagged before publication (EVID-006). Drafting reads only records available to the current operator; the prompt obeys AI-010’s data-processing setting. Unresolvable citations are dropped with a visible notice and never displayed as cited. Unlinked inbox drafts remain editable until linked to a published request.

**Acceptance.**
1. Every citation in a fixture summary resolves to a stored record; unknown citations are dropped and disclosed.
2. A draft containing a private account name is flagged and its publication refused until edited.
3. Nothing is sent without an explicit send of the edited wording.
4. A revoked session refuses a draft completed in flight.

**Evidence.** `tests/base/penny-evidence.test.ts`; `tests/browser/learning-journey.mjs`; `tests/browser/draft-journey.mjs`
**Gap.** None.

#### AI-007 — Spam and abuse flags

Core · target · **missing** · Rules D-4

**Requirement.** Portal and widget submissions and comments that look like spam, abuse or exposed personal data are flagged in moderation with a reason; on an auto-publish board (REQ-033) a flag holds the item instead of publishing it. A flag never deletes or publishes anything.

**Acceptance.**
1. The `spam-v1` evaluation (AI-011) reports precision of at least 0.95 and recall of at least 0.90 for spam and abuse, and recall of at least 0.95 for exposed personal data.
2. A fixture spam batch is flagged with reasons and stays in moderation.
3. A false positive is approved normally.

**Evidence.** None.
**Gap.** The `spam-v1` evaluation meets the AI-007 bars; a fixture spam batch is flagged with reasons and stays in moderation (held on an auto-publish board); a false positive is approved normally.

#### AI-008 — Sensitive-data redaction

Core · target · **partial** · Rules D-4

**Requirement.** Owner-configured rules (US Social Security numbers, payment card numbers, phone numbers, email addresses, credential shapes and custom patterns), with optional model detection, redact captured excerpts and transcripts before storage; redactions are marked, and the unredacted original stays only in the source system.

**Acceptance.**
1. The `redaction-v1` evaluation (AI-011) reports recall of at least 0.99 for Social Security and payment card numbers and at least 0.95 for the other default kinds, with precision of at least 0.90.
2. A fixture ticket containing an SSN and a card number is stored redacted in D1, search and the archive.
3. A new rule applies to new captures and, on request, re-applies to stored ones.

**Evidence.** `tests/base/penny-evidence.test.ts`; `tests/browser/redaction-journey.mjs`; `tests/browser/operator-pages.mjs`; `scripts/ai-eval/run.mjs`; `tests/fixtures/ai/redaction-v1`
**Gap.** Deterministic owner rules cover operator evidence, CAP-009 email capture, native portal submissions, saved Canny/UserVoice imports and Orbit/native learning acquisition before storage, and owner-confirmed reapplication rewrites editable wording and copies; AI-010 is not used for redaction, and AI-011 still inherits the minimal runner. Gap: Optional model detection is not built. Rule reapplication does not rewrite the preserved or fingerprinted places explicitly counted as blocked in preview: saved-import plans/originals/provenance and their owned native rows; learning scope/originals/interpretations/corrections/commitments; decision and approved/published/status/notification history; pending verification payloads; canonical request addresses; signed/outbound/tracker envelopes; audit reason copies; archive/restore staging. These require DATA-003 erasure/copy resolution or an owner ruling. Binary attachment originals are not rewritten. No transcript store exists; CAP-008 inherits transcript capture and redaction.

#### AI-009 — Ask Penny

Core · target · **missing** · Rules D-4

**Requirement.** Operators ask questions in Penny, Slack or Teams ("What are Enterprise accounts saying about SSO this quarter?") and get an answer that cites the evidence, requests and accounts it used, limited to what the asker's role may see.

**Acceptance.**
1. A question over a fixture corpus returns an answer whose every citation resolves.
2. A role without commercial permission receives no revenue figures.
3. A Slack answer posts only where the asker chose.

**Evidence.** None.
**Gap.** A question over a fixture corpus returns an answer whose every citation resolves; a role without commercial permission receives no revenue figures; a Slack answer posts only where the asker chose.

#### AI-010 — Model configuration and cost

Core · target · **done**

**Requirement.** The owner chooses the model provider and model for each AI capability (default: Claude through Penny’s enforcing model port), a monthly USD budget and data-processing settings. Every AI run reserves and reports cost as LEARN-006 does; an absent or exhausted model visibly refuses AI work while every non-AI path keeps working. Settings choose OpenAI or Anthropic and a catalog model per capability, a UTC-calendar-month USD cap (initially $0), and whether permitted private context may be sent. By default private notes, account names and commercial fields are withheld where prompts are built. Keys, allowed models and prices remain installation bindings, never D1 or the screen. Learning keeps its investigation ceiling inside the installation cap; ambiguous calls keep their reservation and are never automatically retried.

**Acceptance.**
1. Exhausting a fixture budget refuses new AI runs with a visible reason while lexical suggestions, manual capture and triage keep working.
2. The cost report matches metered fixture usage.

**Evidence.** `src/core/features/ai/`; `tests/base/learning-stage2.test.ts`; `tests/base/upgrade.test.ts`; `tests/browser/learning-journey.mjs`; `visual/ai-models/`
**Gap.** None.

#### AI-011 — Measured AI quality

Core · target · **missing**

**Requirement.** Every AI capability that suggests, links, merges, classifies, extracts, flags or redacts is measured against a named, versioned, labeled fixture set held in the repository: `duplicates-v1` (at least 300 request pairs, at least 30% of them hard negatives that share key terms but differ in need, and paraphrase positives with no shared terms), `links-v1` (at least 200 inbox items labeled with their request or none, and their theme), `merges-v1` (a backlog of at least 500 requests across at least three boards with labeled duplicate clusters), `extraction-v1` (at least 50 tickets, calls, emails and threads with labeled request spans), `themes-v1` (at least 400 items with a three-level taxonomy, adjudicated), `spam-v1` (at least 300 submissions and comments labeled spam, abuse, personal data or clean) and `redaction-v1` (at least 200 excerpts with labeled sensitive spans). One evaluation command runs a capability over its set through the configured model adapter, with the model chosen per run.

**Acceptance.**
1. Each named set exists with its documented size and label mix.
2. The evaluation command writes a report naming the set version and hash, model and prompt version, counts, precision, recall, F1 or agreement, the confusion matrix and cost, and whether each bar in the capability's clause is met.
3. It exits non-zero when a bar is not met, including on a deliberately degraded fixture model.
4. The lexical baseline (EVID-007) is evaluated on `duplicates-v1` without a model, so every report has a floor to beat; the baseline run needs no model.
5. Each model evaluation is recorded as a dated receipt in CHANGELOG.md.

**Evidence.** None.
**Gap.** Each named set exists with its documented size and label mix; the evaluation command reports every figure for each set and exits non-zero on a deliberately degraded fixture model; the lexical baseline run needs no model. Only `redaction-v1` (210 synthetic excerpts) and a minimal runner exist.

#### AI-012 — Evaluation gates automatic rules

Core · target · **missing** · From AI-011

**Requirement.** In the product, settings show the latest evaluation for the configured model on each capability, and an auto-link (AI-002), auto-merge (AI-003), automatic theme assignment (AI-005) or automatic request creation (AI-004) rule cannot be enabled for a model and prompt version whose recorded evaluation is missing or below its bar; changing either one turns such rules off until a passing evaluation is recorded. Operators' accept and reject decisions can be exported as a private labeled set to run the same evaluation on the owner's own data; it is never committed to the repository.

**Acceptance.**
1. Settings show the latest evaluation for the configured model on each capability.
2. Enabling auto-merge for a model with no passing evaluation is refused with the reason, and a passing evaluation allows it.
3. Changing the model or prompt version turns such rules off until a passing evaluation is recorded.
4. Operators' accept and reject decisions export as a private labeled set that the evaluation command runs on.

**Evidence.** None.
**Gap.** Settings show no evaluation, and no automatic rule is gated on a passing evaluation; enabling auto-merge for a model with no passing evaluation must be refused with the reason, a passing evaluation must allow it, and accept and reject decisions must export as a private labeled set.

### Customer value and segments

#### SEG-001 — HubSpot

Core · target · **missing** · Rules D-1

**Requirement.** An OAuth connection syncs HubSpot companies and contacts (domain, lifecycle stage, owner and configured properties such as ARR, MRR, plan and renewal date) and deals (amount, stage, close date) into Penny accounts and requesters by HubSpot ID and email, through webhooks, applied within 5 minutes of arrival, plus a scheduled full refresh every 6 hours (the owner may set 1 to 24 hours in the connector's settings). Write-back of a "Penny requests" property and timeline events is off unless the owner enables it.

**Acceptance.**
1. HubSpot API fixtures map companies, contacts and deals.
2. A webhook update changes segment membership within 5 minutes and a property changed without a webhook arrives at the next scheduled refresh.
3. Nothing is written to HubSpot by default.

**Evidence.** None.
**Gap.** HubSpot API fixtures map companies, contacts and deals; a webhook update changes segment membership within 5 minutes and a property changed without a webhook arrives at the next 6-hour (or owner-set) refresh; nothing is written to HubSpot by default.

#### SEG-002 — Salesforce

Core · target · **missing** · Rules D-1

**Requirement.** A Salesforce connected app syncs Accounts, Contacts, Opportunities (amount, stage, close date, type) and configured fields; feedback can be tied to an opportunity, so revenue at stake is the sum of open opportunity amounts; an optional Penny Requests related list is written back when enabled.

**Acceptance.**
1. Salesforce REST fixtures with sandbox OAuth: mapping, opportunity-linked evidence summing open amounts in USD, and closed-lost opportunities excluded from revenue at stake.

**Evidence.** None.
**Gap.** Salesforce REST fixtures with sandbox OAuth: mapping, opportunity-linked evidence summing open amounts in USD, and closed-lost opportunities excluded from revenue at stake.

#### SEG-003 — Orbit

Core · target · **partial** · Rules D-1

**Requirement.** Orbit, the sibling CRM (https://github.com/just-every/run-orbit), syncs accounts, contacts and deals on SEG-001's terms through its public API.

**Acceptance.**
1. A journey against an Orbit test installation shows Orbit account attributes as Penny segment attributes and Orbit deals in revenue at stake.

**Evidence.** `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** Today Penny reads only selected Orbit evidence records for learning (LEARN-001). A journey against an Orbit test installation shows Orbit account attributes as Penny segment attributes and Orbit deals in revenue at stake.

#### SEG-004 — Billing revenue

Core · target · **missing** · Rules D-1

**Requirement.** Stripe Billing, and Nectar, the sibling billing seed (https://github.com/just-every/run-nectar), sync each customer's MRR, plan and subscription status by customer ID or email domain, in USD; a non-USD subscription records its conversion rate and date.

**Acceptance.**
1. Stripe API fixtures compute MRR from subscriptions with discounts and several items, flag churned customers and convert a non-USD subscription with its recorded rate.

**Evidence.** None.
**Gap.** Stripe API fixtures compute MRR from subscriptions with discounts and several items, flag churned customers and convert a non-USD subscription with its recorded rate.

#### SEG-005 — Product and success attributes

Core · target · **missing** · Rules D-1

**Requirement.** Segment identify and group traits, and Buoy, the sibling customer-success seed (https://github.com/just-every/run-buoy), supply user and company attributes such as plan, seats, health and last active.

**Acceptance.**
1. Signed Segment webhook fixtures set traits that move an account into a segment.
2. A Buoy health change does the same.

**Evidence.** None.
**Gap.** Signed Segment webhook fixtures set traits that move an account into a segment; a Buoy health change does the same.

#### SEG-006 — Dynamic segments

Core · target · **missing**

**Requirement.** Operators save segments as rules over any account or requester attribute (plan is Enterprise and ARR at least $50,000; health at risk; churned in the last 90 days). Membership is recomputed within 5 minutes of a changed attribute reaching Penny (SEG-001's webhook and refresh timing), and every operator list, prioritization view, roadmap view, report and agent scope filters by segment. Segments and attributes are operator-only.

**Acceptance.**
1. A base test changes an attribute and sees the account enter and leave a segment within 5 minutes.
2. Request, inbox and report filters agree on membership.
3. No segment name or attribute appears in any public payload (DATA-002).

**Evidence.** None.
**Gap.** A base test changes an attribute and sees the account enter and leave a segment within 5 minutes; request, inbox and report filters agree on membership; no segment name or attribute appears in any public payload (DATA-002).

#### SEG-007 — Customer-value demand

Core · target · **partial**

**Requirement.** For every request, feature and theme, operators see as separate figures: voters (including proxy votes), accounts, the ARR and MRR of requesting accounts, open opportunity amounts citing it, churned ARR that cited it, and evidence count, each filterable by segment and date range, in USD, counting each account once. The value figures appear beside REQ-026's separate vote, evidence and account figures and are combined into no score.

**Acceptance.**
1. A fixture with several voters from one account counts that account's ARR once.
2. Opportunity and churn figures reconcile with fixture CRM data and appear beside REQ-026's separate counts.
3. Each figure filters by segment and date range, for requests, features and themes.
4. None of them appears publicly.

**Evidence.** `src/core/features/requests/operator-context.ts`; `src/core/features/accounts/read-context.ts`; `tests/base/penny-evidence.test.ts`
**Gap.** REQ-026 ships private per-account vote totals and separate vote, linked-evidence and distinct-account counts, with all verified address/account associations and complete supporter history expandable 50 people at a time. Private account revenue is available on account records (EVID-005). PRIO-001 ships private feature demand that counts each person and account once with recorded account revenue and evidence. CAP-014 native proxy support ships from the inbox, request page and Zendesk edge. Aggregated ARR/MRR, opportunity and churn value figures beside request and feature counts, theme demand, and segment/date filtering remain required.

### Target: Requests and portal

#### REQ-033 — Auto-publish for identified requesters

Core · target · **missing**

**Requirement.** Owners and Admins choose each public board's moderation in settings: hold everything (REQ-003's holding) or auto-publish. On an auto-publish board, a submission (REQ-003), comment (REQ-007) or edit (REQ-020) from a requester verified under REQ-023 or identified through host or SSO identity (REQ-031, WIDGET-002) is public on submission in the requester's own wording, with the public status Open, unless it is held: flagged by AI-007, matched by a hold rule (TRIAGE-003), from a requester an operator set to always-moderate, or carrying a file other than an image within `seed.json` upload limits. A held item enters moderation with its reason and follows REQ-030. Image attachments on an unheld post publish with it; this supersedes REQ-011's separate file approval on auto-publish boards only, and every other file stays held under REQ-011. An operator can take down an auto-published post or comment at any time with a reason; this is REQ-041's removal, which works on every board: it leaves the portal within 5 seconds, its URL answers 404, it counts toward no public total and its author can see the reason. Operators edit auto-published wording under REQ-038. A blocked requester is still refused (REQ-022), duplicate suggestions still appear before submission (REQ-004), and each submission still creates its evidence item (EVID-001). When AI-007 cannot run (AI-010), the board's choice applies: publish and mark the item "not screened" for operator review (default), or hold. New public boards default to auto-publish; boards that exist when this ships keep holding until the owner chooses. *Policy: `request.moderation.v1` reads this setting.*

**Acceptance.** A base and browser journey:
1. With auto-publish on, a verified requester's post and comment are public on submission and a widget-identified user's post is listed at once.
2. A post flagged by an AI-007 fixture, and one matched by a hold rule, are held with their reason.
3. A post with a PDF is held while an image post publishes with its image.
4. A takedown removes the post from every public read within 5 seconds and its URL answers 404.
5. With the model unavailable, posts publish marked not screened, or are held when the board chooses hold.
6. With the setting off, REQ-003's holding applies unchanged.

**Evidence.** None.
**Gap.** With auto-publish on, a verified requester's post and comment are public on submission and a widget-identified user's post is listed at once; an AI-007-flagged post and a hold-rule match are held with their reason; a PDF post is held while an image post publishes with its image; a takedown (REQ-041's removal) removes the post from every public read within 5 seconds and its URL answers 404; with the model unavailable, posts publish marked not screened, or are held when the board chooses hold; with the setting off, REQ-003's holding applies unchanged.

#### REQ-034 — Public categories

Core · target · **partial**

**Requirement.** Operators define categories on each board, with one optional level of subcategories, and rename, reorder, merge and archive them. Each board's setting makes a category off, optional or required on submission. A requester picks one category when submitting from the portal, widget or SDK (REQ-003, WIDGET-001, WIDGET-004); an operator can change it when publishing (REQ-005) or later. Categories are public: the portal shows each published request's category, filters by category (REQ-012) and shows per-category counts that include only published requests visible on that board, never unpublished, held, internal, withdrawn or removed (REQ-041) ones. Categories are distinct from operator-only tags (EVID-009) and themes (AI-005), and nothing moves between them implicitly. A merge keeps the canonical request's category (REQ-008). Automation rules can match and set a category (TRIAGE-003), and categories are in the CSV export, the API and the archive (DATA-001, DATA-005, DATA-006). Canny categories and subcategories (MIG-001), Aha! categories (MIG-003) and UserVoice categories (MIG-004) land here.

**Acceptance.** A browser journey at both widths:
1. A requester picks a category on submit, and a board with categories required refuses a submission without one.
2. The board's category filter returns only matching published requests.
3. Category counts exclude an unpublished and a held request.
4. Merging two requests in different categories keeps the canonical's.
5. A Canny API fixture's categories and subcategories arrive as categories on their boards, and no tag or public payload changes as a result.

**Evidence.** `tests/base/board-categories.test.ts`; `visual/board-categories/REQ-034/`
**Gap.** Board categories/subcategories, rename/order/archive/merge, required submission, moderation and later assignment, visible-only counts/filtering, canonical merge custody, CSV/API/archive and roadmap cards are implemented; route and 1440/390 browser journeys pass. Gap: incumbent category imports, category automation rules and a standalone SDK interface remain missing.

#### REQ-035 — Vote importance

Core · target · **partial**

**Requirement.** A board's setting can ask each voter how important the request is to them (default labels Nice to have, Important and Must have; the owner may rename them or use four levels). Choosing is optional and can be changed or cleared. Operators see each request's votes broken down by importance, and with SEG-007's value figures (such as the ARR of Must-have voters); prioritization views (PRIO-003) can use the breakdown. The portal shows only the vote total. Proxy votes (CAP-014) record importance as the source states it; Canny's `votePriority` (MIG-009) and Productboard's portal-card importance (MIG-002) import into it. Completion requires SEG-007’s customer-value figures by importance, PRIO-003’s use of the breakdown and MIG-002’s Productboard importance import; this clause is done only when those dependencies and its native and Canny acceptance are complete.

**Acceptance.**
1. A voter picks Must have and later changes it to Important, and the operator breakdown follows.
2. The public request payload carries no importance value.
3. A proxy vote records its importance.
4. A Canny fixture vote with each `votePriority` value lands with the matching importance and the receipt counts each.

**Evidence.** `tests/base/vote-importance.test.ts`; `tests/base/import-vote-importance.test.ts`; `tests/browser/vote-importance.mjs`; `tests/browser/zendesk-proxy-votes.mjs`
**Gap.** Board-configured three/four labels, optional choose/change/clear, private per-request importance counts, native and Zendesk source-stated proxy importance, CSV and Canny saved votePriority mapping/receipt/replay/undo ship. Importance counts can now sort saved PRIO-003 views. Remaining: SEG-007 commercial-value figures by importance, complete PRIO-003 inputs and MIG-002 Productboard portal-card importance import.

#### REQ-036 — Set a request's status

Core · target · **partial**

**Requirement.** On any published request an operator changes the status in one action, as Canny's status picker does: one of REQ-016's six public statuses directly, or an internal status (PRIO-002), which sets its mapped public status. The change takes an optional public comment, prefilled from the owner's template for that public status (one per status in settings, editable per change, blank by default), and an optional public ETA of a month or a quarter, which the request shows and the status roadmap (ROAD-014) shows beside it and which can be changed or cleared. Saving publishes one status update (REQ-015) carrying the new status and any comment into the request history, and the public status follows within 5 seconds under REQ-016. It notifies once per change each follower, vote-subscribed voter (NOTIFY-008) and subscribed author (NOTIFY-011) under NOTIFY-001 and NOTIFY-002, and NOTIFY-009's captured contacts when ticked; a change with no comment still sends a status-change message naming the new status. Declined still requires a public reason (REQ-017). Saving the same status again with no comment and no ETA change publishes and sends nothing. A bulk status change (TRIAGE-005) sends one message per request and recipient, coalesced under NOTIFY-002. The request ETA is set by the operator and never derived from an internal target date (ROAD-012).

**Acceptance.** A base and browser journey:
1. Setting Planned with no comment on a published request that has no roadmap item shows Planned in every public payload within 5 seconds and emails each vote-subscribed voter and follower once.
2. The request appears in the status roadmap's Planned column with its ETA.
3. An internal status mapped to In progress shows In progress publicly and its own name only to operators.
4. The template prefills and the published comment is the edited wording.
5. Saving the same status again sends nothing.
6. Declined without a reason is refused.

**Evidence.** `tests/base/request-status-workflow.test.ts`; `visual/request-status-workflow/REQ-036/`
**Gap.** Six direct statuses, optional comments, public month/quarter ETA, internal statuses, templates and unchanged-save deduplication are proved through the API and browser at 1440/390. Vote/author subscriptions (NOTIFY-008/011), captured-contact sends and bulk status actions remain separate gaps.

#### REQ-037 — Comment replies and images

Core · target · **missing**

**Requirement.** Portal comments take one level of threaded replies: a verified requester or an operator replies to a published top-level comment, and replies show under it in time order. A requester's reply is moderated like any comment (REQ-007, REQ-030, REQ-033); an operator's reply is a public reply under NOTIFY-001, and a requester's reply, once public, notifies the parent comment's author once when they hold a permission for the request. Comments and replies can carry images within `seed.json` upload limits: on a holding board each image is approved with its comment under REQ-011, and on an auto-publish board an unheld comment's images publish with it (REQ-033). A held, rejected or removed (REQ-041) parent hides its replies from the portal, and a reply to it is refused. Imported replies and comment images (MIG-009, MIG-004, MIG-005) land in the same thread with their original dates under the import's publication choice (IMP-002); Canny internal comments land as internal notes (REQ-032).

**Acceptance.** A browser journey at both widths:
1. A requester's reply to an operator comment is held, then shown under its parent once approved.
2. An operator's reply is public at once and notifies followers once.
3. A comment image on a holding board stays hidden until approved and on an auto-publish board publishes with the comment.
4. A reply to a rejected comment is refused.
5. A Canny fixture reply lands under its parent with its image.

**Evidence.** None.
**Gap.** At both widths: a requester's reply to an operator comment is held, then shown under its parent once approved; an operator's reply is public at once and notifies followers once; a comment image on a holding board stays hidden until approved and on an auto-publish board publishes with the comment; a reply to a rejected comment is refused; a Canny fixture reply lands under its parent with its image.

#### REQ-038 — Edit published wording

Core · target · **missing**

**Requirement.** As Canny's Edit Post does, a Product manager, Admin or Owner (OPS-001) can, on any board and whatever its moderation setting (REQ-033), edit a published request's public wording: the title, description and category (REQ-034), and an approved attachment's publication (withdrawing it under REQ-011). They can also edit the text of a published requester comment, operator comment or status update (REQ-015, REQ-036).

**Acceptance.** A base and browser journey on a holding board and an auto-publish board:
1. An operator retitles a published request, and within 5 seconds the new title is in the request page, board list, search, category facets, status roadmap, feeds, widget and API, while the old title appears only in the operator history with its editor and time.
2. The request keeps its ID and public URL, and every earlier version stays readable to operators (as EVID-010 keeps evidence versions).
3. The requester's own later edits (REQ-020) start from the operator's wording, and the evidence item the submission created keeps the requester's original wording (EVID-004).
4. Editing an operator comment shows the new wording marked "Edited" on the portal and keeps the old for operators.
5. Editing a status update changes neither the request's status nor its ETA.

**Evidence.** None.
**Gap.** Before publication, edit-then-approve under REQ-030 ships today; there is no route to edit published content (`src/core/features/requests/operator-routes.ts`). On a holding board and an auto-publish board: a retitled published request shows the new title in the request page, board list, search and API within 5 seconds while the old title appears only in the operator history; an edited operator comment shows the new wording marked Edited and keeps the old for operators; editing a status update leaves its status and ETA.

#### REQ-041 — Remove and restore published content

Core · target · **missing** · From REQ-038

**Requirement.** As Canny's delete does, a Product manager, Admin or Owner can remove a published request or comment, with a reason, on any board; this is REQ-033's takedown, available on every board. Removal is reversible: an operator restores it with its earlier state, votes and follows. An Owner or Admin can delete a removed request permanently, which deletes its public content, votes, comments and follows, keeps its evidence item and leaves an audit entry with no customer wording (DATA-003); a merge (REQ-008) is offered instead when the removal names a duplicate.

**Acceptance.** A base and browser journey on a holding board and an auto-publish board:
1. Removing a published request makes its URL answer 404 and drops it from the vote total, category counts, search, sitemap, feeds, the status roadmap column (ROAD-014) and widget lists within 5 seconds; its votes, comments and followers are kept for operators, and the evidence item survives (EVID-004).
2. Restoring it brings each back with its earlier state, votes and follows.
3. Removing a requester comment hides it from the portal within 5 seconds, a removed parent hides its replies (REQ-037), and its author's activity view (REQ-025) shows the reason.
4. Removing an operator comment or a status update removes only its text from the portal and leaves the request's status unchanged.
5. An Owner or Admin permanently deletes a removed request: its public content, votes, comments and follows are gone, its evidence item stays, and the audit entry holds no customer wording.
6. Removing a request whose reason names a duplicate offers a merge instead.

**Evidence.** None.
**Gap.** There is no route to remove or restore published content (`src/core/features/requests/operator-routes.ts`). A removed published request answers 404 and leaves the vote total, category counts, search and the status roadmap column within 5 seconds, and restoring it brings each back; a removed requester comment leaves the portal and its author's activity view shows the reason; removing a status update leaves the status unchanged; permanent delete keeps the evidence item.

#### REQ-042 — Notice and accountability for edits and removals

Core · target · **missing** · From REQ-038 · Cites BASE-ROLE-001

**Requirement.** Edits and removals of published content send no mail by default and are accountable. A removal offers one private notice to the author with its reason, under REQ-030's rules for a rejection notice (current consent, suppression, mute, unsubscribe and quiet hours); editing a status update never re-sends it, and sending a corrected wording to recipients requires a new status update. No follower or voter is notified of an edit or a removal. Bulk removal is TRIAGE-005.

**Acceptance.**
1. None of REQ-038's or REQ-041's actions sends mail, except one author notice for a removal when ticked.
2. No follower or voter is notified of an edit or a removal, and editing a status update never re-sends it.
3. Each edit, removal, restore and permanent delete has one audit entry (ROLE-004) with the actor, subject and reason and no customer wording.
4. A Contributor and a Viewer are refused each action.

**Evidence.** None.
**Gap.** No action sends mail except one author notice when ticked; a Contributor is refused each action with 403; each action has one audit entry. None of this exists while edits and removals of published content are unbuilt.

#### REQ-039 — Social sign-in for requesters

Core · target · **done** · Register R-4

**Requirement.** Beside REQ-023's emailed link, the owner can turn on "Continue with Google" and "Continue with GitHub" for requesters (each off by default, with the owner's own OAuth client credentials held as installation custody). A provider address verified by that provider (Google's `email_verified`, GitHub's primary verified email) becomes a REQ-023-verified address without a further email, the visitor gets REQ-023's browser-local session with no cookie, and an action held for verification (a vote, a follow, a comment or a submission) is applied on completion exactly as REQ-023 applies it. Sign-in grants no email permission (REQ-010) and no operator authority, and an address an SSO-enforced operator domain covers (ROLE-002) is still only a requester. An unverified provider address falls back to REQ-023's emailed link. On an SSO-required portal (WIDGET-006) only WIDGET-008 applies.

**Acceptance.** A browser journey against Google and GitHub OAuth fixtures at the network edge:
1. A signed-out visitor votes, chooses Continue with Google, and returns to the request with the vote applied and no cookie set.
2. A GitHub account with no verified email is sent to the emailed link.
3. A forged or replayed OAuth state is refused and changes nothing.
4. With both providers off, neither button appears.

**Evidence.** `tests/base/auth.test.ts`; `tests/browser/operator-pages.mjs`
**Gap.** None.

#### REQ-040 — Board participation and display settings

Core · target · **done**

**Requirement.** Each public board has settings, as Canny's board settings do: who may post (requesters, or operators only, which makes a vote-and-comment board on which the portal and widget offer no submit form and an API or widget submission is refused with 403), whether requester comments are allowed, whether vote totals show publicly (when hidden, vote totals leave every public read and the API, the board may still sort by them, and operators still see them), whether voters' display names are listed publicly on a request (off by default; when on, the vote control states it before voting), and whether requester names show publicly or every requester reads as "Anonymous" (operators always see who). A setting change applies to every public read within 5 seconds and removes no record.

**Acceptance.** A browser journey:
1. On an operators-only board the submit form is absent and a widget or API submission answers 403, while voting and commenting work.
2. Hiding vote totals removes them from the board, request page and public API.
3. Turning on the voter list shows display names only, and the vote control states it.
4. An anonymized board shows "Anonymous" on every public read while the operator page shows the requester.

**Evidence.** `tests/base/board-categories.test.ts`; `tests/base/import-board-policy.test.ts`; `tests/browser/import-board-policy.mjs`; `visual/board-categories/REQ-040/`
**Gap.** None.

#### REQ-043 — Canny board settings in migration

Core · target · **done** · From REQ-040 · Rules D-5

**Requirement.** For Canny migration (MIG-001), only the board visibility (`isPrivate`) and historical comment visibility (`privateComments`) exposed by [Canny’s API reference](https://developers.canny.io/api-reference) are mapped automatically. Posting permission, vote-count visibility, voter visibility and anonymity are not exposed by that API: for each board, the migration shows a reviewed board-settings mapping for those four settings, with the Canny dashboard values entered or confirmed by the owner before apply. Requester comment participation is also an explicit owner choice: `privateComments` governs historical comment visibility, not permission to comment. The preview distinguishes source API fields from owner-confirmed settings, retains the reviewed mapping with the originals and imports no setting it cannot verify.

**Acceptance.**
1. A Canny API fixture maps `isPrivate` and `privateComments` without inventing API fields.
2. For each board the owner enters or confirms posting permission, vote-count visibility, voter visibility and anonymity from the Canny dashboard and explicitly reviews comment participation; a board confirmed as posting off and votes hidden lands with both settings.
3. The preview shows the source of each mapped setting, a changed mapping requires a fresh preview, and an unverified setting is not imported.
4. Replay changes nothing; undo removes the imported settings, while a later native edit refuses reversal rather than overwriting it.

**Evidence.** `tests/base/board-categories.test.ts`; `tests/base/import-board-policy.test.ts`; `tests/browser/import-board-policy.mjs`; `visual/board-categories/REQ-040/`
**Gap.** None.

### Triage, ownership and follow-up

#### TRIAGE-001 — Request owner

Core · target · **done**

**Requirement.** Every request and inbox item can have one accountable owner; boards have a default owner applied on capture (themes take theirs under AI-005); each operator has a queue of the items, requests and requester comments awaiting them.

**Acceptance.**
1. A captured item takes its board's default owner.
2. Reassignment moves it between queues.
3. A queue lists only the operator's own items.

**Evidence.** `tests/base/ownership.test.ts`; `tests/browser/ownership-journey.mjs`
**Gap.** None.

#### TRIAGE-002 — Aging and reminders

Core · target · **done**

**Requirement.** Untriaged inbox items, unanswered requester comments and requests with no public response past owner-set ages (default 7 days) are flagged on the overview and remind their owner once per age step; snoozed items return on their date. Requests whose public status has stayed Under review, Planned or In progress past an owner-set age (default 28 days, settable per status) are flagged stale on the overview and in the request queue (REQ-028) and remind their owner once per age step, as Canny's stale posts do; a status change (REQ-036) or a mapped roadmap transition clears the flag.

**Acceptance.**
1. A clock-advanced test sends one reminder per age step, returns a snoozed item on its date, flags a request left in Planned for 28 days as stale with one reminder, clears the flag when its status changes, and the overview's aging and stale counts link to their records.

**Evidence.** `tests/base/triage-aging.test.ts`; `tests/browser/triage-aging.mjs`
**Gap.** None.

#### TRIAGE-003 — Automation rules

Core · target · **missing**

**Requirement.** Admins define ordered rules: when an item or request matches conditions (source, connector, board, tag, theme, segment, keyword, account attribute), assign an owner, add tags, set the board or category (REQ-034), link to a request, set a custom field or score input, hold an item for moderation on an auto-publish board (REQ-033), or post to a Slack or Teams channel. A rule previews its matches before saving, runs once per item and logs each action. Rules cannot publish, vote, notify a customer or commit.

**Acceptance.**
1. A rule dry-runs against a fixture inbox, then applies once per item with one audit entry each.
2. A hold rule keeps a matching auto-publish submission in moderation with the rule named as its reason.
3. The rule editor offers no publication, vote, customer-notification or commitment action.

**Evidence.** None.
**Gap.** A rule dry-runs against a fixture inbox, then applies once per item with one audit entry each; a hold rule keeps a matching auto-publish submission in moderation with the rule as its reason; the rule editor offers no publication, vote, customer-notification or commitment action.

#### TRIAGE-004 — Mentions and internal discussion

Core · target · **done**

**Requirement.** Internal notes (REQ-032) support selected operator @mentions and one level of threaded replies. A mention creates one durable in-app notice per note and active recipient by default; saving again or dismissing the notice does not duplicate it. NOTIFY-006 carries channel preferences and email, chat, push and digest delivery of mention notices.

**Acceptance.**
1. A selected mention notifies its operator once, including after an idempotent save and dismissal.
2. A reply appears under its parent.
3. A removed operator cannot receive a new mention.
4. The note and its replies never appear in a public payload.
5. Archive/restore and erasure preserve their custody, and a reply restores after its parent.

**Evidence.** `tests/base/internal-discussion.test.ts`; `tests/browser/internal-discussion.mjs`
**Gap.** None.

#### TRIAGE-005 — Bulk actions

Core · target · **partial** · Cites BASE-ROLE-001

**Requirement.** Operators select many inbox items or requests and tag, assign, move board, set status (REQ-036), link, mark reviewed, remove published requests with one reason (REQ-041) or propose merge in one action, see a summary of what changed and can undo the batch. One batch authorization rule applies (RULINGS.md RL-101): each selected record and verb is authorized with the same current operator, board and feature permission as its individual action (OPS-001 roles, ROLE-001 custom permissions, REQ-036 status, REQ-041 reasoned removal); tag, assign and review may be delegated, while merge, move, status and reasoned removal need their own rights, and selecting many records never widens them.

**Acceptance.**
1. Tagging and assigning 200 fixture items writes one audited batch; undo restores every item.
2. Each selected record is authorized as its individual action would be, and an operator without the right for a verb has those records refused.
3. The preview shows the eligible selection and the refused records without revealing hidden data.
4. Commit and undo each run as one attributed batch with rechecked authority and unchanged-state fences.

**Evidence.** `tests/base/ownership.test.ts`; `tests/base/request-batches.ts`; `tests/browser/ownership-journey.mjs`; `tests/browser/triage-bulk.mjs`
**Gap.** Inbox-item batches, move board, set status, link, mark reviewed, REQ-041 bulk removal with one reason and propose merge remain unimplemented, as do per-record authorization of each verb, the eligible and refused preview and rechecked-authority commit and undo (RL-101); the tag and assignment batch is Owner/Admin only today.

#### TRIAGE-006 — Accountable background work

Core · target · **partial**

**Requirement.** Every automatic action (connector sync, rule, agent run, scheduled publication, delivery sync, reminder) has an accountable owner, a due condition, durable progress, visible failure and an explicit stop or resolved state. A repeated or restarted run never duplicates a customer message, a request or a tracker issue.

**Acceptance.**
1. For each worker type, a kill-and-restart test resumes without duplicates and shows the failure state until resolved.

**Evidence.** `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts`; `tests/base/notifications.test.ts`
**Gap.** Learning runs and mail drains meet this today. For each worker type, a kill-and-restart test resumes without duplicates and shows the failure state until resolved.

### Prioritization

#### PRIO-001 — Product hierarchy

Core · target · **done**

**Requirement.** Products contain components, components contain features, and requests link to features (many requests to one feature), so demand, value and evidence roll up; roadmap items (ROAD-002) attach to features. The hierarchy is operator-only except through an approved roadmap item.

**Acceptance.**
1. A base test rolls three requests from two accounts up to one feature, counting each account once.
2. Moving the feature to another component keeps every link.

**Evidence.** `tests/base/product-hierarchy.test.ts`; `tests/browser/product-hierarchy.mjs`
**Gap.** None.

#### PRIO-002 — Configurable statuses and fields

Core · target · **done**

**Requirement.** Operators define internal request statuses (Needs info, Researching) each mapped to one of REQ-016's six public statuses; setting one on a request (REQ-036) sets the request's direct public status to its mapping, and changing a status's mapping moves every request holding it, publishing no update and notifying nobody. Custom fields (DATA-004) on requests, features and accounts. The portal shows only the mapped public status, unless the owner chooses to show a custom status's own name publicly in place of its mapped label.

**Acceptance.**
1. A custom status mapped to Under review shows Under review in every public payload and the custom name only to operators, and shows its own name publicly once the owner chooses so.
2. A Canny fixture's custom status names arrive as internal statuses each mapped to the public status the owner chose in the migration preview (MIG-008).

**Evidence.** `tests/base/request-status-workflow.test.ts`; `tests/base/import-statuses.test.ts`; `tests/browser/import-statuses.mjs`
**Gap.** None.

#### PRIO-003 — Prioritization views and formulas

Core · target · **partial**

**Requirement.** Operators build saved, shareable views of requests or features with columns from demand (SEG-007), custom fields, scorecards (PRIO-004) and effort (PRIO-005), and an optional formula (presets RICE, value over effort, weighted segment demand, or a custom weighted sum) whose inputs and weights are visible on every row. A formula only sorts: it is never stored on a decision and never changes roadmap or public status. This supersedes REQ-026's "combines them into no score" inside these views only.

**Acceptance.**
1. A RICE view sorts fixture features with every component visible.
2. Changing a weight re-sorts.
3. The decision brief and every public payload show no score.

**Evidence.** `tests/base/prioritisation.test.ts`; `tests/browser/prioritisation.mjs`
**Gap.** Saved private/shared request and feature views show native voters, accounts, evidence and importance inputs; RICE, value/effort, manual segment demand and weighted sums sort only the view. Missing inputs stay unscored. Remaining: SEG-007 commercial/segment/date columns, custom-field columns, PRIO-004 scorecard inputs and PRIO-005 delivery-sourced effort.

#### PRIO-004 — Scorecards

Core · target · **missing**

**Requirement.** Operators define scorecards (named criteria with 1–5 or 1–10 scales and weights) and score ideas individually; each card shows every scorer's inputs and the weighted result, and rankings from scorecards filter by segment.

**Acceptance.**
1. Two operators' inputs are both visible on a card.
2. The weighted rank is computed.
3. Changing the criteria keeps earlier scores readable.

**Evidence.** None.
**Gap.** Two operators' inputs are both visible on a card; the weighted rank is computed; changing the criteria keeps earlier scores readable.

#### PRIO-005 — Effort from delivery

Core · target · **missing**

**Requirement.** Effort comes from the linked Vector, Linear, Jira, GitHub, Azure DevOps, ClickUp or Asana estimate (points, estimate, size or estimated time) or a manual field, with its source shown.

**Acceptance.**
1. A Linear fixture estimate appears as effort on the linked feature.
2. A manual override is marked as such.

**Evidence.** None.
**Gap.** A Linear, a ClickUp and an Asana fixture estimate each appear as effort on the linked feature with their source; a manual override is marked as such.

#### PRIO-006 — Objectives

Core · target · **missing**

**Requirement.** Operators define objectives with an owner, a timeframe and optional key results with a target, and link features, roadmap items and decisions to them. Prioritization views (PRIO-003) and roadmaps (ROAD-009) filter and group by objective, and a key result can read its current value from a measurement source (MEAS-001–MEAS-003). Objectives are operator-only unless shown on a public roadmap's approved wording (ROAD-004). Productboard objectives migrate here (MIG-002).

**Acceptance.**
1. Features linked to an objective appear grouped under it on a roadmap view and filter a prioritization view.
2. A key result reads its value from an Amplitude fixture.
3. A Productboard fixture's objectives land with their feature links.

**Evidence.** None.
**Gap.** Features linked to an objective appear grouped under it on a roadmap view and filter a prioritization view; a key result reads its value from an Amplitude fixture; a Productboard fixture's objectives land with their feature links.

### Target: Roadmap

#### ROAD-009 — Roadmap views

Core · target · **missing**

**Requirement.** Internal roadmaps show as a board by status, Now/Next/Later columns or a timeline by month or quarter from target and release windows; views filter by product, component, owner, theme and segment and can be saved and shared with operators.

**Acceptance.**
1. A browser journey switches the three views with the same filters and gets the same items.
2. Moving an item records a ROAD-001 transition.

**Evidence.** None.
**Gap.** A browser journey switches the three views with the same filters and gets the same items; moving an item records a ROAD-001 transition.

#### ROAD-010 — Several and audience roadmaps

Core · target · **missing**

**Requirement.** Owners publish more than one public roadmap (by product or audience) and can restrict one to a WIDGET-006 audience; each projects only approved items (ROAD-004).

**Acceptance.**
1. Two public roadmaps each show only their own approved items.
2. An audience roadmap answers 404 to non-members.

**Evidence.** None.
**Gap.** Two public roadmaps each show only their own approved items; an audience roadmap answers 404 to non-members.

#### ROAD-011 — Release planning and dependencies

Core · target · **done**

**Requirement.** Operators group roadmap items into planned releases with dates and record dependencies between items (blocks, blocked by); a slipped dependency flags its dependents and any public ETA (ROAD-012). Sprint and capacity planning stay in the delivery tool. Plans, dependencies and warnings stay operator-only and publish nothing.

**Acceptance.**
1. A slipped dependency flags each dependent item and its ETA.
2. The release plan lists its items with their states.

**Evidence.** `tests/base/release-planning.test.ts`; `tests/browser/release-planning.mjs`
**Gap.** None.

#### ROAD-012 — Public ETA

Core · target · **done**

**Requirement.** An approved roadmap item may show a coarse public ETA (a month or a quarter), approved separately like its other customer-safe fields; changing or removing it prepares a status-update draft (ROAD-007). A request's own ETA is set with its status (REQ-036). Internal target dates never appear publicly.

**Acceptance.**
1. The ETA appears only after approval.
2. Changing it drafts an update.
3. An internal target date is absent from every public payload.

**Evidence.** `tests/base/roadmap-public-eta.test.ts`; `tests/browser/roadmap-public-eta.mjs`
**Gap.** None.

#### ROAD-013 — Roadmap sharing and export

Core · target · **missing**

**Requirement.** Operators share a read-only internal roadmap with signed-in Viewers and export a roadmap view as PDF, PNG or CSV for leadership reviews; exports respect role field restrictions (ROLE-001).

**Acceptance.**
1. An export contains only fields the exporter's role may see.
2. The shared link refuses a signed-out visitor.

**Evidence.** None.
**Gap.** An export contains only fields the exporter's role may see; the shared link refuses a signed-out visitor.

#### ROAD-014 — Status roadmap

Core · target · **done**

**Requirement.** Each public roadmap (ROAD-006, ROAD-010) has a source the owner chooses: approved roadmap items (ROAD-006) or request statuses, which is how Canny builds its public roadmap. A status roadmap lists the published requests on the boards the owner selects, in columns by public status (REQ-016): Under review, Planned, In progress and Shipped by default; the owner can hide a column, rename its heading and limit Shipped to the last 30, 90 or 365 days or show all. Each card shows the request's title, board, category (REQ-034), vote total and public ETA (REQ-036) and links to the request. A status change moves the card within 5 seconds. Open and Declined requests, and unpublished, held, internal (REQ-019), withdrawn and removed (REQ-041) requests, never appear, and no count includes them. A request mapped to an approved roadmap item appears once, in the column of its public status. A new installation's first public roadmap uses request statuses; a roadmap that exists when this ships keeps approved items until the owner chooses. A migration rebuilds the source's public roadmap as a status roadmap (MIG-011). The preview binds the settings before and after apply, refuses stale approval, and supports replay and undo of unchanged imported settings; later native edits refuse undo rather than being overwritten.

**Acceptance.** A browser journey at both widths:
1. A request set to Planned appears in the Planned column within 5 seconds with its ETA and moves to Shipped when set.
2. An Open, an unpublished and an internal-board request never appear and no column count includes them.
3. A hidden column and a Shipped limit apply.
4. A mapped request appears once.
5. Switching the source to approved items shows ROAD-006's projection unchanged.

**Evidence.** `tests/base/request-status-workflow.test.ts`; `tests/base/import-roadmap.test.ts`; `tests/browser/import-roadmap.mjs`
**Gap.** None.

### Target: Releases and outcomes

#### REL-014 — Scheduled publication

Core · target · **done** · Register R-16

**Requirement.** A release (REL-002), an announcement (REL-018) or a status update (ROAD-008) can be scheduled for a time in `workspaceTimezone`. Penny retains the UTC instant and the entered IANA timezone, shows the schedule and lets an operator cancel it before publication. At that time Penny checks the same current publication conditions as Publish now: REL-002's for roadmap targets, ROAD-008's for status updates, REL-018's for announcements and REL-019's for request targets. If they fail, the entry stays a draft and its author receives a durable in-app failure notice. Scheduled publication is audited and repeated Cron runs publish the version only once.

**Acceptance.**
1. A clock-advanced test publishes a scheduled release and status update once at their times, never before.
2. Cancellation prevents publication.
3. A release whose target is no longer Shipped and a status update whose approval is stale stay draft and notify their authors.
4. The browser journey schedules and cancels through the release and status-update controls at both widths.

**Evidence.** `tests/base/penny-releases.test.ts`; `tests/browser/loopjourney-release.mjs`
**Gap.** None.

#### REL-015 — Rich changelog

Core · target · **done**

**Requirement.** Release bodies support Markdown with inline images from the release's approved attachments and video embeds from approved hosts, public labels (New, Improved, Fixed and owner-defined labels), and a changelog page filterable by label and product. Raw HTML is shown as text.

**Acceptance.**
1. An inline image renders from an approved attachment.
2. The label filter returns only matching releases.
3. Raw HTML in a body is not rendered.

**Evidence.** `tests/base/rich-changelog.test.ts`; `tests/browser/rich-changelog.mjs`
**Gap.** None.

#### REL-016 — Changelog distribution

Core · target · **partial**

**Requirement.** Besides email to subscribers (REL-012), the changelog has RSS and Atom feeds, a segment-targeted email send that reaches only consented recipients in the segment, and the widget (WIDGET-003).

**Acceptance.**
1. The feeds validate and list only published versions.
2. A segment send reaches exactly the intersection of consent and segment.

**Evidence.** `src/core/features/releases/recipients.ts`; `tests/base/penny-releases.test.ts`
**Gap.** Subscriber email ships today. The feeds validate and list only published versions; a segment send reaches exactly the intersection of consent and segment.

#### REL-017 — Release notes from delivered work

Core · target · **missing**

**Requirement.** When linked delivery work completes (DELIV-006), Penny drafts a release from the shipped requests' approved public wording and the tracker items the operator marks public; the draft waits for approval.

**Acceptance.**
1. A Linear fixture completion drafts a release containing only approved wording and marked items.

**Evidence.** None.
**Gap.** A Linear fixture completion drafts a release containing only approved wording and marked items.

#### REL-018 — Announcements

Core · target · **missing**

**Requirement.** An operator writes, labels (REL-015) and publishes a changelog entry with no target, as Canny's changelog allows: an announcement, for a fix, a small improvement nobody requested, or a pricing or policy notice. It needs a title, a body, a type or label and a publication date, publishes now or on schedule (REL-014) with no roadmap-state check, and has no outcome prompt (REL-008, REL-009) because it has no target. It appears on the changelog page, its feeds (REL-016) and the changelog widget (WIDGET-003). Its recipient snapshot (REL-004) is the updates subscribers (REL-012), narrowed by any segment send the operator chooses (REL-016); each receives it once under REL-006, REL-007 and NOTIFY-002, and unticking "Notify subscribers" (ticked by default) publishes it with no email. Corrections follow REL-003. Announcements inherit REL-014’s scheduling, cancellation, current-condition checks and durable author failure notices.

**Acceptance.** A base and browser journey:
1. An entry with no target publishes, appears on the changelog page, both feeds and the widget, and emails each updates subscriber once and nobody else.
2. With Notify subscribers unticked it emails nobody.
3. It shows no outcome prompt.

**Evidence.** None.
**Gap.** Today every release needs a roadmap target; REL-014 supplies scheduling for the entry types this clause will add. An entry with no target publishes, appears on the changelog page, both feeds and the widget, and emails each updates subscriber once and nobody else; with Notify subscribers unticked it emails nobody; it shows no outcome prompt.

#### REL-019 — Request targets on any release

Core · target · **missing** · From REL-018

**Requirement.** An operator can link published requests to any release as request targets without a roadmap item: publication requires each linked request to be Shipped (REQ-016), unless the operator ticks "Mark linked requests Shipped", which sets each one through REQ-036 in the same transaction; each linked request's followers, vote-subscribed voters and subscribed author join the snapshot once, with that request as their context, and see its outcome prompt. Corrections follow REL-003. Request targets inherit REL-014’s scheduling, cancellation, current-condition checks and durable author failure notices. A release with a roadmap target still enforces REL-002.

**Acceptance.** A base and browser journey:
1. A release whose roadmap target is Planned is still refused.
2. A release with an Open request target is refused unless Mark linked requests Shipped is ticked, which makes the request Shipped and adds its subscribed voters to the snapshot once each.

**Evidence.** None.
**Gap.** Today every release needs a roadmap target. A release whose roadmap target is Planned is still refused; a release with an Open request target is refused unless Mark linked requests Shipped is ticked, which makes the request Shipped and adds its subscribed voters to the snapshot once each.

### Delivery sync

#### DELIV-001 — Vector

Core · target · **missing** · Rules D-1

**Requirement.** Create or link a Vector issue or project from a request, feature or roadmap item; Vector state changes flow back under DELIV-006; Vector shows the linked demand (DELIV-007); a finished Vector cycle or release can draft a Penny release (REL-017).

**Acceptance.**
1. A journey against a Vector test installation creates an issue, maps its state change to the roadmap item and shows Penny's demand inside Vector.

**Evidence.** None.
**Gap.** A journey against a Vector test installation creates an issue, maps its state change to the roadmap item and shows Penny's demand inside Vector.

#### DELIV-002 — Linear

Core · target · **partial** · Rules D-1

**Requirement.** Extends INT-005 and INT-006: create or link Linear issues and projects; Linear webhooks map workflow states to roadmap states (DELIV-006); Penny keeps a Linear attachment with demand on the issue (DELIV-007); estimates feed PRIO-005.

**Acceptance.** Linear fixtures:
1. Create, link, state mapping, and the attachment updated when votes change.

**Evidence.** `src/core/features/integrations/tracker-service.ts`; `src/core/features/integrations/tracker-receiver.ts`; `tests/browser/integration-states.mjs`
**Gap.** Deliberate create and link, and signed private state receipts, ship today. Linear fixtures: create, link, state mapping, and the attachment updated when votes change.

#### DELIV-003 — Jira Cloud

Core · target · **partial** · Rules D-1 · Register R-8

**Requirement.** DELIV-002's behavior for Jira Cloud issues and epics, plus a Jira issue panel showing linked requests, voters, ARR band and segments, limited by ROLE-001.

**Acceptance.** Jira fixtures:
1. Create, link, status-category mapping, and panel content restricted for a role without commercial permission.

**Evidence.** `src/core/features/integrations/tracker-service.ts`; `tests/browser/integration-states.mjs`
**Gap.** Deliberate create and link, and signed state receipts, ship today. Jira fixtures: create, link, status-category mapping, and panel content restricted for a role without commercial permission.

#### DELIV-004 — GitHub

Core · target · **missing** · Rules D-1

**Requirement.** A GitHub App creates or links issues and follows issue state, merged pull requests that close them and GitHub Projects status fields, mapping them to roadmap states.

**Acceptance.** Signed GitHub webhook fixtures:
1. An issue closed by a merged pull request proposes Shipped.
2. A bad signature is refused.

**Evidence.** None.
**Gap.** Signed GitHub webhook fixtures: an issue closed by a merged pull request proposes Shipped; a bad signature is refused.

#### DELIV-005 — Azure DevOps Services

Core · target · **missing** · Rules D-1

**Requirement.** Create or link Azure DevOps work items and map their states.

**Acceptance.**
1. Azure DevOps fixtures create a work item and map its state change.

**Evidence.** None.
**Gap.** Azure DevOps fixtures create a work item and map its state change.

#### DELIV-006 — Status mapping and close the loop

Core · target · **missing**

**Requirement.** For each connected tracker (DELIV-001–DELIV-005, DELIV-009, DELIV-010) an admin maps tracker states to roadmap states (In Progress to In progress, Done to Shipped). A mapped change updates the roadmap item with a ROAD-001 transition; for an approved item the public status follows (ROAD-003) and a follower update is drafted (ROAD-007). *Policy: `roadmap.auto-update.v1`; default: off.* When the owner turns it on, mapped changes publish their update from a template that carries only approved wording and follows NOTIFY-002. A manual change wins until the next tracker change, and origin marking prevents loops. This supersedes INT-006's "private until an operator chooses" for mapped states only.

**Acceptance.**
1. A Linear fixture Done moves the item to Shipped, the public status to Shipped and creates a draft.
2. With auto-update on, each follower gets one notification and a replayed webhook sends nothing more.

**Evidence.** None.
**Gap.** A Linear fixture Done moves the item to Shipped, the public status to Shipped and creates a draft; with auto-update on, each follower and NOTIFY-008 voter gets one notification and a replayed webhook sends nothing more; the same mapping runs for ClickUp and Asana fixtures (DELIV-009, DELIV-010).

#### DELIV-007 — Demand in the tracker

Core · target · **missing**

**Requirement.** Linked tracker issues show Penny's demand (requests, voters, accounts, ARR band, top segments) with a link back, refreshed as it changes; commercial fields are omitted when the integration's role may not see them.

**Acceptance.**
1. A new vote updates the tracker attachment once.
2. With commercial permission off, no revenue band is sent.

**Evidence.** None.
**Gap.** A new vote updates the tracker attachment once; with commercial permission off, no revenue band is sent.

#### DELIV-008 — Sync health and reconciliation

Core · target · **partial**

**Requirement.** Each tracker connection shows its last event, drift between Penny and tracker state, failures and held effects; operators reconcile ambiguous creates (INT-003) and resync.

**Acceptance.**
1. A drift fixture is shown and resolved by resync.
2. An ambiguous create is reconciled to the known issue without a duplicate.

**Evidence.** `tests/browser/integration-states.mjs`
**Gap.** Held and uncertain tracker commands with known-issue reconciliation ship today. A drift fixture is shown and resolved by resync; an ambiguous create is reconciled to the known issue without a duplicate.

#### DELIV-009 — ClickUp

Core · target · **missing** · Rules D-1

**Requirement.** A ClickUp OAuth app creates or links ClickUp tasks (and lists) from a request, feature or roadmap item on DELIV-002's terms. ClickUp webhooks, verified by their HMAC signature, map task statuses to roadmap states under DELIV-006; Penny keeps demand on the task as a linked custom field and a link back (DELIV-007); sprint points or the time estimate feed effort (PRIO-005).

**Acceptance.**
1. ClickUp API and webhook fixtures create a task from a request, link an existing one and map a status change to Shipped with its ROAD-001 transition and follower draft.
2. The task's demand field updates once when a vote arrives.
3. A bad signature is refused and a replayed webhook changes nothing.

**Evidence.** None.
**Gap.** ClickUp API and webhook fixtures create a task from a request, link an existing one and map a status change to Shipped with its ROAD-001 transition and follower draft; the task's demand field updates once when a vote arrives; a bad signature is refused and a replayed webhook changes nothing.

#### DELIV-010 — Asana

Core · target · **missing** · Rules D-1

**Requirement.** An Asana OAuth app creates or links Asana tasks and projects on DELIV-002's terms. Asana webhooks (established with the X-Hook-Secret handshake and verified by X-Hook-Signature) map completion, sections or a status custom field to roadmap states under DELIV-006; demand appears on the task as a linked custom field and a link back (DELIV-007); estimated time feeds effort (PRIO-005).

**Acceptance.**
1. Asana API and webhook fixtures complete the handshake, create and link a task and map its completion to Shipped with its follower draft.
2. The task's demand field updates once when a vote arrives.
3. A bad signature is refused and a replayed event changes nothing.

**Evidence.** None.
**Gap.** Asana API and webhook fixtures complete the X-Hook-Secret handshake, create and link a task and map its completion to Shipped with its follower draft; the task's demand field updates once when a vote arrives; a bad signature is refused and a replayed event changes nothing.

### Target: Notifications

#### NOTIFY-006 — Operator notifications and digests

Core · target · **partial**

**Requirement.** Each operator chooses, per event (new inbox item on my boards, mention, assignment, aging reminder, decision review due, connector failure, release published, demand threshold reached) and per channel (in-app, email, Slack, Teams, mobile push), immediate or daily or weekly digest. Defaults are quiet: mentions, assignments and review due only. The mention event carries TRIAGE-004's mention notices, whose durable in-app notice stays the default (inherited from TRIAGE-004).

**Acceptance.**
1. A preference-matrix test delivers each event, a TRIAGE-004 mention among them, once on each chosen channel and nowhere else.
2. A digest coalesces a day's events into one message.

**Evidence.** `src/core/features/integrations/destinations.ts`; `tests/base/egress-delivery.test.ts`; `tests/base/penny-decisions.test.ts`
**Gap.** Decision-review mail (NOTIFY-003) and installation-wide Slack and webhook posts of public events ship today. A preference-matrix test delivers each event, a TRIAGE-004 mention among them, once on each chosen channel and nowhere else; a digest coalesces a day's events into one message.

#### NOTIFY-007 — Close the loop through the original channel

Core · target · **missing** · Rules D-2

**Requirement.** When a request linked to a ticket or conversation changes public status or ships, Penny drafts a reply on that Zendesk, Freshdesk, Intercom, Help Scout or HappyToHelp thread (or a note to the CRM owner for sales-captured feedback), ready for the support team to send. Email to requesters still requires NOTIFY-001's consent.

**Acceptance.** Zendesk and Freshdesk fixtures:
1. A shipped request drafts one reply per linked ticket.
2. Nothing is sent until the draft is explicitly sent (D-2).

**Evidence.** None.
**Gap.** Zendesk and Freshdesk fixtures: a shipped request drafts one reply per linked ticket; nothing is sent until it is explicitly sent (D-2).

#### NOTIFY-008 — Vote subscriptions

Core · target · **partial** · Register R-6

**Requirement.** Owners and Admins turn on, per board in settings, "Voting subscribes to updates", which is how Canny closes the loop with voters. On such a board the vote control tells the voter, before they vote, that voting subscribes them to updates on that request and how to stop; the vote then follows the request (REQ-010) and stores a timestamped permission record with its origin (vote), board and setting version, so status updates (REQ-015, ROAD-008), decline (REQ-017) and the release that ships it (REL-004) reach that voter under NOTIFY-001 and NOTIFY-002. Every such email says why it was sent ("You voted for …") and carries the one-click unsubscribe (NOTIFY-002), which withdraws the permission, and the owner's postal address (NOTIFY-014, CAN-SPAM); the setting cannot be turned on until that address is recorded. Removing the vote withdraws a vote-origin permission unless the voter also followed or ticked "Email me updates". Turning the setting off stops new vote subscriptions and keeps existing ones; the owner may also withdraw every vote-origin permission on that board, with a recorded reason. Proxy votes (CAP-014) and historical imported votes never subscribe (MIG-007 is the only import path). The author's subscription on submission is NOTIFY-011. New boards default to on; boards that exist when this ships keep it off until the owner chooses.

**Acceptance.** A base and browser journey:
1. With the setting on, the vote control states the subscription, and a vote creates one permission record with origin vote.
2. A published status update emails that voter once.
3. The email's unsubscribe link withdraws the permission and the next update sends nothing.
4. Removing a vote withdraws its permission while a voter who also followed keeps theirs.
5. With the setting off a vote creates no record.
6. A supporter recorded through CAP-014’s native proxy controls on a vote-subscription board creates no permission record and receives no status-update email unless independently subscribed.

**Evidence.** `tests/base/requester-subscriptions.test.ts`; `visual/requester-subscriptions/NOTIFY-008/`; `tests/base/vote-importance.test.ts`
**Gap.** Disclosed votes create versioned, board-scoped permission; postal admission, stale-disclosure refusal, status delivery/unsubscribe, vote removal, explicit-follow retention, off-setting retention and reasoned bulk withdrawal are implemented. API/provider-fixture and 1440/390 journeys pass. Gap: Admin-role configuration remains unproved; live provider and inbox acceptance is R-6.

#### NOTIFY-009 — Notify captured contacts

Core · target · **missing**

**Requirement.** When an operator publishes a status update (REQ-015, ROAD-008), declines a request (REQ-017) or publishes a release (REL-002), they can tick "Also email people linked through captured evidence", as Canny's "Notify users tracked internally" does. Before sending, Penny shows the count and list of contacts with a deliverable address linked to the request through captured evidence (CAP-001–CAP-022) or a proxy vote (CAP-014). Each receives one message per update version, deduplicated with followers and voters; the message says why it was sent, carries only customer-safe wording (REL-005), one-click unsubscribe and the owner's postal address (NOTIFY-014; the box cannot be ticked until it is recorded). Suppression (REL-011), a mute and any earlier unsubscribe from Penny email are respected, and an unsubscribe here stops every later NOTIFY-009 message to that address. Ticking it creates no permission record: each send is the operator's recorded choice, with its recipient count, in the audit log (ROLE-004). A board's setting can make the box ticked by default; it starts unticked.

**Acceptance.** A base test:
1. With the box ticked, a captured contact linked through Zendesk evidence gets one email, a contact who is also a follower gets one email in total, and a suppressed or previously unsubscribed contact gets none.
2. With the box unticked no captured contact is emailed.
3. Neither case creates a permission record.
4. The audit entry records the choice and the count.

**Evidence.** None.
**Gap.** With "Also email people linked through captured evidence" ticked, a captured contact linked through Zendesk evidence gets one email, a contact who is also a follower gets one in total, and a suppressed or previously unsubscribed contact gets none; unticked, no captured contact is emailed; neither creates a permission record; the audit entry records the choice and the count.

#### NOTIFY-010 — Weekly requester digest

Core · target · **partial** · Register R-6

**Requirement.** The owner can enable a weekly email to requesters who opt in (a "Weekly summary" choice on the activity view, REQ-025, and the updates surface, REL-012) and to voters subscribed under NOTIFY-008: status changes, new public replies and approved comments on the requests they follow or voted for, and releases published that week. A week with nothing for a requester sends nothing. It carries one-click unsubscribe and respects quiet hours, suppression and mutes (NOTIFY-002, REL-011).

**Acceptance.**
1. A clock-advanced test sends one digest per opted-in requester per week containing only their requests' public changes, sends nothing for an empty week, and the unsubscribe link stops the next digest.

**Evidence.** `tests/base/weekly-summary-flow.ts`; `tests/base/notifications.test.ts`; `tests/base/weekly-summary-portability.ts`; `tests/browser/weekly-summary-choice.mjs`; `tests/browser/workspace-clock.mjs`
**Gap.** Mail-edge fixture only: the weekly summary flow, portability and the owner and requester choices are asserted at the mail edge. No hosted mailbox receipt; real-provider mailbox proof for live digest delivery and unsubscribe is R-6.

#### NOTIFY-011 — The author's vote and subscription

Core · target · **partial** · Register R-6

**Requirement.** Submitting a request records the author's vote on it, as Canny makes a post's author its first supporter; the vote counts in the vote total (REQ-006) once the request is published, and the author can remove it like any vote. On a board with vote subscriptions on (NOTIFY-008), submitting also subscribes the author: the submit form on the portal, widget and SDK (REQ-003, WIDGET-001, WIDGET-004) says before submission that they will get updates on their request and how to stop, and submission stores one timestamped permission record with origin `submission`, its board and the setting version. Through it, the publication of their held request (one "Your request is now public" message), public operator replies, approved comments, status updates (REQ-015, REQ-036, ROAD-008), a decline (REQ-017), a rejection notice an operator chooses to send (REQ-030) and the release that ships it (REL-004) reach them under NOTIFY-001 and NOTIFY-002. Every such email says why it was sent ("You posted …") and carries the one-click unsubscribe, which withdraws the permission, and the owner's postal address (NOTIFY-014). Removing the author's vote keeps the submission permission; withdrawing the request (REQ-021) withdraws it; a blocked author (REQ-022) gets nothing. A submission held for email verification (REQ-023) records the vote and the permission only once the address is verified. On a board with the setting off, the author gets updates only by ticking "Email me updates" (REQ-010). Operator-authored requests (REQ-029) and imported posts record no author vote or permission (MIG-007 is the only import path).

**Acceptance.**
1. A base and browser journey on a vote-subscription board: the submit form states the subscription.
2. An author who never ticks Email me updates receives one email for the first public operator reply and one for a status update, and their permission record has origin `submission`.
3. The published request's vote total includes the author's vote once.
4. The unsubscribe link stops the next update.
5. Withdrawing the request withdraws the permission.
6. On a board with the setting off the author receives nothing without ticking, and their vote still counts.

**Evidence.** `tests/base/requester-subscriptions.test.ts`; `visual/requester-subscriptions/NOTIFY-011/`
**Gap.** Verified submissions record the author vote and disclosed submission permission; publication notifies once, replies/status/release/rejection use the durable permission path, removing the vote retains it, and withdrawal/unsubscribe revoke it. Held-verification and board-off cases pass through routes; 1440/390 journeys pass. Gap: a separate SDK disclosure journey remains unproved; live inbox acceptance is R-6.

#### NOTIFY-012 — Merge notice

Core · target · **done**

**Requirement.** When an operator merges a duplicate into a canonical request (REQ-008), each follower, vote-subscribed voter and subscribed author of the duplicate who is not already on the canonical request receives one message saying their request was merged into it, with its public title and link, under NOTIFY-002 and REL-004 eligibility; REQ-008 has already moved them to follow the canonical request. The merge dialog shows the count and lets the operator untick the notice for that merge. A merge into an unpublished or internal-board canonical request notifies nobody until that request is published on a public board. Unmerging (REQ-009) notifies nobody, and automatic merges (AI-003) send the notice only when the owner turns it on for them.

**Acceptance.** A base test:
1. Merging a duplicate with two followers and a vote-subscribed voter, one of whom already follows the canonical request, sends two messages naming and linking the canonical request.
2. With the notice unticked it sends none.
3. Unmerging sends nothing.

**Evidence.** `tests/base/merge-notices.test.ts`; `tests/browser/merge-notices.mjs`
**Gap.** None.

#### NOTIFY-013 — Sender identity

Core · target · **partial** · Cites BASE-MAIL-001 · Register R-6

**Requirement.** Owners and Admins set, in settings, how requester and release email presents the business, as Canny's email whitelabeling does: the sender name (default: the INT-007 company name), the from address on a domain verified with the owner's mail provider (Penny sends a test message to the operator and shows the provider's result before saving, and refuses an address the provider rejects), and an optional monitored reply-to address that is never the CAP-009 capture address (without one, replies go to the no-reply address under NOTIFY-004). Every requester and release email (NOTIFY-001, NOTIFY-008–NOTIFY-012, REL-005, REQ-030's rejection notice) uses the sender name and from address. Operator email (NOTIFY-003, NOTIFY-006) uses the same from address. `MAIL_FROM` supplies the deployment address until a tested sender identity is saved.

**Acceptance.** A base and browser journey:
1. A status email to a follower has the configured sender name and from address.
2. A from address the provider fixture rejects is refused before saving.
3. With a reply-to set, a reply reaches that address and creates no record (NOTIFY-004).
4. An Owner and an Admin each save the sender identity in settings.

**Evidence.** `tests/base/mail-identity.test.ts`; `visual/requester-subscriptions/NOTIFY-013/`; `visual/requester-subscriptions/OPS-005/`
**Gap.** Provider-tested sender acceptance and refusal and configured sender and reply-to headers are implemented; real provider clients use HTTP-edge fixtures, and API and 1440/390 browser proof pass. CAP-009 proves the reciprocal capture-address exclusion through `tests/base/notifications.test.ts`. Gap: Admin-role sender settings remain unproved; live verified-domain, reply and inbox acceptance is R-6.

#### NOTIFY-014 — Postal address and the mail it unlocks

Core · target · **partial** · From NOTIFY-013

**Requirement.** The owner records the business postal address, and every requester and release email carries it in its footer with the one-click unsubscribe, as CAN-SPAM requires. First-run setup (OPS-005) asks for the postal address with the company name and cannot finish without both; an installation set up earlier shows its owner a one-time prompt alongside OPS-008's. Until a postal address is recorded, the paths that email people who did not ask in that moment cannot be turned on or chosen, each refused with the reason: vote subscriptions (NOTIFY-008), author subscriptions (NOTIFY-011), the captured-contact send (NOTIFY-009), the weekly digest (NOTIFY-010) and MIG-007 carry-over; boards created meanwhile start with vote subscriptions off; mail a requester explicitly asked for (a follow, an Email me updates tick, an updates subscription) still sends; and the overview shows the missing address until it is set. Operator email needs no postal address.

**Acceptance.** A base and browser journey:
1. Setup refuses Finish without a postal address, and an installation set up earlier shows the one-time prompt.
2. A status email to a follower carries the postal address in its footer with the one-click unsubscribe.
3. On an installation with no postal address, turning on vote subscriptions, choosing MIG-007 carry-over and ticking NOTIFY-009 are refused with the reason, while a follower's status email still sends.
4. Turning on author subscriptions and the weekly digest is refused with the reason, and boards created meanwhile start with vote subscriptions off.
5. The overview shows the missing address until it is set.

**Evidence.** `tests/base/mail-identity.test.ts`; `visual/requester-subscriptions/NOTIFY-013/`; `visual/requester-subscriptions/OPS-005/`
**Gap.** Company/postal setup and the legacy prompt, the postal footer and automatic-subscription admission are implemented, with API and 1440/390 browser proof. Gap: refusing the unsupported carry-over, captured-contact and digest choices without a postal address remains unproved.

### Measurement and reporting

#### MEAS-001 — Amplitude

Core · target · **missing** · Rules D-1

**Requirement.** Amplitude supplies event and cohort counts for the features linked to roadmap items and releases (MEAS-005), and Amplitude cohorts can become segments.

**Acceptance.**
1. Amplitude API fixtures return a feature's event counts over a window and a cohort that becomes a segment.

**Evidence.** None.
**Gap.** Amplitude API fixtures return a feature's event counts over a window and a cohort that becomes a segment.

#### MEAS-002 — Mixpanel

Core · target · **missing** · Rules D-1

**Requirement.** Mixpanel supplies the same usage counts and cohorts as MEAS-001.

**Acceptance.**
1. Mixpanel API fixtures match MEAS-001's journey.

**Evidence.** None.
**Gap.** Mixpanel API fixtures match MEAS-001's journey.

#### MEAS-003 — PostHog, Segment and Vane

Core · target · **missing** · Rules D-1

**Requirement.** PostHog and Vane, the sibling web-analytics seed (https://github.com/just-every/run-vane), supply the same usage reads; Segment track events can be forwarded to Penny's usage store for features without another analytics tool.

**Acceptance.**
1. PostHog, Vane and Segment fixtures produce the same feature usage counts for a linked roadmap item.

**Evidence.** None.
**Gap.** PostHog, Vane and Segment fixtures produce the same feature usage counts for a linked roadmap item.

#### MEAS-004 — Insight reports

Core · target · **partial**

**Requirement.** Dashboards show feedback volume, votes and evidence over time by source, theme, board, segment and account; top requests by voters, accounts and ARR; new and rising themes; and time to first response and to resolution. Time to first response runs from a request's creation, or an inbox item's capture, to the first operator action its requester can see: a public operator comment, a published status update, or a NOTIFY-007 reply sent on the original thread. Time to resolution runs to the request reaching Shipped or Declined, or to the inbox item being linked to a request or marked reviewed. Both report median and 90th percentile and exclude snoozed time. Each report exports as CSV and can be scheduled to email or Slack.

**Acceptance.**
1. Report totals reconcile with record counts on fixture data.
2. Response and resolution times on a fixture with a public comment, a status update, a snooze and a decline equal the hand-computed median and 90th percentile.
3. A scheduled report sends once per period.

**Evidence.** `src/core/features/releases/outcomes.ts`; `src/core/features/requests/operator-context.ts`
**Gap.** Current per-account counts and release outcome totals ship today. Report totals reconcile with record counts on fixture data; response and resolution times on a fixture with a public comment, a status update, a snooze and a decline equal the hand-computed median and 90th percentile; a scheduled report sends once per period.

#### MEAS-005 — Release adoption

Core · target · **partial**

**Requirement.** For a shipped release target with a declared success measure (DEC-003, LEARN-003), Penny reads usage for the requesting accounts and the comparison cohort over the window and shows adoption against baseline beside the outcome responses (REL-008, REL-009). Missing or partial usage is shown as unknown, never as success.

**Acceptance.**
1. Fixture usage yields adoption with its denominator and baseline.
2. Removing the usage data reports unknown.

**Evidence.** `src/core/features/releases/outcomes.ts`; `tests/base/penny-releases.test.ts`
**Gap.** Outcome responses and coverage ship today. Fixture usage yields adoption with its denominator and baseline; removing the usage data reports unknown.

#### MEAS-006 — Loop health

Core · target · **done**

**Requirement.** The overview tracks how well the team closes the loop: the share of current canonical requests with an owner; median seconds from capture to the first published public comment or status update, including ROAD-008 updates and ignoring held comments; the share of shipped requests with a nonempty recipient snapshot whose recipients all have delivered receipts (provider acceptance alone is insufficient); and the distinct active items with promises at risk from approved public ETAs past due or ROAD-011 slipped blockers. Each figure links through an overview drilldown to the records counted.

**Acceptance.**
1. Fixture records reconcile all four figures and their linked drilldowns, including first-response ordering, held-comment exclusion, ROAD-008 publication, accepted versus delivered receipts, empty snapshots and distinct risk counting.
2. The overview and drilldowns work at 1440 and 390 widths.

**Evidence.** `tests/browser/operator-pages.mjs`; `visual/loop-health/`
**Gap.** None.

### Target: Data

#### DATA-005 — CSV exports

Core · target · **partial**

**Requirement.** Operators export CSV of requests (vote totals and, separately, every individual voter with proxy marks), evidence and notes, features and hierarchy, accounts and requesters with attributes, roadmap items and releases, from any saved view, within their role's field restrictions.

**Acceptance.**
1. A CSV export of fixture data reconciles its vote totals with its individual voter rows and with record counts.

**Evidence.** `src/core/features/data/archive.ts`; `tests/base/hosted-export.test.ts`
**Gap.** The complete JSON archive (DATA-001) remains the full backup and ships today. A CSV export of fixture data reconciles its vote totals with its individual voter rows and with record counts.

#### DATA-006 — Complete API and webhooks

Core · target · **partial**

**Requirement.** The scoped REST API (API-001) covers every operator record type (evidence, requests, votes including proxy votes, comments, notes, accounts, segments, features, decisions, roadmap, releases) with pagination and filters, and signed webhooks fire for each lifecycle event; an OpenAPI document is published under `/docs`.

**Acceptance.**
1. OpenAPI contract tests exercise every resource through the public API.
2. Each webhook's signature verifies and replays are rejected.

**Evidence.** `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts`
**Gap.** Requests, comments, status and releases are covered today, as are proxy-vote customer lookup and recording under `votes:write`; the remaining record types, full pagination/filter coverage and OpenAPI acceptance remain required. OpenAPI contract tests exercise every resource through the public API; each webhook's signature verifies and replays are rejected.

### Migration from each incumbent

#### MIG-001 — Canny

Core · target · **partial** · Rules D-5 · Register R-9

**Requirement.** A live Canny API migration (with the owner's API key) moves every record a Canny customer relies on, each to a named destination, starting with the board structure: boards with their visibility and access settings (REQ-018, REQ-019, WIDGET-006) and their posting, comment, vote-count, voter-list and anonymity settings (REQ-043); categories and subcategories (REQ-034); and tags (EVID-009). The status mapping, the decline reasons and the roadmap rebuild wait in the preview for the owner's approval, and nothing reaches the portal before it. It produces a redirect map (MIG-006), and a delta run during cutover adds only what changed. Historical users never become verified identity or operator authority. MIG-008 to MIG-011 carry the other record kinds on the same terms.

**Acceptance.** A recorded Canny API fixture that contains each kind migrates it into its destination:
1. Records are read live through the Canny API with the owner's API key.
2. Boards land with their visibility and access settings, categories and subcategories as categories, and tags as tags.
3. Nothing reaches the portal before the owner approves the preview.
4. The IMP-007 receipt counts each kind (read, applied, skipped with reasons) and names every field left out.
5. A second run adds only the delta.
6. The migration itself queues zero deliveries, sends no mail and creates no notification.

**Evidence.** `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts`; `tests/base/import-vote-importance.test.ts`
**Gap.** Saved Canny CSV and API-response files import today (IMP-001, IMP-006), including reviewed board participation and display settings (REQ-043), with stale-preview refusal, before/after custody, replay and conflict-safe undo. Remaining: live API acquisition; categories; and the complete-fixture acceptance of the board structure, preview approval, receipt, delta run and zero deliveries.

#### MIG-008 — Canny posts and statuses

Core · target · **partial** · From MIG-001 · Rules D-5

**Requirement.** The Canny migration moves posts with title, details, images, status (the request's direct status, REQ-036, under the mapping the owner approves in the preview; a closed post lands Declined with its last status-change comment as the public reason, or the reason the owner gives in the preview), owner (mapped to an operator the owner chooses), ETA (the request's ETA, REQ-036, public only where Canny showed it publicly and the owner approves) and status-change history (published status updates in the request history, with Canny's dates and comments); custom status names (PRIO-002 internal statuses, each mapped to a public status the owner chooses); and custom post fields (DATA-004 fields on requests, typed as Canny types them).

**Acceptance.** From the recorded Canny API fixture:
1. A post in `planned` and one in `complete` read Planned and Shipped on the portal after the owner approves the preview.
2. A closed post lands Declined with its last status-change comment, or the owner's reason, as the public reason.
3. A custom status lands as an internal status mapped to its public status.
4. A custom post field lands as a request field.
5. Status-change history lands as published status updates with Canny's dates and comments.

**Evidence.** `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts`; `tests/base/import-vote-importance.test.ts`
**Gap.** Saved Canny custom statuses import with owner-approved public mappings (PRIO-002). Remaining: live API acquisition of posts, closed-post decline reasons, ETAs, status-change history and custom post fields, and their complete-fixture acceptance.

#### MIG-009 — Canny votes, comments and merges

Core · target · **partial** · From MIG-001 · Rules D-5

**Requirement.** The Canny migration moves votes with each voter, vote date, `votePriority` (REQ-035) and the teammate who voted on a customer's behalf (a proxy vote, CAP-014); comments with their replies and images (REQ-037), and internal comments as internal notes (REQ-032); and merged posts as merge history (REQ-008).

**Acceptance.** From the recorded Canny API fixture:
1. Each `votePriority` lands as importance.
2. A teammate's vote on a customer's behalf lands as a proxy vote.
3. A reply lands under its comment, with its image.
4. An internal comment lands as an internal note, and a merged post as merge history.

**Evidence.** `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts`; `tests/base/import-vote-importance.test.ts`
**Gap.** Saved Canny votes, comments and merge chains import (IMP-001), with `votePriority` mapped to importance. Remaining: live API acquisition, proxy votes from teammates, reply and image migration, internal comments as notes, and their complete-fixture acceptance.

#### MIG-010 — Canny users, companies, insights and opportunities

Core · target · **missing** · From MIG-001 · Rules D-5

**Requirement.** The Canny migration moves users with their custom fields (DATA-004 requester fields) and companies with MRR, creation date and custom fields (DATA-004 account fields feeding SEG-006); insights and Autopilot captures, each as evidence linked to its post with CAP-002 provenance (the source system, such as Intercom, Zendesk or Gong, its link back, the excerpt, the user and company and its priority); and opportunities linked to posts (SEG-002 opportunity links, in USD).

**Acceptance.** From the recorded Canny API fixture:
1. An insight lands as evidence with its source link and company.
2. User and company fields land as attributes a segment can use.
3. An opportunity lands linked to its post's request, in USD.

**Evidence.** None.
**Gap.** Live API acquisition, insights/Autopilot evidence, custom user and company fields and opportunity links are not built.

#### MIG-011 — Canny subscribers, changelog and roadmap

Core · target · **partial** · From MIG-001 · Rules D-5

**Requirement.** The Canny migration carries post subscribers and changelog subscribers only under MIG-007, and moves changelog entries with labels, types and publish dates (REL-015), each published as it was in Canny with its original date: an entry with linked posts as a release whose request targets (REL-019) are those posts' requests, one without as an announcement (REL-018), and an unpublished Canny draft as a draft, with an empty recipient snapshot and no outcome prompt for imported releases. Canny's public roadmap is rebuilt as a status roadmap (ROAD-014) over the same boards and statuses.

**Acceptance.** From the recorded Canny API fixture:
1. Subscribers land as MIG-007 records when carry-over is selected and as nothing when it is not.
2. A changelog with an unlinked and a linked entry lands both as published with their original dates and labels, the linked one targeting its post's request.
3. Posts in `planned` and `complete` appear in those columns of the rebuilt status roadmap.

**Evidence.** `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts`; `tests/base/import-vote-importance.test.ts`
**Gap.** Saved-Canny status-roadmap reconstruction ships (ROAD-014). Remaining: live API acquisition, subscriber carry-over under MIG-007, and changelog migration with original dates and request targets.

#### MIG-002 — Productboard

Core · target · **missing** · Rules D-5 · Register R-9

**Requirement.** Productboard's API and CSV exports move notes (insights) with their users and companies, features in their product and component hierarchy (PRIO-001) with statuses and custom fields, portal cards with votes and importance (REQ-035), releases, and objectives with their key results and feature links (PRIO-006), plus portal subscribers under MIG-007; every field Penny cannot hold is named in the receipt.

**Acceptance.**
1. Productboard API and CSV fixtures rebuild the hierarchy, keep every note-to-feature link, land objectives with their feature links and importance on each vote, and name each omitted field in the receipt.

**Evidence.** None.
**Gap.** Productboard API and CSV fixtures rebuild the hierarchy, keep every note-to-feature link, land objectives with their feature links (PRIO-006) and importance on each vote (REQ-035), and name each omitted field in the receipt.

#### MIG-003 — Aha! Ideas

Core · target · **missing** · Rules D-5 · Register R-9

**Requirement.** The Aha! API migration moves ideas, categories (REQ-034), statuses (PRIO-002), idea subscribers under MIG-007, votes including proxy votes (CAP-014), comments, idea-portal visibility, scores and the ideas' users and organizations.

**Acceptance.**
1. An Aha!
2. API fixture migrates with proxy votes marked proxy and portal visibility mapped to boards.

**Evidence.** None.
**Gap.** An Aha! API fixture migrates with proxy votes marked proxy and portal visibility mapped to boards.

#### MIG-004 — UserVoice

Core · target · **partial** · Rules D-5 · Register R-9

**Requirement.** Beyond IMP-008's saved CSV exports, the UserVoice API moves suggestions, supporters, comments, status updates, forums, categories (REQ-034), internal notes, labels and suggestion subscribers under MIG-007.

**Acceptance.**
1. A UserVoice API fixture produces the same requests and supporters as IMP-008 for overlapping data and adds the comments and notes.

**Evidence.** `tests/base/feedback-import-uservoice.test.ts`
**Gap.** IMP-008's saved CSV exports ship today. A UserVoice API fixture produces the same requests and supporters as IMP-008 for overlapping data and adds the comments and notes.

#### MIG-005 — Featurebase

Core · target · **missing** · Rules D-5 · Register R-9

**Requirement.** The Featurebase API or CSV migration moves posts, boards, statuses (as direct statuses, REQ-036), upvoters, comments with replies (REQ-037), changelog entries (REL-018, with their original dates) and post and changelog subscribers under MIG-007.

**Acceptance.**
1. A Featurebase fixture migrates with counts reconciling to its receipt.

**Evidence.** None.
**Gap.** A Featurebase fixture migrates with counts reconciling to its receipt.

#### MIG-006 — Cutover kit

Core · target · **partial** · Rules D-5

**Requirement.** Every migration offers a dry run with the IMP-007 receipt, a side-by-side count check, a redirect map from the old portal's post URLs to Penny's request URLs, the widget swap snippet, the owner's choice between subscription carry-over (MIG-007) and a re-consent invitation that only creates permission when a customer accepts it, the vote-subscription and auto-publish settings (NOTIFY-008, REQ-033) set for each imported board to match the source's behavior, and a cutover checklist that shows, before the redirect map goes live, whether the company name, logo and favicon (INT-007), the SSO login URL when the source used SSO (WIDGET-008), and the sender identity and postal address (NOTIFY-013, NOTIFY-014) are set. Reversal follows IMP-004.

**Acceptance.**
1. The dry-run receipt equals the apply receipt.
2. Each imported post URL answers 301 to its request.
3. A re-consent invitation creates a permission record only on the customer's click.
4. The cutover checklist names each unset branding, sign-in and sender item.

**Evidence.** `src/core/features/imports/service.ts`; `tests/base/feedback-import.test.ts`
**Gap.** Preview receipts and safe reversal ship today. The dry-run receipt equals the apply receipt; each imported post URL answers 301 to its request; the owner chooses carry-over (MIG-007) or re-consent, and a re-consent invitation creates a permission record only on the customer's click; imported boards get vote-subscription, auto-publish and participation settings (REQ-040) matching the source; the cutover checklist names each unset branding (INT-007), SSO login (WIDGET-008) and sender (NOTIFY-013) item.

#### MIG-007 — Subscription carry-over

Core · target · **missing** · Rules D-5

**Requirement.** In a migration preview the owner can select carry-over of the subscriptions the source system recorded: Canny post and changelog subscribers, Productboard portal subscribers, Aha! idea subscribers, UserVoice suggestion subscribers (including the Subscribed column of IMP-008's Ideas & Voters export) and Featurebase post and changelog subscribers. Each carried subscription is stored as an imported permission record holding the source system, the source record ID, the subscription date the source supplied, the import job and the owner who selected carry-over; a post subscription follows the mapped request and a changelog subscription becomes an updates subscription (REL-012). It makes that address eligible for request and release email (REL-004) and nothing else: never verified identity, sign-in, a vote, operator authority, a segment or an outreach audience beyond the subscribed request or changelog. Addresses the source marks unsubscribed, bounced or suppressed, and rows without an address, are skipped with their reason. The first Penny email to a carried address says the feedback board has moved and carries one-click unsubscribe; unsubscribe and suppression then work as for any permission (NOTIFY-002, REL-011). The IMP-007 receipt counts carried and skipped subscriptions per kind; undo (IMP-004) removes the records it created, and erasure (DATA-003) deletes them. Without carry-over, MIG-006's re-consent invitation applies and IMP-008's treatment of the Subscribed column is unchanged.

**Acceptance.**
1. A Canny fixture voter subscribed to a post, migrated with carry-over, gets the next status email on the mapped request without re-consent, and the email names the move.
2. A changelog subscriber gets the next release.
3. An unsubscribed source row is skipped with its reason.
4. The receipt counts carried-over and skipped subscriptions.
5. Without carry-over the same voter gets nothing until they accept the re-consent invitation.
6. Undo removes the carried records.

**Evidence.** None.
**Gap.** A Canny fixture voter subscribed to a post, migrated with carry-over, gets the next status email on the mapped request without re-consent and the email names the move; a changelog subscriber gets the next release; an unsubscribed source row is skipped with its reason; the receipt counts carried-over and skipped subscriptions; without carry-over the same voter gets nothing until they accept the re-consent invitation; undo removes the carried records.

### Mobile and accessibility

#### MOB-001 — Phone-width web

Core · target · **done** · Cites BASE-ACCESSIBILITY-001

**Requirement.** Every portal and operator page works at 390 pixels wide with no horizontal scroll and touch-sized controls; every new surface in this contract (inbox, widget, prioritization and roadmap views) joins the same check.

**Acceptance.**
1. Every portal and operator journey runs at 1440 and 390 pixels with axe and layout checks, and each new surface joins them.

**Evidence.** `tests/browser/acceptance-audit.mjs`; `tests/browser/operator-pages.mjs`; `tests/browser/requester-board.mjs`
**Gap.** None.

#### MOB-002 — Installable app and push

Core · target · **missing**

**Requirement.** The operator app is an installable progressive web app with web push for NOTIFY-006 events and a capture form that queues offline.

**Acceptance.**
1. A PWA install check passes.
2. A push fixture delivers once.
3. An offline capture syncs once on reconnect.

**Evidence.** None.
**Gap.** A PWA install check passes; a push fixture delivers once; an offline capture syncs once on reconnect.

#### A11Y-001 — Accessibility

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001 · Register R-1, R-2

**Requirement.** Penny's delta on Base's accessibility bar: it covers the portal, the widget and the operator app, on every journey page at both widths. Penny publishes a VPAT 2.5 (Section 508 edition) for US public-sector and enterprise buyers, stating WCAG 2.1 AA conformance; the VPAT and the human screen-reader review it rests on are register rows.

**Acceptance.**
1. Axe reports no serious or critical violation on every journey page of the portal, the widget and the operator app at both widths.
2. Keyboard-only journeys submit, vote and triage at both widths.

**Evidence.** `tests/browser/acceptance-audit.mjs`
**Gap.** Axe runs on the existing journeys today. Axe on every journey page of the portal, widget and operator app at both widths, and keyboard-only submit, vote and triage journeys, lack passing assertions; the VPAT and the screen-reader review are R-1 and R-2.

### Agents on the bet, not just the backlog

#### AGENT-001 — Competing explanations

Core · push-further · **partial** · Rules D-6

**Requirement.** For a problem the PM selects (a theme, a request or a decision question), an agent keeps at least two rival explanations of why customers ask (a missing capability, an onboarding gap, a plan limit), each with supporting and disconfirming excerpts from tickets, calls, votes, churn reasons and accounts that never asked, updates them as evidence arrives, and names the evidence that would tell them apart. The PM chooses scope and budget and can reject an explanation (kept with its reason, evidence untouched). Adding an explanation to a decision brief is a standard step through the decision tools.

**Acceptance.**
1. A fixture problem with planted disconfirming evidence: both explanations cite real spans, and the planted counter-evidence is surfaced.
2. Rejecting an explanation keeps its evidence and history.

**Evidence.** `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** LEARN-002's competing options and contradictions over selected sources ship today. A fixture problem with planted disconfirming evidence: both explanations cite real spans, the planted counter-evidence is surfaced, and rejecting an explanation keeps its evidence and history.

#### AGENT-002 — Disconfirming evidence search

Core · push-further · **partial** · Rules D-6

**Requirement.** Before a commitment and on its review schedule, an agent searches every connected source in scope for evidence against the leading explanation and the selected bet (customers who churned anyway, workarounds, contrary requests), attaches what it finds as contradicting-evidence proposals on the bet and suggests a review (DEC-007) when contradictions pass the owner's threshold. A proposal is a link that is accepted or rejected through the evidence tools; the search itself changes no decision.

**Acceptance.**
1. With contradicting fixture tickets, proposals attach with spans.
2. Accepting a proposal links it as contradicting (EVID-004).
3. Crossing the threshold raises one review suggestion.

**Evidence.** `src/core/features/learning/run.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** Contradictions within selected sources ship today. With contradicting fixture tickets, proposals attach with spans; accepting links them as contradicting (EVID-004); crossing the threshold raises one review suggestion.

#### AGENT-003 — Next learning action

Core · push-further · **partial** · Rules D-6

**Requirement.** When explanations are close, the agent proposes the cheapest useful learning step (five interviews with a named segment, a two-question in-app poll under CAP-018, a usage query under MEAS, or a Pencil survey) with its expected information, cost and the customers it would contact; it drafts outreach only to consenting contacts, with booking links through Dial, the sibling scheduling seed (https://github.com/just-every/run-dial). Each learning step is a standard call, and each outreach message an external call to known counterparties with its recipients counted; the company's policy decides both.

**Acceptance.**
1. The proposal lists only consenting contacts.
2. Under the held policy, each message waits for approval, and approval sends exactly the approved messages.
3. Poll answers return as evidence linked to the explanation.

**Evidence.** `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** LEARN-002's distinguishing clarification ships today. The proposal lists only consenting contacts; under the held policy approval sends exactly the approved messages; poll answers return as evidence linked to the explanation.

#### AGENT-004 — Quiet and lost segments

Core · push-further · **partial** · Rules D-6

**Requirement.** The agent compares who is asking (votes, ticket volume) with who matters (ARR, renewals due in 90 days, churned accounts, accounts whose usage dropped) and reports the selection bias, such as Enterprise renewals this quarter being absent from votes on reporting, with the accounts concerned and proposed research questions. It reads CRM and usage cohorts only within the grant its sponsor gives it, and any contact is an external call the company's policy decides.

**Acceptance.**
1. A fixture where loud small-business voters differ from silent Enterprise renewals: the report names the gap with cited records.
2. Under the held policy, no contact happens before approval.

**Evidence.** `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts`
**Gap.** Selected Orbit cancellation evidence ships today. A fixture where loud small-business voters differ from silent Enterprise renewals: the report names the gap with cited records and, under the held policy, no contact happens before approval.

#### AGENT-005 — Bet review after release

Core · push-further · **partial** · Rules D-6

**Requirement.** At a committed decision's review date after its release, an agent joins the commitment snapshot (DEC-004, LEARN-003's protocol), delivery receipts (DELIV), the release, cohort adoption (MEAS-005), outcome responses (REL-008) and follow-up feedback, and recommends keeping, changing or reversing the bet with the evidence on each side and its confidence; incomplete data is reported as unknown. Recording the review and any revision (DEC-006) goes through the decision tools.

**Acceptance.**
1. Three fixture outcomes (adopted, shipped but unused, negative follow-up) produce keep, change and reverse recommendations citing their data.
2. Missing usage produces unknown.

**Evidence.** `src/core/features/decisions/reviews.ts`; `tests/base/penny-decisions.test.ts`; `tests/base/learning-stage3.test.ts`
**Gap.** Review-due decisions, measurement protocols and outcome responses ship today. Three fixture outcomes (adopted, shipped but unused, negative follow-up) produce keep, change and reverse recommendations citing their data; missing usage produces unknown.

#### AGENT-006 — Promise keeper

Core · push-further · **partial** · Rules D-6

**Requirement.** The agent watches public replies, status updates, approved ETAs (ROAD-012), roadmap state and delivery changes for promises at risk (an ETA past due, a Planned reply on a dropped item, a ticket told "soon" whose issue slipped) and prepares source-linked corrections for the accountable owner, reminding them until resolved or dismissed with a reason. Publishing a correction or sending it to a customer is an external call the company's policy decides.

**Acceptance.**
1. A fixture slipped issue with a public ETA yields one draft and one owner reminder.
2. Dismissal records its reason.
3. Under the held policy, nothing is published before approval.

**Evidence.** `src/core/features/roadmap/update-drafts.ts`; `tests/browser/operator-pages-status.mjs`
**Gap.** Status-update drafts from approved roadmap moves ship today. A fixture slipped issue with a public ETA yields one draft and one owner reminder; dismissal records its reason; under the held policy nothing is published before approval. The remaining promise-detection kinds (a Planned reply on a dropped item, a ticket told "soon" whose issue slipped) and their corrections and reminders are not built.

#### AGENT-007 — Sales and renewal brief

Core · push-further · **missing** · Rules D-6

**Requirement.** For an open opportunity or upcoming renewal in Salesforce, HubSpot or Orbit, the agent writes an internal brief for the account team: the requests that account and similar accounts raised, their status and approved public wording, the cited evidence, and what may and may not be promised; it refreshes when status changes. Promises still go through publication.

**Acceptance.**
1. A fixture opportunity's brief cites that account's requests.
2. It uses only approved public wording in its suggested customer language.

**Evidence.** None.
**Gap.** A fixture opportunity's brief cites that account's requests and uses only approved public wording in its suggested customer language.

#### AGENT-008 — Weekly product brief

Core · push-further · **partial** · Rules D-6

**Requirement.** On a schedule, an agent sends each subscribed PM a cited brief of their area: rising themes, new high-value requesters, decisions due, promises at risk and connector failures, every line linked to its records, within a per-run budget. Unchanged inputs produce no brief and no model call.

**Acceptance.**
1. A scheduled run over a fixture week produces one brief per subscriber with resolvable citations.
2. An unchanged week produces none and no model call.

**Evidence.** `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts`
**Gap.** Scheduled bounded learning runs ship today. A scheduled run over a fixture week produces one brief per subscriber with resolvable citations; an unchanged week produces none and no model call.

#### AGENT-009 — Agent controls

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-009 · Rules D-6

**Requirement.** Every agent runs under LEARN-004–LEARN-006's controls extended to every source: a named owner, scope (sources, segments, themes), budget, schedule, pause, resume and revoke, an activity log of reads, model calls, cost and proposals in the audit log (ROLE-004), and erasure closure (LEARN-005). Each customer contact, publication, merge, vote or commitment an agent takes is a call with its own class, decided by the company's policy at the Base chokepoint.

**Acceptance.**
1. For each agent, revoking mid-run stops further reads and model calls.
2. Erasure removes its derived work.
3. The audit log shows each action.

**Evidence.** `src/core/features/learning/audit.ts`; `tests/base/learning-stage3.test.ts`
**Gap.** Learning runs meet this today. For each agent, revoking mid-run stops further reads and model calls, erasure removes its derived work, and the audit log shows each action.

## Agent surface

### Agent surface (Base-delivered)

#### BASE-AGENT-001 — One MCP door per seed

Agent surface · target · **partial**

**Requirement.** Every seed, hosted or self-hosted, serves one remote MCP endpoint at `/mcp` over Streamable HTTP. It speaks the current revision (2026-07-28) and accepts 2025-11-25 clients through the twelve-month deprecation window. It implements `server / discover`, tools, resources and prompts. Lists are deterministic and carry `ttlMs` and `cacheScope: "private"`. Roots, Sampling and Logging are not served.

**Acceptance.**
1. `server / discover` returns the supported versions, capabilities, `serverInfo` and instructions.
2. A 2026-07-28 request works with no handshake, and a 2025-11-25 client completes `initialize` and lists the same tools.
3. An unsupported version returns `UnsupportedProtocolVersion`.
4. Two `tools / list` calls return the same order, with cache fields.
5. A foreign Origin returns 403, and a header and body method mismatch returns `HeaderMismatch`.
6. An oversized body returns 413 with no effect.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Tools/policy/pause/audit/idempotency and evidence resources are declared. Both MCP eras use the same registry. Events, prompts and subscriptions remain undeclared.

#### BASE-AGENT-002 — The seed's jobs are tools, through the UI's own actions

Agent surface · target · **partial**

**Requirement.** Each Core job a person does in the product is a tool. Where one is not, the Agent surface says why: it runs on a device, it is a person's interactive screen, it belongs to a connector or the import door, or it is an installation fact. Risk is never the reason: a risky job is a tool with its class (BASE-AGENT-006). Tools are named `<seed>.<area>.<verb>` and declare input and output schemas and truthful annotations. Each calls the same server action as the UI, so validation and authorization are written once, and the seed's embedded agents use the same registry. A business refusal returns `isError` with the seed's stable error code.

**Acceptance.**
1. The Core clause ids in each tool's `_meta`, with the not-a-tool reasons that `server / discover` serves, cover every Core clause in the contract, and no reason is risk; the harness and `rer check` fail on a gap.
2. Each tool's fixture result validates against its `outputSchema`.
3. Read tools declare `readOnlyHint`; tools that can carry destructive declare `destructiveHint`, and tools that can carry external declare `openWorldHint`.
4. A refusal returns the same error code the UI gets for the same action.
5. The UI action and its tool, on the same fixture, give the same record state and the same audit event type.
6. The seed's embedded agents appear in the audit as calls to the same tools.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared tools call real native services. Complete Core clause coverage, all native verbs, UI/REST registry unification and embedded-agent use remain incomplete.

#### BASE-AGENT-003 — Records are resources

Agent surface · target · **partial**

**Requirement.** Each primary record type has a URI template, and tools return `resource_link`s to the records they touch. A read returns exactly the fields the caller's role sees in the UI. File bytes count against any byte budget on the grant. A record the caller cannot open reads as not found, identical to a missing id. Text from customers, imports or files carries an untrusted marker in `_meta`.

**Acceptance.**
1. `resources / templates / list` names every record type in the Agent surface.
2. Reads as two roles return exactly what the UI shows each.
3. An out-of-scope id and a missing id give identical responses.
4. A write's `resource_link` reads back the new state.
5. Bytes over budget return `budget_exhausted` and no partial content.
6. Customer-sourced text carries the untrusted marker.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Evidence capture/update return resource links; evidence:read and current native authority gate the native evidence projection and untrusted wording history (tests/base/penny-evidence.test.ts: captures source provenance (agent-resources.ts readback helper)). Other primary record resources, role-specific projections and byte-budget proof remain incomplete.

#### BASE-AGENT-004 — Business identity and short-lived, audience-bound tokens

Agent surface · target · **partial**

**Requirement.** The door is an OAuth 2.1 resource server. Its RFC 9728 metadata names the authorization servers this installation trusts. That is the paired Business when Business provisioned it, verified with the owner-claim trust the installation already holds for its import door; otherwise it is the seed's own sign-in. Access tokens are RFC 9068 JWTs with `aud` set to the seed's canonical MCP URI, `sub` the sponsoring person, `act` the agent (RFC 8693) with its specialist, scopes per tool family, and a lifetime of 15 minutes or less (5 by default). The policy scopes rules on the sponsor, agent and specialist the token names. The consent behind the tokens can last longer and is revocable. Tokens travel only in the Authorization header, and there is no passthrough.

**Acceptance.**
1. An unauthenticated call returns 401 with `resource_metadata`, and the metadata names the trusted servers and scopes.
2. A Business token for this seed works, and the same token sent to a sibling seed returns 401.
3. An expired token returns 401, and a token with a lifetime over 15 minutes is refused.
4. A read-only token calling a write tool returns 403 `insufficient_scope` with every needed scope in one challenge.
5. A token in a query string is refused and not logged.
6. Revoking consent in the seed or in Business refuses the next call within 60 seconds.
7. After unpairing, Business tokens are refused and the seed's own sign-in still works.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Signed owner lifecycle, durable owner/team mapping, unknown and changed-email refusal, scoped native credentials and consent revocation are proved. Inactive/excluded sponsor fixtures and multi-sponsor lifecycle are undeclared; Penny has no native operator allow-list beyond current membership.

#### BASE-AGENT-005 — An agent acts as a person in a role, never more

Agent surface · target · **partial**

**Requirement.** Every call is authorized as the sponsoring person's current role and access (BASE-ACCESS-004), intersected with the grant's resources, actions and budget. A grant only narrows. No call widens the calling agent's own authority. A call that would widen its own grant or its sponsor's role, or change the company policy or Pause, is refused with `self_escalation`, whatever the policy says; narrowing its own grant is allowed. Other access and security changes are ordinary actions in the access and security classes. An agent never acts after its sponsor is suspended. Anything an agent reads (records, files, emails, imports, other seeds' results) is data and cannot change its scope, its targets or a call's class.

**Acceptance.**
1. For each role fixture, every tool's allow or deny through MCP equals the UI's for the same action.
2. A one-folder, read-only grant holds, and widening through arguments is refused.
3. Downgrading the sponsor changes the next call's result, and suspending the sponsor returns 401.
4. Calls that widen the agent's own grant or its sponsor's role, or change the policy or Pause, return `self_escalation` and change nothing, even under a policy with every class autonomous; dropping a scope from its own grant runs.
5. An injection fixture yields no out-of-grant call and no change of class: record text asking for a wider action, or claiming that a recipient is internal.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Native current membership, narrow original key scopes and private view ownership are enforced. Access/security tool families are undeclared, so real widening/narrowing and self-escalation fixtures are not claimed.

#### BASE-AGENT-006 — Every action declares its risk class

Agent surface · target · **partial**

**Requirement.** Classes come from the fleet list in RISK-POLICY.md: standard, external, money, commitment, accounts, gated, access, security, destructive, sensitive and live. In the registry, each tool declares the classes it can carry and a server-side classifier that decides them per call from the arguments, current records and, for gated, the provider's answer. The classifier also supplies each class's facts: the measure (items, recipients, amount and currency, people or records), the counterparty (internal, known, new or public), the direction for access, the provider and step for gated, and the data kind for sensitive. A classifier never reads a flag, label or claim supplied by the agent or by record text. A seed cannot add a class; it proposes one for the fleet list.

**Acceptance.**
1. Every tool in `tools / list` carries its possible classes in `_meta`, equal to the Agent surface table.
2. For each tool, fixture calls cover every class it can carry, and the computed classes and facts equal the fixture's expected values.
3. An argument or record text asserting a class or a confirmation (`internal: true`, `confirmExternal: true`) leaves the computed classes unchanged.
4. Money calls carry amount and currency, external calls their counterparty and recipient count, access calls their direction, and destructive calls their item count.
5. No tool in `tools / list` declares a class outside the fleet list, and `rer check` fails on one.
6. A refused call's audit row still records its computed classes.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared standard/live tool-class pairs pass native journeys and injection checks. The external/money/commitment/accounts/gated/access/security/destructive/sensitive families are not registered or claimed.

#### BASE-AGENT-007 — The company's policy decides, at one chokepoint

Agent surface · target · **partial**

**Requirement.** Every agent door calls one decision function: MCP, the integration API with agent tokens, and the seed's embedded agents. It evaluates the call's classes against the company's policy, as above. The seed ships no dispositions and fills no gap with one: agent access opens only under a complete policy that setup has asked for (RISK-POLICY.md), and before then every agent call returns `policy_unset` with the setup link and changes nothing. *Autonomous* runs the call. *Review* runs it and adds it to the review feed. *Approval* saves a pending action with server-computed facts and returns `input_required`, with a URL-mode elicitation to the seed's approval page and a pending handle. Each person the rule names approves the exact saved revision in a signed-in browser, and changed inputs need a new approval. The retried call returns the result and a receipt. A rejection returns `approval_rejected`, and a lapse past the wait the rule sets returns `approval_expired`. *Blocked* returns `policy_blocked`, naming the class, rule and revision.

**Acceptance.**
1. The Base harness runs each tool under each disposition for every class it can carry, and sees it run, run and enter the review feed, wait with no effect, or be refused.
2. Before setup is complete, the setup page lists every class the seed's tools carry with examples and no answer pre-selected, an agent call returns `policy_unset` with the setup link and changes nothing, and an incomplete revision cannot be confirmed; a `*` rule completes it, and a tool an upgrade adds with an unanswered class appears in `tools / list` once that class is answered, while the other tools keep running.
3. Under "money autonomous up to $500, approval up to $10,000, blocked above", calls of $400, $600 and $20,000 run, wait and are refused; a per-day cap sends the call that crosses it to the next rule.
4. A call carrying two classes takes the stricter disposition.
5. An approval shows server-computed facts and an expiry, returns the URL elicitation and a handle, and completes once after the named approver approves; a changed input needs a new approval, and a rejection or lapse leaves no effect.
6. The same call through MCP, the integration API and an embedded agent gets the same decision.
7. A policy change applies to the next call within 60 seconds, and the audit cites the new revision.
8. A policy document with a bad signature or another Business's id is rejected, and the door keeps the last valid revision.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** CORE signed policy, held native approval, unset/removed/blocked states and Pause pass normal conformance. Embedded, provider and queued lifecycle families remain unscoped.

#### BASE-AGENT-008 — Truthful attribution

Agent surface · target · **partial**

**Requirement.** Every agent act is recorded and shown as `"<agent> for <person>"`, and mail and messages an agent sends outside name it that way as their sender. An approval, a review mark, a confirmation (a warning dialog, a typed-field confirmation, a delivery confirmation), a decision or a signature attributed to a person comes only from that person's signed-in session. When an agent does the equivalent act, the record names the agent, and the act carries its own class; a binding decision or a signature is commitment. Agent doors ignore arguments that stand for a person's confirmation. No tool solves a bot check, or enters a person's own password or 2FA code at an outside service. A provider step that demands a person goes to a person, whatever the policy says; the gated class marks such steps before they run.

**Acceptance.**
1. An agent call carrying a person-confirmation flag is classified and decided exactly as without it.
2. Approving, marking reviewed or answering a policy question with an agent or device token returns 403 and changes nothing.
3. A form-mode elicitation "accept" never completes an approval.
4. Where an agent's decision, signature or field confirmation runs without a person, it reads `"<agent> for <person>"` in the record, the activity view, exports and any certificate, never as the person's own act.
5. After a person approves an agent's prepared action, the record shows the person as approver and the agent as preparer.
6. Activity and exports at 1440 and 390 show `"<agent> for <person>"` for every agent act.
7. Mail an agent sends to an outside address names `"<agent> for <person>"` as its sender.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared effects retain agent-for-person, sponsor and real approver attribution in door and native audit. Outbound content and native Undo are undeclared.

#### BASE-AGENT-009 — Every agent action is audited with its class and decision

Agent surface · target · **partial**

**Requirement.** Extending BASE-OPS-005, each call that reads private data or changes anything records the agent client, name and specialist, and the run or task id (`traceparent` when sent); the sponsoring person, the grant, the tool and the targets; the classes and their facts, and the policy revision and rule; the decision (autonomous, review, approval, blocked, unset or self_escalation) and the outcome (done, refused, pending or failed); the approval or review id and person, and the idempotency key. For a period, the seed's Agents page shows actions by class and decision with the notable ones, the review feed (Mark reviewed, Flag, and Undo where reversible), pending approvals, steps waiting for a person and setup questions. Business shows the same across seeds.

**Acceptance.**
1. One write leaves a complete audit row.
2. Refused, pending, unset and self-escalation calls are audited.
3. The Agents page's counts by class and decision equal the audit rows on a fixture week.
4. The review feed lists exactly the calls decided as review; Mark reviewed records the person, and Undo restores a reversible one.
5. Filtering by agent or class lists only those rows, and export includes every field.
6. Removing the agent keeps its rows and its name.
7. The Agents page works at 1440 and 390 with no serious or critical axe findings.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared calls, private reads, refusals, policy decisions and replay audit pass with differs_from_policy zero. Embedded-agent, provider and queued audit families remain unscoped.

#### BASE-AGENT-010 — Agents can follow changes

Agent surface · target · **missing**

**Requirement.** The seed emits a typed event for every record change and for every approval, review and policy decision. Each event carries a stable id, a type, the record URI, the actor (a person, or an agent acting for a person) and a time. Events never carry secrets or more than the subscriber may read. Agents can read events three ways: `subscriptions / listen`, an `events.list` tool with a cursor, and signed webhooks from Base `integrations` using the same ids. Every channel delivers at least once and filters by access at delivery.

**Acceptance.**
1. A subscribed record changed in the UI produces a notification within 10 seconds.
2. `events.list` returns the same event id the webhook carries.
3. Replaying from a cursor returns the same ids in order.
4. After access is revoked, no channel delivers events about that record.
5. A failed webhook is visible and replays without duplicate effects.
6. `approval.pending`, `approval.decided`, `review.flagged` and `policy.adopted` carry the class and decision and nothing the subscriber may not read.

**Evidence.** None.
**Gap.** No event, cursor, subscription or signed-webhook implementation is declared for the agent door.

#### BASE-AGENT-011 — Limits are policy, and Pause stops everything

Agent surface · target · **partial**

**Requirement.** Business limits are rules in the company's policy: per-call and per-day thresholds on any class's measure, such as money moved, outside recipients or items destroyed; spend caps on provider cost (models, SMS, email) per seed, specialist or agent, which setup asks with the classes; "no cap" is an answer. Tools with provider cost declare an estimate before they run, and an exhausted cap returns `budget_exhausted` before any partial effect. The seed's capacity limits (request rate, body and byte sizes) protect the installation: they bound rate and size, never daily business volume, are documented and are not policy. A grant carries budgets only when the person granting it sets them. A **Pause agents** control in the seed, and Pause all agents in Business when paired, refuses every agent token within 60 seconds until a person resumes; browser sessions and devices keep working.

**Acceptance.**
1. A rate overrun returns 429 with `Retry-After`.
2. A per-day cap of three outside recipients sends the fourth to the rule that applies past the cap.
3. An exhausted spend cap returns `budget_exhausted` with no partial effect and shows the spend.
4. Under the answer "no cap", a spending call runs and its spend shows in usage; a call that spends nothing is unaffected by any cap.
5. The usage view shows calls, decisions by class, money moved and provider spend per agent.
6. Pause and Pause all agents each stop the next call within 60 seconds, and resume restores access.
7. An agent token cannot resume.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** CORE Business/local Pause and consent revocation pass. Spend is none; no cost is registered. Mail edges, timed/dual-host/queued lifecycle, resource refresh and company spend reservation remain unscoped.

#### BASE-AGENT-012 — Writes are idempotent and conflict-safe

Agent surface · target · **partial**

**Requirement.** Every mutating tool requires an idempotency key and takes an optional expected revision. The same key with the same arguments returns the first outcome for at least 24 hours; the same key with different arguments returns `idempotency_conflict`; a stale revision returns `revision_conflict` with the current revision. Long work returns a job handle and a status tool, with no dependence on the Tasks extension.

**Acceptance.**
1. Two calls with one key give one effect and equal results.
2. A retry with a new JSON-RPC id and the same key, after a dropped stream, returns the recorded outcome.
3. The same key with different arguments returns a conflict and no effect.
4. A stale revision returns a conflict naming the current revision.
5. A job handle used by another person's token reads as not found.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared native write replay, changed-policy/current-scope admission and once-only effect checks pass. Full concurrent/provider/queued lifecycle families remain unscoped; native version guards are retained.

#### BASE-AGENT-013 — Manifest, docs and the conformance journey

Agent surface · target · **partial**

**Requirement.** `server / discover` instructions and an on-site `/docs/agents` page are generated from the action registry. The page lists tools by job, with each tool's classes, the test that adds each computed class, its scopes, resource templates, event types, capacity limits and error codes, and the specialist role. `prompts / list` carries the specialist's jobs. Base ships the conformance journey, a harness that `rer verify` runs against `rer dev` and seeds run in CI. It is an MCP client; a signed-in test person takes a person's steps (setup answers, approvals, review marks, resume) through the URLs the door returns, and the same browser leg runs the UI-parity actions and the page checks at 1440 and 390. It runs every acceptance point of BASE-AGENT-001 to 012 and of the seed's SURFACE clauses under two company policies: *all autonomous* (`*`), and *held* (standard review, every other class the seed declares approval, which the test person grants), plus the single-class variants a point names. A point that names no disposition passes under both.

**Acceptance.**
1. The docs list exactly the names in `tools / list` and `resources / templates / list`.
2. Each tool's classes, and the test behind each computed one, are documented.
3. The harness fails on any of: a tool without a schema; an effect under approval or blocked, or before setup is complete; a computed class that differs from its fixture; a flag that changes a class or completes a person's step; a role-parity mismatch; a wrong-audience token being accepted; a duplicate effect on retry.
4. Every acceptance point runs under both policies, every decision matches the policy in force, and under all autonomous no call waits for a person or is refused by policy.
5. A stranger agent given only the seed URL completes the specialist journey through MCP.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** The declared surface and native journey pass the agent-door conformance harness; docs are generated from that declaration. Other record-resource, event, prompt, subscription and wider specialist-week families remain incomplete.

### Agent surface

#### DATA-007 — MCP server

Agent surface · target · **partial** · Cites BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-004, BASE-AGENT-005

**Requirement.** Penny's delta on the Base agent door: the Model Context Protocol server gives Claude, ChatGPT, Cursor and other MCP clients Penny's search, read and capture tools (search requests and evidence, read the roadmap, add feedback, record a proxy vote), authorized by a scoped key or OAuth and limited to that key's role.

**Acceptance.**
1. An MCP conformance client lists the tools and runs search and capture.
2. A call outside the key's scope is refused.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** The declared MCP subset passes search/capture and scope refusal. Roadmap reads and proxy votes from the wider target remain outside this registry.

#### SURFACE-001 — The registry equals this table

Agent surface · target · **partial** · From new · Cites BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Penny's door serves exactly the tools, resource templates, event types and prompts in this section, generated from one action registry that the operator app, the scoped REST API (API-001), DATA-007's MCP server and Penny's own agents all call. Each tool declares input and output schemas, truthful annotations, the risk classes it can carry and the server-side test that decides them.

**Acceptance.**
1. `tools/list` and `resources/templates/list` return exactly the names in the tool table and the resource list, in a stable order.
2. The Core clause ids in `tools/list` `_meta`, with the reasons `server/discover` serves for what is not a tool, cover every Core clause, and no reason given is risk.
3. Each tool's classes in `_meta` equal its Risk class cell, and each tool's fixture result validates against its output schema.
4. For capture, link, tag, assign, approve, set status and merge, the operator app's action and the tool on the same fixture leave the same record state and the same audit event type.
5. `/docs/agents` lists every tool with its classes, scopes and error codes, and the test that adds each computed class.
6. The Base harness passes on Penny's fixtures in CI under both of its policies, all autonomous and held.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared subset: 27 native tools with schema, scopes and standard/live classes. The wider target table, UI/REST registry unification, embedded jobs and resource family remain incomplete; no risk-based notTools exemptions are claimed.

#### SURFACE-002 — Triage through the door

Agent surface · target · **partial** · From new · Cites BASE-AGENT-003, BASE-AGENT-005, BASE-AGENT-006

**Requirement.** The feedback triager finds, reads and triages through the read tools and the `penny://` resources. Every read returns exactly what the sponsor's current role shows in the operator app, and a record the sponsor cannot open reads exactly like a missing id. Triage calls inside the business are standard.

**Acceptance.**
1. `penny.search` with the request queue's filters returns the same records in the same order as the sponsor's operator search, and none outside the grant.
2. Reads as a role without commercial permission (ROLE-001) return no revenue, opportunity or health value, and as a role with it return them.
3. An out-of-scope id and a missing id return the same not-found result.
4. Capture, link, tag, assign, review, snooze, an internal note and a proxy vote on an unpublished request each compute standard and nothing else.
5. Evidence wording, requester comments and imported posts carry the untrusted marker, and wording that asks for a wider action or claims a recipient is internal changes neither the call nor its class.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Declared internal capture, lexical search/suggestions, review/link/assign, notes and tags are native. Evidence resource readback is implemented; snooze, proxy votes, all queue filters and future commercial-role restrictions are not fully proved.

#### SURFACE-003 — Customer-facing calls are external

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Penny computes external, with its counterparty and recipient count, for every call that makes wording public or reaches a customer, as "How Penny computes each class" states. Mail an agent's call sends names "<agent> for <person>" as its sender.

**Acceptance.**
1. Approving a held request, publishing a status update, posting a public comment, and editing, removing or restoring published wording each compute external with counterparty public.
2. A status change computes external with the recipient count of its followers, vote-subscribed voters, subscribed authors and ticked captured contacts, deduplicated as NOTIFY-001 counts them.
3. Publishing a release computes external with its snapshot recipient count (REL-004); with Notify subscribers unticked it carries counterparty public and no recipients.
4. Moving a request from an internal board to a public one, merging published requests and moving an approved roadmap item compute external; the same calls on internal boards or unapproved items compute standard.
5. Rejecting a held item computes standard without the author notice and external with one known recipient when the notice is ticked.
6. An outreach message (AGENT-003) computes external with counterparty known and its recipient count, and its email names "<agent> for <person>".

**Evidence.** None.
**Gap.** No call computes a risk class today; external calls, their counterparties and recipient counts are not computed.

#### SURFACE-004 — Destructive and sensitive calls

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Penny computes destructive, with its item count, for what it cannot undo, and sensitive, with the data kinds, for redaction over regulated numbers.

**Acceptance.**
1. `penny.published.delete` and `penny.erasure.run` compute destructive with their item counts.
2. Merging two requester identities computes destructive; blocking and unblocking a requester compute standard.
3. Deleting a tag applied to records computes destructive with the number of records it leaves; deleting an unused tag computes standard.
4. `penny.redaction.reapply` computes destructive and sensitive, with the kinds and place counts its preview shows.
5. A refused destructive call's audit row still records its computed classes.

**Evidence.** None.
**Gap.** No call computes a risk class today; destructive and sensitive calls are not declared.

#### SURFACE-005 — Access, security, live and gated calls

Agent surface · target · **partial** · From new · Cites BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Penny computes access with its direction for operators, roles and keys; security for credentials and protective settings; live for settings that change what portal and widget visitors see; and gated for a connector's consent step.

**Acceptance.**
1. Inviting an operator or widening a role computes access (widens); removing an operator or narrowing a role computes access (narrows).
2. Issuing a scoped key computes access (widens) and security; revoking one computes access (narrows) and security.
3. Changing SSO enforcement or the AI data-processing setting computes security; changing board moderation, auto-publish, participation, branding or the SSO-required portal computes live.
4. Connecting a connector computes gated with the provider and its consent step, and its OAuth consent goes to a person in that provider account; disconnecting computes security.
5. Configuring an outbound integration destination computes external and security.
6. A call that widens the calling agent's own key or its sponsor's role returns `self_escalation` and changes nothing, under any policy.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** Public-board creation computes live and its held approval is proved. Access, security, gated connector and the remaining live settings families are undeclared; no self-escalation callback or fixture is invented.

#### SURFACE-006 — Penny's own agents use the same door

Agent surface · target · **missing** · From new · Cites BASE-AGENT-002, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-011

**Requirement.** AGENT-001 to AGENT-009 and AI-006's drafting call the registry's tools and the Base decision function, so an embedded agent and an outside one get the same decision for the same call (D-6). A draft never sends itself (D-2).

**Acceptance.**
1. Each embedded agent's reads and writes appear in the audit as calls to the registry's tools, read as "<agent> for <person>".
2. Under all autonomous, AGENT-003's approved learning step sends its outreach with no person involved; under the held policy it waits for approval and sends exactly the approved messages.
3. AI-006 drafts produce no send; posting the edited wording is a separate `penny.comments.post` call with its own class and decision.
4. Pause agents stops embedded and outside agents alike on their next call within 60 seconds.

**Evidence.** None.
**Gap.** Penny's learning runs and AI drafting call internal services, not a tool registry, and there is no decision function or Pause agents control.

#### SURFACE-007 — The feedback triager's week

Agent surface · target · **partial** · From new · Cites BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-013

**Requirement.** A stranger agent given only the installation's URL runs a seeded week of feedback work through MCP under two company policies: all autonomous, and held. The week triages new inbox items, links duplicates, merges one published pair, sets a request Planned with a comment, publishes a release to the requesters who asked, and erases one requester on request.

**Acceptance.**
1. Before setup is answered, the first call returns `policy_unset` with the setup link, and setup lists every class Penny declares with no answer pre-selected.
2. Under all autonomous, the week completes with no person involved: no call waits for approval, none is refused by policy, and the review feed is empty.
3. Under held, the standard calls run and enter the review feed, and the merge, the status change, the release and the erasure each wait for approval and run once the test person approves.
4. Every call's audit row carries its classes, the rule and the policy revision, and no decision differs from the policy in force.
5. Pause agents stops the agent on its next call within 60 seconds, and resume restores it.

**Evidence.** `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/fixtures.mjs`
**Gap.** The declared internal triage/decision journey passes autonomous and held policies. The wider week including published merge, status, release and erasure remains undeclared.

## Later

### Roles, sign-in and governance

#### ROLE-003 — SCIM provisioning

Later · target · **missing** · Cites BASE-SIGNIN-001 · Register R-15

**Requirement.** SCIM 2.0 Users and Groups endpoints let Okta and Entra create operators, change their role by group membership and deactivate them; deactivation revokes cookies, links, generated functions and keys exactly as OPS-002 removal does.

**Acceptance.**
1. Okta and Entra SCIM request fixtures through the public endpoint create, patch and deactivate a user.
2. The deactivated user's session and API key are refused on their next request, as they are after OPS-002 removal.

**Evidence.** None.
**Gap.** Okta and Entra SCIM request fixtures through the public endpoint create, patch and deactivate a user; the deactivated user's session and API key are refused on their next request, as they are after OPS-002 removal.

### Mobile and accessibility

#### MOB-003 — Native operator apps

Later · target · **missing** · Register R-8

**Requirement.** iOS and Android apps let operators triage the inbox, look up requests and accounts, capture from the share sheet (screenshot, text or link), record voice notes transcribed under CAP-008 and receive push notifications. Store distribution uses the owner's or Run Edit Run's developer accounts.

**Acceptance.**
1. XCTest and Espresso UI tests against a test installation triage an item.
2. A share-sheet capture creates exactly one inbox item.

**Evidence.** None.
**Gap.** XCTest and Espresso UI tests against a test installation triage an item, and a share-sheet capture creates exactly one inbox item.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | A published VPAT 2.5 (Section 508 edition) stating WCAG 2.1 AA conformance for the portal, the widget and the operator app | A11Y-001 | not run | | |
| R-2 | A recorded human screen-reader review of the portal, the widget and the operator app, preceding the VPAT | A11Y-001 | not run | | |
| R-3 | Hosted Cloudflare Email Routing on an owner's domain: a real capture address receives live forwarded mail, and admission sees the `Authentication-Results: mx.cloudflare.net;` header | CAP-009 | not run | | |
| R-4 | Live Google and GitHub requester sign-in with an owner's own OAuth clients: real consent, hosted redirect URIs and provider-console acceptance | REQ-039 | not run | | |
| R-5 | A live Zendesk installation running Penny's sidebar app, linking, capturing and recording proxy votes | CAP-003, CAP-014 | not run | | |
| R-6 | A live verified sender domain at the owner's mail provider: requester mail reaches a hosted mailbox, replies reach the reply-to, and unsubscribe works from the received message | NOTIFY-008, NOTIFY-010, NOTIFY-011, NOTIFY-013 | not run | | |
| R-7 | An owner-run custom hostname serving the portal over TLS through Cloudflare custom hostnames | WIDGET-006, INT-007 | not run | | |
| R-8 | Live public listings after each vendor's review: Zapier and Make directories, Zendesk Marketplace, Slack App Directory, Atlassian Marketplace, Chrome Web Store, App Store and Google Play | CAP-003, CAP-010, CAP-012, CAP-015, DELIV-003, MOB-003 | not run | | |
| R-9 | A tested real owner export from each incumbent (Canny, Productboard, Aha! Ideas, UserVoice, Featurebase), migrated before any replacement claim | IMP-001, IMP-008, MIG-001, MIG-002, MIG-003, MIG-004, MIG-005 | not run | | |
| R-10 | Learning on real provider and model accounts, with customer usefulness and retention, owner attention and hosted recurrence measured | LEARN-006 | not run | | |
| R-11 | Hosted restore and supported-root erasure on a real hosted installation, including latest-journal continuity on a brand-new destination | DATA-001, DATA-003 | not run | | |
| R-12 | A deployed installation with an enforcing egress service delivering webhooks and Slack posts to real destinations | INT-002, INT-007 | not run | | |
| R-13 | Two-person labelling of `themes-v1` with the labelers' agreement recorded | AI-005 | not run | | |
| R-14 | Operator SSO against real Okta, Microsoft Entra ID and Google Workspace tenants | ROLE-002 | not run | | |
| R-15 | SCIM provisioning from real Okta and Entra tenants | ROLE-003 | not run | | |
| R-16 | Hosted Cron execution and inbox delivery for scheduled releases and status updates | REL-014 | not run | | |
| R-17 | The mobile SDKs published as a Swift Package, on Maven Central and on npm | WIDGET-004 | not run | | |
