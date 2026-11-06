# sd-penny-c-f97 results

Repository: https://github.com/just-every/run-penny
Product branch: `cloud/sd-penny-c-f97`
Product commit: `a8906f92a14aa564ecfe444bdc8f61595b9b5425`
Parent and synchronized main at push: `0d6f3416c75fe29675323ad1a2ef4bd1f8086756`

## Scope and status

MEAS-004 remains **PARTIAL to PARTIAL**. This implements the selected native feedback-volume count and export portion of acceptance point 1. It does not complete that acceptance point across all promised reports and does not claim DONE. Counts remain **79 done, 124 partial, 78 missing, 281 total**. Every one of the parent's 281 Status rows and all 445 table lines are retained. Only MEAS-004's Evidence and Gap cells changed; its requirement and three acceptance sentences did not change.

The plan extract's selected MEAS-004 row gains the native count and export proof. No Mac plan, inbox or state file was read or changed. No next clause was selected: the POINTS section expressly excludes the other native reporting work in this round. PLAN.md contains the complete executed plan.

## Product behavior

Native operator routes serve JSON at `/api/operator/reports/feedback-volume` and CSV at `/api/operator/reports/feedback-volume.csv`. Both require explicit RFC 3339 `from` and `to` instants with offsets. The window includes its start and excludes its end, normalizes to UTC, advances, and is bounded to 366 days. Unknown and duplicate filters and invalid dates return 400. Every intersecting UTC day appears, including empty days; partial days include only records inside the window.

Requests count at `requests.created_at`, grouped by current board. Evidence counts at `evidence_items.created_at`, the recorded capture time, grouped by source type. Historical observation time is not capture time. Each retained record counts once, including held or rejected requests, merged requests and archived-board records while stored. Changes in links, versions, votes or published wording do not add a capture. Erased rows do not appear in subsequent reads. This reports retained volume rather than immutable board-movement history.

The request and evidence aggregates execute separately in one D1 batch, preventing joins to links or versions from multiplying either metric. The existing read-only database guard rechecks current operator session, membership version and expiry inside that batch. No new authority is granted. Missing, requester-only and revoked operator credentials return 401. Reports are private, no-store and nosniff. They expose only aggregate counts and board or source labels, without evidence wording or person and commercial fields.

CSV downloads reproduce window and daily metric totals and groups, with explicit period and group columns. All cells are quoted, embedded quotes are doubled, rows use CRLF, and active spreadsheet formula prefixes receive an apostrophe. OPERATIONS.md documents these semantics. No migration, configuration, homepage, screen or Base pin changed.

## Public-door proof

`tests/base/feedback-volume-report.test.ts` — **native feedback volume reconciles private JSON and CSV windows without multiplying linked records**.

One new sanity-journey registration, zero registrations removed. No existing assertion was deleted, narrowed, skipped or moved behind a condition. The focused file is covered by the existing push Verify base-test globs; no workflow or verification configuration changed. The pre-existing suite already uses helper registrations and multiple test runners; no claim is made that a simple source regex is its authoritative test count.

- Lines 34–72 create two boards, five requests and five evidence items through existing native routes, then set independently declared historical fixture timestamps. Each evidence item links to three requests. One in-window evidence item is revised through its native route; its original observation date is outside the report window.
- Lines 73–92 publish a request, add a requester vote and assert the entire JSON response: exactly three requests and three evidence items; two requests in the public board and one in the internal board; two interviews and one email. Request day totals are 2, 0, 1 and evidence day totals 1, 1, 1. Start-inclusive and end-exclusive fixture records, including timezone-offset records, determine these hand-declared results.
- Lines 93–111 download and parse the entire actual CSV, including a private board label with comma, quotes, newline and a formula prefix. Every row is compared to independently declared expected rows, including all daily and window group counts.
- Lines 112–122 assert an offset-normalized partial-day window and empty JSON and CSV windows with zero daily totals.
- Lines 123–128 read a populated public list and approved detail. The public request remains visible and the internal board label, private evidence markers and report fields are absent.
- Lines 129–142 exercise malformed and duplicate and unsupported filters on both formats, anonymous and requester refusals, then sign out the native operator and prove both routes refuse the revoked cookie without changing request or evidence records.

PROBE MEAS-004 1: built Worker GET `/api/operator/reports/feedback-volume` and its CSV route with five native requests, five native evidence items and a window from 2026-10-01T00:00:00.000Z to 2026-10-04T00:00:00.000Z -> exact JSON and CSV totals requests=3 evidence=3; board totals=2+1; source totals=1+2; daily boundaries, empty windows, escaping, populated public privacy and both-format authority refusals passed.

The focused journey passed on the exact committed product SHA. The full actual Vitest receipt and log are in touched-tests.json and touched-tests.log. Initial local fixture failures were an existing board consent-disclosure refusal and the actual 204 sign-out response; the fixture now configures explicit consent and expects that native response. These were pre-candidate fixture development, not CI repair rounds.

## Checks and custody

