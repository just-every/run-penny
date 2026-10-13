# Historical Penny acceptance records

These records describe earlier named candidates. Statements of current or final
verification below are historical, and do not establish a later head. Requirements
remain governed by CONTRACT.md, BASELINE.md and the current ACCEPTANCE.md.

# Penny acceptance

Current integration: requester notification and source release candidate, following
[Base adoption](docs/base-adoption.md). Historical
receipts below describe their own frozen candidates and are not current provider
or release claims.

## Editing-resource regression requirements

`tests/ui/auxiliary-resources.test.tsx` checks ROAD-002/EVID-004 save admission
when evidence choices are unavailable, and explicit failure, retry and expired
session states for roadmap and release choices. `test:ui` runs in ordinary
`pnpm verify`. `tests/base/roadmap-suggestions.test.ts` checks ROAD-004 selected-bet
suggestions against other-bet, held and internal-board requests through native
operator admission. The decision-loop browser journey also checks the suggested
public request before manual mapping, failed-read save refusal, retained evidence
links and genuine resource reload after retry, at both widths. Its four deliberate
auxiliary HTTP 500 responses per width are counted separately from unexpected
browser errors. Exact-head execution receipts are required to satisfy these
bounded requirements; they do not close wider contract or hosted release gates.

## Historical bounded implementation milestone — 2 October 2026

This milestone advances Stage 1 in `docs/flagship-acceptance.md`; it does not
replace its wider gates or waive any `CONTRACT.md`/`BASELINE.md` obligation.

An allow-listed operator can request and consume a single-use magic link, read
the private app, and sign out with durable session revocation. A requester can
verify an email address, submit feedback with an idempotency key to an available
public board, and see an honest held state. Submission creates one request and
one unreviewed evidence/version/link transaction. An authenticated operator can
inspect the queue, approve explicit customer-safe title/description/board/display
name, or reject with a reason. Only approved fields reach public reads and SSR.

Local review uses an explicitly selected local-only D1 mail outbox, read through
the local CLI. No auth token is returned from issuance or exposed in a public
outbox endpoint. Outside local/test this transport must fail closed; production
mail is unavailable until separately implemented and authorized. Synthetic local
verification proves token consumption, not email ownership in production.

Acceptance evidence must cover expiry/replay/revocation, disallowed operators,
unverified/blocked requesters, CSRF, invalid inputs, idempotent replay/conflict,
atomic rollback, rejected/internal/archived publication, audit custody and public
privacy; and exercise the actual browser journey on the emitted Start runtime.
Fresh installation, migration of Stage 0 data and existing tests must still pass.

## Requester-board profile — Base candidate, 7 October 2026

Required: votes, explicit follows, moderated first posts, comments and edits,
status updates, merge/unmerge, boards, private tags and separately approved
attachments, with maintained Base operator authentication and provider-backed
requester verification. Appeals, duplicate suggestions, custom fields and
host-signed identity retain their existing implementation but are not additional
gates for this bounded integration. No wider contract guarantee is waived.

That 7 October candidate imported Base operator-auth and mail at
`5c25d26744e8dbbe64dc85ff984696ea37e42e72`, and deploy-kit at
`61b6b499fd70850a36496ad9bfcddea5389885d4`.
[Base adoption](docs/base-adoption.md) records source custody, predecessor test
separation, the credential-revoking 0009 upgrade and actual Base integration
checks. [Disposable installation](docs/disposable-install.md) documents the
implemented setup/deploy/health commands. Push CI runs frozen installation and
`pnpm verify`. Local browser evidence exercises exact emitted production code at
1440 and 390 with test-only provider HTTP capture. Those receipts belong to the
7 October profile. Later integrated-candidate clean-clone, CI and browser results
are recorded below; hosted deployment and actual provider delivery remain
separate proof. No hosted claim follows from local tests.

## Preserved wider obligations

