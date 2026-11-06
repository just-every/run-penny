# sd-penny-c-f114 results

Repository: just-every/run-penny. Branch: cloud/sd-penny-c-f114.
Candidate: 10251bf06e325648e6c16a2414e2ed50686bee84.

INT-005 remains PARTIAL. The selected acceptance-point-2 reconciliation admission is implemented and exercised. Counts remain 79 DONE, 124 PARTIAL, 78 MISSING before and after. No contract text, acceptance point, Status, Gap, Evidence, generated view, workflow, migration, homepage, logo or visual implementation changes are included. No new policy default was adopted.

## Plan and implementation

The complete execution plan is PLAN.md. The pinned predecessor already contained the selected guard. Its Verify 42217914659 failed at generated contract-document freshness in every failed shard, including workspace-clock job 127892519348. Running its exact failing command, `node src/base/contract-docs.mjs check`, reproduced exit 1: `ACCEPTANCE.md: generated content differs; run contract-docs write.` No assertion repair, workflow change, rerun or CI dispatch was attempted for that expected mechanical failure.

The predecessor changed a protected contract Status row and was not on main. The unpublished task branch was moved onto current main f52beea3be587114d61166d21e4be26777fa96f3, and the predecessor's complete product guard and journeys were carried forward without its contract-cell edit. Main's other writers' keyboard work was preserved. No published ref or history was rewritten. The first real task commit f0e99ad was immediately pushed with `[skip ci]`; the final candidate adds native readback and ordinary accepted-create refusal proof.

The guard in `src/core/features/integrations/tracker-service.ts` lines 33–45 requires an uncertain delivery in the tracker namespace matching the command, selected subject, connection and original link. The same condition is checked inside the D1 link transaction. Link creation, command linkage, resolution insertion and delivery acceptance roll back together. Only an identical previously reconciled accepted command returns the original link as a replay.

The existing `checkTrackerActions` journey now checks native command and link projections after reconciliation and after a real restart. It also refuses relabelling an ordinary accepted create as a reconciliation even when the supplied issue is its actual existing link. All original assertions remain. The HTTP fixture can pause a real sending delivery and return a rejected response; it does not fake command, route, scheduler or D1 behavior. Test registrations added: 0; removed: 0. The cap remains 200.

## Reproduction and public-door probes

The disposable `queued-probe.mjs` ran against the emitted Worker with main's unguarded service before restoring the guard. POST to the native reconciliation route returned 200, inserted a link, left the matching delivery queued, and a subsequent native scheduler event made one additional provider create. `queued-before.log` records that source-derived defect.

With the guard restored, the same public-door input returns 409. Complete rows in links, commands, deliveries, attempts and resolutions remain identical, with zero provider calls. `queued-after.log` records this result. The browser journey additionally covers both tracker providers and both request and decision subjects, with allowed uncertain reconciliation, rejected state transitions and persisted readback.

PROBE INT-005 2: native queued create followed by POST /api/operator/integrations/trackers/commands/:id/reconcile with a supplied known issue -> 409, unchanged five-table custody snapshot, zero provider calls; native uncertain outcome -> one accepted reconciliation and original-link replay, followed by real restart and repeated native scheduler drains with no additional create.

## Acceptance and selected-point proof map

All line references below are in the candidate. The public entry journey is `tests/browser/integration-states.mjs`; its existing push Verify entry is the workspace-clock shard in verification.json. No test was moved behind a new flag or width condition.

| Item | Public behavior and proof | Local result | Exact-SHA Verify |
| --- | --- | --- | --- |
| INT-005 acceptance 1, retained native proof | `tests/browser/integration-tracker-actions.mjs` lines 43–56; `tests/browser/integration-tracker-edge.mjs` lines 19–22. Deliberately entered known link sends no create; the complete emitted create body is entered wording plus selected routing, with private wording absent. | PASS, final journey exit 0 | PASS: push Verify 42227124916, completed/success |
| INT-005 acceptance 2, selected admission | `tests/browser/integration-tracker-actions.mjs` lines 19–25 and 62–75. Queued and genuinely sending commands refuse reconciliation with full unchanged-state snapshots and native readback. | Focused native probe passed; PASS, explicit process exit 0 | PASS: push Verify 42227124916, completed/success |
| INT-005 acceptance 2, rejected and ordinary accepted states | Same file lines 99–115. Native rejected delivery and ordinary accepted create refuse supplied known-issue reconciliation, with custody unchanged across restart and repeated drains. | PASS, explicit process exit 0 | PASS: push Verify 42227124916, completed/success |
| INT-005 acceptance 2, atomic supported path | Same file lines 76–86. A late D1 abort leaves all five custody tables unchanged; removing the bounded fault allows one uncertain reconciliation through the mounted native control. | PASS, explicit process exit 0 | PASS: push Verify 42227124916, completed/success |
| INT-005 acceptance 2, identical replay and restart | Same file lines 27–34 and 87–97. Identical replay returns repeat and original link, all history stays identical, native projections preserve selected subject, connection, stable issue ID and URL after restart, and scheduler drains make zero additional creates. | PASS, explicit process exit 0 | PASS: push Verify 42227124916, completed/success |
| Retained authority and private-receipt duties, no expanded inheritance claim | `tests/browser/integration-tracker-checks.mjs` lines 23–62 retains signature, provider identity, stale operator authority, source ordering, replay after restart and public privacy assertions. `tests/browser/integration-uncertainty.mjs` lines 50–54 retains revoked-destination no-send proof. Tracker commandGuard and subject and connection checks are unchanged. | PASS, final journey exit 0; erasure not newly claimed | PASS: push Verify 42227124916, completed/success |

