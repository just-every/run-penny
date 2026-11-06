# sd-penny-c-f80 results

AI-011 moves from missing to partial at c0c7df9f0d9e8f4ff5a0257c316ae415b139ca25, branch cloud/sd-penny-c-f80.
Before: 79 done, 124 partial, 78 missing. After: 79 done, 125 partial, 77 missing.
Only AI-011's Status Evidence and Gap changed; acceptance sentences are unchanged.
The plan row changed is AI-011 from the planner's eleventh return. No other
campaign target is selected by this round. The full executed plan is PLAN.md.

## Selected outcomes and proof

Point 1's duplicate-corpus portion: duplicates-v1 version 1.0.0 contains 300
authored labeled pairs across 100 candidate needs: 200 positives, 100 hard
negatives (33.33% of all pairs), and 100 disjoint-term paraphrase positives.
Its byte SHA-256 is d5599bacbe1dc5c2812c3c8028419dc88cb0c9ccfdcd364ecd0d2bbf3f92031d.
The corpus was authored before scoring and was not tuned or relabeled afterward.
SPEC.md documents correlated pairs, the candidate pool and the label boundary.

Point 4's lexical floor: the real evaluation command loads only fresh temporary
D1 storage, runs all 300 title queries through the emitted production public
suggestion route and its existing suggestions.ts implementation, and removes
its own fixture store. It loads no installation settings or provider credentials.
Outbound requests are refused and counted. No substitute matcher predicts pairs.

The final actual receipts are DUPLICATES.json and REDACTION.json. Precision,
recall, F1 and top-five recall are each 0.50; paraphrase recall is 0. Confusion
counts are TP 100, FP 100, FN 100, TN 0. These are labeled-pair measurements of
the native five-result response, not labels for every other returned candidate.
Model and prompt versions are inapplicable. Provider calls and cost are zero.
The lexical weaknesses remain visible; no semantic quality gate is claimed.

The existing duplicate-suggestion capacity journey invokes
tests/runtime/ai-eval-command.mjs, function proveAiEvaluationCommand.
It executes the real command, checks the independently labeled billing control
(a lexical match, a false-positive hard negative and a missed paraphrase),
reconciles every reported pair with the confusion matrix and derived metrics,
checks the corpus hash and persisted report, refuses an invalid label without
writing a report, and retains the redaction command. The actual Node 22 command
proof is COMMAND-PROOF.log. Helper lines 23 to 40 prove the command and native
control; lines 43 to 62 reconcile observations and metrics; lines 64 to 76 prove
invalid-label refusal and retained redaction. The existing scale journey invokes
the helper at lines 6 to 9. No existing assertion is removed, narrowed, skipped
or put behind a condition. The final tree adds no test registration or Verify
entry. TEST-CUSTODY.json records the pre-existing count above the stated cap.

PROBE AI-011 1: eval:ai duplicates-v1 with provider credentials absent -> validated 300 pairs, 100 hard negatives and 100 disjoint-term paraphrases, corpus version and hash reported.
PROBE AI-011 4: native public suggestions with the 100-candidate fixture pool -> TP=100 FP=100 FN=100 TN=0; billing control reconciled; zero provider calls and cost.

## Deliberate remainders

Point 1 still needs links-v1, merges-v1, extraction-v1, themes-v1 and spam-v1.
R-13's two-person theme labeling and adjudication remain held. Points 2, 3 and 5
still need configured-model reports, capability bars, a deliberately degraded
fixture-model failure gate and dated model-evaluation receipts. The lexical
floor does not qualify AI-001 or unlock AI-012 automatic rules. Provider,
device, account, Base and other-seed dependencies and all existing ct, UI,
payment and release holds remain. No live provider qualification, UI, homepage,
logo, publication or deployment work was selected. These are honest remaining
obligations, not a claim that the selected native work is blocked.

## Mechanical and custody checks

CHECKS.json records actual candidate checks and exits. The candidate build,
Node 22 typecheck, focused lint and native command proof pass. First-party
inspection passes. Contract generator write and check pass locally; its generated
views were then restored whole from origin/main and never committed. The source
lock was regenerated last and its check passes. No migration changed, so no
migration-ledger check applies. The final checkout has no diff.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0, generated views restored; ledger=none, no migration changed.

All 281 parent Status rows survive both commits. Authors and committers use
the fleet identity, with no co-author trailers. The changed product files
contain no email-shaped strings. CUSTODY.json records these bounded checks.
The complete publication scan is the guarded lander's duty; this cloud report
does not claim COMPLETE or landing. Main was current before both pushes;
published history was preserved and no default branch was pushed.

## DONE riders and pre-READY scope

No DONE claim or judge request is made. Rider 1 remains unmet for the full
AI-011 clause because the other corpora and model outcomes are absent.
Rider 2 passes for this bounded command control and invalid-label refusal.
Rider 3 depends on the candidate's recorded Verify; CI custody is recorded
separately below. Rider 4's local proof is at the exact candidate.
Rider 5 adds no inherited duty. Rider 6 has truthful partial Evidence and Gap,
and local generated-view check passes before the required restoration.
Rider 7 passes: no acceptance change or obligation was removed.
Rider 8 adds no authority or money action. Rider 9 retains all provider limits.
Rider 10 adopts no policy default. Rider 11 remains the guarded lander's duty.

Authority, erasure and replay implementations are unchanged. Evaluation uses
disposable synthetic fixture data and no credentials, outreach or installation
mutation. No screen changed, so browser screenshots and visual checks do not
apply. Exact candidate Verify, main equality, final publication scanning and
Run site custody are reported honestly rather than inferred from local checks.

Main baseline e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f has green push Verify
42153984585 and Run site 42153984645. Nightly journeys 42156564353 failed
separately; that existing nightly failure is not treated as a red main.

CI and evidence transfer observations are appended before publication.

Receipt collection corrected one unsupported direct package-file invocation
(MODULE_NOT_FOUND); the supported npx dispatcher passes. CHECKS.json retains
that diagnostic. No product repair or assertion change followed it.

## Exact candidate CI handoff

Push Verify 42171694429, event push, completed with conclusion failure on
c0c7df9f0d9e8f4ff5a0257c316ae415b139ca25. The plan job passed; all 29 failed
shards failed only at Check generated contract documents. Local exact-head
reproduction after restoring main's views is:
ACCEPTANCE.md: generated content differs; run contract-docs write.
The generator write and check pass before that required restoration. No product
test assertion failed or ran in those shards. CI-JOBS.json records every job
and failed step; CI-GENERATED-VIEW.log is the one requested failed-job archive
read for the requester-board job 127740839755. No workflow was changed,
dispatched or rerun. Five GitHub diagnostic calls were used.

This is the explicitly permitted generated-view freshness exception. The
candidate is READY for the guarded lander, which must regenerate the views,
rerun exact-SHA Verify on its resulting commit, perform the publication scan
and establish Run site before counting or landing. This report claims neither
a successful branch Verify nor a completed landing. No product blocker remains
for the selected scope. The full AI-011 clause remains partial.

Evidence is published separately from the product branch with the explicitly
selected actual files in this packet. The emitted evidence ref and head are
reported in the terminal handoff. Product head and index stay unchanged.
