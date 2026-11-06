# sd-penny-c-f118 — INT-005 reconciliation admission

Repository: https://github.com/just-every/run-penny
Branch: `cloud/sd-penny-c-f118`
Candidate: `d331e3762ef153b225b1fa72c04890b4979a71fe`
Requested base: `10251bf06e325648e6c16a2414e2ed50686bee84`
Main at final synchronization: `f52beea3be587114d61166d21e4be26777fa96f3`

CLAIM INT-005 PARTIAL points=2 tests=tests/browser/integration-tracker-actions.mjs#checkTrackerActions
GAP INT-005: The selected matching uncertain-delivery admission is proven locally. Provider qualification and all existing provider, account, device, sibling, Base, mapping, demand refresh, drift, resync, health and release holds remain unchanged. No wider connector proof or status promotion is claimed.

Counts before and after: 79 DONE, 124 PARTIAL, 78 MISSING. INT-005 remains PARTIAL. No clause text, Status, Gap or Evidence cell changed. No generated view was committed. No plan row was rewritten; the selected INT-005 point-2 guard is the only campaign row advanced, with the existing holds retained. No new policy default was needed; the supplied Penny ruling RL-101 concerns TRIAGE-005 and does not change this tracker rule.

## What changed

The requested base already carried the transactional uncertain-delivery guard and most of its journey. This run preserved both published base commits rather than rewriting them. The guard checks the delivery state before admission and again in the same D1 batch that links the command, records the resolution and accepts the delivery. A previously accepted reconciliation may return its original link only with the original resolution. Ordinary provider acceptance is not relabelled as operator reconciliation.

The new commit extends the existing journey with unchanged-state refusals for an already linked issue while a command is queued, sending or rejected, and an uncertain command submitted for a different existing subject. It preserves every earlier assertion, including new-issue refusals, ordinary entered-only create and link, a late-write rollback, original-link replay, native readback, real Worker disposal and restart, and repeated scheduler drains. No new test registration, migration, configuration, provider installation, Base edit, UI, homepage, logo or design work was added.

## Reproduction and proof

Before the new test edit, a native route probe built the requested base with only the tracker service replaced by current main's implementation. It created a command, reconciled a supplied known issue while the delivery was queued, restarted the real local Worker and drained its scheduler. The unsafe observations were HTTP 200, one new link, a still-queued delivery, and one subsequent tracker create for that command. `main-reproduction.json` contains the actual observations. The reproduction shell returned 1 after writing those observations; that wrapper result is not represented as a passing gate.

The final candidate probe returns HTTP 409 for queued reconciliation with a byte-equivalent custody snapshot and no added link. A genuine uncertain delivery accepts exactly one explicit reconciliation; its identical replay returns the original link and changes no history. Real restart followed by two scheduled drains leaves one resolution and zero additional creates. The native tracker read route retains the original command and link identity. `candidate-probe.json` was regenerated on the pushed SHA, with exit 0.

The complete existing integration-states journey passed with 46 captures at 1440 and 390. It began on the requested base; runtime, UI and edge-fixture bytes are identical to the final candidate. The focused harness then loaded the final extended `checkTrackerActions` bytes and passed all four Linear and Jira request and decision combinations at 1440. It passed again after the final commit on the exact pushed SHA; the receipt, log and desktop captures in this packet are from that committed run. Its source hashes, actual result files and command exits are in `receipts.json`. The test remains included by the existing push Verify integration group in `verification.json`; no workflow was edited. There are 24 relevant tracker screenshots in this packet. Only the provider HTTP boundary is doubled; commands, deliveries, attempt and resolution custody, routes and scheduled Worker execution are native.

### Frozen rubric for the selected bounded point

| Row | Outcome | Proof and result |
| --- | --- | --- |
| R1 | Preserve ordinary create and link and send only entered wording | `tests/browser/integration-tracker-actions.mjs` lines 44–60 and 75–80; `tests/browser/integration-tracker-edge.mjs` lines 18–22. PASS locally for both providers and both subject kinds. |
| R2 | A queued delivery refuses supplied new and already linked issues without mutations | `checkTrackerActions`, lines 19–25 and 64–65. HTTP 409, unchanged links, commands, deliveries, attempts and resolutions, and native state readback. PASS. |
| R3 | A genuinely sending command refuses reconciliation without mutations | `checkTrackerActions`, lines 66–72; the HTTP edge pauses an actual in-flight create. New and existing known issue attempts both return 409 with unchanged custody. PASS. |
| R4 | A rejected command refuses reconciliation without mutations | `checkTrackerActions`, lines 112–121. Real edge rejection followed by both refusal shapes and restart. PASS. |
| R5 | Only the matching uncertain command and subject may reconcile; late failure is atomic | `checkTrackerActions`, lines 81–91. A different existing subject returns 409 unchanged; a late D1 abort returns 503 and rolls back the link, command, delivery and resolution together. The supported reconciliation then succeeds. PASS. |
| R6 | Identical reconciliation replay retains the original link and history | `checkTrackerActions`, lines 92–101 and native read helper at lines 27–34. Same link, repeat acknowledgement, unchanged custody, and different-issue refusal. PASS. |
| R7 | Reconciliation survives a real restart and drains never create again | `checkTrackerActions`, lines 99–102 and 118–121; `candidate-probe.json`. Native readback retains the subject, connection, external issue and original link, one resolution, and zero additional creates. PASS. |

### Acceptance sentences and inherited duties

