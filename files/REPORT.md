# sd-penny-c-f67: REQ-019 native exclusion proof

Product branch: cloud/sd-penny-c-f67
Product head: 2236f87f4375799c35944caf633d66814b73c610
Integrated main: e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f
Initial main: 84bad894d12e7f969f567177a126cb544a3237b1
PR: none; the existing push workflow admits this branch.

REQ-019 remains PARTIAL to PARTIAL. The selected missing proof for acceptance point 1 is closed: populated public roadmaps exclude the subject, release publication is refused without publication or snapshot or outbox changes, and requester notification drains suppress queued internal-board mail. Subsequent public status and reply attempts are refused without new mail graph effects. Acceptance point 2's request move and five-second withdrawal proof is explicitly omitted by the planner and remains the clause Gap. No acceptance text, policy, field-proof hold or release requirement was changed. The native predicates were already correct, so no runtime source change was needed.

Counts remain 79 DONE, 124 PARTIAL and 78 MISSING, total 281. All 281 parent Status rows survive, and the full contract table retains 445 rows. The plan row to carry forward is REQ-019 PARTIAL with the selected point 1 exclusions proved and the request move and timing remainder named. No other clause or plan row is changed. PLAN.md contains the full plan used for this run.

## Native public-door proof

The existing board sanity registration in ./tests/base/board.test.ts at line 45 invokes proveInternalBoardExclusion at line 59. Its original private-tag, file-approval, byte, size-limit and attachment assertions remain. The helper at ./tests/base/internal-board-exclusion.ts uses real operator and requester routes and real D1 transactions; only the mail HTTP edge is faked.

- Setup: lines 13 to 25 create a separate public board, a genuinely approved public control request and a verified follower. ./tests/base/release-fixture.ts nativeReleaseTarget, lines 31 to 56, creates evidence, competing bets, a native committed decision, an approved roadmap mapping, a Shipped target and a draft release through operator routes. There is one isolated subject draft and one separate public control draft.
- Roadmaps: helper lines 34 to 38 prove both subjects appear before the native board change. Lines 49 to 63 change the subject board through its operator route and read both roadmap sources. Each response contains exactly the public control, its request projection and matching detail; the subject detail is 404. The rendered roadmap retains the public control and excludes subject identity and title.
- Portal: lines 64 to 67 require a nonempty public request response with the control and without the subject, retaining the subject request and approved attachment 404s.
- Releases: lines 68 to 82 snapshot complete release, version, target, mapping, recipient, context, outbox and audit rows. Subject publication returns 409 with its target-review message and every snapshot equals its earlier value. Its public release URL remains 404. The separate public release publishes successfully and remains the nonempty public list control.
- Mail: lines 40 to 48 establish a real queued event and nonempty queued batch before the board change. Lines 83 to 87 attempt later internal status and reply activity, require 404s and compare the unchanged status, comment and notification graph. Lines 88 to 110 create public control status and reply activity, run scheduler drains and inspect actual HTTP-edge envelopes. The public status, reply and release are sent; subject identity and queued or later internal markers are absent; subject batches become suppressed; repeated drains send no additional messages.
- The existing configured-input notification journey in ./tests/base/notifications.test.ts at line 105 now changes visibility through the native operator board route at line 117, retaining every other current-eligibility case and its suppressed-batch assertion.

PROBE REQ-019 point 1 roadmap: native board PATCH, then both public roadmap sources and detail reads -> exactly one public control remains; subject omitted and subject detail 404.
PROBE REQ-019 point 1 release: native subject release publish -> 409; complete publication, snapshot, outbox and audit rows unchanged; independent control release publishes and is publicly readable.
PROBE REQ-019 point 1 notification: queued event, native internal board change, attempted status and reply, then scheduler drains -> subject batches suppressed and no subject envelope; public status, reply and release delivered once.
PROBE REQ-019 point 2: none; request move and five-second withdrawal are expressly omitted by the selected planner points.

## Validation and failure sensitivity

The final rebased head passes both touched suites: 22 tests in two files, no skipped tests. Typecheck, touched-file lint, build and first-party check pass. No registration or assertion was removed, narrowed, skipped or moved behind a width or branch condition. No new permanent test was registered.

