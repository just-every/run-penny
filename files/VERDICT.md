# REQ-023 independent exact-source verdict

REQ-023 STAYS PARTIAL. R1 is MET. R2 is UNMET only for its frozen requirement to exercise populated notification custody: the expiry journey preserves a populated request but snapshots empty notification tables. This is a bounded proof gap, not an observed product data-loss defect. The candidate's status promotion is not accepted.

Tag: ct-judge-penny-req023-20261105-1430-sol1  
Repository: just-every/run-penny  
Exact source: f8377876c502bb0c5a99de92f7964c6f30e41c76  
Source branch: cloud/sd-penny-c-f24  
Parent: 1d278bb9a1582cb59f92d7a41e131ed6286444c0  
Actual model and reasoning: gpt-6.1-sol, xhigh, under the 2026-11-06T01:26Z single-use replacement authority. No model API, paid credits, subagent or successor session was used.

The original commission, exact source, frozen rubric and lifetime FIX custody were retained. The supplied commission states that no previous same-source CT judgment or duplicate judge exists; I did not access private fleet history or rejudge another SHA. accepted(source) remains empty. No source acceptance, hold change, release, submission, deployment or landing is authorized by this report. This report supersedes no older refusal.

## Product context from the pinned contract

Category: Product feedback management and public roadmaps.

First buyer: A US product team (head of product, product managers, product operations) at a B2B SaaS business, installing Penny on its own Cloudflare account; revenue is ARR and MRR in USD, on US time zones.

Incumbents: Canny, Productboard, Aha! Ideas and UserVoice. The contract also names Featurebase, Productlane and Enterpret as the newer bar. The job is to capture and attribute customer feedback, organize and weigh it, decide accountable bets, publish approved roadmap and release wording, and close the loop with requesters. These descriptions come only from pinned CONTRACT.md.

## Clause table

| Clause | Full assigned duty and inherited boundaries | Public-door journeys and acceptance coverage | Exact-source execution and recorded Verify | Judgment |
| --- | --- | --- | --- | --- |
| REQ-023 | Requirement: emailed link is single use and expires after 30 minutes. AP1: browser-local requester token, first interaction, 30-day idle expiry, no portal cookies. AP2: submission, vote, follow and comment are held for 24 hours without product, public or notification effects, applied on first timely verification or discarded permanently. Preserve requester-only authority, successful verification and timely replay. Retain all 11 DONE riders and existing live-provider and SSO-required-portal boundaries. | Two journeys in `tests/base/requester-expiry.test.ts` use emitted Worker POST identity email, POST identity email verify, GET identity session, POST requests and request participation routes, GET request detail and GET requester activity. They perform link reuse and expiry refusal, active and idle session deadlines, all four holds, exact deadline discard, later verification and reads, unchanged public request, and a later explicit allowed vote. `tests/base/no-mail-identity.test.ts` performs delivered-link consumption and held-submission replay without a configured mail provider. `tests/base/auth.test.ts`, through `tests/base/requester-oauth-fixture.ts`, performs timely replay of all four actions, provider-edge verification, invalid-state refusal, no-cookie checks and refusal of requester tokens at operator doors. `tests/browser/no-mail-journey.mjs` is retained; its original execution failed on stale copy. A separate manual functional browser observation completed the same no-mail submission flow at 1440 and 390. | Native: 3 files, all 17 tests PASS on this SHA, 49.69 seconds. Original browser: exit 1 at line 38; not PASS. Manual functional browser: exit 0, two verified submissions, zero cookies and zero mail calls. Verify Penny push run 42036312798 is supplied as failed only on generated views and consequential steps; runtime shards did not run. No CI poll, rerun or dispatch. Native tests are included collectively by the push base-1 and base-2 shards; the standalone no-mail browser script is absent from the pinned verification plan. Full exact-FINAL runtime Verify containing the relied-on journeys remains pending. | STAYS PARTIAL: frozen R2 populated notification custody is not performed; DONE riders 1 and 2. No NEW finding. R1 MET. Final rows 3 and 11 are pending guards, not an additional source acceptance. |

## Full original clause, unchanged

Requirement. A requester verifies an email address by following a single-use link sent to it; the link expires 30 minutes after it is sent and fails after one use.

Acceptance.

1. The verified session is a browser-local token created at the requester's first interaction and expiring after 30 days without use, so no portal surface sets a cookie.
2. An identity-required action attempted before verification is held for 24 hours, applied on the first verification of that address, and otherwise discarded, and it creates no vote, public record, or notification while held.