The wider flagship stages, full operator queue filters, evidence/decision/roadmap/
release workflows, production portability and erasure guarantees, whole-product
release acceptance, provider delivery, accessibility/load limits and customer-outcome
gates remain required. Bounded archive restoration and erasure evidence retain the
limits documented below. A requester-board candidate does not satisfy the entire
product launch or authorize a narrower contract.

## Bounded product archive milestone

`docs/data-ownership.md` defines authenticated hosted HTTPS export and journal
downloads, local-only exact R2-byte restoration, supported-root erasure and
interruption recovery. `hosted-export.test.ts` and `tests/data/commands.test.mjs`
prove the emitted hosted-mode Worker over local TLS and isolated native restore;
they do not establish a deployed installation or a hosted restore. Current
limits, operator holds, ambiguous-copy blocking and fresh-destination journal
continuity gap are explicit. Universal BASE-DATA-001/003 and DATA-001/003 remain
open. Local setup prepares only the local schema; no remote setup or release claim.

## Requester notification and source release candidate

The bounded release uses declared version `0.0.0` consistently in package, seed
and RELEASE metadata. It is the first source release record and does not infer a
previous published version from historical bootstrap labels. NOTIFY-001 records
public reply and approved-comment triggers; NOTIFY-002 records the fixed first
event one-hour coalescing window and minute-Cron quiet-hours drain. All wider
clauses and uncovered guarantees remain operative.

The local gate must check consent/mute/suppression, public versus held/private
content, event deduplication, fixed-window boundaries, 20:00–08:00 timezone
quiet hours, one-click unsubscribe, failed/uncertain-send reconciliation and
selected-provider serialization. Existing board assertions and fixtures remain
unchanged. Additive `0010_request_notifications.sql` follows immutable 0001–0009. Independently verify an
existing-data upgrade and repeated migration without SQL mutation.

Source hygiene removes research and copied competitor/prototype material from
the release tree; historical private blobs remain and cannot pass a visibility
flip. Exact reviewed fixture/example entries do not exempt secrets, environment
matches, competitor images or licenses. The public candidate requires a
clean-history export and committed release-tree/history scans.

The focused deployment checks preserve the original nine-migration 0009 regression
profile. The production/Base profile independently applies the exact complete
on-disk migration history, including Base authority migrations 0009 and 0012,
against existing rows: no historical outbox replay, atomic comment/status event triggers, held
comment privacy, deduplication, internal-board recipient exclusion, foreign-key
integrity and no-mutation repeated deployment.

`pnpm test:release-metadata` checks real maintained RELEASE-schema validation,
version consistency and operations failing missing or wrong-provider keys.
`pnpm source:lock` and `pnpm source:check` must run after integration staging;
the lock, recipe and retained snapshots ship together. Local operations checks
prove required input declarations, not credentials or mail delivery. Current
clean-clone verification, both-width browser runs and pushed CI are recorded
below. Hosted setup/health/Cron, actual inbox delivery, tag/release approval,
publication checks and any catalog/site proof require their own evidence.

## Notification review corrections

Additive `0011_notification_delivery_events.sql` preserves all applied migrations.
Signed Base mail intake verifies original provider bytes and authorizes the stored
Penny delivery, attempt, provider and recipient. A D1 transaction validates every
read, then commits Base receipts/state and hard-bounce or complaint suppression
together. Receipt conflicts roll back; the provider may retry a 503. Retained
permission rows remain intact, and suppression is checked before later mail.
SendGrid's webhook message ID differs from its API receipt: a signed batch and
attempt correlation binds the first callback message ID, and later IDs must match.
REL-011 is not fully satisfied: delayed or asynchronous bounces without
`sg_message_id` cannot pass the retained Base intake, despite being a
[documented SendGrid event shape](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event).
Historical accepted attempts without the new recipient snapshot or attempt correlation
are not retroactively trusted. Penny suppression for these excluded events is not implemented;
operators must review provider-side suppression separately. A valid callback
signature alone does not remove either boundary.
No hosted callback receipt is established by local verification.

