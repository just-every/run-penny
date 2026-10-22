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

Current contract counts: 117 done, 62 partial, 68 missing (247 clauses).

CAP-009 is done against provider-edge fixtures (22 October 2026). Direct or BCC copies without recoverable forwarded headers are attributed to the admitted sender and marked not forwarded. Message-ID digests stay after erasure so a replay cannot recreate an item. Refusals keep only non-personal reason counts. Hosted Email Routing, a real domain and live mail acceptance: NOT RUN. Admission depends on the `Authentication-Results: mx.cloudflare.net;` header, which only a hosted receipt can confirm. HTML-only mail is refused (`excerpt_size_or_plain_text_required`). Captured source provenance records "Forwarded by <admitted sender>"; a recovered body address is labeled "Sender stated in forward".

| Clause | Status | Evidence boundary |
| --- | --- | --- |
| HOME-001 | partial | `tests/browser/route-review.mjs` — push Verify shard rich-changelog. Gap: owner-configured workspace identity and a changed portal description have no passing assertion. |
| DOCS-001 | partial | `tests/browser/route-review.mjs` — push Verify shard rich-changelog; `docs/site.json`. Gap: manifest navigation order; build/development rendering and rejection of unlisted Markdown, broken links and forbidden image paths; full header/footer and page-navigation semantics; client navigation and HTML escaping; and workspace/session/cookie isolation lack sentence-complete running assertions. |
| REL-010 | done | `tests/browser/route-review.mjs` — checkEmptyRoutes, push Verify shard rich-changelog, empty updates at 1440/390 with zero release articles. |
| EVID-002 | done | All source kinds retain original wording, observed time and recording operator; nullable supplied speaker/account and native portal requester attribution are asserted without inference. `tests/base/penny-evidence.test.ts` — push Verify base shards; `tests/browser/operator-pages-decisions.mjs` — push Verify shard loop-health |
| REQ-029 | partial | Native creation from evidence preserves operator authorship and evidence links and remains unpublished. Gap: skipping requester moderation and the complete explicit-publication transition lack passing assertions. `tests/browser/operator-evidence-flow.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard loop-health |
| ROAD-002 | done | Native internal-record edits persist owner, window, decision, bet, evidence, impact, confidence, notes and draft customer-safe wording while preserving status and separate approved projection at both widths. `tests/browser/operator-roadmap-record.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard loop-health |
| ROAD-008 | partial | Native status-update drafts and discard execute at both widths. Gap: every mapped request history, eligible-follower deduplication and repeat-publication refusal lack complete passing assertions. `tests/browser/operator-pages-status.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard loop-health |
| DATA-004 | done | The seven-entity matrix defines and edits fields in settings, persists and clears values through native record forms, reads as a second operator and excludes definitions/values from public documents and APIs at both widths. `tests/browser/operator-completeness-fields.mjs` via `tests/browser/operator-pages.mjs` — push Verify shard import-statuses |
| REQ-020 | partial | `requester-repair.mjs` is not loaded by Verify/nightly; own request and comment edits, retained approved text and auto-publish history needs complete running assertions. |
| INT-001 | partial | `integration-states.mjs` is not loaded by Verify/nightly; selected public events, immutable destinations and held restored history needs complete running assertions. |
| INT-003 | partial | `integration-states.mjs` is not loaded by Verify/nightly; durable attempt identity, bounded retries and explicit reconciliation needs complete running assertions. |
| INT-004 | partial | `integration-states.mjs` is not loaded by Verify/nightly; raw-byte signature admission and idempotent private inbound notes needs complete running assertions. |
| INT-005 | partial | `integration-states.mjs` is not loaded by Verify/nightly; Linear and Jira create/link and uncertain-outcome reconciliation needs complete running assertions. |
| INT-006 | partial | `integration-states.mjs` is not loaded by Verify/nightly; authenticated source-ordered tracker receipts and private state needs complete running assertions. |
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