No acceptance sentence, expiry policy or inherited duty was changed. REQ-023's published metadata is Core and has no clause-specific Base supersession. The shared Base session, public privacy, current authority and explicit mail-onboarding exception remain operative. REQ-039's provider sign-in uses the same requester session path and grants no operator authority or permission by sign-in alone. The unimplemented SSO-required portal remains with WIDGET-006, WIDGET-008 and WIDGET-009; this judgment does not transfer those duties or promote those clauses.

## Frozen rubric, retained verbatim

R1 / Requirement and AP1: a single-use emailed link expires thirty minutes after sending and fails after use. Verified requester identity uses a browser-local token created at first interaction; successful use renews its thirty-day idle deadline, and unused/renewed-but-idle expired sessions refuse without custody changes. No portal surface sets a cookie. Retain existing successful verification/timely replay and requester-only authority.

R2 / AP2: all four preverification identity-required actions (submission, vote, follow, comment) are held twenty-four hours, with no product/public/notification effect while held. First verification inside the deadline applies them; otherwise fresh verification discards them and no later verification/session/activity/public read replays them. Exercise populated product and notification custody; stable state on refusal.

| Frozen row | Score | Code and executed evidence | Remaining outcome |
| --- | --- | --- | --- |
| R1 | MET | The first `tests/base/requester-expiry.test.ts` journey, “emailed links consume once; requester use renews thirty-day idle sessions and expired credentials change nothing”, passed. It obtains emailed links at the provider edge, consumes one, refuses reuse, refuses an unused link at 30 minutes, renews at day 29 to day 59, refuses the unused session at day 30, renews the active session to day 60, then refuses that renewed-but-idle session and a vote attempt at day 60 with unchanged sessions, addresses and product custody. `src/core/features/auth/native-service.ts` checks unconsumed future-expiry links and current unrevoked sessions; `src/core/features/auth/verified-requester.ts` mints the opaque session. `src/core/features/auth/requester-pending.ts` creates the browser pending token on interaction; `src/core/features/auth/ui/verify-requester.tsx` stores the verified token in localStorage. The delivered-link and OAuth journeys passed; the OAuth helper checks no Set-Cookie and rejects requester authority at operator APIs. Manual browser observations at both widths show localStorage admission, 200 session reads, 201 submissions, no Set-Cookie on observed public responses and zero cookies. | None within this frozen row. Local runtime and HTTP-edge mail proof do not establish hosted mailbox delivery or real OAuth consent. |
| R2 | UNMET | The second expiry journey, “four held actions expire after twenty-four hours, are discarded on fresh verification and never replay on later reads or verification”, passed on a real published request with its evidence and author vote. It performs all four public writes as holds, verifies the immutable 24-hour deadlines, checks unchanged product custody and public detail before expiry, refuses the stale emailed link, freshly verifies at the deadline, checks that all holds are gone, then performs session, activity, public reads, another verification and replay refusal without recreating them. A new explicit vote then succeeds. `tests/base/no-mail-identity.test.ts` — “delivered verification consumes once and replays its held submission after outbound mail is removed” passed. `tests/base/auth.test.ts` — “requester OAuth verifies at the provider edge without cookies or operator authority; missing mail fails closed” passed; its helper applies a Google held vote and GitHub held follow, comment and submission. `src/core/features/requests/pending-actions.ts` removes expired holds and replays only current bound actions. | No relied-on expiry journey starts with existing notification event, intent, outbox or attempt custody and then checks it survives holding, expiry, discard and refusal. Populated product custody is present; populated notification custody is absent. This is the original R2 outcome, not a new test-count or per-field criterion. |

## Sole substantive blocker: populated notification custody

At `tests/base/requester-expiry.test.ts` lines 86–97, the expiry setup creates an owner, one verified requester, one public board, one request and its evidence. It invokes `tests/base/explicit-consent-board.ts`, which turns vote subscriptions off. The submission has emailUpdates false. The request is then approved without posting a public comment or status update, following it, or creating another notification-bearing event.

The publication trigger in `migrations/core/0071_author_publication_permission.sql` lines 4–12 inserts an author publication event only when a current submission-origin permission exists. This setup creates none. The status and comment event triggers in `migrations/core/0010_request_notifications.sql` are not exercised by this setup. There is therefore no existing business notification event, intent, outbox or attempt for the custody snapshot to preserve. The nonempty messages array holds identity-verification email; it is not pre-existing requester-notification custody.

The equality checks on the snapshot correctly prove no notification is added while held, but they do not perform preservation of populated notification state. No other named relied-on journey combines existing notification custody with the 24-hour expiry and discard path. This is the empty-state issue identified by DONE rider 2 and the explicit final sentence of frozen R2. It is not a demand for an assertion per table, an extra screen, mutation testing, provider operation or a larger suite.

Disposition: keep REQ-023 partial. CT retains the original lifetime FIX custody for the unperformed R2 outcome. No fix was made or successor commissioned here. No introduced exposure, actual data loss, plausible runtime regression or ordinary runtime correctness defect was found; NEW = 0.

