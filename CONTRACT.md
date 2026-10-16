# CONTRACT.md — Penny

This is Penny's target contract: the product we are building towards, not a description of what exists today. Each clause states the behaviour a buyer gets and its acceptance evidence, and the status table at the end marks it `done` (implemented, with the cited test through a public door), `partial` (some of it ships; the cited file or test shows what) or `missing`. Clauses carried from the first release take their acceptance evidence from the named tests in that table and in `ACCEPTANCE.md`, which lists every clause's evidence and status in its "Target contract acceptance" section. `seed.json`, the product landing and `/docs` describe only what ships; a build round that completes a clause updates them with it. No clause is stubbed green to close an implementation gap.

`docs/read-spine.md`, `docs/native-feedback.md`, `docs/requester-board.md` and [HANDOVER.md](HANDOVER.md) describe the proven and deferred boundaries of the shipped slice. `rer verify` runs the repository's actual structural, source-custody, lint, type, importer, Worker, installer and build checks, not a universal satisfied/overridden/broken clause ledger. Base integration and its proof boundary are recorded in `docs/base-adoption.md`; local proof does not establish hosted mail delivery, and source custody checks do not satisfy runtime or release clauses. Security, privacy, and operational guarantees are in `BASELINE.md`; a clause here may supersede one only by naming its `BASE-` ID and stating the changed requirement and consequences. REQ-011 is the current supersession. Capacity and rate limits are in `seed.json → limits`, whose `status` field says whether they have been load-tested. Response times in clauses are p95 at those limits. Clauses marked *Policy* have a default that buyers may replace through the named extension point. Every connector, model and transcription provider named here sits behind an adapter at the paid or network edge; tests use fixtures only there.

Local running is `rer install`, `setup`, `dev`, then `verify`, `reset`, `export`/`import` and `deploy`, as README.md and OPERATIONS.md describe. Setup claims the first owner, and the owner completes first-run setup at `/setup` (OPS-005).

## Scope

**The product.** Penny is an owned replacement for Canny, Productboard, Aha! Ideas and UserVoice: feedback captured from every channel where customers speak, deduplicated into requests weighted by customer value, accountable prioritization, a public roadmap and changelog, and closing the loop with every requester. It is installed by one US B2B software business on its own Cloudflare account. A buyer of any of the four incumbents can bring its history (MIG), connect the same support, sales, chat, CRM, analytics and delivery systems (CAP, SEG, MEAS, DELIV) and run the same job without losing a request, a vote, a voter, a comment or a promise. Featurebase, Productlane and Enterpret set the newer bar for in-app capture, a combined feedback inbox and AI taxonomy (WIDGET, CAP-001, AI); the Push further clauses go past them.

**The buyer.** A US product team (head of product, product managers, product operations) at a B2B SaaS business whose support team works in Zendesk, Intercom, Help Scout or HappyToHelp, whose sales team works in Salesforce, HubSpot or Orbit with Gong or Fathom on calls, and whose engineers build in Vector, Linear, Jira or GitHub. Revenue is ARR and MRR in USD.

**Scope before (first release, 0.1.1).** Customer boards with verified identities, requests, votes and follows, moderation, merge and undo, private evidence and account context, decision comparison, approved internal and public roadmaps, release publication, consent-aware customer mail, saved Canny and UserVoice imports, export, erasure and self-hosting, plus bounded source-cited learning over selected records.

**Scope after (this contract).** The whole category job:

1. **Capture** from the portal, an in-app widget and mobile SDKs with SSO identify, help desks, call recorders, email, Slack, Teams, a browser extension, CRM record panels and automation platforms, each linked to its original source (CAP, WIDGET).
2. **Organise** into requests with semantic deduplication, auto-linking, adaptive themes and redaction (AI, EVID).
3. **Weigh** by customer value from CRM, billing and product data in dynamic segments (SEG).
4. **Triage and follow up** with owners, aging, reminders, rules and bulk actions (TRIAGE).
5. **Prioritise** in a product hierarchy with transparent formulas and scorecards (PRIO), then **decide** with accountable, evidence-backed commitments (DEC).
6. **Plan and publish** internal and public roadmaps, ETAs and a scheduled, rich changelog with a widget (ROAD, REL).
7. **Deliver** through two-way sync with Vector, Linear, Jira, GitHub and Azure DevOps (DELIV).
8. **Close the loop** with every follower, subscriber and original ticket (NOTIFY, REL).
9. **Measure** adoption and feedback trends with Amplitude, Mixpanel, PostHog, Segment and Vane (MEAS).
10. **Move in and out** from Canny, Productboard, Aha! Ideas, UserVoice and Featurebase, with CSV, API, webhooks and MCP (MIG, IMP, DATA).
11. **Govern** with roles, SSO, SCIM and an audit log (OPS, ROLE), on phones and in native apps (MOB), accessibly (A11Y-001).
12. **Push further** with agents that hold competing explanations, look for disconfirming evidence and check a shipped bet against adoption (AGENT).

**Neighbouring products stay separate.** Penny links to sibling seeds through their public APIs exactly as it links to third-party services, and never rebuilds them: Vector is the issue tracker where work is built (DELIV-001); Orbit is the CRM (SEG-003, CAP-013); HappyToHelp is the help desk (CAP-005); Nook is team chat (CAP-010); Pencil runs general forms and surveys (CAP-018, AGENT-003); Dial books research calls (AGENT-003); Vane is web analytics (MEAS-003); Buoy is customer success (SEG-005); Nectar is subscription billing (SEG-004); Auth is the workforce identity provider (ROLE-002); Crank is workflow automation (CAP-015). Shared code between seeds is welcome; a shared product is not.

The customer-learning work in [FLAGSHIP-PLAN.md](FLAGSHIP-PLAN.md) is now part of this contract: LEARN-001 through LEARN-006 are its shipped, bounded stage, and the AI and AGENT clauses carry it to every connected source under the same controls.

## Landing

- **HOME-001 — Public feedback portal.** *Superseded by HOME-002; the portal's guarantees live under REQ-001.* The public board at `/portal/feedback` identifies the workspace and gives the owner's configured one-line portal description; public feedback, roadmap, and updates follow REQ-001, ROAD-006, and REL-010. It makes no vendor, pricing, testimonial, or metric claims and exposes no operator-only data.
- **HOME-002 — Public product landing.** At `/`, the deployment serves Penny's public product page, rendered on the server as the finished page. It has a header with Penny's coin mark and name and links to the documentation at `/docs`, the public board at `/portal` (which redirects to `/portal/feedback`), the source repository and `/signin`; a hero with the page's one heading, a supporting line and links to `/docs/install` and `/docs`; and sections, each with a decorative paper-collage drawing of Penny's own screens, for the moderated public board, evidence-based decisions, closing the loop with followers, private commercial context, and self-hosted ownership the owner may change with their own agents. A closing call to action repeats the two links, and the footer repeats the navigation. Its copy names only capabilities whose clauses are `done` in the status table at the end of this contract and shows no pricing, testimonials, customer logos, metrics or integrations Penny does not ship; drawn labels use the portal's own status and sort vocabulary. The public board, roadmap and updates remain the portal under `/portal` (REQ-001, ROAD-006, REL-010). The page reads no workspace or operator data, sets no cookie, and loads no resource from another origin: its fonts, styles, script and drawings are served by the deployment itself. Its optional footer credit, "Powered by Penny · runeditrun.com", is visible by default and `showPoweredByCredit` in `src/ext/config.ts` turns it off; the credit is a plain link that adds no telemetry or phone-home. Motion is optional and plays once on load; it never loops, is off under reduced motion, and never hides content: without script, with reduced motion and after motion ends, every section is fully visible.

**Owner decision (12 October 2026): two homepages.** An installed Penny serves its public board at `/` (with its search, status, board and sort parameters and Sign in); `/portal` and `/portal/` redirect to `/`, and `/portal/feedback` serves the same board. The HOME-002 product landing is the separate run site (run-penny.com, built from `src/site`), not a route of an installation. This supersedes HOME-002's `/` mapping and the redirect target below.

**Public board address (HOME-001, REQ-001).** The public feedback board's canonical address is `/portal/feedback`, with its search, status, board and sort parameters, server rendering and reads unchanged; `/portal` and `/portal/` redirect there. Every portal link, breadcrumb, navigation item, the submission page's way back, the sign-in page's way back and the operator's "Open public board" link point to `/portal/feedback`. `/` is the product landing (HOME-002), and no surface depends on `/` being the board; a request to `/` carrying any of the board's old `q`, `status`, `board` or `sort` parameters answers a `302` to `/portal/feedback` with the same query, so board links shared earlier keep working. The portal-home guarantees live at `/portal/feedback` under REQ-001: the board's home identifies the workspace and shows the owner's configured one-line portal description, makes no vendor, pricing, testimonial or metric claims, and exposes no operator-only data (REQ-001 tests: `trust-boundary.test.ts` for the configured description without server configuration, `read-spine.test.ts` for customer-safe projected reads). Security consequences: none beyond the public `/docs` paths that DOCS-001 adds; no data becomes newly public and no protection is relaxed.

## Documentation

- **DOCS-001 — Public documentation.** The public paths `/docs` and `/docs/<slug>` serve Penny's first-party documentation: the Markdown files that `docs/site.json` lists as published, in the sections and order it gives, which is the only navigation. The Markdown is rendered to HTML at build time by a Vite plugin, in a build and in development, and never in the Worker or the browser; each page is its own lazily loaded chunk that the Worker renders per request. A page has its title as its one top-level heading, under the same header as the product landing (HOME-002): Penny's coin mark and name linking to `/`, then links to the docs (marked as the current section), the public board at `/portal`, the source repository and `/signin`, of which a phone keeps the mark, the name and sign-in; the landing's footer repeats them. It has a section menu, an on-this-page list, previous and next links, tables in labelled scrollable regions and an Edit-on-GitHub link; after the page loads, moving between docs pages is client-side navigation. Every Markdown file at the repository root, under `docs/` and as a top-level `<directory>/README.md` is either published or listed in the manifest as GitHub-only with a reason, and an unlisted file fails verification. A broken internal link or anchor, an image outside `docs/media/` or an absolute build-machine path fails the build; raw HTML in the Markdown is shown as text, never rendered. The documentation reads no workspace record, requester or operator identity or session, sets no cookie and loads only same-origin resources. An unknown or nested slug answers a `404` with no article.

**Docs share the landing's header and footer (DOCS-001).** The docs use the landing's header and footer, so `/` and `/docs` read as one site, and the public board link is `/portal` as on the landing. Security consequences: none; the links are to the same public pages and no data or protection changes.

**Documentation site (DOCS-001).** Operators get the install, portal, decision-loop, email, data and customisation guides from the deployment itself rather than from the source repository. Affected IDs: `DOCS-001` and its mirrors in `seed.json` (capability `first-party-docs`, `deploy.publicPaths` and its notes) and `RELEASE.json`. Security consequences: `/docs` and `/docs/` become declared public document paths that serve fixed build-time pages and read no workspace data; no existing protection is relaxed.

## Operators

- **OPS-001 — Roles.** Every operator holds one role. **Owner**: everything, including installation configuration, ownership handover (OPS-002), integrations, export and erasure. **Admin**: all product work plus settings, boards, integrations, automation rules and the roles below Owner. **Product manager**: all product work on evidence, requests, moderation, decisions, roadmap and releases. **Contributor**: the seat for support, sales and success staff, who capture evidence, record proxy votes (CAP-014), comment internally and read product records, but cannot moderate, publish, commit, change settings or see commercial fields unless granted (ROLE-001). **Viewer**: read-only. Contributor and Viewer seats are unlimited. Each role is checked in the business transaction like current authority, and a role change applies to the next request. Operators invited before roles ship become Product managers, which is today's behaviour: every operator equal, with owner-only configuration. *Policy: `operator.roles.v1`; default: the five roles above.*
- **OPS-002 — Management.** Operators are invited and removed in settings. The operator configured at setup can be removed only by themselves. *Policy: `operator.management.v1`; default: any operator may invite or remove any other operator.*
- **OPS-003 — Overview.** The operator home lists decisions that are ready or review due, evidence that is unreviewed, roadmap items that are Planned or In progress, and releases published in the last 30 days with their outcome totals. Every figure links to the records it counts, and a section with no records names what is absent and links to the action that creates one.
- **OPS-005 — First-run setup.** The signed-in owner whose setup is unfinished completes it at `/setup`, and every `/app` document and client-side app navigation sends that owner there first. Finishing it opens the app, and later visits to `/setup` go to the app. A signed-out visitor to `/setup` is sent to sign-in and back, and a signed-in operator who is not the owner is never sent there. Setup completion is installation state recorded once by the owner under the same-origin and authority checks of the business transaction; it is not portable domain data and does not transfer in an archive. An installation that already has an active owner is treated as finished. `rer setup` and the local outbox sign-in return the owner to `/setup` until it is finished.
- **OPS-004 — Global search.** Operators can search request titles and descriptions, evidence wording, decision questions and rationales, roadmap item titles and summaries, release titles and bodies, requester display names and email addresses, and account names. The first page of results returns within 500ms.

## Roles, sign-in and governance

These clauses complete OPS-001's roles for a buyer moving from Productboard's maker/contributor/viewer seats, Canny's admin/manager/contributor teammates or Aha!'s user roles.

- **ROLE-001 — Custom roles and restricted commercial fields.** Admins define custom roles from a fixed permission set (capture evidence and proxy votes, moderate, publish, commit decisions, manage roadmap, manage releases, manage integrations, manage automation, view commercial fields, export, erase) and assign them to operators. Commercial fields (revenue, MRR/ARR, opportunity amounts, health) are hidden from roles without "view commercial fields" in every screen, API response, export, agent answer and notification. *Acceptance:* A base test signs in under a role without commercial permission and reads requests, accounts, prioritisation views, CSV exports and Ask Penny answers through their routes: no revenue, opportunity or health value appears; granting the permission reveals them on the next request; each role change is in the audit log (ROLE-004).

