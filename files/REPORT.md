# sd-penny-c-f103 results

Repository: https://github.com/just-every/run-penny
Branch: `cloud/sd-penny-c-f103`
Candidate: `5eb5ad4cfabc9b28c24ad83ef5e807f16cd22e3a`
Parent and synchronized main before push: `6c1eb018f6391de17e04fc8868c0c74f8732abd8`
Recovered predecessor: `a8906f92a14aa564ecfe444bdc8f61595b9b5425`

## Outcome and plan row

MEAS-004 remains **PARTIAL to PARTIAL**. The selected native count and export slice of acceptance point 1 is implemented and locally proven. This does not complete all reports in acceptance point 1 or the whole clause. Counts remain **79 done, 124 partial, 78 missing, 281 total**. All 281 parent Status rows and all 445 table lines are retained. Only MEAS-004's Evidence and Gap cells change; its requirement and acceptance sentences are unchanged.

PLAN.md contains the full executed plan. The selected MEAS-004 plan row gains native feedback-volume report proof. No other clause or plan row changes. The provided POINTS expressly omits the wider native work, so this continuation does not select another target or represent those omissions as external blockers. All earlier ct, uip, payments, provider, device, account, cross-seed, Base, live qualification and release holds remain unchanged.

The predecessor's single unfinished commit was replayed with a no-commit cherry-pick onto fresh full-history main, then committed under this task's branch. This rebases the unfinished change onto main without rewriting the published predecessor branch. CONTRACT.md merged cleanly, retaining newer main judgments. The changelog conflict retained both writers' entries. The old lock was discarded in favor of regeneration from the resolved tree. The newer DATA-006 OpenAPI work is retained. No generated view was committed, no workflow changed, no default branch pushed and no PR was necessary because branch push starts Verify.

## Product behavior

An active native operator session reads JSON at `/api/operator/reports/feedback-volume` and CSV at `/api/operator/reports/feedback-volume.csv`. Explicit `from` and `to` timestamps are required; timezone offsets normalize to UTC. The window includes its start, excludes its end, must advance and is bounded to 366 days. Unknown, repeated or malformed filters return 400. UTC daily buckets include zero days and respect partial first and last days.

Each retained request counts once at `requests.created_at`, grouped by its current board. Each retained evidence item counts once at `evidence_items.created_at`, its capture clock, grouped by source type. Historical observation time is separate. Request and evidence aggregates execute independently in one guarded D1 batch, so evidence links, versions and votes cannot multiply captures. The report describes retained volume, including retained held, rejected and merged records, rather than immutable historical board membership. It reads current native tables and stores no new data or replay state.

The existing read-only database guard rechecks active native membership, session expiry, revocation and operator version inside that same read transaction. Anonymous, requester-only and revoked-session reads are refused. Responses are private, no-store and nosniff. No new role grant, scoped credential or provider authority is introduced. CSV reproduces the JSON window and daily totals and groups, quotes cells, doubles embedded quotes, uses CRLF and neutralizes spreadsheet formula prefixes. OPERATIONS.md documents these semantics. No migration or reconfiguration is needed.

## Public-door proof

`tests/base/feedback-volume-report.test.ts` — **native feedback volume reconciles private JSON and CSV windows without multiplying linked records**. It runs through the emitted Worker with native record routes and fakes only the mail HTTP edge needed for fixture authentication.

- Lines 34 to 72 create two boards, five requests and five evidence items through existing routes. Independently declared historical fixture times straddle the exclusive window boundaries. Evidence links fan out to three requests, an evidence revision is saved, and observation time differs from capture time.
- Lines 73 to 92 publish a populated public request, add a vote and compare the complete JSON report against declared expected records: requests=3, evidence=3, board totals=2+1, source totals=1+2, daily request totals=2,0,1 and evidence totals=1,1,1.
- Lines 93 to 111 download and parse the actual CSV and compare every row, including a board name with a formula prefix, commas, quotes and newline.
- Lines 112 to 122 exercise an offset-normalized partial day and empty JSON and CSV windows.
- Lines 123 to 128 require nonempty public list and detail reads and exclude private board, source and evidence markers and report fields.
- Lines 129 to 142 exercise malformed, duplicate and unsupported filters in both formats, anonymous and requester refusals, native sign-out and revoked-session refusal with unchanged business records.

PROBE MEAS-004 1: built Worker GET `/api/operator/reports/feedback-volume` and its CSV door, five native requests and five native evidence items, window 2026-10-01T00:00:00.000Z to 2026-10-04T00:00:00.000Z -> exact JSON and CSV totals requests=3 evidence=3, board counts=2+1, evidence-source counts=1+2, UTC daily counts=2,0,1 and 1,1,1; boundary, empty-window, escaping, populated public privacy and authority assertions passed.

One focused sanity registration is recovered from the predecessor. No existing assertion or registration is removed, narrowed, skipped or moved behind a condition. The existing push Verify base-test globs load the file. A source-definition estimate across mixed test runners was already above the nominal 200 cap on main (204, now 205), before accounting for standalone assert journeys or generated registrations. This is an inherited budget issue, not a comprehensive authoritative count or a claim of cap compliance. No unrelated security or business assertion was deleted to make that estimate smaller, and no cap raise was requested.

## Checks and mechanical receipt

The production build passed after the source replay. The following checks passed again on exact committed 5eb5ad4cfabc9b28c24ad83ef5e807f16cd22e3a: the focused Worker journey (1 test), typecheck, first-party check, source-lock check and focused oxlint. LOCAL-RECEIPT.json records the exact head, commands, exit codes, timestamps and actual output filenames. build.log records the preceding production build; no relevant source or test byte changed afterward. The shell used Node 24.19.0 for direct checks; the rer dispatcher selected the repository's Node 22.20.0 for setup and build. The pinned rer and Base copies remain unchanged.