Three temporary source mutations failed the new journey at distinct assertions, then every source file was restored byte-for-byte. See mutations.json and the actual mutation logs. Roadmap guard removal fails at helper line 53 because both cards remain. Disabling the release visibility predicate fails at line 76 because publication succeeds instead of refusing. Removing notification board visibility fails at line 104 because the queued subject leaks into the HTTP envelope. The initial release mutation first failed compilation due to an unused import; it was corrected to keep the import while disabling that predicate, then the runtime test failed as intended. That initial compile diagnostic is retained separately. These are local development mutations, not CI repairs or a claim of independent exact-head qualification; the final source and assertion hashes are recorded in candidate-inputs.json.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock followed by check exit=0; views=node src/base/contract-docs.mjs write followed by check exit=0; ledger=none exit=0.

After generator write and check, both generated views were restored whole from main and are absent from the product diff. The source lock was regenerated last with all intended files staged, then checked again after the completed rebase. A candidate generated-view freshness failure is expected until the Mac lander regenerates those views.

## DONE-RIDERS and pre-READY limits

No DONE claim or count increase is made.

| Row | Result on this bounded change |
| --- | --- |
| 1 | PARTIAL for the whole clause: the selected point 1 native outcomes are reached by the passing sanity journey; acceptance point 2 remains unproved. |
| 2 | PASS for selected outcomes: populated before and after controls, a real unsafe publication attempt with unchanged state, queued mail, successful public release and successful public mail are exercised. |
| 3 | Exact-head Verify completed with only the permitted generated-view freshness failures, before test execution. The local exact-head suites pass; the existing base test globs load this helper through the board registration. The lander must regenerate views and obtain its fresh Verify before landing. No new flag or nightly-only path was added. |
| 4 | Final touched suites ran on 2236f87f4375799c35944caf633d66814b73c610. Runtime source is unchanged from initial main; local mutation evidence is bounded as described above. |
| 5 | No new inherited duty or receiving-clause rewrite is claimed. Existing duties remain. |
| 6 | The partial Gap accurately retains the omitted move and clock proof. Views generate and check before restoration; the lander owns the final generated views and judgment provenance. |
| 7 | PASS: zero acceptance changes, no split, no ruling change and no removed clause row. |
| 8 | No product authority code changed. Native current operator routes are used; unsafe publication and post-internal public activity are refused with unchanged state. |
| 9 | PASS boundary: no live provider, device, deployment, legal or qualification claim; only the mail HTTP edge is faked. |
| 10 | No new policy default or missing ruling was introduced. Earlier ct, uip, payments, account, provider, device, Base and cross-seed holds remain. |
| 11 | Pending guarded landing: no main push, no main equality, no exact-head publication scan or Run site claim from this cloud. |

Applicable pre-READY checks: selected native outcomes pass and detect guard removal; all existing assertions remain; no authority, erasure or capture implementation changed, and mail replay is explicitly checked. No UI or visual surface was changed, so browser screenshots, tooltip changes and design work are outside this run. Source lock is fresh and no new literal address or credential-shaped fixture was added. Full-history publication scanning, generated-view landing, final Verify acceptance and Run site remain guarded lander duties.

## Custody and CI

The cloud push guard succeeded on its first attempt and remote branch readback equals 2236f87f4375799c35944caf633d66814b73c610. Every unpublished candidate author, committer and trailer was inspected, including side parents; only the fleet identity appears and there is no co-author trailer. The branch was never force-pushed and main was never pushed.

Main advanced during preparation. Rebase preserved main's newer LEARN-001 judgment, retained both changelog entries and regenerated the source lock. The final push followed a fresh main fetch and successful no-op rebase. The exact rebased head's touched suites and typecheck passed.

Exact-head Verify: run 42154620493, event push, completed with conclusion failure. All 29 shard failures name only Check generated contract documents; the plan job passed. The committed candidate locally reproduces the stale-view check (expected-view-check.log), while generator write and check already passed before restoring both views. This is the explicit generated-view exception allowed for READY, not a claim that product tests executed in this CI run. No product assertion failed and no speculative repair or workflow rerun was made. The lander must generate the views and obtain the new exact-head Verify before landing. No PR or dispatch was needed. Complete job results are in ci-jobs.json, with exact status in ci-status.json and RECEIPT.json. Six GitHub commands were used, within the ten-call budget.

Baseline context: initial main had successful exact-head Verify 42138503924 and Run site 42140171051. A duplicate main Verify 42140171112 reported a browser job failure, job 127638280568. Its one permitted failed-job log read returned exit 0 with empty output; no retry or speculative repair was attempted. This is not a failure of the new candidate.

No product blocker is established. The remaining clause gap is selected scope, not a new external dependency. This packet is report transport only and does not declare DONE, acceptance or landing. Private credentials, environment dumps, held-out gate material and symlinks are excluded; copied diagnostic address text is redacted.