The bounded SendGrid policy intentionally does not satisfy REL-007's provider
idempotency guarantee: `rer_delivery_id` is correlation only, and SendGrid offers
no provider duplicate suppression for this send request. REL-006 ambiguous or
interrupted sends remain **unknown with no automatic retry**, including a crash
after provider acceptance before receipt persistence. Operators inspect provider
records; the app offers no blind resend. Known pre-acceptance failures retain
bounded retries. The authorized SendGrid sender is the owner's `noreply` address at justevery.com; the `noreply` address at exitvent.com is permitted only after an actual recorded sender rejection.

Address-bound monotonic unsubscribe generations fence both request and global
re-subscription even in the same millisecond. Links already mailed remain valid
through identity merges until an explicit re-subscription; new links use a
secret HMAC address binding. Existing signed version-1 links remain readable
with their original binding until their scope's generation changes.

Renewed follow and vote-with-email consent also advance request generations,
including every current canonical origin in the same transaction. Unfollow keeps
revoked permission history. Identity merging returns a visible 409
`identity_merge_notification_active` while either identity owns a sending batch;
the operator can retry after those sends settle. Queued unique events survive a
later merge and already delivered events retain custody. Final send admission
atomically checks eligibility and claim ownership, selects public event content,
and persists the exact recipient and verification generation before provider HTTP.
A preference change committed before that admission prevents the send; HTTP
already admitted cannot be recalled.

## Local setup adoption and historical checks — 8 October 2026

Complete operator-auth and deploy-kit trees are byte-identical to Base main
`36ec7f4fe96a0ffcc9ebba4d4926eeb12ddfd09b`, which removed internal task identifiers from the copied files; the complete mail tree is byte-identical to
`e0d0232c37e7c10a5974df0344320ab40bf372e2` (the current 113-file copy), with read-only development-outbox
retention and attachment-free listings. The two consumed operations helpers are
exact copies from main at their last-change pin
`8c3bf4850c47af57367cc32c32b1ef2c435fcf40`.
Migration `0012_base_local_auth.sql` follows the unchanged notification migration
0011. Its prior-data test preserves product rows, notification custody, Base
operator authority, sessions and the complete migration ledger.

On earlier candidates, the fresh-copy journey ran the numbered README commands in two
fresh source copies, including frozen installation, setup and `dev`, at
1440×900 and 390×844. Each copy began with one Base operator and zero boards,
requests, evidence, decisions, roadmap items, releases or requesters. Both
operator sign-in and requester verification used the real Base development
outbox. The successful journeys each captured twelve states with zero axe
violations, horizontal overflow, console/page errors or external requests.
The actual local recovery drill compared every restored D1 row, revoked Base
and predecessor/requester credentials, cleared captured links, preserved the
source, and allowed a fresh sign-in request against the restored store.

H.2's consumed/revoked-link page was checked in a separate browser context at
both widths. It retained the exact Base HTTP 400 response and `/signin` recovery
link, with zero axe violations, overflow, application errors or external
requests. The separate negative receipt records Chrome's expected document
HTTP diagnostic; the successful G.6 journeys permit no console exceptions.
Screenshots and receipts live outside the release tree in the integrator's
evidence directory. These are actual local runtime proofs. The final
clean-clone verification is recorded below; hosted provider delivery and
hosted publication retain separate acceptance gates.

The original predecessor authentication fixtures apply every present and future
product migration and exclude only Base authority migrations 0009 and 0012. An
independent filename inventory asserts this exact selection. The production/Base
profile applies the exact complete on-disk history, including 0009 and 0012. Both
profiles retain every prior behavior, row/R2, constraint and maintenance assertion;
the independent production 0009 upgrade test still verifies revocation of prior
credentials. Base sign-in and durable sign-out stay available during a product
data lock so the owner can regain admission and recover the locked operation. Historical test
counts and pins above describe their recorded candidate only.

