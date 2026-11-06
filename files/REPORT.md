# sd-penny-c-f91 results

Repository: just-every/run-penny
Product branch: cloud/sd-penny-c-f91
Product head: 41e313788c47c7cfadeb9cade9f2c4c0d636b31f
Current main observed: 8d4b0ac3eebe3e50003b61820f9c366282986327
Pull request: none; branch pushes are Verify's existing entry point.

## Outcome and scope

AI-011 remains PARTIAL relative to the supplied f86 predecessor. The selected duplicates corpus and no-model lexical floor are already complete in that predecessor. This run inspected them and produced fresh command evidence on the same exact commit. No product edit, redundant test, empty commit, new matcher or corpus relabeling was needed. The requested branch now points to the preserved predecessor commit. The predecessor has not been observed on main.

Relative to current main, this candidate carries AI-011 from MISSING to PARTIAL. Counts move from 79 done, 124 partial, 78 missing to 79 done, 125 partial, 77 missing, with 281 clauses and no DONE increase. Relative to the supplied base, all counts and statuses are unchanged.

The full clause cannot be called DONE. The brief explicitly excludes the five remaining corpora, configured-model reports and capability bars, deliberately degraded fixture-model failure gate and dated model receipts. R-13's two-person theme labeling and adjudication, AI-001 semantic quality and AI-012 automatic-rule prerequisites remain open. Existing provider, device, account, Base, cross-seed, ct, UI, payments and release holds remain in the contract. These are retained remainders, not newly proved or newly released obligations. No next clause was started because this continuation names only this selected slice and explicitly omits the rest.

## Plan carried out

PLAN.md records the full execution plan. Fleet setup, private credential helper, push guard and preserved repository hooks were installed. A full-history clone checked out the requested predecessor. The clause and current Gap, production lexical implementation, authored labels, command and command journey were read.

The requested final rebase attempted to flatten the predecessor's already-published merge history and encountered changelog and source-lock conflicts. It was aborted without creating a commit. The published-history rule was applied instead: merging origin/main returned Already up to date. The head, merge ancestry, tests and all other writers' work remain byte-for-byte unchanged. Generated contract views were written and checked successfully, restored whole from main, then the source lock was regenerated and checked last. The work tree remained clean.

All five candidate commits, including merge-side parents, passed fleet author, committer and trailer inspection. Every candidate commit retains every parent Status ID. No unpublished commit needed correction and no published history was rewritten. The product push guard succeeded on its first attempt. No default branch, other repository or PR was changed.

## Selected acceptance proof

Point 1, duplicates-v1 portion:
- ./tests/fixtures/ai/duplicates-v1/SPEC.md documents authored labels and stable version 1.0.0.
- ./tests/fixtures/ai/duplicates-v1/cases.json has 300 pairs against 100 distinct candidates: 200 positives, 100 hard negatives sharing terms but changing need, and 100 positive paraphrases without shared terms.
- Corpus SHA-256: d5599bacbe1dc5c2812c3c8028419dc88cb0c9ccfdcd364ecd0d2bbf3f92031d.
- ./scripts/ai-eval/duplicates.mjs lines 10–38 validate corpus shape, identities, unique pairs, label mix and term disjointness.

Point 4, lexical floor:
- ./scripts/ai-eval/lexical-runtime.mjs migrates fresh temporary D1 storage around the emitted production Worker, sends queries through /api/public/requests/suggestions and refuses all outbound traffic. It supplies no provider credentials and removes its own store on exit.
- ./src/core/features/requests/suggestions.ts remains the production implementation. No alternate prediction matcher was introduced.
- ./tests/runtime/ai-eval-command.mjs, proveAiEvaluationCommand, lines 44–110, runs the real command with credential variables removed, reconciles saved output with stdout and corpus bytes, and retains the redaction evaluation.
- Lines 61–66 check independent hand labels. Lines 67–96 use six identical needs competing for five native slots and a different correction need to check ranks 1 through 5, the excluded sixth, and all four confusion outcomes. Lines 97–104 prove invalid labels fail before an output report is presented.
- ./tests/runtime/duplicate-suggestions-scale.mjs lines 7–10 invoke that command proof from the existing requester-board push Verify journey. No new registration or cap change was added.

Observed report: TP 100, FP 100, FN 100, TN 0; precision 0.50, recall 0.50, F1 0.50, top-five recall 0.50 and paraphrase recall 0.00. Model and prompt are inapplicable. Provider calls are zero and cost is USD 0. This is the honest lexical floor; AI-001's semantic capability is not qualified and its displayed comparison bars are not met. The floor is a measurement, so this is a successful baseline command, not a degraded-model gate pass.