- Production build passed. build.log contains actual non-secret build output.
- Typecheck passed on the final source and test bytes; typecheck.log is its actual output. The dispatcher uses the repository's Node 22.20.0 for build and setup; the shell provides Node 24.19.0 for the passing direct typecheck and test commands.
- Focused oxlint passed without warnings after replacing unused destructured mapping parameters.
- First-party structural check passed with exit 0.
- The contract generator write and check both passed after the last source edit and synchronization. Generated views were restored whole from origin/main and are absent from the product diff. contract-generation.log records the actual generator output. Candidate view freshness can therefore fail as expected until the lander regenerates those views.
- The documented source-lock generator ran last and source-lock check passed, including on exact committed HEAD. No migration was added, so migration-ledger verification is not applicable.
- Candidate commit identity and trailers were checked over the full candidate range, including side parents. identity-audit.txt records the result. The cleanup hook and original repository hooks remained active.
- The product push guard succeeded on its first attempt, and an independent remote-ref readback matched the full product SHA. The first real commit is the only product commit. No published history was rewritten; no default branch was pushed; no pull request was needed because push starts Verify directly.
- Publication scan, guarded main landing and exact-main Run site are fleet duties. No COMPLETE scan or landing is claimed here. No source lock or generated view was hand-resolved.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check, restored origin/main views exit=0; ledger=none exit=0.

## DONE riders and self-check

No DONE promotion or ct judge request is made. The broader requirement remains open; the following table makes the bounded proof explicit.

| Rider | Result for this candidate |
| --- | --- |
| 1 | PASS for the selected native counts and export slice, test lines 34–122. UNMET for dashboards, remaining dimensions, timing and scheduled delivery; clause stays PARTIAL. |
| 2 | PASS for nonempty independent expected results, linked-record fan-out and allowed and refused reads, lines 34–142. |
| 3 | Local exact-SHA journey PASS; push Verify status is recorded in the CI receipt. No full-clause DONE claim. |
| 4 | PASS: focused route journey rerun on the exact product SHA after its last source change. |
| 5 | No inheritance or acceptance change. Existing Base authority is reused; no claim that broader role duties are complete. |
| 6 | PASS for the honest PARTIAL Gap, bounded evidence and successful local generation. Generated views deliberately remain main's bytes for the lander. Historical global judgment provenance is retained, with no new DONE judgment. |
| 7 | PASS: no acceptance sentence or ID changed; every parent Status row retained. |
| 8 | PASS for current native-session admission and post-signout refusal without business changes, lines 129–142. Commercial-role machinery remains held. |
| 9 | PASS for boundary honesty: no provider, device, legal, live sandbox or hosted delivery claim. |
| 10 | No new custody, consent, spending or delegated authority policy. Existing native operators retain their current read authority; wider policy holds remain named. |
| 11 | PENDING fleet publication scan, main landing and exact-main Run site. This report claims product branch custody only. |

Pre-ready self-check: selected behaviors are tested through the built Worker and would fail if counts, grouping, window bounds, CSV output or refusal behavior changed. No previous assertions weakened. Report routes are guarded reads and do not restore or replay deleted records or captures. Native capture replay and erasure duties remain with their existing doors. There are no touched screens, so viewport, text-size, icon-tooltip and browser proof are not applicable. The current source lock passes; the cloud does not claim a publication scan it cannot run. No email literal or provider-shaped credential was added to the new fixture or modules.

## Remaining work

Dashboard presentation; votes over time; account, segment and theme dimensions; top requests by voters, accounts and ARR; new and rising themes; all response and resolution median and 90th-percentile obligations with snooze exclusion and original-thread timing; all scheduled email and Slack sends; commercial-role machinery; and provider, device, account and cross-seed and Base prerequisites remain named remainders. All earlier ct, uip, payments, live-qualification and release holds remain unchanged. There is no implementation blocker for the selected slice, and omitted native work is not represented as an external blocker.

## CI

Push Verify for this exact candidate: run **42199127314**, event **push**, initially **in_progress**, at https://github.com/just-every/run-penny/actions/runs/42199127314. candidate-ci-discovery.jsonl records the initial observation; final CI status is in the accompanying CI receipt.

The synchronized parent main SHA had successful Verify **42192912570**, but later main Verify **42194484496** and Run site **42194484854** were failed at initial observation. main-ci.jsonl retains that exact observation. These are not claimed green, and are not evidence for the candidate. Any diagnosis obtained within the ten-call API budget is recorded in the accompanying receipt and relay lines.

Main failure diagnosis: the failed main Verify job was **127814272471**, `shards (import-statuses, true)`, with `page.waitForURL: Timeout 30000ms exceeded` in `reviewPrivateSearch` at `tests/browser/operator-completeness-read.mjs:70`. This pre-existing navigation path is outside the selected reporting slice; no source repair was attempted. The failed Run site job was **127814206039**, with **provider-http-503**, HTTP 503 and `no healthy upstream` during the Cloudflare site Worker settings read. One failed-job retry was requested through REST for that proven provider flake. Sanitized actual log excerpts are included. No main source or deployment configuration was changed.

Candidate final CI observation: Verify **42199127314** completed with conclusion **failure** on `a8906f92a14aa564ecfe444bdc8f61595b9b5425`. The plan job succeeded; all 29 shard jobs failed only at **Check generated contract documents**, before runtime tests. A representative failed-job archive read succeeded and its actual diagnostic is in candidate-ci-failure.log. Under the task's explicit generated-view exception, this is eligible for READY and is not a claim that the full candidate suite ran. The lander must regenerate main's views and obtain fresh exact-SHA Verify before landing. CI-RECEIPT.json records this distinction and the ten GitHub calls used. No Verify retry or dispatch was requested for the candidate.

The Run site 503 failed-job retry request succeeded. Its eventual conclusion was not polled; no green Run site or main landing is claimed. The parent main navigation timeout remains an fv follow-up. Product scope and local gates have no known failing behavior.