`pnpm test:browser:no-mail` additionally checked the emitted production Worker
through local HTTPS with delivery absent: public reading, operator sign-in
explanation, anonymous verification explanation, enabled verified-requester
submission and unavailable outbox, at both widths. Its ten captured states had
zero axe violations, overflow, console/page errors or external requests. The
retained route review also passed all 126 route/auth checks and 116 screenshots.

## Decision-loop status updates and changelog

Approved roadmap transitions prepare private customer-safe status drafts in the same transaction. Explicit grouped publication writes every approved request history and one identity intent. Release drafts collect approved targets, tags, type, title, body, author, date and an optional safe link; publication requires every target still Shipped and the exact approved mapping set still valid. Publication freezes one version and the complete deduplicated address-bound audience before queueing. Public pages expose the approved wording only; mail includes only that recipient’s currently eligible snapshotted request contexts. Release commands use the minute Cron independently of the request one-hour window and honor workspace quiet hours.

The focused release/status, concurrency, delivery, provider-event, custody and additive-upgrade tests passed locally, and the final-head browser journey exercised status and release publication at both widths. These checks show local publication and queue behavior, not hosted Cron or inbox delivery. REL-007 provider duplicate suppression remains **unsatisfied**: SendGrid's stable delivery key is correlation only. Ambiguous or interrupted sends stay unknown with no automatic retry. REL-011 remains partly open for the retained Base intake's documented events without a provider message ID and historical uncorrelated attempts. No exactly-once provider guarantee is claimed.

This change does not implement EVID-005 beyond choosing an existing account, EVID-007 duplicate suggestions, EVID-008 attachments or EVID-010 wording versions beyond the preserved first version; DEC-006 revisions, DEC-007 review due and NOTIFY-003, or DEC-008 outcome evidence; or REL-003 corrections/new correction delivery, REL-008 outcome responses, REL-009 coverage or REL-012 subscribe-all. These remain open alongside the other unimplemented contract clauses recorded above. Published wording is immutable; no public outcome prompt or outcome submission is offered. Version remains 0.0.0.

## Historical integrated verification — supplied predecessor, 9 October 2026

The integrated candidate passed frozen clean-clone `pnpm verify` with 594 tests
and zero errors; the clone had no tracked or untracked changes, and pushed CI
passed. An earlier independent final-correction gate passed 267 tests with zero
failures or skips: seven API publication/seal paths, 165 retained Base
release/status/notification/provider-event/auth/local-mail tests, 16 migration
and diagnostic-boundary checks, and 79 retained decision-loop, all-table
ownership and read-spine tests, plus production/predecessor builds and source
custody checks. Current-main follow-up checks also passed seven API publication
cases, ten diagnostic-redaction cases and seven custody checks.

Focused local Worker coverage passed for these contract areas:

- Evidence (EVID-002, EVID-003, EVID-004): every source kind stores its exact provenance and leaves optional fields null; each review action and its reverse work; linking, unlinking and committing preserve the evidence item and wording byte-for-byte; unauthenticated, non-operator and cross-origin requests are refused without changing data.
- Decisions (DEC-001 to DEC-005): draft, ready and committed transitions work; seeded dimensions match hand-computed values with shared evidence counted once and offset instants compared correctly; missing commitment fields are named; a single bet without a recorded reason is refused; a failed partial commit leaves no committed decision, Planned item or snapshot; evidence snapshots survive relinking and declined-bet items stay untouched.
- Roadmap (ROAD-001 to ROAD-008): approval and withdrawal, including the 404 after withdrawal, and refusal of a second mapping are covered; every transition appears through the public API and request page; planted private values such as account name, revenue, rationale, declined bet, confidence and delivery note stay out of public responses; unapproved commitments remain private and each move prepares one safe draft atomically.
- Status updates and releases (ROAD-007, ROAD-008, REL-001 to REL-007, REL-010, REL-013): draft/publish/republish creates no second queue; followers deduplicate across mapped requests; mute, suppression, quiet hours and coalescing are checked on an injected clock; publishing refuses each target not yet Shipped; recipient snapshots precede delivery and survive follow, unfollow and merge; release mail stays outside the request coalescing window; delivery keys remain stable across Cron retries; out-of-order events do not move delivery backward; an empty updates page shows no draft, example or outcome prompt.
- Data ownership (DATA-001, DATA-003): the unchanged all-table export/import round trip includes every new table; requester erasure removes or anonymises personal data in snapshots, deliveries and notifications while retaining independently approved public wording; migrations 0013, 0014 and 0015 pass prior-data upgrade checks.