## Browser result and bookkeeping notes

The original no-mail script was read end to end with its helpers and executed once, unchanged. It reached the operator no-mail page, public board and disabled verification form at 1440, then timed out waiting for “Verified as Verified requester. Submission grants no email update permission.” The actual pinned page says “Verified as Verified requester. Your vote is recorded when you submit.” The changed wording is plain at `src/core/features/portal/ui/submit-feedback.tsx` line 33. No 390 leg or original-script submission completed. The original script remains FAILED; it is never counted as PASS.

A separate manual browser observation used the existing runtime and audit helpers against the unchanged emitted Worker, with the rendered wording. It completed sign-in unavailability, public reading, disabled verification, localStorage verified-session admission, form submission and both outbox 404 reads at 1440 and 390. It recorded ten screenshots, zero application diagnostics, zero external browser requests, zero axe violations, no horizontal overflow, two requests with two evidence items and two votes, no update permissions or notifications, and zero mail calls. These are functional observations, not a UI-quality judgment or a passing original journey. The first manual stdin attempt failed during worker startup because eval module mode reached a CommonJS worker; the file-based run under Node 22.20.0 completed. Both failures and the successful observation are retained.

The stale copy expectation is F bookkeeping, never a product FIX or the reason for STAYS PARTIAL. The pinned push plan also does not invoke the standalone no-mail browser script; native R1 and R2 tests are selected collectively by the push base-1 and base-2 shards. Carry browser invocation and wording as C NEXT planned-touch notes, without inventing a source acceptance or weakening the final requirement that relied-on runtime journeys execute in exact-FINAL Verify.

## DONE-RIDERS 1–11

| Rider | Finding |
| --- | --- |
| 1 | UNMET only for frozen R2's populated notification-custody preservation. All other original R1 and R2 outcomes have named executed native public-door evidence. |
| 2 | UNMET for the same outcome: product state is populated, but the compared notification tables are empty in the expiry path. Supported and unsafe session cases, timely replay and expiry discard are otherwise executed. |
| 3 | PENDING final integration guard. Supplied push run 42036312798 failed generated-view freshness before runtime. It is not full runtime green. Native journeys are selected by the push base shards. Standalone no-mail browser invocation is not in the pinned plan. No new CI operation was performed. |
| 4 | MET for local evidence: every executed source and test remained at the exact SHA; tracked status stayed clean. The direct parent diff changes only CHANGELOG.md, CONTRACT.md, sources.lock.json and the new expiry journey. Runtime, screens and existing assertions are unchanged. |
| 5 | INSPECTED: full pinned contract, shared duties and BASELINE.md read; REQ-023 is not a Base supersession. Requester-only authority and cookie isolation remain covered by the named tests. No duty from another clause is imported as a new refusal. |
| 6 | Mechanical PENDING: CONTRACT.md proposes done and 78 done, 125 partial, 78 missing, while ACCEPTANCE.md retains partial and 77 done, 126 partial, 78 missing. Full requirement and acceptance bodies match for all 281 IDs; REQ-023 is the only generated-view status, Evidence or Gap difference. Both documents retain old Judged-from provenance. Generator check exit 1 names only ACCEPTANCE.md and docs/CLAIMS.md. Do not hand-edit or commit generated views. |
| 7 | INSPECTED: requirement and acceptance are unchanged; no business assertion was deleted, skipped or weakened. Relevant rulings introduce no REQ-023 policy change. Existing duties remain; no new rubric criterion was added. |
| 8 | MET within the assigned requester scope: verified access and timely replay succeed; reused or expired credentials and invalid OAuth state are refused; requester bearer authority is refused at operator routes. No new operator permission is granted. Populated notification safety remains the same rider 2 gap. |
| 9 | UNMET-EXTERNAL boundaries retained: actual mail delivery to a hosted mailbox, live Google or GitHub consent, owner clients and redirect acceptance, hosted deployment and native-device proof were not run. HTTP-edge fixtures and local D1 are the bounded claims. They are not added as blocking rubric rows. |
| 10 | INSPECTED: no policy default, configuration, source pin, acceptance text or authority choice changed. Existing 30-minute, 30-day and 24-hour policies remain. No missing ruling is invented. |
| 11 | PENDING and unestablished: no landing receipt, complete full-history NEW 0 scan, exact-main equality, exact-FINAL full runtime Verify or exact-main Run site was supplied or obtained. Nothing was landed or counted by this review. |

## Commands and receipts

COMMAND-RECEIPT.json records the actual commands, exits and omissions. Logs are complete non-secret command output. The important results are:

