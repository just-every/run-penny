# Current bounded claims

CAP-009 uses the platform `email()` door, with provider-edge synthetic Gmail and
Outlook fixtures, private attachment limits, durable Message-ID digests and
notification-loop exclusions. Live Cloudflare Email Routing, a capture address
on an owner's domain and live mail delivery are **NOT RUN**. CONTRACT.md and
ACCEPTANCE.md remain the authoritative status and acceptance records.

Future AI-006 connector or mail reply drafts inherit explicit operator editing
and sending, never auto-send, and a fresh private-value check before publication.

## Published wording override awaiting a release round

NOTIFY-004 previously said: “The Worker has no mail handler and no route accepts
a mail message.” With CAP-009 it now says: “The Worker accepts inbound mail only
through CAP-009’s dedicated platform-invoked email handler; no HTTP route accepts
a posted mail message.” NOTIFY-004 remains done. No issued release metadata is
changed by this contract round.

DATA-005 published wording override (23 October 2026): `docs/DECISIONS.md`
previously said: “**Export individual votes (CSV)** includes that attribution.”
It now means: “Owner-only voter CSV includes proxy marks and recorder attribution;
source prose, source URLs and email addresses stay out. Source attribution stays
in the private supporter list.” The release-round documentation update is owed;
no issued envelope or release metadata changes. CAP-014 retains its recorder
CSV assertion. ct confirmed this bounded CSV policy on 23 October 2026 at 12:54Z.



REQ-039 is qualified with Google and GitHub fixtures at their network edges,
including cookie-free browser completion. Real consent, an owner's OAuth client,
hosted redirect URIs and provider-console acceptance are NOT RUN. WIDGET-006 and
WIDGET-008 inherit: on an SSO-required portal only WIDGET-008 applies; current
Penny has no such portal state. ROLE-002's status is unchanged.


AI-008 is partial. Deterministic rules cover operator evidence, email capture,
wording edits and requester submissions (including held submissions), through
one shared text-redaction function. Rule-only detection passed the versioned
redaction-v1 synthetic set; this is not a guarantee for arbitrary real data.
There is no model detection. Binary attachments are not rewritten.

Open coverage: saved-import originals and learning source envelopes retain their
source identity/citation custody and are not redacted by this feature. Explicit
reapplication currently covers at most 200 stored evidence wording versions,
not every copied excerpt, transcript or larger store. AI-008 retains the full
contract and remains partial until those gaps close. AI-011 remains missing and
inherits extending the minimal set loader/metrics runner.

EVID-010's ordinary edits still create versions and retain earlier versions.
Explicit AI-008 privacy reapplication permanently replaces matched wording in
those retained versions; version and evidence IDs stay stable, counts are
previewed, and an owner must confirm. This privacy operation is audited and
cannot recover the original text from Penny.

## Evidence reconciliation · 22 October 2026

Current contract counts: 121 done, 60 partial, 66 missing (247 clauses).

CAP-009 is done against provider-edge fixtures (22 October 2026). Direct or BCC copies without recoverable forwarded headers are attributed to the admitted sender and marked not forwarded. Message-ID digests stay after erasure so a replay cannot recreate an item. Refusals keep only non-personal reason counts. Hosted Email Routing, a real domain and live mail acceptance: NOT RUN. Admission depends on the `Authentication-Results: mx.cloudflare.net;` header, which only a hosted receipt can confirm. HTML-only mail is refused (`excerpt_size_or_plain_text_required`). Captured source provenance records "Forwarded by <admitted sender>"; a recovered body address is labeled "Sender stated in forward".