All six package browser scripts passed at both 1440×900 and 390×844:

- `pnpm test:browser` exercises requester-board journeys on the emitted Worker with a local mail fixture.
- `pnpm test:browser:routes` visits operator and portal routes in empty and populated states.
- `pnpm test:browser:readme` runs the README commands in a fresh clone and signs the owner in through the outbox and first-run setup.
- `pnpm test:browser:no-mail` checks public reading and form behavior with delivery unconfigured.
- `pnpm test:browser:operator-pages` checks the Needs-you overview, sidebar, roadmap cards, next steps and feedback settings.
- `pnpm test:browser:decision-loop` runs from an empty local store through evidence, a two-bet decision, roadmap approval and movement, local status publication, release publication and the queued-delivery views. It does not send hosted mail.

The full 12-step decision-loop browser journey passed at both widths from a fresh
source copy and empty store, without sample data or manual SQL bootstrap: local
setup; operator sign-in through
the development outbox; board creation; requester verification and submission;
moderation; a second evidence item and subject tag; a two-bet decision with
evidence for each stance; commitment of one bet; request mapping and approval,
with the public request showing **Planned** within five seconds as measured; a
move to In progress and status publication; a move to Shipped; release drafting
and publication; the public updates page; and queue views showing one follower
awaiting a status notification and one queued release delivery. The journey
never changes the clock. The page assertions prove queue state; the injected-clock
Worker tests above establish later send timing and delivery-state behavior, not
hosted provider acceptance or inbox delivery.

The four-step README proof passed in a fresh frozen clone at `127.0.0.1:8787`,
at both 1440×900 and 390×844. Setup left one active operator and all seven
business tables empty, and wrote two distinct fresh 256-bit secrets with mode
0600 without printing their values. Real sign-in through the local outbox,
styled confirmation and the empty Overview were verified. Twelve captured states
recorded zero axe violations and no horizontal overflow, console or page errors,
or external requests; no owned browser or development process remained.
These local browser results do not establish hosted deployment, hosted
delivery/Cron or public-release acceptance.

**Historical disposable hosted proof at `05fa94b717664376d518b49b6ca7181102b4c61b` only**, not final-head proof: a workers.dev installation used the seed's own setup, deploy and health commands with workspace timezone UTC. A real QA sign-in used multipart mail and styled confirmation; the development outbox was unavailable. The loop ran through the hosted interface, and Planned projection was measured at 459 ms through the API, 583 ms through server rendering and 849 ms in the browser. A release receipt arrived at 11:29:43.635Z, about 47 minutes 44 seconds after publication; the exact first Cron invocation time was not retained. Status mail arrived at 11:42:43Z, 49 seconds after its one-hour window. Both historical messages carried customer-safe content and one-click unsubscribe headers. The release unsubscribe flow was exercised; the status-mail unsubscribe URL was captured but not exercised.

**Still unproven for the final integrated head:** exact-head hosted deployment and deliveries, and authenticated applicable-prefix resource emptiness before and after teardown. Historical resource snapshots were limited to default scope and did not establish complete R2 pagination or every applicable scope. An earlier setup/recovery attempt completed desktop and failed during mobile development-server startup; the current six browser scripts and literal README proof later passed at both widths. Private bounded startup diagnostics now preserve the exit code, signal and output tail for reproduction. The integrator's publication proof is the source of truth for the newest Base publication, release dry-run and generated naming-list results. SendGrid's stable delivery key is correlation only: REL-007 provider duplicate suppression remains unsatisfied, and ambiguous sends stay unknown without automatic retry.

