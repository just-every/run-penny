# sd-penny-c-f108 results

Repository: just-every/run-penny. Branch: cloud/sd-penny-c-f108. Candidate: 980b8e283b68799bbb5419ff7fe3ba6c75e0b29d. No PR is required: branch push starts Verify Penny. Product push succeeded on its first attempt. This is selected partial progress, with no DONE claim or release claim.

LEARN-004: PARTIAL to PARTIAL. Counts remain 79 DONE, 124 PARTIAL, 78 MISSING, 281 total. The only plan row updated by this report is LEARN-004 acceptance point 4's resume-within-a-valid-grant proof. The plan extract itself was not edited.

The resume route already rejects expired grants. The change extends the existing native journey in `tests/base/learning-stage3.test.ts`, without a new registration, runtime edit or model run. `proveNativeFences` invokes `proveResumeWindow` at line 316. Lines 353 to 386 create and pause native-only grants through native routes; at the shorter grant's expiry, the same current operator resumes the longer valid grant. The shorter grant remains paused and still has budget. At expiry and one millisecond afterward the resume returns 409 and learning_resume_requires_new_grant. Native detail, complete grant and source rows, durable runs, AI reservation rows, integration guards and all audit rows stay equal, with zero source or model HTTP calls.

The five existing registrations in the touched file pass on the exact committed candidate under Node 22.20.0. Build, typecheck, first-party check (1147 checks), contract write and check, source lock write and check, staged diff whitespace, identity and trailer audit passed. No existing assertion was removed, narrowed, skipped or moved behind a condition; registrations added 0, removed 0. Every parent contract table row is retained: 445 pipe rows before and after. Contract status, acceptance wording and all existing Gap text are retained. Evidence names the existing scheduled-refresh journey and the new resume proof. Generated views were checked locally, then restored whole from origin/main and omitted from the commit. Source lock was regenerated last and remains fresh after the main refresh.

A temporary mutation removed only the resume expiry predicate from `src/core/features/learning/controls.ts`. The focused existing journey failed with exit 1 at line 381: AssertionError: {"ok":true}: expected 200 to be 409. Production bytes were restored in a finally block. The full touched file then passed again, including on the candidate. The mutation changes neither committed source nor permanent test registrations.

PROBE LEARN-004 4: native create, pause, detail and POST /api/operator/learning/investigations/:id/control with action resume under controlled time -> valid grant 200 with active state and version increment; expired grant 409 at and after expiry; grant, version, runs, reservations, audit and network recorder unchanged.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0, generated views restored; ledger=none exit=0.

DONE-RIDERS applicability (no DONE flip requested):

1. PASS for the selected point only: native route journey lines 357 to 384. Full-clause outcomes remain PARTIAL.
2. PASS for the selected authority boundary: valid resume line 367 and refusal plus no-op custody lines 381 to 384. Expiry-predicate mutation failed.
3. Exact-SHA Verify Penny run 42217528244 (push) completed with failure solely at generated-view freshness in all 29 shards. The logged error is ACCEPTANCE.md: generated content differs; run contract-docs write. Runtime CI steps were skipped. This is the explicitly permitted candidate freshness exception; all five local exact-candidate tests pass. The lander regenerates views and reruns its own exact-SHA Verify.
4. PASS: LEARNING-CANDIDATE.log runs the exact pushed candidate. Runtime source and fixtures did not change.
5. Unchanged: no acceptance or inherited duty was added or reinterpreted.
6. PASS for this partial update: evidence refreshed, existing gaps retained, generator passes before the required view restoration. No full-clause provenance or DONE claim was added.
7. PASS: acceptance text unchanged; no rewrite or ruling needed.
8. PASS for the selected expiry boundary: current operator valid control succeeds and expired authority refuses without effects. Wider permissions remain unchanged.
9. PASS: no live provider, device or legal boundary is claimed. All earlier holds remain.
10. PASS: existing semantics only, with no new custody, consent, spending or authority policy.
11. Pending fleet landing: main equality, publication scan and resulting Run site remain the maintained lander's duties. They are not claimed here.

Pre-READY review: the selected visible API behavior fails when its expiry check is removed; existing assertions are preserved. Existing scope, uncertainty, accounting, erasure and replay journeys remain and pass in the same touched file. No screens, controls, homepage, logos or style changed, so browser-width proof and tooltip audit are inapplicable to this selected non-UI point. No new fixture or email-shaped string was introduced. No Base pin, workflow or applied migration changed. The source lock is fresh. Cloud publication scan is not available here and is assigned to the fleet; no COMPLETE or zero-findings claim is made.

Remainders: points 1 to 3 and 5, and the other point-4 controls receive no new completion claim. Keep the current LEARN-004 Gap unchanged. Preserve provider, device, account, cross-seed and Base prerequisites; all prior ct, uip, payment and release holds remain. LEARN-001 deployment-principal and live qualification proof, LEARN-003 point 2, embedded-agent integration and wider agent/provider obligations remain open. No new local blocker was found for the selected point.

The full executed plan is PLAN.md. Actual local receipts are CHECKS.json, MECHANICAL.json, PUSH-RECEIPT.json, FIRST-PARTY.json, LEARNING-CANDIDATE.log, EXPIRY-MUTATION.log, VIEWS-WRITE.log and VIEWS-CHECK.log. Baseline and exact candidate CI receipts are separate JSON files. CI-FAILED-JOB.log retains the actual failed command and error, with its irrelevant environment preamble omitted. CANDIDATE-VIEW-CHECK.log records the same expected error locally. Five budgeted GitHub invocations were used; no CI dispatch or rerun was made. Reports go only to the evidence ref, not the product branch. The successful clone is deleted after evidence publication and final remote-ref confirmation.

Terminal CI: Verify Penny 42217528244 completed with the permitted generated-view-only failure on the exact pushed SHA. No real test failure or unresolved product blocker was found. Publication scan, generated-view landing commit, exact landed-SHA Verify and Run site remain fleet duties. The branch was confirmed remotely at the candidate SHA. Evidence publication is separate from READY and from any product landing.