| Command | Exit and result |
| --- | --- |
| Frozen pnpm dependency installation through cloud_run | 0 |
| npx -y @runeditrun/rer build through cloud_run | 0; rer selected project Node 22.20.0 |
| pnpm exec vitest run --config vitest.base.config.ts tests/base/requester-expiry.test.ts tests/base/no-mail-identity.test.ts tests/base/auth.test.ts | 0; 17 of 17 tests across 3 files, no skips, 49.69 seconds |
| node tests/browser/no-mail-journey.mjs, Chromium at /usr/bin/chromium with no-sandbox | 1; original stale-copy timeout at 1440; not PASS |
| Manual browser stdin attempt | 1; worker startup module-mode error; not proof |
| Manual file-based browser observation under Node 22.20.0 | 0; full functional flow at 1440 and 390; separate receipt and screenshots |
| pnpm run typecheck | 0 |
| pnpm run source:check | 0; source lock current |
| node src/base/contract-docs.mjs check | 1; only the two generated-view freshness errors |
| Immutable raw reads of CONTRACT.md, ACCEPTANCE.md, AGENTS.md and RULINGS.md | HTTP 200; full bytes match clone |
| gh api source commit, restricted to SHA, parents and file diff | 0; one GitHub budget call, no CI calls |

INSPECTED: full pinned CONTRACT.md and its 281 clauses, full ACCEPTANCE.md through acquisition and complete body and metadata comparison, AGENTS.md, BASELINE.md, RULINGS.md, direct source diff, all four named journeys end to end and their direct relied-on helpers. SOURCE-RECEIPT.json and INSPECTION-RECEIPT.json contain immutable hashes and the precise generated-view delta. The supplied original builder READY and affected gate exit 0 are commission context, not independently reproduced Mac receipts.

NOT RUN: setup of a separate local installation (the emitted-Worker harness owns disposable runtime state); full or baseline suite; generator write or source-lock mutation; new per-point product tests or mutation testing; CI polling, dispatch, rerun or archive downloads; live provider, device or deployment operations; publication scan; main updates; product commits, pushes or PRs. These were unnecessary or prohibited by the read-only commission. The supplied toolchain shim selected Node 24.19.0 for direct pnpm commands because it exceeds its minimum; build selected the pinned Node and the final manual browser run explicitly used Node 22.20.0. No pins changed.

## Exact status, Gap and counts

The candidate proposes only REQ-023 partial to done, replaces its old Gap with an empty cell, and adds the expiry and delivered-link evidence while retaining OAuth and browser evidence. Candidate counts are 78 done, 125 partial and 78 missing across 281 IDs. The parent and stale generated view are 77 done, 126 partial and 78 missing. Published counts change from 57 done, 58 partial, 1 missing to 58 done, 57 partial, 1 missing; target and push-further counts stay 20 done, 68 partial, 77 missing.

Judgment: no promotion. Recommended count result is 77 done, 126 partial, 78 missing across 281 IDs. This does not replace a fresh-main count or sum concurrent proposals. No status or count was edited here.

Exact proposed source flip for the lane, subject to fresh-main assertions: REQ-023 done to partial; retain the new native evidence and record the browser result truthfully. Replace the Gap with:

> Preservation of pre-existing notification custody while the four held actions expire and are discarded is not exercised: the journey snapshots empty notification event, intent, outbox and attempt tables. Link expiry and single use, idle-session renewal and expiry, timely replay of all four actions, and twenty-four-hour discard without later replay are asserted.

The old generated Gap says idle session expiry and 24-hour discard have no passing assertion. That is now stale: those native outcomes passed. The new Gap names the remaining frozen outcome without narrowing the requirement. The browser wording failure is a separate bookkeeping note, not this substantive Gap. On any later integration, generate summaries and views from CONTRACT.md, never hand-resolve them, and regenerate the source lock last. This review makes no source edit or integration commitment.

## Remaining integration and custody guards

All original fresh-main guards remain: preserve EVERY newer Status AND Gap, Evidence and provenance cell and every newer assertion; resolve the contract source before generated views; write and check the merged generator and counts with correct provenance; restore the generated views to main as instructed; relock source last and check it; actually execute complete green runtime Verify on the exact FINAL source including the relied-on journeys; run the COMPLETE full-history publication scan with NEW 0; and obtain guarded main equality plus exact-main Run site success and the lander's receipt. No generated-view-only CI exception is represented as full runtime green. None of these guards or the lifetime FIX hold is released here.

The report packet is published separately to evidence/ct-judge-penny-req023-20261105-1430-sol1. Evidence custody does not signal product READY, acceptance or landing. The replacement product branch is not created, no PR is opened, and the existing source branch is not pushed. After report publication, the disposable clone and its dependencies are deleted as commissioned; actual teardown is confirmed in the terminal return after it occurs.