## DONE-RIDERS

This is a PARTIAL claim, not a DONE promotion. PASS below describes the selected slice; it does not waive the existing contract remainder or lander gates.

| Rider | Result and evidence |
| --- | --- |
| 1 | Selected native outcomes are reached through create, reconcile, readback, restart and scheduled public doors in checkTrackerActions, lines 19–115. Full clause qualification and other existing proof remain open; no DONE claimed. |
| 2 | Allowed uncertain reconciliation and unsafe queued, sending, rejected and ordinary accepted attempts are all exercised against populated state, with five-table snapshots; lines 19–25, 62–115. |
| 3 | PASS for the selected slice: the journey remains in push Verify's workspace-clock shard; push Verify 42227124916 is completed/success on candidate 10251bf06e325648e6c16a2414e2ed50686bee84. The final CI receipt records that exact SHA. |
| 4 | Source and journey hashes and the complete candidate SHA are in source-receipt.json. The final run has its own process receipt; no relevant source or test bytes change afterward. |
| 5 | No new inherited Base duty is claimed and no receiving-clause text changes. Existing native session, subject and connection guards remain intact. |
| 6 | Contract write and check pass; generated views and all contract judgments are main's whole files. No status-cell or count edit is staged or present against main. |
| 7 | Acceptance sentences, clause IDs, coverage mappings and rulings are unchanged. |
| 8 | Wrong-state attempts change nothing; the permitted uncertain action and original-link replay complete through authenticated native routes. No authority policy or role grants change. |
| 9 | Provider HTTP fixtures are explicitly synthetic. No live Linear or Jira account, device, provider installation, hosted Cron, publication or qualification claim is made. |
| 10 | No new custody, consent, spending or authority default was adopted. RL-101 governs unrelated bulk permissions and supplies no new tracker ruling. |
| 11 | Pending fleet landing. Candidate is branch-only; main equality, publication scan and main Run site are not established by builder receipts. |

## Mechanical and pre-ready checks

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0.

Build through the required cloud subreaper passed. Typecheck and touched lint passed. The first-party structural check passed with no output. The source-lock check's complete actual result is source-lock-check.json and has ok=true. Contract generation wrote zero files and its check says current. Generated view files were restored from main. No migration was added or edited, so no migration-ledger check is applicable.

Pre-ready: (1) selected behaviors are asserted through native public doors; see the point map and final process receipt. (2) No assertion was removed, narrowed, skipped or newly width-gated. (3) The state transition cannot start a new outbound action; identical replay, durable terminal state, current authority checks and existing revoked and private receipt coverage remain. Erasure and restored-authority implementations were not changed or newly claimed. (4) No screen implementation changed; the existing journey captures the exercised screens at 1440 and 390 using system Chromium with no-sandbox, and performs its existing overflow, accessibility, secret masking, error and external-request checks. (5) Lock and generated-view checks pass. Exact-SHA Verify is reported separately; publication and Run site belong to the maintained lander. Changed text was inspected for accidental repository-shaped prose tokens and has no added email-shaped string.

Publication scan: commit=10251bf06e325648e6c16a2414e2ed50686bee84 complete=NOT_RUN historyScanned=NOT_RUN findings=NOT_ESTABLISHED. This cloud run does not have the fleet publication scanner; the mandatory exact-tree full-history scan remains a landing duty. No COMPLETE or zero-findings scan claim is made.

## Remaining scope and plan-row return

GAP INT-005: Full Linear and Jira create and link qualification and remaining INT-005 proof outside the selected native reconciliation admission remain open. Provider-account holds and DELIV-002, DELIV-003, DELIV-006 and DELIV-008 prerequisites remain unchanged. Full connector mapping, drift, resync, demand refresh, provider installation, live qualification and broader provider or sibling obligations were explicitly excluded from this bounded round.

Plan row return: INT-005 selected acceptance-point-2 known-issue reconciliation admission proved; PARTIAL to PARTIAL; counts unchanged. No full plan was rebuilt or edited. No external dependency blocked the selected native state guard. The wider held work is not reported as completed.

CLAIM INT-005 PARTIAL points=2 tests=tests/browser/integration-tracker-actions.mjs#checkTrackerActions; tests/browser/integration-states.mjs#integration-states

Final local browser result: the unchanged candidate 10251bf06e325648e6c16a2414e2ed50686bee84 completed at 2026-11-06T13:37:44Z with recorded child exit 0 and cloud_run exit 0. All 46 captures passed, including both widths; the browser result reports zero unexpected errors, zero external requests, zero live provider calls, 28 fixture edge calls and fulfilled teardown. The prior command session had reported exit 1 despite completed assertions; it was not accepted as a gate, was preserved in prior-journey-receipt.json, and the same unchanged command was rerun with explicit process accounting. No test or product repair was required.

## Final CI and custody

Exact-SHA push Verify 42227124916 completed successfully on 10251bf06e325648e6c16a2414e2ed50686bee84; actual REST output is ci-final.json. Its URL is https://github.com/just-every/run-penny/actions/runs/42227124916. Five GitHub API calls were used in total, including predecessor diagnosis; the final run had one discovery and two polls at intervals exceeding 300 seconds. No Verify dispatch, rerun or PR was needed. The remote product branch advertises the exact candidate SHA. Both candidate commits have fleet author and committer identity and no trailers. Main remains f52beea3be587114d61166d21e4be26777fa96f3 and does not equal the candidate. No Run site run or publication scan was claimed; these are mandatory lander duties. There is no blocker to this selected native guard handoff.