| Clause | Status | Evidence boundary |
| --- | --- | --- |
| HOME-001 | partial | `tests/browser/portal-identity-checks.mjs` via `tests/browser/route-review.mjs` — push Verify rich-changelog, build-time branding label and two changed descriptions at 1440/390, signed-out isolation and claim exclusion. Gap: the owner’s runtime company name does not replace the build-time portal label; changed workspace identity has no passing assertion. Description changes, old-description exclusion, signed-out isolation and claim exclusion pass at 1440/390. |
| DOCS-001 | partial | `tests/browser/route-review.mjs` — push Verify shard rich-changelog; `docs/site.json`. Gap: manifest navigation order; build/development rendering and rejection of unlisted Markdown, broken links and forbidden image paths; full header/footer and page-navigation semantics; client navigation and HTML escaping; nested-unknown-slug 404/article exclusion; and workspace/session/cookie isolation lack sentence-complete running assertions. |
| REL-010 | done | `tests/browser/route-review.mjs` — checkEmptyRoutes, push Verify shard rich-changelog, empty updates at 1440/390 with zero release articles. |
| EVID-002 | done | All source kinds retain original wording, observed time and recording operator; nullable supplied speaker/account and native portal requester attribution are asserted without inference. `tests/base/penny-evidence.test.ts` — push Verify base shards; `tests/browser/operator-pages-decisions.mjs` — push Verify shard loop-health |
| REQ-029 | done | One and several evidence sources retain operator authorship and all links without a requester submission hold. Explicit public-wording approval publishes only approved fields; original evidence stays private. The existing CORE journey asserts the publication and public detail at 1440/390. `tests/base/operator-request-publication.ts` — proveOperatorPublication in `tests/base/penny-evidence.test.ts` (captures source provenance, push Verify base shards): one/several evidence links, operator authorship, no held requester submission, private-before/approved-after fields and private-evidence exclusion; `tests/browser/operator-evidence-flow.mjs` via `tests/browser/operator-pages.mjs` CORE — explicit publication and public detail at 1440/390, push Verify loop-health |
| ROAD-002 | done | Native internal-record edits persist owner, window, decision, bet, evidence, impact, confidence, notes and draft customer-safe wording while preserving status and separate approved projection at both widths. `tests/browser/operator-roadmap-record.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard loop-health |
| ROAD-008 | done | Publishing adds the version to both approved mapped requests and leaves unapproved/unmapped controls untouched. A follower of both receives one intent per version; a muted follower receives none; two versions coalesce into one email. Repeating publication refuses with a reason and changes no history, intent or mail. CORE asserts both histories at 1440/390. `tests/base/roadmap-update-publication.ts` — proveRoadmapPublication in `tests/base/board.test.ts` (publication and real scheduled mail, push Verify base shards): both approved mapped histories, unapproved/unmapped controls, one intent per eligible identity/version, muted-follower exclusion, coalesced mail and unchanged repeat; `tests/base/notifications.test.ts` (public event intent is atomic; fixed windows include all approved events, exclude held/internal/voter-only; rechecks each configured input after enqueue); `tests/browser/operator-pages-status.mjs` via `tests/browser/operator-pages.mjs` CORE — publication, both public histories and repeat refusal at 1440/390, push Verify loop-health |
| DATA-004 | done | The seven-entity matrix defines and edits fields in settings, persists and clears values through native record forms, reads as a second operator and excludes definitions/values from public documents and APIs at both widths. `tests/browser/operator-completeness-fields.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard import-statuses |
| REQ-020 | partial | The native requester journey edits its own request into moderation and reopens an appeal at both widths. Gap: own-comment editing, retention of approved public text during review, and auto-publish edit/history lack passing assertions. `tests/browser/requester-repair.mjs` — push Verify shard requester-board |
| INT-001 | partial | Native integration configuration runs with outbound transport disabled. Gap: selected public event kinds, immutable destinations, atomic business-write/event-target capture, held restored history and portable safe integration history with nonportable credentials lack complete passing assertions. `tests/browser/integration-states.mjs` — push Verify shard workspace-clock |
| INT-003 | partial | Native integration setup and restart execute. Gap: durable attempt identity, finite retry, ambiguity/reconciliation and revoked/private/blocked send fencing lack complete passing assertions. `tests/browser/integration-states.mjs` — push Verify shard workspace-clock |
| INT-004 | done | Raw-byte signature and bounded-input refusal, atomic note/receipt/replay rollback, restart replay and stale native authority pass; receiving changes no request, identity or consent and issues no cookie or bearer at both widths. `tests/browser/integration-receiver-checks.mjs` via `tests/browser/integration-states.mjs` — push Verify shard workspace-clock |
| INT-005 | partial | The native journey links a selected Linear issue and confirms creation is disabled without outbound transport. Gap: complete Linear/Jira create and link from requests/decisions, entered-only wording and uncertain-outcome reconciliation lack passing assertions. `tests/browser/integration-states.mjs` — push Verify shard workspace-clock |
| INT-006 | done | Both Linear and Jira verify original bytes and configured identity, reject conflicting equal-time and stale-authority events, preserve newer source state, atomically roll back receipt/state failures and retain replay after restart; public API/SSR exclude private state and no Penny status update is created. `tests/browser/integration-tracker-checks.mjs` via `tests/browser/integration-states.mjs` — push Verify shard workspace-clock |
| OPS-003 | done | Ready and review-due decisions, unreviewed evidence, Planned and In progress items, current releases with revision-deduplicated outcome totals, record links and empty creating actions pass at both widths. `tests/browser/operator-pages.mjs`; `tests/browser/operator-overview-checks.mjs` — push Verify shard loop-health |
| EVID-003 | done | Native linking to request and bet, creating request and decision, explicit review reason and return to unreviewed pass without implicit review at both widths. `tests/browser/operator-evidence-flow.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard loop-health |
| EVID-001 | done | `tests/base/penny-evidence.test.ts` — "captures source provenance atomically and keeps originals private with durable replay and upload custody"; `tests/base/no-mail-identity.test.ts` |
| EVID-004 | done | `tests/base/decision-loop-commit.test.ts` — "derives hand-computable dimensions and immutable current-version snapshots" |
| REQ-001 | done | `tests/base/board.test.ts` (line 16); `tests/base/board-categories.test.ts` (line 15); `tests/base/penny-evidence.test.ts`; `tests/browser/requester-blocking.mjs`; `tests/browser/roadmap-public-eta.mjs`; `tests/browser/rich-changelog.mjs` |
| ROAD-004 | done | `tests/base/decision-loop-roadmap.test.ts` (line 9); `tests/base/decision-loop-roadmap.test.ts` (line 17); `tests/base/request-status-workflow.test.ts` (line 7) |
| ROAD-006 | done | `tests/base/decision-loop-roadmap.test.ts`; `tests/browser/roadmap-public-eta.mjs` — approved-only columns and counts, mapped request, published release on card and detail at 1440/390 |
| REQ-039 | done | Provider-edge acceptance; live consent/client/redirects NOT RUN. |
| CAP-009 | done | Provider-edge capture, provenance, structured forwards, archive and erasure. Hosted mail NOT RUN. |
| AI-008 | partial | Deterministic redaction only; existing storage/reapplication gaps remain. |
| AI-011 | missing | Model selection, complete evaluation receipts/sets and table-driven quality bars remain. |
| DATA-005 | partial | `tests/base/csv-export-proof.ts` via `tests/base/hosted-export.test.ts` — push Verify base shards; `tests/base/proxy-votes.test.ts`; `tests/browser/proxy-votes.mjs` — push Verify proxy-votes, downloaded request and voter CSV at 1440/390; `tests/browser/saved-view-checks.mjs` via `tests/browser/ownership-journey.mjs` — push Verify ownership. Requests and individual voters reconcile record/vote counts, proxy marks and recorder attribution; formula cells, RFC 4180 quoting, UTF-8 without BOM, withdrawn/erased identities, private fields, audit and current Owner authority are asserted. Default ADOPTED (ct confirmed 23 October 12:54Z): Owner only, no email, commercial fields or source prose/URLs. Gap: evidence/notes, features/hierarchy, accounts/requesters with attributes, roadmap/releases, role-by-field restrictions. Requests CSV also exports exactly the saved requests view under current authority; saved views for the other record families remain unbuilt. |
| TRIAGE-006 | partial | `src/core/features/learning/scheduled.ts`; `tests/base/learning-stage3.test.ts`; `tests/base/notifications.test.ts`; `tests/runtime/mail-kill-proof.mjs` via `tests/runtime/mail-events-restart.test.mjs` — push Verify static (test:mail-runtime). Requester-update mail kill/restart after provider-edge acceptance retains durable unknown/interrupted failure, repeats without a second message and exposes the same failure through the operator API. Gap: resolved-state proof and equivalent kill/restart proof for learning runs, scheduled publications and reminders; release/rejection/review mail variants and integration webhook/tracker deliveries; connector sync, rules and delivery sync are not built. |
| OPS-006 | partial | `tests/base/list-views-proof.ts` via `tests/base/prioritisation.test.ts`; `tests/base/hosted-export.test.ts`; `tests/base/upgrade.test.ts`; `tests/base/penny-erasure.test.ts` — push Verify base shards; `tests/browser/saved-view-checks.mjs` via `tests/browser/ownership-journey.mjs` — push Verify ownership at 1440/390. Requests and inbox/evidence save validated filters, sort and columns; a second operator gets the shared result set and cannot discover/read private views. Roadmap has its own asserted product/component/owner filters and presentation. Stored tag/custom-field ids survive deletion as removed filters; invalid/foreign fields are refused. Defaults ADOPTED: creator-only private visibility; shared edits by creator/Owner/Admin; current viewer authority; JSON backup refuses another operator’s private views and restored private views remain held. Gap: features, accounts and releases; arbitrary fields, theme/segment and sentence-complete owner/date/custom-field coverage for every list; role-by-field authority, sealed held archive custody for private definitions that no tool renders, and reactivation only in the creator’s own session after restore. The interim refusal gives the aggregate blocked-view count and creator share/delete actions, without names or definitions (ct confirmed 23 October 12:54Z). |
| ROAD-009 | partial | `tests/base/roadmap-views-proof.ts` via `tests/base/product-hierarchy.test.ts` — push Verify base shards; `tests/browser/roadmap-view-checks.mjs` via `tests/browser/product-hierarchy.mjs` — push Verify product-hierarchy, three layouts, shared view and keyboard transition at 1440/390. Status board, Now/Next/Later and month/quarter timeline retain the same product/component/owner-filtered items, save/share presentation and use ROAD-001 for moves. Existing target windows and linked release dates supply buckets. Gap: theme and segment filters; ranged start/end windows are not stored; undated target wording remains Unscheduled, and a quarter-only target stays a quarter bucket in month mode. |