**Still open in this contract:**

- Evidence: EVID-005 beyond choosing an existing account, EVID-007 duplicate suggestions, EVID-008 attachments, and EVID-010 wording versions beyond the preserved first version.
- Decisions: DEC-006 revision, DEC-007 review due, NOTIFY-003 review-due notification, DEC-008 outcome evidence.
- Releases: REL-003 corrections after publication, REL-008 outcome responses, REL-009 coverage, REL-012 subscribing to every release.
- REL-011 delayed or asynchronous bounce events without a provider message identifier remain unmatched, as recorded above.
- Deployment planning and dry-run modes remain open. The required teardown/first-health outcome has not landed completely; newer optional upstream health APIs do not supply the missing teardown proof and are not adopted. Publish-check performance documentation is still absent. The public homepage and importer are separate work. Public-child release documentation has landed upstream and is recorded only.

## Historical publication corrections — predecessor candidate

Status drafts with changed approval, mapping or visibility witnesses remain unpublishable with 409 and no longer appear as publishable Needs-you obligations. Roadmap and Releases show their stale state and an explicit discard action; the old wording and witnesses are retained. A later deliberate roadmap move prepares a new draft from the current approval. Published operator release names and tags use the publication's frozen display metadata.

Migration 0015 adds durable publication seals and backfills every already published release and status version, including versions predating native publication claims. Native publication writes and seals every target, recipient and context before the first delivery command in the same transaction. Insert, update and delete fences then preserve snapshot membership while the existing applying phase still permits controlled restore and erasure. Raw legacy sample fixtures created after migration are not native publication operations; they retain their original test setup semantics. No existing migration is rewritten.

The earlier mobile startup failure did not recur in the unchanged effective runtime reproduction at the README default port: fresh setup and recovery both became ready, and both process receipts recorded zero remaining owned processes. This is a bounded reproduction, not proof of the old failure's cause; the current two-width browser results are recorded above. Failed startup diagnostics now retain bounded private output only after known local secrets and token URLs are redacted, together with exit code and signal. No automatic startup retry or deadline change is introduced.

A subsequent independent diagnostic check exposed credential suffixes and magic-link tokens at raw-tail truncation boundaries. The current candidate conservatively discards incomplete truncated records and redacts complete command output before tail selection. After disk capacity was restored, the root reran all eight diagnostic tests plus two independent boundary counterexamples: 10 passed, zero failed or skipped, with zero owned Workers or browsers remaining. The integrated candidate has since passed clean-clone verification, all six browser scripts and the literal README setup/sign-in/outbox proof at both widths, plus pushed CI. Hosted deployment and delivery, and resource-scope checks remain pending.

## Historical Base inventory (superseded 10 October 2026)

Before single-pin adoption, the corrected installer, native owner claim,
editor and matching operator-auth selected
`bd6c68ccf7f7f63f554cead340ab7bc1b0879fa6`. The setup-field-definition
onboarding/schema update selected `d87263084afe700830be5d84db8ae1efcbc44c06`;
mail, deploy-kit, operations and edition-authoring retained
`5885264dd9d04b340a4d7218b31e5ad127d8484a`. These are historical provenance,
not the active module selection or publicly fetchable Penny revisions.

At preparation head `793e1220e4d3c0ad31a27126fc708c2393a53274`, the then-copied
onboarding suite and Penny command-custody regressions reported 223 executions:
219 passed, zero failed, four declared sibling/platform skips. The suite
included local/ and ui/ checks; ci-contract.test.mjs and template-adapter.test.mjs
were excluded because they inspect Base siblings. This bounded historical
receipt is not a check of the current runtime-only distribution. Shared Base
tests are now retained upstream; Penny keeps its product and adapter checks.