Contract generation write and check passed before commit. The generator wrote one changed view, ACCEPTANCE.md; both view files were restored whole from origin/main. The product diff contains neither ACCEPTANCE.md nor docs/CLAIMS.md. The documented source-lock generator ran last, and its check passed both before commit and on exact committed HEAD. No migration changed, so the migration-ledger check is not applicable.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check, restored both main views exit=0; ledger=none exit=0.

Before the commit, the complete result was staged and the removed-line diff and staged table count checked. A Status-ID set comparison retained every parent's 281 rows; counts stayed 79,124,78. Before push, the complete candidate history, messages, authors, committers and trailers were inspected. identity-audit.txt records the sole candidate's fleet identities and absent trailers. Repository hooks and fleet cleanup remained active. The final fetch and rebase found the branch up to date with main. The product push guard succeeded on attempt 1. An independent remote-ref readback exactly matches 5eb5ad4cfabc9b28c24ad83ef5e807f16cd22e3a, and the checkout was clean.

## CI and landing boundary

Exact candidate Verify **42204760178**, event **push**, completed with conclusion **failure** on 5eb5ad4cfabc9b28c24ad83ef5e807f16cd22e3a. The plan job succeeded; all **29** shard jobs failed only at **Check generated contract documents**, before runtime execution. Representative job **127848554340** reported: `ACCEPTANCE.md: generated content differs; run contract-docs write.` Its failed-job archive was read once; the relevant actual excerpt is in candidate-failed-job.log. candidate-jobs.json proves the common failure step. Under the brief's explicit generated-view exception this is eligible for READY. It is not a claim that the full candidate runtime suite ran or was green. No Verify repair, dispatch or rerun was attempted.

Current synchronized main 6c1eb018f6391de17e04fc8868c0c74f8732abd8 has successful Verify **42201695865** and successful Run site **42201695577**. main-ci.json retains that exact observation. Those runs do not prove this candidate. CI-RECEIPT.json records six GitHub invocations used, including predecessor discovery and job inspection, exact candidate discovery and jobs, current-main discovery and the single failed-job archive invocation. No short-interval polling was used.

The cloud cannot run the fleet's publication scan. No COMPLETE scan, main equality, landing or candidate Run site is claimed. The maintained lander must regenerate views, obtain exact-SHA green Verify, complete its full-history publication scan with zero findings and perform the guarded landing and Run site checks. The candidate is branch-only until those gates pass. No implementation blocker is known for the selected native slice.

## DONE riders and pre-ready self-check

No DONE claim or ct judge request is made. This bounded row-by-row assessment preserves the full clause's honest PARTIAL state.

| Rider | Assessment at 5eb5ad4cfabc9b28c24ad83ef5e807f16cd22e3a |
| --- | --- |
| 1 | Selected native count and export outcomes locally PASS, journey lines 34 to 122. Wider dashboard, dimension, timing and scheduled-delivery outcomes remain UNMET; clause stays partial. |
| 2 | PASS for populated independent expectations, link fan-out, allowed reads and unsafe refusals, lines 34 to 142. |
| 3 | Exact-SHA local journey PASS. Candidate Verify stopped at generated views, so full recorded runtime proof is pending the lander. |
| 4 | PASS: focused journey rerun on exact committed SHA after the last relevant source change. |
| 5 | No new inheritance claim or acceptance change. Existing native Base authority is reused; broader roles remain held. |
| 6 | Honest partial Gap and named journey retained. Generator write and check pass locally; generated views are intentionally main's bytes. Historical judgment provenance is retained because there is no DONE judgment. |
| 7 | PASS: no acceptance sentence or ID changes; all parent Status rows retained. |
| 8 | PASS for current native-session allowed access and post-signout refusal without business changes, lines 129 to 142. Wider commercial roles remain open. |
| 9 | PASS for honest provider, device, legal and live-proof boundaries; no such new qualification is claimed. |
| 10 | No new custody, consent, spending or delegation policy; existing native operator authority is reused. |
| 11 | PENDING the fleet's guarded landing receipt, publication scan and exact-main Run site. |

Removing a report route, changing record or timestamp selection, multiplying rows through links, removing CSV escaping or dropping authentication would break the journey's visible assertions. This is inspection of the assertions, not a claimed executed mutation run. The dangerous read path is exercised in both the allowed and refused cases. Existing assertions are intact. The report is a guarded read and neither replays captures nor restores erased content; it exposes only counts and current board and source labels, without personal or evidence wording. No screens changed, so browser screenshots, viewport assertions, tooltip and text-size checks are not applicable. No email literal or provider-shaped credential was added to the new product fixture or modules. The source lock passes. Publication remains a lander duty and is not misreported as complete.

## Remainders

Dashboard presentation, votes over time, account and segment and theme dimensions, top requests by voters and accounts and ARR, new and rising themes, all response and resolution median and 90th-percentile calculations, snooze exclusion, NOTIFY-007 original-thread timing, all scheduled email and Slack reports, commercial-role machinery and every named provider and device and account and cross-seed and Base prerequisite remain open. Earlier ct, uip, payments, live qualification and release requirements remain held. This is the planner-selected count and export slice only.

The actual non-secret plan, report, receipts and relevant logs are selected explicitly for the separate evidence ref. Evidence publication does not signal product acceptance or landing. The product clone is removed only after verified product and evidence transport.