- **ROLE-002 — Operator single sign-on.** Operators sign in with SAML 2.0 or OIDC from Okta, Microsoft Entra ID, Google Workspace or Auth (the sibling identity provider, https://github.com/just-every/run-auth). The owner can enforce SSO for a verified email domain (email links then refuse that domain), provision operators just in time with a default role, and map IdP groups to roles. Today only the optional `IDENTITY_PROVIDER` dependency is declared; sign-in remains email links. *Acceptance:* A browser journey against SAML and OIDC test identity providers at the network edge: a first sign-in creates a Contributor, a group claim maps another user to Admin, an enforced domain refuses an email link, and an IdP-side deactivation ends access at the next session check.

- **ROLE-003 — SCIM provisioning.** SCIM 2.0 Users and Groups endpoints let Okta and Entra create operators, change their role by group membership and deactivate them; deactivation revokes cookies, links, generated functions and keys exactly as OPS-002 removal does. *Acceptance:* Okta and Entra SCIM request fixtures through the public endpoint create, patch and deactivate a user; the deactivated user's session and API key are refused on their next request, as `auth.test.ts` asserts for removal.

- **ROLE-004 — Audit log.** Owners and Admins read, filter (actor, action, subject, date) and export as CSV or JSON an audit log of every privileged action: publication, moderation verdict, merge and unmerge, commitment, role and member change, integration connect and disconnect, automation rule change, export, erasure and every agent action, with the person or agent responsible. Entries contain no customer wording or commercial values and are anonymised on erasure (DATA-003). Durable actor audits are recorded and archived today; there is no audit screen or export. *Acceptance:* Perform each listed action, then read and export the log through the UI and API; erase an operator and see their entries anonymised while the events remain.

- **OPS-006 — Saved views and filters.** Every operator list (inbox, requests, features, evidence, accounts, roadmap, releases) filters on any field, custom field, tag, theme, segment, owner and date, chooses its columns and sort, and saves the result as a private or shared view. *Acceptance:* A browser test saves a filtered, sorted view, then a second operator opens the shared view and gets the same result set; a private view is not listed for them.

## Evidence and accounts

- **EVID-001 — Capture.** Every portal submission creates exactly one evidence item in the same transaction (REQ-003). An operator can also record an evidence item, whose source is one of sales call, support conversation, interview, email, or a free-text label the operator supplies.
- **EVID-002 — Provenance.** Every evidence item stores its source, its original wording, the observed time, and the operator or portal submission that created it. The submitting requester or named speaker and the account are nullable, are set only from what the recorder supplies, and are never inferred.
- **EVID-003 — Review lifecycle.** New evidence is unreviewed. An operator can link it to a request or to a candidate bet in a decision brief (DEC-002), create a request or a decision from it, or mark it reviewed with a reason, and can return any reviewed item to unreviewed. Linking alone does not mark it reviewed.
- **EVID-004 — Non-destructive linking.** One evidence item can be linked to any number of candidate bets, and each link is recorded as supporting or contradicting that bet. Linking, unlinking, tagging, merging a request, and committing a decision never alter or remove an evidence item or any of its versions; only an operator deleting it does.
- **EVID-005 — Account context.** An account has a name, an internal owner, optional commercial fields for revenue, renewal date, and health, its requesters, its evidence in observed-time order, and its linked requests and decisions. Evidence recorded against an account appears on that account, and on every request and decision the same transaction linked it to, when that transaction commits.
- **EVID-006 — Private commercial data.** No field of an account (EVID-005), no evidence source attribution, and no internal note (REQ-032) appears in a portal response, on a public page, in page metadata, in a sitemap, or in the subject or body of a requester notification.
- **EVID-007 — Duplicate suggestions.** When an operator records evidence or a requester types a request title, Penny returns within 500ms up to 5 existing requests ranked by term overlap between the typed title and stored request titles and descriptions, and names the matched terms for each. A requester is shown published requests only. Matching is lexical and deterministic and keeps working when no model is configured; AI-001 adds meaning-based suggestions beside it. Penny never links or merges without an explicit operator or requester action, or an auto-link or auto-merge rule an owner enabled (AI-002, AI-003).
- **EVID-008 — Evidence attachments.** An operator can attach files to an evidence item within the limits in `seed.json` under BASE-INPUT-003. An evidence attachment is readable only by an operator session and is never served from a public path, whatever the publication state of a linked request.
- **EVID-009 — Tags.** Operators create, rename, merge, and delete tags and apply them to evidence items and requests. A tag is operator-only, filterable in every operator list, survives a request merge, and is included in the export.
- **EVID-010 — Versions.** Editing an evidence item's wording writes a new version and leaves every earlier version readable to operators. The item's own ID never changes.

**Observed-time precision (EVID-002, DEC-003, DEC-004).** New operator evidence requires a date and time with an explicit timezone offset or `Z`, with up to nine fractional-second digits. Stored provenance retains the exact accepted string. Evidence order and latest-support snapshots compare UTC whole seconds and the complete fractional part separately; equal instants use evidence ID as a stable tie-break. Snapshot selection stays inside the commitment transaction. Existing stored date-only or timezone-free observations are preserved and retain their UTC interpretation. Browser-local observed-time controls submit the corresponding explicit UTC instant.

## Capture from every channel

Customers rarely visit a feedback board first. These clauses bring their words in from where they speak, so the public board is one input among many. Each connector's credentials are installation custody (never in archives), each runs as accountable background work (TRIAGE-006), and each keeps the source system authoritative (CAP-002).

- **CAP-001 — Feedback inbox.** Every item captured from any channel (portal, widget, connectors, email, Slack, browser extension, API) lands once as unreviewed evidence (EVID-001) in one inbox that shows its source, customer, account, segment attributes, excerpt and suggested links (AI-002). From the inbox an operator links it to a request, creates a request (REQ-029), adds it to a decision, assigns an owner (TRIAGE-001), tags it, snoozes it until a date or marks it reviewed with a reason, by keyboard and in bulk (TRIAGE-005). The inbox filters by source, connector, owner, segment, theme, age and state. Today the unreviewed evidence list does this for portal and manually recorded evidence only. *Acceptance:* A browser journey at 1440 and 390 pixels: items from three connector fixtures arrive, are triaged by keyboard (link, create, dismiss with reason, snooze), each linked request shows the item with its source link, and the overview counts match the inbox.

- **CAP-002 — Source provenance and link-back.** A captured item stores its connector, the source record's ID, a deep link to the original (ticket, conversation, call timestamp, Slack permalink, email message ID or page URL), the verbatim excerpt the operator or rule selected, the author or speaker as the source names them, the capturing person or rule and the source's own time. When the source record changes, the captured version stays and Penny shows that the source changed; when it is deleted or access is revoked at the source, the item is marked source-removed and its excerpt is purged after the owner's policy window. EVID-002 provenance ships today for manually recorded sources without deep links or source sync. *Acceptance:* A connector fixture test captures a record, edits it at the source and deletes it at the source: Penny shows changed and removed states, purges the excerpt at the window, and the deep link opens the original record.

- **CAP-003 — Zendesk.** A Zendesk app in the ticket sidebar lets an agent search requests, link the ticket to one, create a new request, record a proxy vote for the ticket's requester (CAP-014) and see the request's public status without leaving Zendesk. Tickets with a configured tag or in a configured view are captured automatically. The ticket requester and organization map to a Penny requester and account by email and organization ID. When a linked request changes status, the sidebar shows it and offers the drafted reply (NOTIFY-007). *Acceptance:* Zendesk OAuth, API and webhook fixtures at the network edge: install, link, create and proxy-vote from the sidebar; tag-triggered capture creates one item per ticket however often the webhook replays; the status appears in the sidebar; uninstalling revokes and deletes the tokens.

- **CAP-004 — Intercom.** An Intercom Inbox app (Canvas Kit) offers CAP-003's actions inside a conversation; conversations with a configured tag or topic are captured; Intercom contacts and companies map to requesters and accounts with their custom attributes (plan, MRR) feeding segments (SEG-006); NOTIFY-007 replies can go back through the conversation. *Acceptance:* Intercom API and webhook fixtures run CAP-003's journey and show company attributes arriving as private segment attributes.

- **CAP-005 — HappyToHelp.** HappyToHelp, the sibling help desk (https://github.com/just-every/run-happytohelp), gets CAP-003's sidebar, tag capture and close-the-loop replies through its public API. Neither product keeps the other's records beyond the linked excerpt and IDs. *Acceptance:* A journey against a running HappyToHelp test installation links a ticket, captures one by tag and receives the drafted status reply on that ticket.

- **CAP-006 — Help Scout.** A Help Scout sidebar app and tag-based capture with customer and company mapping, on CAP-003's terms. *Acceptance:* Help Scout API fixtures: link, create, tag capture and mapping, each once per conversation.

- **CAP-007 — Gong.** For calls matching configured filters (workspace, tracker, deal stage, participants), Penny reads the transcript and call metadata, and the extraction agent (AI-004) proposes the feature-request moments as inbox items with the verbatim span, speaker, a timestamped deep link and the deal and account Gong associates. Calls outside the filters are never read. *Acceptance:* Gong API fixtures: filtered calls are ingested, proposals carry exact transcript spans and timestamps, accounts map through Gong's CRM association, and the fixture records no request for an out-of-filter call.

- **CAP-008 — Call recorders, recordings and transcripts.** Fathom and Zoom cloud-recording connectors work on CAP-007's terms. An operator can also upload a recording or a VTT, SRT or text transcript; audio is transcribed by the owner-configured transcription provider as a bounded background job with LEARN-006's cost rules. Transcripts are searchable, and a highlighted passage becomes evidence linked to its timestamp. *Acceptance:* A Fathom fixture ingests a call; a VTT upload produces a searchable transcript whose highlight becomes evidence with a timestamp link; an audio upload shows progress, reserved and metered cost, and a visible failure when the provider fails.

- **CAP-009 — Email capture.** Each installation has a dedicated capture address on the owner's domain (Cloudflare Email Routing or the configured mail provider's inbound parse). Operators forward or BCC customer emails to it. Penny accepts only mail from operator addresses or allowlisted domains with DMARC alignment, recovers the original sender from the forwarded message, keeps attachments within `seed.json` limits and creates one inbox item per message ID. Notification reply addresses never reach this route (NOTIFY-004). *Acceptance:* Inbound-mail fixtures: forwarded Gmail and Outlook messages each create one item attributed to the original sender; a replayed message ID, an unaligned sender and a reply to a Penny notification create nothing.

- **CAP-010 — Slack and Nook.** A Slack app adds a "Send to Penny" message shortcut and an emoji-reaction trigger in selected channels, including Slack Connect channels shared with customers. The message and its thread permalink become an inbox item, the Slack user who triggered it is the capturer, and a Slack Connect workspace maps to an account. Nook, the sibling team chat (https://github.com/just-every/run-nook), offers the same actions. Outbound Slack posts are NOTIFY-006 and INT-001. *Acceptance:* Signed Slack Events and Interactivity fixtures: the shortcut and the reaction each capture a message once, a bad signature is refused, and a Slack Connect channel maps to its account; the same capture runs against a Nook test installation.

- **CAP-011 — Microsoft Teams.** A Teams message action captures a message and its link into the inbox; channel notifications follow NOTIFY-006. *Acceptance:* Bot Framework fixtures with token validation capture a message once and refuse an unsigned request.

- **CAP-012 — Browser extension.** A Chrome and Edge extension (Manifest V3), signed in with the operator's Penny session, captures selected text or a screenshot from any page (a CRM record, a review site, a community thread) with its URL, picks the customer and the request, and can record a proxy vote. *Acceptance:* A Playwright extension journey on a fixture page creates an inbox item with the URL, excerpt and screenshot attachment; a signed-out extension is refused.

- **CAP-013 — CRM record panels.** A HubSpot CRM card and a Salesforce Lightning component on contact, company or account and deal or opportunity records show that account's requests and their statuses, and let sales capture feedback or a proxy vote tied to the opportunity (SEG-002). Orbit gets the same panel through its extension point. *Acceptance:* HubSpot and Salesforce fixtures render the panel for a record's company, capture feedback tied to an opportunity amount and attribute a proxy vote to the right customer.

- **CAP-014 — Proxy votes.** An operator records a vote on behalf of a customer (an existing requester, a connector contact, or a new unverified contact) with the source that justifies it. A proxy vote counts once per customer in demand (REQ-026, SEG-007), is marked proxy with who recorded it, collapses with that customer's own later vote, grants no verified identity or email consent (REQ-010), and appears publicly only inside the vote total. Today the proxy mark exists only for supporters imported from UserVoice (IMP-008). *Acceptance:* A base test records proxy votes from the inbox and from a Zendesk sidebar fixture: each counts once, collapses with the customer's own later vote, creates no permission record, and appears in the CSV export with its recorder.

- **CAP-015 — Automation platforms.** Published Zapier and Make apps offer triggers (new request, status change, new evidence, release published) and actions (create evidence, create request, record proxy vote, find request) over the scoped REST API (API-001) and signed webhooks (INT-001); Crank, the sibling automation seed (https://github.com/just-every/run-crank), uses the same surface. Scoped keys and outbound events ship today; no packaged app exists. *Acceptance:* A Zapier CLI test against a running installation fires each trigger once per event and runs each action within its key's scopes; an out-of-scope action is refused.

- **CAP-016 — Connector health.** Each connector shows the connected account, scope, last successful sync, items captured, backlog and its last failure with the reason and a fix (reconnect, grant scope). A connector failing past a threshold notifies the owner once (NOTIFY-006) and appears on the overview. Disconnecting revokes and deletes its tokens and stops capture; captured evidence stays. Delivery and tracker-receipt states are shown today for outbound integrations only. *Acceptance:* A fixture with an expired token and a rate limit shows the connector failing with its reason, notifies the owner once, and after reconnect resumes from its cursor without duplicate items.

- **CAP-017 — Capture scope, minimisation and consent.** Connectors read only the configured scope (channels, tags, views, call filters, record types), store the selected excerpt rather than the whole record unless the operator chooses otherwise, apply redaction (AI-008) before storage, keep any source person nullable and non-authorizing (EVID-002), and never subscribe anyone to email (REQ-010). Purpose-bound selected-record acquisition ships today for Orbit and native records (LEARN-001). *Acceptance:* Connector fixtures assert that no request is made for out-of-scope records, that redaction precedes the write, and that captured people hold no permission record.

- **CAP-018 — Submission forms and polls.** Owners configure the portal and widget submission form per board: custom questions (text, single or multiple choice, number, rating), required and conditional fields, and a short poll attached to a request or a release ("How important is this to you?"). Answers are evidence linked to the request and filterable by segment. General surveys and NPS stay in Pencil, the sibling forms seed (https://github.com/just-every/run-pencil). *Acceptance:* A conditional question renders and validates on the portal and the widget at both widths; poll answers aggregate per request and by segment and stay operator-only.

## In-app widget and customer identity

Featurebase, Canny and Productlane take feedback where the customer is already signed in: inside the product. These clauses bring the portal there.

- **WIDGET-001 — In-app feedback widget.** A JavaScript snippet and npm package embed Penny in the customer's own product as a launcher, modal or side panel: identified users submit, search, vote, comment and follow without leaving the product, and the current page URL and any metadata the host passes are attached as private context. It loads only from the installation's origin, sets no third-party cookie, keeps the portal's moderation and privacy, and takes the host's colours. Allow-listed iframe embedding of the portal (REQ-027) ships today. *Acceptance:* A browser test on a fixture host page at both widths: an identified user submits, votes and follows; the page URL appears only in private evidence; the documented CSP directives suffice; no third-party cookie is set.

- **WIDGET-002 — SSO identify.** The customer's server signs a user token (JWT with HS256 or RS256, or REQ-031's host identity) carrying user ID, email, name, company ID and name, and optional attributes such as plan, role and MRR in USD. The widget and portal accept it without email verification, apply REQ-014's expiry and store the attributes operator-only for segments (SEG-006). REQ-031 host identity ships for the portal today. *Acceptance:* Host-identity tests extended to JWT and to the widget origin: a valid token identifies the user and links the account with private attributes; expired, future-dated and forged tokens are refused and change nothing.

- **WIDGET-003 — Changelog widget and announcements.** The same snippet shows a "What's new" panel with an unread badge of published releases, optional in-app announcements of a release to a segment, and reactions; each entry opens its release. *Acceptance:* A browser test: the unread count falls after viewing; a segment-targeted announcement shows only to matching identified users; an unpublished release never appears.

- **WIDGET-004 — Mobile SDKs.** iOS (Swift Package), Android (Kotlin, Maven Central) and React Native SDKs give the customer's app native feedback, voting and changelog screens with SSO identify, offline queueing of submissions and status-change hooks for the host app's own push. *Acceptance:* SDK sample apps run XCTest and Espresso UI tests against a test installation: identified submit, vote and changelog read, and a queued offline submission sent once on reconnect.

- **WIDGET-005 — Moment capture.** The host product opens a short Penny prompt at a deliberate moment (`penny.capture({moment: 'cancellation'})`: cancellation, downgrade, failed search, feature-flag exit), and the answer becomes evidence tagged with that moment. There is no passive tracking, session replay or keystroke capture. *Acceptance:* A fixture host triggers two moments; their answers arrive as evidence tagged with the moment; the widget sends nothing to Penny until a call is made.

- **WIDGET-006 — Portal domain and audiences.** The owner can serve the portal at a custom domain (such as feedback.example.com through Cloudflare custom hostnames), require SSO identify for the whole portal, and restrict a board to identified users in a segment (an Enterprise beta board) or to employees signed in through ROLE-002. A restricted board never appears to anyone else, in counts, search or the sitemap. Internal boards (REQ-019) remain operator-only. *Acceptance:* A browser test: a segment member sees the restricted board while a non-member and a signed-out visitor get 404 and no count; a custom hostname configured through the deployment path serves the portal over TLS (an owner-run receipt).

## Deduplication, themes and AI organisation

Lexical matching (EVID-007) stays the baseline that always works. These clauses add meaning-based organisation under AI-010's model and cost control. No AI path publishes, votes, notifies a customer or commits a decision.

- **AI-001 — Semantic duplicate detection.** Alongside EVID-007's lexical suggestions, Penny ranks existing requests by meaning (embeddings over titles, descriptions and linked evidence) for a requester typing a title, for each inbox item and for an operator viewing a request, and names the passages that matched. Requesters see published requests only. When the model is unavailable the lexical suggestions still appear. *Acceptance:* A labelled set of at least 200 duplicate and non-duplicate pairs drawn from fixture data reaches the precision and recall recorded in ACCEPTANCE.md; requester suggestions contain only published requests; with the model disabled, lexical suggestions still return within EVID-007's limit.

- **AI-002 — Auto-link suggestions.** Each new inbox item gets up to three suggested requests and one suggested theme, each with a confidence and a reason; the operator accepts or rejects in one action, and a rejected suggestion is not offered again. An owner may enable a rule that links automatically above a confidence threshold for chosen sources; auto-links are marked, reversible, and never publish, vote or notify. *Acceptance:* An inbox journey accepts and rejects suggestions; an auto-link rule on one fixture source links only above its threshold, marks and can undo each link, and changes no public payload.

- **AI-003 — Duplicate sweep and merge proposals.** On demand or weekly, Penny sweeps open requests for likely duplicates and lists merge proposals with a suggested canonical request and the evidence; accepting runs REQ-008's merge. An optional auto-merge rule (*Policy: `request.auto-merge.v1`; default: off*) merges only above its threshold and only within one board, logs each merge, and can be undone by REQ-009. Reversible explicit merge ships today. *Acceptance:* A sweep over a fixture backlog lists proposals; accepting one collapses votes as REQ-008 requires; the auto-merge rule logs each merge and REQ-009 restores it.

- **AI-004 — Request extraction from conversations.** From connected tickets, chats, calls, emails and Slack threads in scope, the extraction agent proposes candidate requests or links: a problem statement, the verbatim spans, the customer and the closest existing request. Proposals wait in the inbox; an owner may let a source create unpublished requests automatically, and REQ-005 still governs publication. Selected Orbit and native evidence produce cited learning options today, not requests. *Acceptance:* Fixture conversations yield proposals whose spans match their source byte for byte; auto-creation produces unpublished requests only; re-running the same conversation creates nothing new.

- **AI-005 — Themes and adaptive taxonomy.** Penny keeps a hierarchical taxonomy (area, theme, sub-theme) over all evidence and requests, classifies new feedback continuously, proposes new themes as volume emerges, and lets operators rename, merge, split, pin or retire themes; operator edits win and reclassification keeps history. Themes filter every list and appear in reports (MEAS-004). *Acceptance:* A fixture corpus gets an initial taxonomy; new feedback is classified in the next run; an operator split reclassifies with history; themes filter the inbox and the request queue.

- **AI-006 — Summaries and reply drafts.** For a request, decision or account, Penny drafts a cited summary of its evidence and discussion; for comments and inbox items it drafts a reply or status-update wording that an operator edits and sends. Drafts never send themselves, and a draft carrying a private value (an account name, revenue, an internal note) is flagged before publication (EVID-006). *Acceptance:* Every citation in a fixture summary resolves to a stored record; a draft containing a private account name is flagged; nothing is sent without the operator's action.

- **AI-007 — Spam and abuse flags.** Portal and widget submissions and comments that look like spam, abuse or exposed personal data are flagged in moderation with a reason. A flag never deletes or publishes anything. *Acceptance:* A fixture spam batch is flagged with reasons and stays in moderation; a false positive is approved normally.

- **AI-008 — Sensitive-data redaction.** Owner-configured rules (US Social Security numbers, payment card numbers, phone numbers, email addresses, credential shapes and custom patterns), with optional model detection, redact captured excerpts and transcripts before storage; redactions are marked, and the unredacted original stays only in the source system. *Acceptance:* A fixture ticket containing an SSN and a card number is stored redacted in D1, search and the archive; a new rule applies to new captures and, on request, re-applies to stored ones.

- **AI-009 — Ask Penny.** Operators ask questions in Penny, Slack or Teams ("What are Enterprise accounts saying about SSO this quarter?") and get an answer that cites the evidence, requests and accounts it used, limited to what the asker's role may see. *Acceptance:* A question over a fixture corpus returns an answer whose every citation resolves; a role without commercial permission receives no revenue figures; a Slack answer posts only where the asker chose.

- **AI-010 — Model configuration and cost.** The owner chooses the model provider and model for each AI capability (default: Claude through the Base AI module), a monthly USD budget and data-processing settings. Every AI run reserves and reports cost as LEARN-006 does; an absent or exhausted model visibly refuses AI work while every non-AI path keeps working. LEARN-006's configuration and cost reservation ship today for learning runs. *Acceptance:* Exhausting a fixture budget refuses new AI runs with a visible reason while lexical suggestions, manual capture and triage keep working; the cost report matches metered fixture usage.

## Customer value and segments

Productboard and Aha! weigh feedback by who asks. These clauses bring revenue and customer attributes from the systems that own them and keep them operator-only (EVID-006, DATA-002).

- **SEG-001 — HubSpot.** An OAuth connection syncs HubSpot companies and contacts (domain, lifecycle stage, owner and configured properties such as ARR, MRR, plan and renewal date) and deals (amount, stage, close date) into Penny accounts and requesters by HubSpot ID and email, through webhooks plus a scheduled refresh. Write-back of a "Penny requests" property and timeline events is off unless the owner enables it. *Acceptance:* HubSpot API fixtures map companies, contacts and deals; a webhook update changes segment membership within the refresh window; nothing is written to HubSpot by default.

- **SEG-002 — Salesforce.** A Salesforce connected app syncs Accounts, Contacts, Opportunities (amount, stage, close date, type) and configured fields; feedback can be tied to an opportunity, so revenue at stake is the sum of open opportunity amounts; an optional Penny Requests related list is written back when enabled. *Acceptance:* Salesforce REST fixtures with sandbox OAuth: mapping, opportunity-linked evidence summing open amounts in USD, and closed-lost opportunities excluded from revenue at stake.

- **SEG-003 — Orbit.** Orbit, the sibling CRM (https://github.com/just-every/run-orbit), syncs accounts, contacts and deals on SEG-001's terms through its public API. Today Penny reads only selected Orbit evidence records for learning (LEARN-001). *Acceptance:* A journey against an Orbit test installation shows Orbit account attributes as Penny segment attributes and Orbit deals in revenue at stake.

- **SEG-004 — Billing revenue.** Stripe Billing, and Nectar, the sibling billing seed (https://github.com/just-every/run-nectar), sync each customer's MRR, plan and subscription status by customer ID or email domain, in USD; a non-USD subscription records its conversion rate and date. *Acceptance:* Stripe API fixtures compute MRR from subscriptions with discounts and several items, flag churned customers and convert a non-USD subscription with its recorded rate.

- **SEG-005 — Product and success attributes.** Segment identify and group traits, and Buoy, the sibling customer-success seed (https://github.com/just-every/run-buoy), supply user and company attributes such as plan, seats, health and last active. *Acceptance:* Signed Segment webhook fixtures set traits that move an account into a segment; a Buoy health change does the same.

- **SEG-006 — Dynamic segments.** Operators save segments as rules over any account or requester attribute (plan is Enterprise and ARR at least $50,000; health at risk; churned in the last 90 days). Membership refreshes as attributes change, and every operator list, prioritisation view, roadmap view, report and agent scope filters by segment. Segments and attributes are operator-only. *Acceptance:* A base test changes an attribute and sees the account enter and leave a segment within the refresh; request, inbox and report filters agree on membership; no segment name or attribute appears in any public payload (DATA-002).

- **SEG-007 — Customer-value demand.** For every request, feature and theme, operators see as separate figures: voters (including proxy votes), accounts, the ARR and MRR of requesting accounts, open opportunity amounts citing it, churned ARR that cited it, and evidence count, each filterable by segment and date range, in USD, counting each account once. Per-account vote breakdown and private account revenue ship today (REQ-026, EVID-005). *Acceptance:* A fixture with several voters from one account counts that account's ARR once; opportunity and churn figures reconcile with fixture CRM data; none of them appears publicly.

## Requests and portal

- **REQ-001 — Public portal.** The portal serves published requests, a request detail page with its discussion, the public roadmap, and published releases. *Policy: `request.visibility.v1`; default: any visitor may read all four without signing in.*
- **REQ-002 — Requester identity.** Submitting, voting, commenting, following, subscribing, and recording an outcome each require either an email address verified under REQ-023 or a host-signed identity under REQ-031. A portal response shows the requester's chosen display name and never their email address or account.
- **REQ-003 — Submission.** A requester submits a title, a problem description, an optional free-text proposed solution, an optional free-text impact statement, a board (REQ-018), and optional attachments. The submission atomically creates one unreviewed evidence item and one request awaiting moderation; the request is not public until an operator publishes it. *Policy: `request.moderation.v1`; default: an operator reviews every requester submission, edit, and comment before it becomes public.*
- **REQ-004 — Duplicate prevention.** Before a requester submits, the portal shows the suggestions from EVID-007 with a vote control and a follow control on each. Choosing one applies that vote or follow and discards the draft, creating no request, evidence item, or moderation item.
- **REQ-005 — Publication.** An operator publishes a moderated request by approving its public title, description, board, requester display name, and each attachment separately (REQ-011). The published record contains only the approved fields.
- **REQ-006 — Voting.** A requester identity has at most one vote on a request and can remove it. The vote total is the count of distinct current voters, and a vote is accepted only while the request's public status is Open, Under review, Planned, or In progress (REQ-016). *Policy: `request.vote-eligibility.v1`; default: any verified requester may vote and every vote counts once.*
- **REQ-007 — Discussion.** Verified requesters and operators can comment on a published request. A requester comment is held under `request.moderation.v1` and becomes public only when an operator approves it; an operator comment is public when posted.
- **REQ-008 — Merge.** An operator can merge a duplicate request into the canonical request, which is the one that survives. The operation atomically moves the duplicate's evidence links, approved attachments, comments, and followers, collapses the combined votes so each identity counts once, keeps the duplicate's title and source as merge history, and answers the duplicate's public URL with a 301 to the canonical request. Merging a request that is itself a duplicate merges it into the canonical request at the end of its chain.
- **REQ-009 — Unmerge.** An operator can reverse a merge. Penny restores the duplicate request's own content, votes, comments, followers, and evidence links, leaves anything added to the canonical request after the merge on the canonical request, and records the reversal.
- **REQ-010 — Follow and consent.** A verified requester can follow and unfollow a published request. Submitting and voting present an unticked "Email me updates" control and grant no email permission on their own. Following, or ticking that control, stores a timestamped permission record for the verified address, which is what makes the identity eligible under REL-004.
- **REQ-011 — Portal attachments.** A file submitted with a request is operator-only until an operator approves that file for publication; rejecting a file records a reason for operators and does not reject the request. While both the parent request and the file are published, `GET /api/public/attachments/:id` serves it with its declared content type and, for the image types in `seed.json → limits.uploadTypes`, an inline disposition so it renders on the request page; **this supersedes BASE-INPUT-003's download disposition for published image attachments only.** In every other state that path returns 404.
- **REQ-012 — Portal search and browse.** Visitors can search published request titles and descriptions, browse one board at a time, filter by public status, and sort by vote total or by most recent public activity, meaning the request's latest published comment, status update, or vote. The first page returns within 500ms, and no result, count, or facet includes an internal board, an unpublished request, or a held comment.
- **REQ-013 — Submission idempotency.** A public submission accepts an idempotency key. Repeating the same submission with that key returns the original request and evidence result and creates no second record of any kind; the same key with a different body returns 409. Keys are retained for 30 days and hold no personal data.
- **REQ-014 — Identity failure.** A host-signed identity is expired when its signed issue time is more than 24 hours old or more than 5 minutes in the future. An identity that is expired, or whose signature does not verify, is rejected for every identity-required action, changes no data, and reveals no account or identity match; the visitor is offered email verification (REQ-023) instead.
- **REQ-015 — Status updates.** An operator can publish a status update on a published request. It is rendered distinctly from comments, can be pinned above them, enters the request history, and notifies followers under NOTIFY-001.
- **REQ-016 — Public status.** A published request has exactly one public status: Open, Under review, Planned, In progress, Shipped, or Declined. A declined request is Declined; otherwise a request with an approved roadmap mapping takes the public status its mapped roadmap item projects under ROAD-003, and a request without one is Open.
- **REQ-017 — Decline.** An operator can decline a published request. A decline without a public reason is rejected. Declining sets the public status to Declined, adds the reason to the request history as a status update (REQ-015), and refuses new votes and requester comments while leaving existing ones visible and counted. Reversing a decline restores the request's previous public status.
- **REQ-018 — Boards.** Every request belongs to exactly one board. Operators create, rename, reorder, and archive boards in settings and can move a request to another board, which keeps its votes, comments, followers, and evidence links. An archived board leaves portal navigation, keeps its published requests reachable at their URLs, and refuses a new submission with 409.
- **REQ-019 — Internal boards.** Each board is public or internal. A request on an internal board never appears in a portal response, on the public roadmap, in a release, or in a requester notification, whatever its own publication state. Moving a request to an internal board withdraws it from the portal within 5 seconds and its public URL returns 404.
- **REQ-020 — Requester's own content.** A requester can edit the title and description of their own request and the text of their own comment. An edit to already-public text re-enters moderation under `request.moderation.v1`, and the previously approved text stays public until the edit is approved or rejected.
- **REQ-021 — Requester withdrawal.** A requester can withdraw their own request. A withdrawn request leaves moderation or the portal, its public URL returns 410, and its votes stop counting. Its evidence item survives under EVID-004, marked withdrawn.
- **REQ-022 — Blocking a requester.** An operator can block a requester identity. A blocked identity's submissions, votes, comments, follows, and outcome responses are refused with 403; their published requests and comments are hidden from the portal but kept for operators; and their votes stop counting toward totals. Unblocking restores all of it.
- **REQ-023 — Email verification.** A requester verifies an email address by following a single-use link sent to it; the link expires 30 minutes after it is sent and fails after one use. The verified session is a browser-local token created at the requester's first interaction and expiring after 30 days without use, so no portal surface sets a cookie. An identity-required action attempted before verification is held for 24 hours, applied on the first verification of that address, and otherwise discarded, and it creates no vote, public record, or notification while held.
- **REQ-024 — Requester identity merge.** An operator can merge two requester identities. The survivor keeps both verified addresses and all requests, comments, follows, permission records, and suppression state; votes for the same request collapse to one; and the merge is recorded. A merge creates no new vote and no new permission record.
- **REQ-025 — Requester activity.** A verified requester can see their own requests with their current moderation state and public status, their votes, their follows, and their own comments including held and rejected ones, and can unfollow, mute, or change their update subscription (REL-012) from that view.
- **REQ-026 — Demand attribution.** For any request, operators can see every current voter's display name, verified address, and linked account, and the vote total broken down by account. The operator view shows the vote total (proxy votes marked, CAP-014), the linked-evidence count, and the distinct-account count as separate figures beside SEG-007's value figures, and combines them into no score; only a prioritisation view an operator builds under PRIO-003 may combine them, with every input shown. None of it appears in a portal response.
- **REQ-027 — Portal embedding.** The portal can be embedded in an iframe on the origins in `publicOriginAllowlist` under BASE-PUBLIC-002; a request to frame it from any other origin is refused.
- **REQ-028 — Request queue.** Operators can list every request, including unpublished ones, filtered by moderation state, board, public status, tag, linked decision, and account, and sorted by vote total, most recent activity, or age. The first page returns within 500ms.
- **REQ-029 — Operator-authored request.** An operator can create a request from one or more evidence items. It skips moderation, records the operator as its author, links the evidence it was created from, and becomes public only through REQ-005.
- **REQ-030 — Moderation verdicts.** An operator can approve, edit and then approve, or reject with a reason any request or comment awaiting moderation. A rejected item never becomes public, counts toward no public total, stays visible with its reason to its author and to operators, and notifies its author only when the operator chooses to. This private author-only notice requires current verified request-specific email consent and respects suppression, mute, unsubscribe and quiet hours; it does not publish the rejected content or create follower notifications.
- **REQ-031 — Host identity claims.** A host-signed identity may assert a display name, an email address, and an account identifier and name. A valid signature marks that address verified without a further challenge and links the requester to the matching or newly created account; any asserted commercial field is stored operator-only under EVID-006.
- **REQ-032 — Internal notes.** Operators can add a note to any request. A note is rendered distinctly from an operator comment and never appears in a portal response, page metadata, a release, or a notification.

## Triage, ownership and follow-up

Small teams drown in incoming requests. These clauses make every item someone's job and keep it moving.

- **TRIAGE-001 — Request owner.** Every request and inbox item can have one accountable owner; boards and themes have a default owner applied on capture; each operator has a queue of the items, requests and requester comments awaiting them. *Acceptance:* A captured item takes its board's default owner; reassignment moves it between queues; a queue lists only the operator's own items.

- **TRIAGE-002 — Aging and reminders.** Untriaged inbox items, unanswered requester comments and requests with no public response past owner-set ages (default 7 days) are flagged on the overview and remind their owner once per age step; snoozed items return on their date. The overview lists unreviewed evidence today, without ages or reminders. *Acceptance:* A clock-advanced test sends one reminder per age step, returns a snoozed item on its date, and the overview's aging counts link to their records.

- **TRIAGE-003 — Automation rules.** Admins define ordered rules: when an item or request matches conditions (source, connector, board, tag, theme, segment, keyword, account attribute), assign an owner, add tags, set the board, link to a request, set a custom field or score input, or post to a Slack or Teams channel. A rule previews its matches before saving, runs once per item and logs each action. Rules cannot publish, vote, notify a customer or commit. *Acceptance:* A rule dry-runs against a fixture inbox, then applies once per item with one audit entry each; the rule editor offers no publication, vote, customer-notification or commitment action.

- **TRIAGE-004 — Mentions and internal discussion.** Internal notes (REQ-032) support @mentions of operators and threaded replies; a mention notifies that operator under NOTIFY-006. *Acceptance:* A mention notifies its operator once; the note and its replies never appear in a public payload.

- **TRIAGE-005 — Bulk actions.** Operators select many inbox items or requests and tag, assign, move board, link, mark reviewed or propose merge in one action, see a summary of what changed and can undo the batch. *Acceptance:* Tagging and assigning 200 fixture items writes one audited batch; undo restores every item.

- **TRIAGE-006 — Accountable background work.** Every automatic action (connector sync, rule, agent run, scheduled publication, delivery sync, reminder) has an accountable owner, a due condition, durable progress, visible failure and an explicit stop or resolved state. A repeated or restarted run never duplicates a customer message, a request or a tracker issue. Learning runs and mail drains meet this today. *Acceptance:* For each worker type, a kill-and-restart test resumes without duplicates and shows the failure state until resolved.

## Prioritisation

These clauses give a Productboard or Aha! buyer their feature hierarchy, formulas and scorecards. A score is a sorting aid that never decides: DEC-003 still compares bets without one.

- **PRIO-001 — Product hierarchy.** Products contain components, components contain features, and requests link to features (many requests to one feature), so demand, value and evidence roll up; roadmap items (ROAD-002) attach to features. The hierarchy is operator-only except through an approved roadmap item. *Acceptance:* A base test rolls three requests from two accounts up to one feature, counting each account once; moving the feature to another component keeps every link.

- **PRIO-002 — Configurable statuses and fields.** Operators define internal request statuses (Needs info, Researching) each mapped to one of REQ-016's six public statuses, and custom fields (DATA-004) on requests, features and accounts. The portal shows only the mapped public status. Custom fields ship today; statuses are fixed. *Acceptance:* A custom status mapped to Under review shows Under review in every public payload and the custom name only to operators.

- **PRIO-003 — Prioritisation views and formulas.** Operators build saved, shareable views of requests or features with columns from demand (SEG-007), custom fields, scorecards (PRIO-004) and effort (PRIO-005), and an optional formula (presets RICE, value over effort, weighted segment demand, or a custom weighted sum) whose inputs and weights are visible on every row. A formula only sorts: it is never stored on a decision and never changes roadmap or public status. This supersedes REQ-026's "combines them into no score" inside these views only. *Acceptance:* A RICE view sorts fixture features with every component visible; changing a weight re-sorts; the decision brief and every public payload show no score.

- **PRIO-004 — Scorecards.** Operators define scorecards (named criteria with 1–5 or 1–10 scales and weights) and score ideas individually; each card shows every scorer's inputs and the weighted result, and rankings from scorecards filter by segment. *Acceptance:* Two operators' inputs are both visible on a card; the weighted rank is computed; changing the criteria keeps earlier scores readable.

- **PRIO-005 — Effort from delivery.** Effort comes from the linked Vector, Linear, Jira or GitHub estimate (points, estimate or size) or a manual field, with its source shown. *Acceptance:* A Linear fixture estimate appears as effort on the linked feature; a manual override is marked as such.

## Decisions

- **DEC-001 — States and queue.** A decision is draft until its brief has a question, an owner, at least one candidate bet, and at least one linked evidence item, at which point it is ready; committing makes it committed, and DEC-007 makes a committed decision review due. The decision queue lists every decision in each state with its owner, last action, review date, and linked-evidence count, and a decision changes row rather than leaving the queue when its state changes.
- **DEC-002 — Brief.** A candidate bet is one named option a decision could commit to, and a bet has at most one internal roadmap item. A decision brief holds a question, an accountable owner, its linked evidence and accounts, its candidate bets with the counter-evidence and assumptions for each, a confidence level of low, medium, or high, a review date, and the requesters currently eligible under REL-004 through its mapped requests.
- **DEC-003 — Comparable bets.** Every candidate bet in a brief shows the same dimensions: affected requesters and accounts, the count and most recent observed time of its supporting evidence, its contradicting evidence, urgency, delivery shape, and an observable success measure. Penny stores and displays no combined score and no automatic ranking of the bets.
- **DEC-004 — Commitment.** Committing requires a selected bet, a rationale, an owner, a confidence level, and a review date, and committing a brief with fewer than two candidate bets additionally requires a recorded reason why no viable alternative exists. The operation records the declined bets and an evidence snapshot made of the evidence IDs, evidence-version IDs, and DEC-003 dimensions as they stood at that moment, without altering the evidence itself. *Policy: `decision.commitment.v1`; default: any operator may commit.*
- **DEC-005 — Commitment effects.** Committing atomically marks the decision committed, creates or updates the selected bet's internal roadmap item as Planned, leaves the declined bets' roadmap items unchanged, and links the decision to that roadmap item. Commitment writes no public field itself; whether the new status reaches the portal is decided entirely by ROAD-004 and ROAD-005.
- **DEC-006 — Revision.** A later change of selected bet or rationale under `decision.commitment.v1` supersedes the prior commitment as a new decision revision, and the original rationale, evidence snapshot, and declined bets stay readable. A revision that changes the selected bet returns the superseded bet's roadmap item to Exploring and, where that item was published, withdraws its approval under ROAD-004 and prepares a status update draft under ROAD-007.
- **DEC-007 — Review due.** A review is complete when an operator records a review note and either a new review date or a revision (DEC-006). A committed decision whose review date has passed in `workspaceTimezone` without a complete review becomes review due within 1 hour and its owner is notified under NOTIFY-003. Becoming review due changes no roadmap status, no public status, and no selected bet.
- **DEC-008 — Outcome evidence.** A requester outcome (REL-008) and any evidence recorded against a linked release appear on the decision as post-release evidence within 60 seconds and do not alter the evidence snapshot that supported the commitment.

**Blank decision questions (DEC-001, DEC-004).** A question containing only ECMAScript whitespace or line terminators is blank. Operator create/edit trims that set; readiness and commitment transaction admission apply the same set to existing records without rewriting historical questions.

## Roadmap

- **ROAD-001 — Internal states.** A roadmap item is Exploring, Planned, In progress, Shipped, or Dropped. A status change records the actor, time, and reason and adds an activity entry to the linked decision without changing that decision's state. Moving backward is allowed and is recorded as a further transition.
- **ROAD-002 — Internal record.** A roadmap item holds its owner, target or release window, linked decision and evidence, account impact, confidence, delivery notes, and its customer-safe title, summary, and status.
- **ROAD-003 — Public projection.** An approved roadmap item's public status follows its internal status within 5 seconds of a transition: Exploring is shown as Under review; Planned, In progress, and Shipped keep their labels; a Dropped item is withdrawn from the public roadmap. The projection exposes only the approved title, summary, board, and public status; account names, revenue, internal dates, confidence, rationale, evidence, declined bets, and delivery notes are never projected.
- **ROAD-004 — Approval is publication.** A roadmap item and each of its request mappings are internal until an operator approves their customer-safe fields, and that approval alone is what puts them on the public roadmap and on the mapped requests. A published request has at most one approved mapping; approving a second is rejected. Withdrawing approval removes the projection from the portal within 5 seconds, makes its public roadmap URL return 404, and deletes no internal record. *Policy: `roadmap.publication.v1`; default: an operator approves every public mapping explicitly.*
- **ROAD-005 — Commitment mapping.** The roadmap item DEC-005 creates or updates is internal unless it already carries an approval under ROAD-004. An already-approved item projects its new Planned status under ROAD-003; an unapproved item and its mappings stay private, and commitment never grants an approval.
- **ROAD-006 — Public roadmap.** The public roadmap groups approved items under Under review, Planned, In progress, and Shipped and links each to its public request or release. It exposes no unapproved item and no count that includes one.
- **ROAD-007 — Status update draft.** Every status change of a roadmap item that carries an approval under ROAD-004, and every request decline under REQ-017, prepares a draft customer-safe update naming the new public status and the problem it addresses. The draft carries no internal rationale, commercial context, declined bet, or outcome prompt, and is invisible on the portal until an operator publishes it.
- **ROAD-008 — Status update publication.** Publishing that draft adds it to the history of every approved mapped request and queues one notification per update version for each requester eligible under REL-004 who follows one of those requests, deduplicated by identity and subject to the coalescing in NOTIFY-002. Republishing the same version queues nothing further.
- **ROAD-009 — Roadmap views.** Internal roadmaps show as a board by status, Now/Next/Later columns or a timeline by month or quarter from target and release windows; views filter by product, component, owner, theme and segment and can be saved and shared with operators. *Acceptance:* A browser journey switches the three views with the same filters and gets the same items; moving an item records a ROAD-001 transition.

- **ROAD-010 — Several and audience roadmaps.** Owners publish more than one public roadmap (by product or audience) and can restrict one to a WIDGET-006 audience; each projects only approved items (ROAD-004). *Acceptance:* Two public roadmaps each show only their own approved items; an audience roadmap answers 404 to non-members.

- **ROAD-011 — Release planning and dependencies.** Operators group roadmap items into planned releases with dates and record dependencies between items (blocks, blocked by); a slipped dependency flags its dependents and any public ETA (ROAD-012). Sprint and capacity planning stay in the delivery tool. Release drafts with roadmap targets ship today; dependencies do not. *Acceptance:* A slipped dependency flags each dependent item and its ETA; the release plan lists its items with their states.

- **ROAD-012 — Public ETA.** An approved roadmap item may show a coarse public ETA (a month or a quarter), approved separately like its other customer-safe fields; changing or removing it prepares a status-update draft (ROAD-007). Internal target dates never appear publicly. *Acceptance:* The ETA appears only after approval; changing it drafts an update; an internal target date is absent from every public payload.

- **ROAD-013 — Roadmap sharing and export.** Operators share a read-only internal roadmap with signed-in Viewers and export a roadmap view as PDF, PNG or CSV for leadership reviews; exports respect role field restrictions (ROLE-001). *Acceptance:* An export contains only fields the exporter's role may see; the shared link refuses a signed-out visitor.

## Releases and outcomes

- **REL-001 — Draft and targets.** A release draft has one or more targets, each linking one roadmap item in any state to its decision and its approved public request mappings. The draft also holds a customer-safe title, a type of New, Improved, or Fixed, one or more subject tags drawn from EVID-009, a body, a publication date, an optional setup or usage link, an author, and the wording of the outcome prompt shown with the REL-008 response.
- **REL-002 — Publication.** An operator can publish a draft only when it has a title, a body, at least one target, and every linked roadmap item at Shipped; publishing with any linked item in another state is rejected. Publication makes one versioned update visible on the portal and durably records the complete recipient snapshot (REL-004) before it queues any delivery.
- **REL-003 — Published wording.** Published release wording is never overwritten. A correction creates a new version, keeps the earlier version readable by operators, and marks which version the portal shows. A correction changes the portal only; sending it to recipients requires an operator to send it as a new delivery version.
- **REL-004 — Recipient eligibility and snapshot.** A recipient is eligible when they hold a verified address and a current permission record, and each eligible identity appears exactly once in the snapshot however many target contexts it has. At publication Penny snapshots every release target and each recipient's linked request or evidence context, and a later merge, relink, or preference change does not alter that snapshot. *Policy: `release.recipient-eligibility.v1`; default: a permission record comes only from following a request (REQ-010) or subscribing to updates (REL-012); voting alone and an operator-entered address grant nothing.*
- **REL-005 — Customer-safe delivery.** Release email and release portal content carry only the published release fields and the recipient's own request context. Recipient lists, other requesters, account context, commercial impact, decision rationale, confidence, and declined bets never appear in either.
- **REL-006 — Acceptance and retry.** Publication queues each eligible delivery within 60 seconds of its permitted send time (NOTIFY-002). A failure returned before provider acceptance is retried up to 5 times with exponential backoff over 1 hour and then marked failed. After acceptance Penny never resends automatically. A result the provider leaves ambiguous is marked unknown, shown to operators, and retried under its delivery key (REL-007); a delivery still unknown after those retries is marked failed for BASE-OPS-004. The published update stays visible on the portal in every failure state.
- **REL-007 — Idempotent delivery and provider events.** Every release version and recipient has one durable delivery key that `mail.sender.v1` passes to the provider as an idempotency key, and the accepted provider message ID is stored against it. `/api/public/mail/events` accepts only signed provider callbacks and deduplicates their event IDs, which are retained for 30 days.
**SendGrid policy decision (REL-006/REL-007):** the selected
SendGrid transport has no provider-side duplicate suppression; its delivery key
is correlation only. Ambiguous or interrupted sends stay unknown and are never
automatically retried. This explicitly supersedes REL-006's ambiguous retry path
for this transport. REL-007's provider-idempotency guarantee remains unsatisfied
for SendGrid; local durable claims do not prove provider exactly-once delivery.
Resend receives each delivery key as its `Idempotency-Key` and suppresses a
duplicate within 24 hours; Penny still never replays an ambiguous send. Signed event
receipts are retained without automatic deletion, consistent with BASE-DATA-002.

- **REL-008 — Outcome response.** A requester in a release's publication snapshot can answer Adopted, Partly adopted, or Not yet for each of its targets, whether or not they have muted or unsubscribed from email. Penny stores one current response per release, requester, and target; changing it records a revision and updates the aggregates without exposing the requester on any public surface. Repeating the same response records no revision.
- **REL-009 — Outcome coverage.** Operators can see, per target and for the whole release, the count of each response and the coverage, meaning current responses divided by snapshot recipients, and can see the individual responses. Each current response links through its snapshotted target and recipient context back to the applicable request or evidence, roadmap item, and decision.
- **REL-010 — Empty feed.** With no release published, the public updates surface states that there are no updates yet and renders no draft, example, or placeholder entry.
- **REL-011 — Bounces and complaints.** A hard bounce or a spam complaint suppresses the address: no further Penny email reaches it until the requester verifies it again, and its permission records are marked suppressed rather than deleted. A soft bounce marks that one delivery failed and suppresses nothing. Suppression removes no vote, request, comment, or portal access.
- **REL-012 — Update subscription.** A verified requester can subscribe to every published release from the public updates surface and unsubscribe there or from any notification's unsubscribe link. Subscribing stores a timestamped permission record for that address; unsubscribing withdraws it without removing votes, requests, or follows.
- **REL-013 — Delivery states.** A delivery moves through queued, then accepted, then delivered, and can terminate at failed, suppressed, or unknown. An out-of-order provider event never moves a delivery backward along that order and never counts a result twice.
- **REL-014 — Scheduled publication.** A release (REL-002) or status update (ROAD-008) can be scheduled for a time in `workspaceTimezone`. At that time Penny checks REL-002's conditions; if they fail, the release stays a draft and its author is notified. *Acceptance:* A clock-advanced test publishes a scheduled release once at its time; a release whose target is no longer Shipped stays draft and notifies its author.

- **REL-015 — Rich changelog.** Release bodies support Markdown with inline images from the release's approved attachments and video embeds from approved hosts, public labels (New, Improved, Fixed and owner-defined labels), and a changelog page filterable by label and product. Raw HTML is shown as text. Release bodies and types ship today. *Acceptance:* An inline image renders from an approved attachment; the label filter returns only matching releases; raw HTML in a body is not rendered.

- **REL-016 — Changelog distribution.** Besides email to subscribers (REL-012), the changelog has RSS and Atom feeds, a segment-targeted email send that reaches only consented recipients in the segment, and the widget (WIDGET-003). Subscriber email ships today. *Acceptance:* The feeds validate and list only published versions; a segment send reaches exactly the intersection of consent and segment.

- **REL-017 — Release notes from delivered work.** When linked delivery work completes (DELIV-006), Penny drafts a release from the shipped requests' approved public wording and the tracker items the operator marks public; the draft waits for approval. *Acceptance:* A Linear fixture completion drafts a release containing only approved wording and marked items.

## Delivery sync

Vector, not Penny, is the issue tracker where work is built (https://github.com/just-every/run-vector). Penny links decisions and roadmap items to that work in whichever tracker the team uses and keeps requesters informed as it moves.

- **DELIV-001 — Vector.** Create or link a Vector issue or project from a request, feature or roadmap item; Vector state changes flow back under DELIV-006; Vector shows the linked demand (DELIV-007); a finished Vector cycle or release can draft a Penny release (REL-017). *Acceptance:* A journey against a Vector test installation creates an issue, maps its state change to the roadmap item and shows Penny's demand inside Vector.

- **DELIV-002 — Linear.** Extends INT-005 and INT-006: create or link Linear issues and projects; Linear webhooks map workflow states to roadmap states (DELIV-006); Penny keeps a Linear attachment with demand on the issue (DELIV-007); estimates feed PRIO-005. Deliberate create and link, and signed private state receipts, ship today. *Acceptance:* Linear fixtures: create, link, state mapping, and the attachment updated when votes change.

- **DELIV-003 — Jira Cloud.** DELIV-002's behaviour for Jira Cloud issues and epics, plus a Jira issue panel showing linked requests, voters, ARR band and segments, limited by ROLE-001. Deliberate create and link, and signed state receipts, ship today. *Acceptance:* Jira fixtures: create, link, status-category mapping, and panel content restricted for a role without commercial permission.

- **DELIV-004 — GitHub.** A GitHub App creates or links issues and follows issue state, merged pull requests that close them and GitHub Projects status fields, mapping them to roadmap states. *Acceptance:* Signed GitHub webhook fixtures: an issue closed by a merged pull request proposes Shipped; a bad signature is refused.

- **DELIV-005 — Azure DevOps Services.** Create or link Azure DevOps work items and map their states. *Acceptance:* Azure DevOps fixtures create a work item and map its state change.

- **DELIV-006 — Status mapping and close the loop.** For each connected tracker an admin maps tracker states to roadmap states (In Progress to In progress, Done to Shipped). A mapped change updates the roadmap item with a ROAD-001 transition; for an approved item the public status follows (ROAD-003) and a follower update is drafted (ROAD-007). *Policy: `roadmap.auto-update.v1`; default: off.* When the owner turns it on, mapped changes publish their update from a template that carries only approved wording and follows NOTIFY-002. A manual change wins until the next tracker change, and origin marking prevents loops. This supersedes INT-006's "private until an operator chooses" for mapped states only. *Acceptance:* A Linear fixture Done moves the item to Shipped, the public status to Shipped and creates a draft; with auto-update on, each follower gets one notification and a replayed webhook sends nothing more.

- **DELIV-007 — Demand in the tracker.** Linked tracker issues show Penny's demand (requests, voters, accounts, ARR band, top segments) with a link back, refreshed as it changes; commercial fields are omitted when the integration's role may not see them. *Acceptance:* A new vote updates the tracker attachment once; with commercial permission off, no revenue band is sent.

- **DELIV-008 — Sync health and reconciliation.** Each tracker connection shows its last event, drift between Penny and tracker state, failures and held effects; operators reconcile ambiguous creates (INT-003) and resync. Held and uncertain tracker commands with known-issue reconciliation ship today. *Acceptance:* A drift fixture is shown and resolved by resync; an ambiguous create is reconciled to the known issue without a duplicate.

## Notifications

- **NOTIFY-001 — Requester updates.** A follower of a published request is notified when an operator publishes a status update on it (REQ-015), declines it (REQ-017), publishes a status update mapped to it (ROAD-008), posts a public reply on it, or approves a requester comment on it (REQ-007), unless they have muted that request or their address is suppressed. Held or rejected comments, unpublished requests, internal boards, internal notes, and an internal roadmap transition with no published update notify nobody, and republishing the same update version notifies nobody again.
- **NOTIFY-002 — Preferences, timing, and unsubscribe.** A notification's permitted send time is the first moment after it is queued at which the requester's preferences and the quiet hours below allow it. Every requester notification carries a one-click unsubscribe link that works without signing in, and a requester can mute one request or all requester email; the preference is checked immediately before each send and removes no vote, evidence, or portal access. *Policy: `requester.notification.v1`; default: hold requester email from 20:00 inclusive to 08:00 exclusive in `workspaceTimezone`, and coalesce updates for the same requester and request in a fixed 1-minute window starting with the first pending event into one message, with later events never extending that boundary. Publication enqueues a Queue wakeup; its consumer sends eligible windows after that boundary and quiet hours. A minute Cron is the backstop for a missed Queue handoff, with the same durable delivery claims.*
- **NOTIFY-003 — Decision review.** A decision owner receives one email and one in-app notification, which stays in their notification list until dismissed, the first time a decision becomes review due. Operator email carries no quiet hours and queues within 60 seconds of the decision becoming review due. No repeat is sent until the review date changes or the operator completes the review and schedules another.
- **NOTIFY-004 — No mail loops.** Notifications are sent from a no-reply address. A reply to any notification creates no evidence item, comment, request, or other record. The only inbound-mail route is CAP-009's dedicated capture address, which accepts mail only from operators and allowlisted senders and never from Penny's own notification addresses.
- **NOTIFY-005 — Notification failure.** Requester status-update email and operator decision-review email each use a durable recipient-and-event key and retry, suppress, and expose failure exactly as REL-006, REL-011, and REL-013 describe. The in-app or portal record of the same event stays available when the email fails.
- **NOTIFY-006 — Operator notifications and digests.** Each operator chooses, per event (new inbox item on my boards, mention, assignment, aging reminder, decision review due, connector failure, release published, demand threshold reached) and per channel (in-app, email, Slack, Teams, mobile push), immediate or daily or weekly digest. Defaults are quiet: mentions, assignments and review due only. Decision-review mail (NOTIFY-003) and installation-wide Slack and webhook posts of public events ship today. *Acceptance:* A preference-matrix test delivers each event once on each chosen channel and nowhere else; a digest coalesces a day's events into one message.

- **NOTIFY-007 — Close the loop through the original channel.** When a request linked to a ticket or conversation changes public status or ships, Penny drafts a reply on that Zendesk, Intercom, Help Scout or HappyToHelp thread (or a note to the CRM owner for sales-captured feedback) for the agent to send. Email to requesters still requires NOTIFY-001's consent. *Acceptance:* A Zendesk fixture: a shipped request drafts one reply per linked ticket; nothing is sent until an agent sends it.

## Measurement and reporting

- **MEAS-001 — Amplitude.** Amplitude supplies event and cohort counts for the features linked to roadmap items and releases (MEAS-005), and Amplitude cohorts can become segments. *Acceptance:* Amplitude API fixtures return a feature's event counts over a window and a cohort that becomes a segment.

- **MEAS-002 — Mixpanel.** Mixpanel supplies the same usage counts and cohorts as MEAS-001. *Acceptance:* Mixpanel API fixtures match MEAS-001's journey.

- **MEAS-003 — PostHog, Segment and Vane.** PostHog and Vane, the sibling web-analytics seed (https://github.com/just-every/run-vane), supply the same usage reads; Segment track events can be forwarded to Penny's usage store for features without another analytics tool. *Acceptance:* PostHog, Vane and Segment fixtures produce the same feature usage counts for a linked roadmap item.

- **MEAS-004 — Insight reports.** Dashboards show feedback volume, votes and evidence over time by source, theme, board, segment and account; top requests by voters, accounts and ARR; new and rising themes; and time to first response and to resolution. Each report exports as CSV and can be scheduled to email or Slack. Current per-account counts and release outcome totals ship today. *Acceptance:* Report totals reconcile with record counts on fixture data; a scheduled report sends once per period.

- **MEAS-005 — Release adoption.** For a shipped release target with a declared success measure (DEC-003, LEARN-003), Penny reads usage for the requesting accounts and the comparison cohort over the window and shows adoption against baseline beside the outcome responses (REL-008, REL-009). Missing or partial usage is shown as unknown, never as success. Outcome responses and coverage ship today. *Acceptance:* Fixture usage yields adoption with its denominator and baseline; removing the usage data reports unknown.

- **MEAS-006 — Loop health.** The overview tracks how well the team closes the loop: share of requests with an owner, median time to first public response, share of shipped requests whose followers were notified, and promises at risk (AGENT-006). *Acceptance:* Each figure matches a count over fixture records and links to them.

## Data

- **DATA-001 — Export contents.** The export contains every durable record as JSON, including every operator, requester, identity merge, account, board, tag, request, moderation decision and reason, merge history, vote, comment, note, follower, block, evidence item and version, decision and revision, roadmap item and transition, release, release version and target, delivery with its key and provider message ID, outcome and revision, subscription, suppressed address, notification and preference, custom field, and audit entry, plus every attachment as its original file.
- **DATA-002 — Public/private boundary.** No operator-only field name and no operator-only value appears anywhere in a public response payload, including in fields the portal does not render.
- **DATA-003 — Erasure outranks history.** Where a clause here says a record is preserved, versioned, immutable, or never overwritten, erasure under BASE-DATA-003 takes precedence: the record is deleted or anonymised and the surviving audit entry keeps an anonymised reference. Unmerging (REQ-009) and revision history never recreate erased data.
- **DATA-004 — Custom fields.** Operators define custom fields in settings on each entity listed in `seed.json → customFields`, and can read and edit their values wherever that entity is shown. A custom field is operator-only and is never projected to a public surface.
- **DATA-005 — CSV exports.** Operators export CSV of requests (vote totals and, separately, every individual voter with proxy marks), evidence and notes, features and hierarchy, accounts and requesters with attributes, roadmap items and releases, from any saved view, within their role's field restrictions. The complete JSON archive (DATA-001) remains the full backup and ships today. *Acceptance:* A CSV export of fixture data reconciles its vote totals with its individual voter rows and with record counts.

- **DATA-006 — Complete API and webhooks.** The scoped REST API (API-001) covers every operator record type (evidence, requests, votes including proxy votes, comments, notes, accounts, segments, features, decisions, roadmap, releases) with pagination and filters, and signed webhooks fire for each lifecycle event; an OpenAPI document is published under `/docs`. Requests, comments, status and releases are covered today. *Acceptance:* OpenAPI contract tests exercise every resource through the public API; each webhook's signature verifies and replays are rejected.

- **DATA-007 — MCP server.** A Model Context Protocol server gives Claude, ChatGPT, Cursor and other MCP clients search, read and capture tools (search requests and evidence, read the roadmap, add feedback, record a proxy vote), authorised by a scoped key or OAuth and limited to that key's role. *Acceptance:* An MCP conformance client lists the tools and runs search and capture; a call outside the key's scope is refused.

**First-release operation profile (11 October 2026).** EVID-005 recording can explicitly select account, request and candidate-bet links in the same transaction, and optional release attribution connects post-release evidence under DEC-008. EVID-010 wording edits require the current version identity and append a version. EVID-008 attachment originals and all operator versions remain private even when a linked request is published. DATA-003 still outranks these histories.

REL-003 corrections retain the original publication's recipient and target snapshot. The portal marks the current wording version, while operators read earlier versions and explicitly request one new delivery command for a corrected version. REL-008 answers retain one release/requester/target identity across corrections and native identity merges without rewriting the publication snapshot; changing an answer appends a revision. The default outcome question is “Have you adopted this update?” REL-009 coverage is current responses divided by original snapshot recipients. The whole-release numerator counts responses across all targets, so it can exceed the recipient count; the UI shows both numbers and does not cap the ratio. With no recipients, counts and coverage are zero. REL-012 subscription permission is address-bound and timestamped. Unsubscribing on Updates or through any notification's global unsubscribe link withdraws that permission without removing follows, votes or requests. The separate “Mute this request” link changes only that request's mute.

Date-only DEC-007 review dates expire after that calendar date in `workspaceTimezone`; timestamps require an explicit timezone and expire at their instant. A minute Cron marks decisions due and queues the one NOTIFY-003 owner reminder without requester quiet hours. Completing a review requires a note plus a new date or revision; a review revision that retains the date completes that schedule without scheduling a repeat reminder. Changing the date starts another schedule. Dismissing its in-app notification alone is not a review.

Hosted restore and supported-root erasure expose the authenticated API and CLI, with current native operator and exact same-origin mutation admission plus the existing maintenance, empty-target, latest-journal and preview-hash fences. Hosted Data screens show operation state and exact commands and provide no destructive button. Verification of this source path is source-only, local TLS. Real hosted acceptance remains an owner/live action; latest-journal continuity on a brand-new destination is still an owner obligation.

## Scoped cancellation learning

This bounded source capability reopens only source-cited interpretation and selected-record acquisition from the non-goals below. It does not complete a live pilot or authorize Stages 4–5.

- **LEARN-001 — Permitted originals.** Equal native operators select native evidence/requests and exact Orbit `rer-delegation/1` evidence targets with a recorded purpose/use basis and all-operator authorization. The deployment pins the source installation and permitted source principals. The adapter only reads selected targets; original text, source revision, supplied record time and retrieval time remain separate. Requester/account links come only from native records; Orbit identity remains source-local and nullable. Model output cannot set identity or grants.
- **LEARN-002 — Contestable learning.** A configured model prepares an evidence comparison, exact validated spans, contradictions, uncertainty, a distinguishing clarification when evidence is thin, and a usable internal implementation brief. Every option has the DEC-003 dimensions computed from originals, including a materially different no-build/process/support/onboarding option. Native/source corrections invalidate current derived work; operator contests are versioned. There is no automatic ranking, customer contact or publication.
- **LEARN-003 — Accountable pre-action choice.** An operator selects an option, rationale, confidence and review date. The immutable snapshot retains the exact interpretation, original evidence, comparable selected/declined options and owner, plus the predeclared cohort, denominator, baseline, window, measure, data source, comparison, limits, stop rule and budget. Missing protocol fields are explicit nulls and prevent commitment. Commitment is a decision record, not execution or an observed customer outcome.
- **LEARN-004 — Bounded recurring work.** Scheduled Worker events refresh selected sources and advance the authorized evidence comparison/internal brief. Every run has a durable event/claim, source revision cursor and budget reservation; unchanged inputs produce no new artifact/card/model call. Source, purpose, native authority, expiry, budget, correction version and erasure epoch are checked before external work and in the result transaction. No implicit contact, production or publication effect exists. Pause one/all, resume within a valid grant, revoke and disconnect are native operator controls. Interrupted/ambiguous calls retain visible uncertainty and reserved budget rather than automatic retries.
- **LEARN-005 — Privacy closure.** Person/native contribution erasure deletes dependent interpretations, corrections, commitment snapshots and provenance copies. Same-source external-person erasure covers duplicate connections. Stable provider/installation/event and person hashes fence replay even under a fresh local source connection. Source revocation purges copies and derived work; in-flight results cannot survive a changed scope or erasure epoch. Archives carry this history and opaque fences, never credentials; restored sources/grants remain held and running claims become uncertain. DATA-003 erasure precedence remains operative.
- **LEARN-006 — Configuration and proof boundary.** Absent source, model or enforcing RPC transport visibly refuses work. Installation-controlled configuration declares a model, token prices/output bound and source read cost; the run reserves its ceiling before work, refunds known unused cost and separates metered cost from uncertain reservations. Local paid/network-edge fixtures establish software behavior only. Actual provider/model accounts, customer usefulness/retention, owner attention, hosted recurrence and Stage 4–5 delivery/outcome integrations remain unproven.

## Saved feedback history

- **IMP-001 — Saved records.** A current native operator previews saved feedback boards, posts/status, individual votes/comments, explicitly supplied merge chains (saved post API mergeHistory with complete posts, or owner relationship sidecars) and private tags. Every mapped request receives one exact-provenance evidence item. Historical contributors have a non-authorizing provenance representation; imports cannot grant verified identity, consent, authority, an outreach audience or commercial context.
- **IMP-002 — Review and mapping.** Exact originals and explicit status/visibility choices bind the reviewed fingerprint. Unsupported fields, missing references and aggregate-only data are named before apply. Rejected mapping prevents application; no row is silently dropped or guessed. Publication/moderation remains a distinct native decision.
- **IMP-003 — Durable custody.** Native D1 changes, original custody, provenance and checkpoints commit atomically under current session/installation authority and maintenance fences. Identical sources repeat without duplication; changed identities conflict. Restart resumes the persisted plan rather than acquiring the source again. Imports never send or enqueue external effects.
- **IMP-004 — Safe reversal.** Undo/rollback removes only owned effects under full native value, revision, relationship and cardinality fences. Later native work or shared dependencies cause a visible conflict without collateral deletion. Reversal is durable and restartable; ordinary reversal retains originals.
- **IMP-005 — Privacy precedence.** Erasure purges affected retained originals/creation copies and records opaque target fences. Old imports cannot recreate erased effects. Historical identity and import metadata participate in product archive and erasure classification; installation credentials remain non-portable.
- **IMP-006 — Ideas aggregates.** Saved Ideas CSV rows become unpublished, unreviewed requests with one exact-provenance evidence item under explicit source-key, status and visibility mappings. Count, company, score, formula, owner and custom fields remain private source material, with aggregate columns named in preview, numeric totals and source-row coverage for textual company data. Counts never manufacture individual voters, commenters, followers, accounts or commercial records. Unknown headings and missing required headings are refused by name; an idea ID or URL must be supplied, never invented from a title or row number.
- **IMP-007 — Move-in receipt.** Preview, apply and reversal expose a private operator receipt with per-kind source/read/applied/skipped counts and reasons, destination counts, named omissions and unresolved relationships, non-authorizing identity treatment, and job-created mail and notification counts (zero). Reversal names removed effects and conflicts preserving later native work, and reports retained originals. Receipt contents, attribution and commercial/source fields remain outside public projections.
- **IMP-008 — UserVoice saved source.** Saved UserVoice ideas-only and Ideas & Voters CSV exports, read by the headings UserVoice documents, become unpublished, unreviewed requests with one exact-provenance evidence item keyed by Idea ID, under explicit status, board and forum mappings. Each idea and UserVoice User ID pair becomes one historical, non-authorizing vote attribution with its original link date; repeated rows for extra accounts or captured feedback fold into it and stay in the private original. A supporter is marked proxy only from the documented feedback-capturer columns, the mark is shown in preview, receipt and the operator request page, and it never upgrades the supporter. Names and email addresses never match, merge or link people; account, company, revenue, subscription and contact columns create no account, follow, consent, verified address or outreach audience. Each file declares its export scope; an undeclared scope is refused, a filtered one shows a partial-history warning, and claimed vote counts beyond the supplied supporters are named aggregate-only and create nothing. Unknown headings, unmapped statuses or forums, unzoned timestamps and spreadsheet workbooks are refused by name before any write.

These clauses cover saved Canny classic CSV and API-response history, the Canny Ideas aggregate CSV export, and UserVoice's ideas-only and Ideas & Voters CSV exports. Live API migrations and the other incumbents are MIG-001–MIG-006, which reuse this custody. The fixture-verified formats and omissions are documented in [MOVE-IN](docs/MOVE-IN.md) and [UserVoice](docs/USERVOICE-MIGRATION.md). No replacement claim or real-owner-export acceptance is inferred. Historical non-authorizing vote attribution is confined to IMP-001, IMP-008 and the MIG clauses.

Existing guarantees remain in force as the target clauses are built: ingestion stays purpose-bound and within each connector's configured scope (CAP-017), and role restrictions (OPS-001, ROLE-001) apply to captured records and agent answers; `REQ-010` means votes and operator-entered email addresses do not grant outreach permission; `REL-004` retains the exact recipient/target context at publication; `NOTIFY-002` rechecks preferences, suppression, and unsubscribe at send time; `REL-003` requires explicit new delivery for a correction; and `NOTIFY-004` prohibits inbound-mail reply loops. `DEC-003` continues to require comparable dimensions without an opaque combined score. Public publication and customer-specific follow-up remain separate, authorized acts.

## Migration from each incumbent

A buyer moves in without losing requests, votes, voters, comments or visibility. Every migration keeps IMP-001–IMP-007's custody: historical identity never becomes verified identity, consent, operator authority or an outreach audience, and a receipt names every omission. A replacement claim still requires a tested real owner export.

- **MIG-001 — Canny.** A live Canny API migration (with the owner's API key) moves boards, categories, tags, posts with status, owner and ETA, votes with each voter, comments including internal ones, merged posts as merge history, companies with MRR, changelog entries and board visibility, and produces a redirect map (MIG-006); a delta run during cutover adds only what changed. Saved Canny CSV and API-response files import today (IMP-001, IMP-006). *Acceptance:* A recorded Canny API fixture migrates with per-kind counts matching its receipt; a second run adds only the delta; no mail or notification is created.

- **MIG-002 — Productboard.** Productboard's API and CSV exports move notes (insights) with their users and companies, features in their product and component hierarchy (PRIO-001) with statuses and custom fields, portal cards with votes and importance, releases and objectives where present; every field Penny cannot hold is named in the receipt. *Acceptance:* Productboard API and CSV fixtures rebuild the hierarchy, keep every note-to-feature link and name each omitted field in the receipt.

- **MIG-003 — Aha! Ideas.** The Aha! API migration moves ideas, categories, statuses, votes including proxy votes (CAP-014), comments, idea-portal visibility, scores and the ideas' users and organizations. *Acceptance:* An Aha! API fixture migrates with proxy votes marked proxy and portal visibility mapped to boards.

- **MIG-004 — UserVoice.** Beyond IMP-008's saved CSV exports, which ship today, the UserVoice API moves suggestions, supporters, comments, status updates, forums, internal notes and labels. *Acceptance:* A UserVoice API fixture produces the same requests and supporters as IMP-008 for overlapping data and adds the comments and notes.

- **MIG-005 — Featurebase.** The Featurebase API or CSV migration moves posts, boards, statuses, upvoters, comments and changelog entries. *Acceptance:* A Featurebase fixture migrates with counts reconciling to its receipt.

- **MIG-006 — Cutover kit.** Every migration offers a dry run with the IMP-007 receipt, a side-by-side count check, a redirect map from the old portal's post URLs to Penny's request URLs, the widget swap snippet, and a re-consent invitation that only creates permission when a customer accepts it. Reversal follows IMP-004. Preview receipts and safe reversal ship today. *Acceptance:* The dry-run receipt equals the apply receipt; each imported post URL answers 301 to its request; a re-consent invitation creates a permission record only on the customer's click.

## Notification and release scheduling clarifications

**NOTIFY-002 deployment timezone.** An optional validated `WORKSPACE_TIMEZONE` deployment input overrides the server-only `workspaceTimezone` default, which remains the IANA timezone for Brisbane. Choose the workspace timezone at setup. Fixed 20:00–08:00 quiet hours, one-minute coalescing and minute Cron do not change.

**Release scheduling clarification (REL-006, NOTIFY-002):** each published release version creates its own durable recipient commands, outside the request status/comment one-minute coalescing window. Release commands are due immediately during 08:00 inclusive to 20:00 exclusive in the workspace timezone; quiet-hour commands become eligible at the next 08:00. Publication queues an immediate wakeup; the Queue consumer drains eligible commands without waiting for Cron activation. The minute Cron remains a recovery backstop, subject to actual platform scheduling. Quiet deferral consumes no retry attempt. Known pre-acceptance rejections use an initial attempt plus at most five retries at 1, 2, 4, 8 and 16 minutes, bounded by one hour from the first attempted send. Accepted or ambiguous SendGrid outcomes never automatically resend. Correlation keys do not provide SendGrid duplicate suppression.

**Release ordering clarification (NOTIFY-002, REL-006):** a queued release command for an address closes that address's still-open coalescing window for a request in the release's recipient context at the next drain, which sends the gathered update before the release command through the Queue or Cron drain; a release claim also waits for earlier queued or in-flight updates to that address and request. The window only ever ends earlier, never later, and the update's content is unchanged.

## Optional installation ownership and visual editing

- **OWN-001 — Signed first owner.** A trusted configured issuer, public signing
  key ring, installation ID and exact application audience can admit the first
  owner through native Base bootstrap. Expiry, signature, audience, replay,
  concurrent second claim and any installed owner refuse authority. The original
  setup token remains compatible. Claims cannot supply trusted configuration or
  take over an existing workspace; raw credentials stay out of storage/archives.
- **EDIT-001 — Owner editor.** The optional maintained editor receives only a
  short lease and validated management origin/installation ID after current
  native owner admission. Equal product operators remain equal for product
  work; this does not grant owner configuration. Compiled data-only edits apply
  after the rendered destination hydrates and preserve native navigation/privacy.
  The management service independently admits its owner and registered frame
  origin. Local editor/compiled-source proof is separate from hosted publication.

## Scoped server integrations

- **API-001 — Scoped keys.** A current native operator may issue a named optional-expiry REST key. Its random value is revealed once; only its hash persists. Route-selected scopes admit only documented requests, comments, status and release operations. Bearers never grant operator HTML, generated-function, export or owner configuration authority.
- **API-002 — Current custody.** Revocation, expiry and issuer authority changes fence every API request and its business transaction in the same native database. Authorization writes safe usage metadata durably before returning authority; storage failure refuses. Credentials are installation custody and are not a portable identity backup.
- **API-003 — Native publication.** API writes reuse native validation, moderation, explicit customer-safe approval, consent, maintenance and immutable snapshots. Imported/restored history creates no new publication or integration effect. Tracker synchronization follows the Delivery sync clauses (DELIV-001–DELIV-008), never an API side effect.

**INT-001 — Explicit integration effects.** Operators select approved public
request/comment/status/release events and immutable destinations. Native writes
and event targets commit together. Imported/restored history cannot create live
outbound effects. Product archives carry safe event/attempt/receipt history;
installation credentials are nonportable.

**INT-002 — Enforcing transport.** Webhook/Slack dispatch uses the maintained
Base delivery service through an installation-owned enforcing RPC transport.
Missing transport disables outbound integrations. Local composition does not
establish deployment enforcement or provider acceptance.

**INT-003 — Durable uncertainty.** Attempt identity, finite retry, ambiguity and
explicit reconciliation survive restart. An ambiguous effect does not resend
under another identity. Revoked configuration and private/blocked content cannot
start a send.

**INT-004 — Signed inbound notes.** Original bounded bytes verify before parsing;
current native authority, replay identity, internal note and processed receipt
commit together. Notes do not publish content or grant identity or consent.

- **INT-005 — Deliberate tracker issues.** Operators create or link a selected Linear or Jira issue from a request or decision. Only entered wording is sent. Native durable commands retain uncertain outcomes for explicit known-issue reconciliation and never create a duplicate automatically. Ongoing state mapping, GitHub, Vector and Azure DevOps are DELIV-001–DELIV-008.
- **INT-006 — Private tracker receipts.** Provider-specific raw-byte authentication, configured identity, durable replay and original source order guard state receipts in the same D1 transaction. Older or conflicting events cannot regress state. Linked state remains private evidence until an operator separately chooses Penny status or publication, except for the tracker states an admin maps under DELIV-006.
- **INT-007 — Owner portal branding.** Current native owners can configure a readable public accent and description and show or hide Penny’s own vector mark. Safe branding participates in product archives. Hosted hostname and egress provisioning require their actual authorized deployment paths.

## Mobile and accessibility

- **MOB-001 — Phone-width web.** Every portal and operator page works at 390 pixels wide with no horizontal scroll and touch-sized controls; every new surface in this contract (inbox, widget, prioritisation and roadmap views) joins the same check. *Acceptance:* The browser journeys run at 1440 and 390 pixels with axe and layout checks (`tests/browser/acceptance-audit.mjs` viewports), and each new surface is added to them.

- **MOB-002 — Installable app and push.** The operator app is an installable progressive web app with web push for NOTIFY-006 events and a capture form that queues offline. *Acceptance:* A PWA install check passes; a push fixture delivers once; an offline capture syncs once on reconnect.

- **MOB-003 — Native operator apps.** iOS and Android apps let operators triage the inbox, look up requests and accounts, capture from the share sheet (screenshot, text or link), record voice notes transcribed under CAP-008 and receive push notifications. Store distribution uses the owner's or Run Edit Run's developer accounts. *Acceptance:* XCTest and Espresso UI tests against a test installation triage an item, and a share-sheet capture creates exactly one inbox item.

- **A11Y-001 — Accessibility.** The portal, widget and operator app meet WCAG 2.1 AA, and Penny publishes a VPAT 2.5 (Section 508 edition) for US public-sector and enterprise buyers. Automated axe checks run on the existing journeys today. *Acceptance:* Axe reports no serious or critical violation on every journey page at both widths; keyboard-only journeys submit, vote and triage; a recorded screen-reader review precedes the VPAT.

## Push further: agents on the bet, not just the backlog

Enterpret and Productboard cluster feedback and rank popularity. These clauses go further: agents reason about why customers ask, look for evidence against the team's own belief, and follow a commitment into adoption. Every agent runs under AGENT-009, reads only in-scope records, and changes no decision, public wording or customer contact without the human action each clause names. Customer simulations never count as evidence.

- **AGENT-001 — Competing explanations.** For a problem the PM selects (a theme, a request or a decision question), an agent keeps at least two rival explanations of why customers ask (a missing capability, an onboarding gap, a plan limit), each with supporting and disconfirming excerpts from tickets, calls, votes, churn reasons and accounts that never asked, updates them as evidence arrives, and names the evidence that would tell them apart. The PM chooses scope and budget, can reject an explanation (kept with its reason, evidence untouched) and decides what enters a decision brief. LEARN-002's competing options and contradictions over selected sources ship today. *Acceptance:* A fixture problem with planted disconfirming evidence: both explanations cite real spans, the planted counter-evidence is surfaced, and rejecting an explanation keeps its evidence and history.

- **AGENT-002 — Disconfirming evidence search.** Before a commitment and on its review schedule, an agent searches every connected source in scope for evidence against the leading explanation and the selected bet (customers who churned anyway, workarounds, contrary requests), attaches what it finds as contradicting-evidence proposals on the bet and suggests a review (DEC-007) when contradictions pass the owner's threshold. Proposals are links the PM accepts or rejects; the agent never changes a decision. Contradictions within selected sources ship today. *Acceptance:* With contradicting fixture tickets, proposals attach with spans; accepting links them as contradicting (EVID-004); crossing the threshold raises one review suggestion.

- **AGENT-003 — Next learning action.** When explanations are close, the agent proposes the cheapest useful learning step (five interviews with a named segment, a two-question in-app poll under CAP-018, a usage query under MEAS, or a Pencil survey) with its expected information, cost and the customers it would contact; it drafts outreach only to consenting contacts, with booking links through Dial, the sibling scheduling seed (https://github.com/just-every/run-dial). The PM approves each step and each contact. LEARN-002's distinguishing clarification ships today. *Acceptance:* The proposal lists only consenting contacts; approval sends exactly the approved messages; poll answers return as evidence linked to the explanation.

- **AGENT-004 — Quiet and lost segments.** The agent compares who is asking (votes, ticket volume) with who matters (ARR, renewals due in 90 days, churned accounts, accounts whose usage dropped) and reports the selection bias, such as Enterprise renewals this quarter being absent from votes on reporting, with the accounts concerned and proposed research questions. The owner approves access to CRM and usage cohorts and any contact. Selected Orbit cancellation evidence ships today. *Acceptance:* A fixture where loud small-business voters differ from silent Enterprise renewals: the report names the gap with cited records and no contact happens without approval.

- **AGENT-005 — Bet review after release.** At a committed decision's review date after its release, an agent joins the commitment snapshot (DEC-004, LEARN-003's protocol), delivery receipts (DELIV), the release, cohort adoption (MEAS-005), outcome responses (REL-008) and follow-up feedback, and recommends keeping, changing or reversing the bet with the evidence on each side and its confidence; incomplete data is reported as unknown. The PM records the review and any revision (DEC-006). Review-due decisions, measurement protocols and outcome responses ship today. *Acceptance:* Three fixture outcomes (adopted, shipped but unused, negative follow-up) produce keep, change and reverse recommendations citing their data; missing usage produces unknown.

- **AGENT-006 — Promise keeper.** The agent watches public replies, status updates, approved ETAs (ROAD-012), roadmap state and delivery changes for promises at risk (an ETA past due, a Planned reply on a dropped item, a ticket told "soon" whose issue slipped) and prepares source-linked corrections for the accountable owner, reminding them until resolved or dismissed with a reason. Nothing is published or sent to a customer without operator approval. Status-update drafts from approved roadmap moves ship today. *Acceptance:* A fixture slipped issue with a public ETA yields one draft and one owner reminder; dismissal records its reason; nothing is published.

- **AGENT-007 — Sales and renewal brief.** For an open opportunity or upcoming renewal in Salesforce, HubSpot or Orbit, the agent writes an internal brief for the account team: the requests that account and similar accounts raised, their status and approved public wording, the cited evidence, and what may and may not be promised; it refreshes when status changes. Promises still go through publication. *Acceptance:* A fixture opportunity's brief cites that account's requests and uses only approved public wording in its suggested customer language.

- **AGENT-008 — Weekly product brief.** On a schedule, an agent sends each subscribed PM a cited brief of their area: rising themes, new high-value requesters, decisions due, promises at risk and connector failures, every line linked to its records, within a per-run budget. Unchanged inputs produce no brief and no model call. Scheduled bounded learning runs ship today. *Acceptance:* A scheduled run over a fixture week produces one brief per subscriber with resolvable citations; an unchanged week produces none and no model call.

- **AGENT-009 — Agent controls.** Every agent runs under LEARN-004–LEARN-006's controls extended to every source: a named owner, scope (sources, segments, themes), budget, schedule, pause, resume and revoke, an activity log of reads, model calls, cost and proposals in the audit log (ROLE-004), erasure closure (LEARN-005), and no customer contact, publication, merge, vote or commitment without the human action its clause names. Learning runs meet this today. *Acceptance:* For each agent, revoking mid-run stops further reads and model calls, erasure removes its derived work, and the audit log shows each action.

## Honest boundaries

Penny does the whole feedback-to-roadmap job; these neighbouring jobs stay in the systems that own them, and Penny connects to them.

- **Not a help desk.** Tickets and chats live in Zendesk, Intercom, Help Scout or HappyToHelp. Penny captures linked excerpts (CAP-003–CAP-006) and drafts replies there (NOTIFY-007).
- **Not a CRM or billing system.** Salesforce, HubSpot, Orbit, Stripe Billing and Nectar stay authoritative for accounts, deals and revenue; Penny reads the attributes it needs and writes back only what the owner enables (SEG).
- **Not an issue tracker.** Sprints, estimates, capacity planning, code review and Gantt scheduling stay in Vector, Linear, Jira, GitHub or Azure DevOps; Penny links work and syncs its state (DELIV).
- **Not a survey suite or community forum.** General surveys and NPS run in Pencil, Typeform or SurveyMonkey; Penny's polls are short questions on requests and releases (CAP-018). Open community chat stays in Nook, Slack or Discord; the portal discussion is about requests.
- **Not a call recorder or product-analytics tool.** Gong, Fathom and Zoom record calls; Amplitude, Mixpanel, PostHog and Vane collect usage. Penny reads transcripts and counts in scope (CAP-007, CAP-008, MEAS). It has no session replay, keystroke capture or passive visitor tracking.
- **Simulations and scores never decide.** A simulated customer ("digital twin") may suggest a hypothesis but never counts as evidence or a vote; a prioritisation formula sorts rows and never commits, ranks bets or changes a public status (PRIO-003, DEC-003).
- **One business per installation.** Several products and audiences are products, boards and roadmaps (PRIO-001, ROAD-010, WIDGET-006), not tenants; an agency serving several clients installs Penny once per client.
- **Compliance is the owner's program.** Penny is self-hosted on the owner's Cloudflare account and inherits no SOC 2 report, HIPAA business associate agreement or regulated-record assurance. Buyers run their own program (Evidence, the sibling compliance seed, or Vanta and Drata) and keep regulated health data out of feedback; AI-008 redaction reduces exposure but is not a guarantee.
- **Media and models run at the owner's providers.** Transcription and model calls go to the providers the owner configures (CAP-008, AI-010) as bounded background jobs, never inside a request Worker; their accounts, costs and data-processing terms are the owner's.
- **No payments.** Penny sells nothing to the buyer's customers, so it has no checkout, sales tax or payout surface.
- **Marketplace and store listings need vendor review.** Zendesk Marketplace, Slack App Directory, Atlassian Marketplace, Chrome Web Store, App Store and Google Play listings require developer accounts and each vendor's review. Until a listing is live, owners install the private app from the manifest Penny publishes.
- **Hosted delivery remains an owner action.** Custom domains, the egress service, live mail providers and deployment are owner-run steps with their own receipts (OPERATIONS.md); local proof never stands in for them.

## Status

Judged against the code and tests of `just-every/run-penny` at commit `02374e4` (16 October 2026). `done` cites the test through a public door; `partial` cites the file or test that shows what ships.

| Clause | Status | Evidence |
| --- | --- | --- |
| HOME-001 | done | `tests/browser/route-review.mjs` |
| HOME-002 | partial | `src/site/pages.tsx` |
| DOCS-001 | done | `tests/browser/route-review.mjs`; `docs/site.json` |
| OPS-001 | partial | `tests/base/auth.test.ts:83` |
| OPS-002 | done | `tests/base/auth.test.ts:83`; `tests/base/auth.test.ts:132`; `tests/base/auth.test.ts:160` |
| OPS-003 | done | `tests/browser/operator-pages.mjs` |
| OPS-005 | done | `tests/base/first-run.test.ts:10` |
| OPS-004 | partial | `tests/browser/operator-completeness-requester.mjs` |
| ROLE-001 | missing | — |
| ROLE-002 | partial | `src/core/features/auth/dependencies.ts` |
| ROLE-003 | missing | — |
| ROLE-004 | partial | `tests/base/board.test.ts:58` |
| OPS-006 | missing | — |
| EVID-001 | done | `tests/base/board.test.ts:14`; `tests/browser/loopjourney-steps.mjs` |
| EVID-002 | done | `tests/browser/operator-pages-decisions.mjs` |
| EVID-003 | done | `tests/browser/operator-pages.mjs` |
| EVID-004 | done | `tests/browser/loopjourney-steps.mjs` |
| EVID-005 | done | `tests/base/penny-evidence.test.ts:50` |
| EVID-006 | done | `tests/base/penny-evidence.test.ts:146` |
| EVID-007 | done | `tests/base/penny-evidence.test.ts:101` |
| EVID-008 | done | `tests/base/penny-evidence.test.ts:121` |
| EVID-009 | done | `tests/base/board.test.ts:41` |
| EVID-010 | done | `tests/base/penny-evidence.test.ts:89` |
| CAP-001 | partial | `src/core/features/evidence/repository.ts`; `tests/browser/operator-pages.mjs` |
| CAP-002 | partial | `src/core/features/evidence/write-service.ts`; `tests/browser/operator-pages-decisions.mjs` |
| CAP-003 | missing | — |
| CAP-004 | missing | — |
| CAP-005 | missing | — |
| CAP-006 | missing | — |
| CAP-007 | missing | — |
| CAP-008 | missing | — |
| CAP-009 | missing | — |
| CAP-010 | missing | — |
| CAP-011 | missing | — |
| CAP-012 | missing | — |
| CAP-013 | missing | — |
| CAP-014 | partial | `tests/base/feedback-import-uservoice.test.ts` |
| CAP-015 | partial | `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts` |
| CAP-016 | partial | `tests/browser/integration-states.mjs` |
| CAP-017 | partial | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| CAP-018 | missing | — |
| WIDGET-001 | partial | `src/core/features/settings/frame-settings.ts`; `tests/browser/operator-completeness-security.mjs` |
| WIDGET-002 | partial | `src/core/features/auth/host-identity.ts`; `tests/base/host-identity.test.ts` |
| WIDGET-003 | missing | — |
| WIDGET-004 | missing | — |
| WIDGET-005 | missing | — |
| WIDGET-006 | missing | — |
| AI-001 | partial | `src/core/features/requests/suggestions.ts`; `tests/base/penny-evidence.test.ts:101` |
| AI-002 | missing | — |
| AI-003 | partial | `src/core/features/requests/merge-repository.ts`; `tests/base/board.test.ts:14` |
| AI-004 | partial | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| AI-005 | missing | — |
| AI-006 | missing | — |
| AI-007 | missing | — |
| AI-008 | missing | — |
| AI-009 | missing | — |
| AI-010 | partial | `src/core/features/learning/run.ts`; `tests/base/learning-upgrade.test.ts` |
| SEG-001 | missing | — |
| SEG-002 | missing | — |
| SEG-003 | partial | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| SEG-004 | missing | — |
| SEG-005 | missing | — |
| SEG-006 | missing | — |
| SEG-007 | partial | `src/core/features/requests/operator-context.ts`; `src/core/features/accounts/read-context.ts`; `tests/base/penny-evidence.test.ts:50` |
| REQ-001 | done | `tests/browser/loopjourney-steps.mjs` |
| REQ-002 | done | `tests/base/no-mail-identity.test.ts` |
| REQ-003 | done | `tests/base/board.test.ts:14` |
| REQ-004 | done | `tests/base/penny-evidence.test.ts:101` |
| REQ-005 | done | `tests/base/board.test.ts:14` |
| REQ-006 | done | `tests/base/board.test.ts:14` |
| REQ-007 | done | `tests/base/notifications.test.ts:40` |
| REQ-008 | done | `tests/base/board.test.ts:14` |
| REQ-009 | done | `tests/base/board.test.ts:14`; `tests/base/notifications.test.ts:244` |
| REQ-010 | done | `tests/base/board.test.ts:14` |
| REQ-011 | done | `tests/base/board.test.ts:41` |
| REQ-012 | partial | `tests/browser/requester-board.mjs` |
| REQ-013 | done | `tests/base/board.test.ts`; `tests/browser/requester-repair.mjs` |
| REQ-014 | done | `tests/base/host-identity.test.ts` |
| REQ-015 | done | `tests/base/board.test.ts:14` |
| REQ-016 | partial | `src/core/features/requests/status-publication.ts`; `tests/base/decision-loop-roadmap.test.ts` |
| REQ-017 | partial | `src/core/features/requests/status-publication.ts` |
| REQ-018 | done | `tests/base/board.test.ts:41` |
| REQ-019 | done | `tests/base/board.test.ts:41` |
| REQ-020 | done | `tests/browser/requester-repair.mjs` |
| REQ-021 | partial | `tests/browser/requester-repair.mjs:86` |
| REQ-022 | partial | `src/core/features/auth/native-service.ts`; `src/core/features/requests/operator-routes.ts` |
| REQ-023 | done | `tests/base/auth.test.ts:46`; `tests/browser/no-mail-journey.mjs` |
| REQ-024 | done | `tests/base/notifications.test.ts:229` |
| REQ-025 | done | `tests/base/notifications.test.ts:152` |
| REQ-026 | partial | `src/core/features/requests/operator-context.ts` |
| REQ-027 | done | `tests/browser/operator-completeness-security.mjs`; `tests/base/board.test.ts:58` |
| REQ-028 | partial | `tests/browser/operator-completeness-read.mjs` |
| REQ-029 | done | `tests/browser/operator-pages-decisions.mjs` |
| REQ-030 | done | `tests/base/notifications.test.ts:279` |
| REQ-031 | done | `tests/base/host-identity.test.ts` |
| REQ-032 | done | `tests/base/penny-evidence.test.ts:146` |
| TRIAGE-001 | missing | — |
| TRIAGE-002 | partial | `src/core/features/overview`; `tests/browser/operator-pages.mjs` |
| TRIAGE-003 | missing | — |
| TRIAGE-004 | missing | — |
| TRIAGE-005 | missing | — |
| TRIAGE-006 | partial | `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts`; `tests/base/notifications.test.ts:87` |
| PRIO-001 | missing | — |
| PRIO-002 | partial | `src/core/features/settings/custom-fields.ts`; `tests/browser/operator-completeness-fields.mjs` |
| PRIO-003 | missing | — |
| PRIO-004 | missing | — |
| PRIO-005 | missing | — |
| DEC-001 | done | `tests/base/decision-loop-commit.test.ts` |
| DEC-002 | done | `tests/base/decision-loop-dimensions.test.ts` |
| DEC-003 | done | `tests/base/decision-loop-dimensions.test.ts` |
| DEC-004 | done | `tests/base/decision-loop-commit.test.ts` |
| DEC-005 | done | `tests/base/decision-loop-roadmap.test.ts` |
| DEC-006 | done | `tests/base/penny-decisions.test.ts` |
| DEC-007 | done | `tests/base/penny-decisions.test.ts` |
| DEC-008 | done | `tests/base/penny-releases.test.ts`; `tests/base/penny-decisions.test.ts` |
| ROAD-001 | done | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-002 | done | `tests/browser/operator-pages-decisions.mjs` |
| ROAD-003 | done | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-004 | done | `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/loopjourney-roadmap.mjs` |
| ROAD-005 | done | `tests/base/decision-loop-roadmap.test.ts` |
| ROAD-006 | done | `tests/browser/loopjourney-roadmap.mjs` |
| ROAD-007 | done | `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/operator-pages-status.mjs` |
| ROAD-008 | done | `tests/browser/operator-pages-status.mjs` |
| ROAD-009 | missing | — |
| ROAD-010 | missing | — |
| ROAD-011 | partial | `src/core/features/releases/drafts.ts`; `tests/browser/loopjourney-release.mjs` |
| ROAD-012 | missing | — |
| ROAD-013 | missing | — |
| REL-001 | done | `tests/browser/loopjourney-release.mjs` |
| REL-002 | done | `tests/browser/loopjourney-release.mjs` |
| REL-003 | done | `tests/base/penny-releases.test.ts`; `tests/base/release-custody.test.ts` |
| REL-004 | done | `tests/base/release-custody.test.ts` |
| REL-005 | done | `tests/browser/loopjourney-release.mjs` |
| REL-006 | done | `tests/base/notifications.test.ts:133`; `tests/base/release-custody.test.ts` |
| REL-007 | partial | `tests/base/release-custody.test.ts` |
| REL-008 | done | `tests/base/penny-releases.test.ts` |
| REL-009 | done | `tests/base/penny-releases.test.ts` |
| REL-010 | done | `tests/browser/route-review.mjs` |
| REL-011 | done | `tests/runtime/mail-events-restart.test.mjs` |
| REL-012 | done | `tests/base/penny-releases.test.ts` |
| REL-013 | done | `tests/base/release-custody.test.ts` |
| REL-014 | missing | — |
| REL-015 | partial | `src/core/features/releases/drafts.ts`; `src/core/features/releases/public-read-repository.ts` |
| REL-016 | partial | `src/core/features/releases/recipients.ts`; `tests/base/penny-releases.test.ts` |
| REL-017 | missing | — |
| DELIV-001 | missing | — |
| DELIV-002 | partial | `src/core/features/integrations/tracker-service.ts`; `src/core/features/integrations/tracker-receiver.ts`; `tests/browser/integration-states.mjs` |
| DELIV-003 | partial | `src/core/features/integrations/tracker-service.ts`; `tests/browser/integration-states.mjs` |
| DELIV-004 | missing | — |
| DELIV-005 | missing | — |
| DELIV-006 | missing | — |
| DELIV-007 | missing | — |
| DELIV-008 | partial | `tests/browser/integration-states.mjs` |
| NOTIFY-001 | done | `tests/base/notifications.test.ts:40`; `tests/base/notifications.test.ts:68` |
| NOTIFY-002 | done | `tests/base/notifications.test.ts:122`; `tests/base/notifications.test.ts:213` |
| NOTIFY-003 | done | `tests/base/penny-decisions.test.ts` |
| NOTIFY-004 | partial | `src/core/features/notifications/delivery.ts` |
| NOTIFY-005 | done | `tests/base/notifications.test.ts:87`; `tests/base/notifications.test.ts:269` |
| NOTIFY-006 | partial | `src/core/features/integrations/destinations.ts`; `tests/base/egress-delivery.test.ts:35`; `tests/base/penny-decisions.test.ts` |
| NOTIFY-007 | missing | — |
| MEAS-001 | missing | — |
| MEAS-002 | missing | — |
| MEAS-003 | missing | — |
| MEAS-004 | partial | `src/core/features/releases/outcomes.ts`; `src/core/features/requests/operator-context.ts` |
| MEAS-005 | partial | `src/core/features/releases/outcomes.ts`; `tests/base/penny-releases.test.ts` |
| MEAS-006 | missing | — |
| DATA-001 | done | `tests/base/hosted-export.test.ts:83`; `tests/installer/portability.test.mjs` |
| DATA-002 | done | `tests/base/host-identity.test.ts`; `tests/base/no-mail-identity.test.ts` |
| DATA-003 | done | `tests/base/penny-erasure.test.ts:137`; `tests/base/penny-erasure.test.ts:178` |
| DATA-004 | done | `tests/browser/operator-completeness-fields.mjs` |
| DATA-005 | partial | `src/core/features/data/archive.ts`; `tests/base/hosted-export.test.ts:83` |
| DATA-006 | partial | `src/core/features/integrations/api-routes.ts`; `tests/base/integration-api.test.ts:19` |
| DATA-007 | missing | — |
| LEARN-001 | done | `tests/base/learning-stage2.test.ts` |
| LEARN-002 | done | `tests/base/learning-stage2.test.ts` |
| LEARN-003 | done | `tests/base/learning-stage3.test.ts` |
| LEARN-004 | done | `tests/base/learning-stage3.test.ts` |
| LEARN-005 | done | `tests/base/learning-stage3.test.ts` |
| LEARN-006 | done | `tests/base/learning-upgrade.test.ts` |
| IMP-001 | done | `tests/base/feedback-import.test.ts:35` |
| IMP-002 | done | `tests/base/feedback-import.test.ts` |
| IMP-003 | done | `tests/base/feedback-import-custody.test.ts` |
| IMP-004 | done | `tests/base/feedback-import-custody.test.ts` |
| IMP-005 | done | `tests/base/feedback-import-custody.test.ts` |
| IMP-006 | done | `tests/base/feedback-import.test.ts` |
| IMP-007 | done | `tests/base/feedback-import.test.ts`; `tests/base/feedback-import-uservoice.test.ts` |
| IMP-008 | done | `tests/base/feedback-import-uservoice.test.ts` |
| MIG-001 | partial | `src/core/features/imports/bundle.ts`; `tests/base/feedback-import.test.ts:35` |
| MIG-002 | missing | — |
| MIG-003 | missing | — |
| MIG-004 | partial | `tests/base/feedback-import-uservoice.test.ts` |
| MIG-005 | missing | — |
| MIG-006 | partial | `src/core/features/imports/service.ts`; `tests/base/feedback-import.test.ts:71` |
| OWN-001 | done | `tests/base/owner-claim.test.ts` |
| EDIT-001 | done | `tests/base/editor-admission.test.ts` |
| API-001 | done | `tests/base/integration-api.test.ts:19` |
| API-002 | done | `tests/base/integration-api.test.ts:36`; `tests/base/integration-api.test.ts:54` |
| API-003 | done | `tests/base/integration-api.test.ts:73` |
| INT-001 | done | `tests/browser/integration-states.mjs` |
| INT-002 | done | `tests/base/egress-delivery.test.ts:35` |
| INT-003 | done | `tests/browser/integration-states.mjs` |
| INT-004 | done | `tests/browser/integration-states.mjs` |
| INT-005 | done | `tests/browser/integration-states.mjs` |
| INT-006 | done | `tests/browser/integration-states.mjs` |
| INT-007 | done | `tests/browser/integration-states.mjs` |
| MOB-001 | done | `tests/browser/acceptance-audit.mjs:7`; `tests/browser/operator-pages.mjs`; `tests/browser/requester-board.mjs` |
| MOB-002 | missing | — |
| MOB-003 | missing | — |
| A11Y-001 | partial | `tests/browser/acceptance-audit.mjs` |
| AGENT-001 | partial | `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-002 | partial | `src/core/features/learning/run.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-003 | partial | `src/core/features/learning/schema.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-004 | partial | `src/core/features/learning/acquisition.ts`; `tests/base/learning-stage2.test.ts` |
| AGENT-005 | partial | `src/core/features/decisions/reviews.ts`; `tests/base/penny-decisions.test.ts`; `tests/base/learning-stage3.test.ts` |
| AGENT-006 | partial | `src/core/features/roadmap/update-drafts.ts`; `tests/browser/operator-pages-status.mjs` |
| AGENT-007 | missing | — |
| AGENT-008 | partial | `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts` |
| AGENT-009 | partial | `src/core/features/learning/audit.ts`; `tests/base/learning-stage3.test.ts` |

**Counts:** 103 done, 54 partial, 61 missing (218 clauses).