| Item | Evidence | Boundary |
| --- | --- | --- |
| INT-005 point 1: only entered wording is sent | Existing `checkTrackerActions` blank-input and native create assertions, plus the complete expected HTTP body and private-marker exclusions in `trackerCreateEdge`. Local PASS; preserved rather than newly expanded scope. | No live provider qualification claimed. |
| INT-005 point 2: native durable commands retain uncertain outcomes for explicit reconciliation and never create a duplicate automatically | Rubric R2–R7 above, native probe, focused journey and complete integration journey. Local PASS for the selected admission guard. Exact-SHA Verify status is recorded below and in the CI receipt. | The clause stays PARTIAL under the selected brief; existing provider and sibling remainders are unchanged. |
| Existing native authority and custody | Service session and connection checks and D1 guard are retained; wrong-state and wrong-subject unsafe paths are exercised in both directions. No authority grants or erasure behavior changed. | Broader revoked-credential, erasure, capture and connector obligations remain in their owning clauses; this round does not certify them. |

### DONE-RIDERS review

No DONE claim is made. These results describe only the bounded change.

| Rider | Result | Evidence |
| --- | --- | --- |
| 1 | PASS for selected native outcomes; wider holds retained | Rubric R1–R7 and the three actual result receipts. |
| 2 | PASS | Populated five-table custody snapshots; supported reconciliation succeeds and unsafe new and existing link attempts change nothing. |
| 3 | PASS | Push Verify 42233789351 completed successfully on the exact candidate and loads the complete extended integration journey. |
| 4 | PASS locally | Final source hashes bind unchanged runtime and UI proof to this candidate; the focused journey and final native probe both execute on the pushed SHA. |
| 5 | INSPECTED, no inheritance edit | The receiving clause's obligations and existing citations are unchanged. |
| 6 | PASS mechanically, judgments unchanged | Contract generator write and check exit 0; main's generated views restored; no status or evidence cell edited. |
| 7 | PASS | No acceptance sentence changed and no obligation removed. |
| 8 | PASS for selected unsafe-state and subject fences | Rubric R2–R5; current native session and connection guards retained. |
| 9 | PASS for honest boundary | Provider fixtures are explicitly identified; no live receipt, account or legal qualification claimed. |
| 10 | PASS, no new default | This is the supplied uncertain-delivery admission rule; no custody or delegation policy was expanded. |
| 11 | PENDING fleet landing | Candidate remains branch-only. Main equality, full-history publication scanning and candidate Run site are lander duties. |

## Mechanical checks and pre-ready review

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, restored main's ACCEPTANCE.md and docs/CLAIMS.md; ledger=none exit=0

Typecheck, first-party inspector, affected browser journeys, syntax and staged diff checks passed. There are zero added or removed test registrations. No existing assertion was removed, narrowed, skipped or put behind a width or branch condition. No touched application screen or icon control changed. Existing tracker captures cover both desktop and phone screens, with the integration journey's overflow and serious or critical axe checks retained. The added diff contains zero email-shaped strings and zero bare prose slash tokens. Every candidate author and committer was checked, including side parents; all are the fleet identity and all trailers are absent.

`git fetch origin main` and `git merge --no-edit origin/main` reported already up to date immediately before publication. The final source-lock check and generated contract check passed on the committed candidate. The source lock was regenerated after the last test and changelog edit. The branch guard pushed successfully on attempt 1. No PR is required: the repository already runs Verify on a branch push.

PROBE INT-005 2: native create then known-issue reconciliation while queued -> HTTP 409, state queued, no link and unchanged custody; genuine uncertain reconciliation then identical replay -> accepted with the original link and one resolution; real restart and two scheduler drains -> zero additional creates.

SCAN commit=d331e3762ef153b225b1fa72c04890b4979a71fe complete=NOT_RUN historyScanned=NOT_RUN findings=NOT_RUN (cloud route; fleet lander duty).
MAIN_EQUALITY commit=d331e3762ef153b225b1fa72c04890b4979a71fe equal=false; current main=f52beea3be587114d61166d21e4be26777fa96f3.

## CI and custody

Candidate Verify: run 42233789351, push event, exact head `d331e3762ef153b225b1fa72c04890b4979a71fe`; completed with conclusion **success** on the exact pushed SHA. The existing integration group loads all extended assertions. Six GitHub invocations were used within the ten-call budget, with run reads spaced at least 300 seconds apart. No duplicate Verify dispatch or rerun was issued.

Current main has a successful exact-SHA branch Verify 42215701402 and Run site 42218054918. A newer main-push Verify 42218054922 failed its requester-board shard, job 127892981073. The single allowed archive read, `gh run view 42218054922 --repo just-every/run-penny --job 127892981073 --log-failed`, returned exit 0 with 0 bytes. Its cause remains unestablished; no blocked blob download or archive read was retried, and the failure is not represented as green. The task does not push main or deploy anything.

The actual plan is `PLAN.md`; full local receipts, CI responses and selected tracker screens accompany this report. Publication scanning, guarded landing and post-landing Run site remain fleet duties. Evidence publication is a separate report-only transport and does not certify product landing or DONE.

FINAL_VERIFY run=42233789351 event=push status=completed conclusion=success head=d331e3762ef153b225b1fa72c04890b4979a71fe.

Final disposition: local selected proof and exact-SHA branch Verify pass; no product blocker remains. INT-005 stays PARTIAL and all held remainders remain unchanged. The product is pushed and ready for the guarded fleet lander; scanning, landing and candidate Run site have not been claimed.