The existing redaction-v1 command passed unchanged: 210 excerpts, 170 labeled spans and no failed kinds. Its actual report is included.

PROBE AI-011 point 1 duplicates portion: eval:ai with the authored version 1.0.0 -> 300 valid pairs, 100 hard negatives and 100 disjoint-term paraphrase positives.
PROBE AI-011 point 4: eval:ai through the native suggestion route with provider credentials absent -> measured confusion matrix and metrics above, model and prompt inapplicable, zero provider calls and zero cost; native ranked controls passed.
PROBE AI-011 redaction retention: eval:ai redaction-v1 -> passed true, failed empty, 210 excerpts.

## Verification

All local commands completed with no remaining processes:
- Fleet-required setup: exit 0; built the Worker, migrated isolated local storage and claimed the fleet owner.
- proveAiEvaluationCommand through the real command: exit 0, including corpus controls, invalid labels and redaction.
- Both actual evaluation report commands: exit 0 with provider credentials removed.
- pnpm run typecheck: exit 0.
- npx -y @runeditrun/rer check --profile first-party: exit 0.
- Contract generator write and check: exit 0. Main's generated views restored whole afterward.
- Source lock regeneration and freshness check: exit 0, no tracked changes.
- No migration changed; no migration-ledger check applies.
- No UI changed; no browser screenshots or visual work were needed.
- Runtime Node was v24.19.0 and pnpm 10.12.4, selected by the required toolchain shim. CI pins Node 22.20.0.
- No existing assertion was removed, narrowed or hidden. No authority, erasure, replay, money or data-loss path changed. This command is read-only over its own fixture store. No new personal data or literal address was put in fixtures.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0, main views restored; ledger=none exit=0.

The restored candidate's generated-view check reports ACCEPTANCE.md differs, exit 1, exactly as the cloud contract expects. This is not a product repair. The lander must regenerate views from CONTRACT.md and run its gates.

## CI and publication custody

The product branch was pushed successfully, without a force push. Exact-SHA run 42180864207, event push on predecessor branch cloud/sd-penny-c-f86, completed failure. Its plan job passed; every one of the 29 failed shard jobs failed only Check generated contract documents. The representative static job is 127769957919; its archived failure log is in verify-42180864207-static.log. No product assertion ran past that guard. This meets only the explicit generated-view exception; no full Verify success is asserted.

The new branch run 42185094008, event push on cloud/sd-penny-c-f91, also completed failure on the same exact SHA. Its plan succeeded and all 29 failed shards failed only Check generated contract documents. Representative static job 127783489357 reports the same ACCEPTANCE.md freshness message; its archive is in verify-42185094008-static.log. The actual selected REST run and job responses are included. Six GitHub invocations were used, with discoveries separated by at least five minutes. This qualifies for the expressly permitted generated-view exception to READY; no successful full Verify is claimed. No workflow was dispatched or rerun. Main equality, Run site, full-history publication scan and landing are maintained Mac lander duties and are not claimed here. There is no scan receipt, no publication finding count claim and no landing claim.

## DONE-RIDERS review

No DONE flip or judge request is made. Full-clause results, retained for clarity:
1. FAIL for full DONE: selected lexical outcomes reached, but the explicitly omitted corpora and model outcomes remain open.
2. PASS for the selected slice: nonempty authored data and independent known native ranks exercise all confusion outcomes; proof lines 61–104.
3. UNESTABLISHED for full DONE: command proof is invoked by push Verify, but runs 42185094008 and 42180864207 stop only at generated-view freshness. This is the explicit handoff exception and does not establish full-clause DONE.
4. PASS for local lexical proof: reports and journey ran on exactly 41e313788c47c7cfadeb9cade9f2c4c0d636b31f, and no relevant bytes changed.
5. NOT APPLICABLE: no inherited duty or acceptance text changed.
6. PARTIAL preserved: Gap retains all missing work; generator write and check pass locally, main views restored per cloud instruction. No candidate DONE provenance is asserted.
7. PASS: no acceptance rewrite, new ruling or lost obligation.
8. NOT APPLICABLE: no authority verb changed.
9. PASS: no provider, legal or real-world proof claimed.
10. NOT APPLICABLE: no policy default adopted.
11. PENDING LANDER: no main equality, scan or Run site claim.

Plan row return: AI-011 selected duplicates corpus and lexical-floor points are verified as already implemented in the supplied base. Keep AI-011 PARTIAL and all named remainder holds; do not rebuild or expand the campaign.

The actual reports, receipts and this plan are published only through evidence/sd-penny-c-f91. Evidence transport is separate from product READY custody and never establishes DONE or landing.
