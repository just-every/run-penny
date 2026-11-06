# sd-penny-c-f96 report

Repository: just-every/run-penny. Product branch: cloud/sd-penny-c-f96.
Candidate: d1d45bf94c51f3645445ad7611c9507eb2f67187. Main inspected: 0d6f3416c75fe29675323ad1a2ef4bd1f8086756.

SURFACE-002 remains PARTIAL to PARTIAL. Counts remain 79 done, 124 partial and 78 missing, total 281. This round completes the planner-selected native evidence snooze portion of acceptance point 4. It does not claim the whole acceptance point or clause DONE.

## Plan and result

1. Read the full SURFACE-002 requirement, its five acceptance points and Status Gap, the shipped plan extract, ct riders and Penny ruling RL-101. The target's native snooze operation was absent from the declared agent tool although the existing operator route already had the native transaction. RL-101 concerns bulk authority and requires no new policy for this individual action.
2. Extract that existing transaction into `src/core/features/triage/snooze.ts`. Keep future-date refusal, canonical ISO time, record existence, one transaction for state and native activity, and the supplied guarded database. Both the existing HTTP route and the agent update tool now call it. The scope remains evidence:write; the tool still computes only standard with measure 1. There is no Base copy change, migration, provider action, new authority or risk class.
3. Extend the existing agent declaration, native HTTP fixture and conformance journey with separate phase-local records for snooze and clear. Add one focused sanity journey through the HTTP route and MCP transport with persisted native readback, existing signed policy, native approval and revocation doors. Registered base test calls increase from 187 to 188, below the declared 200 cap. No existing assertion or registration is removed, skipped or narrowed.
4. Keep SURFACE-002 partial and update only its Evidence and Gap. Acceptance text and every parent Status row remain unchanged: 445 table rows before and after each commit. Update native agent documentation and Unreleased notes. No visual source, homepage, logo or screen is changed; browser screenshots and visual approval are outside the selected slice.
5. Run touched native tests, typecheck, focused lint, first-party structural check, agent documentation check and agent conformance. Save the first real commit as 9657563862886a26b839e7cf778b3bf01fed125b with skip-ci, then push it with the fleet guard. Add current sponsor-removal proof, fetch main and merge it (already current), generate and check contract views, restore the generated views from main, regenerate the source lock last, check it, and push the final candidate with the guard. Both product pushes succeeded without retry or force.
6. Publish only this selected non-secret report and actual receipts to the separate evidence ref. Leave product landing, full-history publication scanning and Run site to the maintained fleet lander.

## Frozen rubric for this native slice

- R1 MET: native HTTP and MCP act on different native evidence records; exact canonical untilAt values and clear readback appear through GET `/api/operator/triage`. `tests/base/agent-snooze.test.ts`, lines 50 to 77; `tests/agent-door/journey.mjs`, snooze and unsnooze steps. Assertions compare independent stored records and exact dates, and detect missing writes or failed clear.
- R2 MET: standard is the only computed and audited class under autonomous execution, approval hold, approval completion and the conformance held-review policy. Native activity retains actor, agent, sponsor, preparer and real approver. `tests/base/agent-snooze.test.ts`, lines 44 to 47, 63 to 66, 107 to 123 and 136 to 139. The held action changes nothing before approval.
- R3 MET: repeated calls retain one native effect and activity; replaying the old successful snooze after clear does not resurrect snooze state. `tests/base/agent-snooze.test.ts`, lines 67 to 77 and 123.
- R4 MET: malformed, missing and past times and missing records refuse, preserving snooze, evidence, version and triage activity rows. `tests/base/agent-snooze.test.ts`, lines 79 to 95. HTTP retains its existing error shape; MCP retains native refusal mapping.
- R5 MET: insufficient scope, Pause, revoked consent, revoked agent and removed native sponsor refuse with the business state unchanged. `tests/base/agent-snooze.test.ts`, lines 89 to 105 and 125 to 147. Both allowed and unsafe paths run through public doors. The removed sponsor's HTTP session and signed MCP token both fail on the next write.

No mutations were committed or represented as executed. The named assertions directly check each selected observable outcome. Existing conformance retains authority, native erasure and restore refusal and replay fences.

## Public-door probes

PROBE SURFACE-002 point-4-snooze: PATCH native triage snooze and MCP penny.evidence.update snooze with the same future instant on distinct evidence ids -> both ids read back with the exact canonical untilAt through GET `/api/operator/triage`; native and agent clear -> both absent.
PROBE SURFACE-002 standard-and-held: MCP snooze and clear under autonomous and held policies -> exactly standard; held approval changes no native state until the named person approves; native activity retains the actual sponsor and approver.
PROBE SURFACE-002 replay: repeat successful calls and replay the original snooze after clear -> no duplicate triage activity and no resurrected snooze.
PROBE SURFACE-002 refusals: bad or past date, missing record, insufficient scope, Pause, withdrawn consent, revoked agent and removed sponsor -> expected refusal with unchanged native evidence and snooze state.
PROBE SURFACE-002 omitted-points: none; point 1 complete queue filters, point 2 ROLE-001 commercial projections, point 3 full grant equivalence, point 4 other verbs and unpublished proxy-vote completion, and point 5 complete untrusted-content coverage remain outside this selected slice.

## Mechanical receipt

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock followed by check exit=0; views=node src/base/contract-docs.mjs write followed by check exit=0; ledger=none exit=0.

Generated ACCEPTANCE.md and docs/CLAIMS.md were restored from origin/main and are not in either product commit. The candidate intentionally has the known generated-view freshness difference. Source lock includes the final tracked bytes, and copied Base custody remains unchanged. No migration ledger is touched. No email-shaped literal was added to the product diff. All candidate author and committer fields are fleet identity; trailers are absent. Published history is preserved.

## DONE-RIDERS assessment

No DONE or judge request is made.

1. FAIL for full clause, MET for selected snooze outcomes: the remaining acceptance outcomes are explicitly retained in the Gap.
2. PASS for this slice: populated distinct records, exact readback and unsafe refusal snapshots.
3. Candidate workflow completed with only the permitted generated-view freshness failure; local touched journeys pass. No CI test execution is claimed. Candidate Verify run 42199129439 is a push run on the full candidate SHA.
4. PASS: final focused journey executes on the candidate; conformance is repeated on the candidate.
5. PASS: clause cites BASE-AGENT-003, BASE-AGENT-005 and BASE-AGENT-006; no inheritance change.
6. PASS for generation and truthful partial Gap; main's unrelated Judged-from text is retained. Generated-view check on the committed candidate is expected to fail until the lander writes views.
7. PASS: no acceptance edits, no id rewrites and all parent Status ids preserved.
8. PASS for selected operation: scope, agent, consent, Pause and current native sponsor refusal preserve state.
9. PASS: provider, account, device, Base and other-seed boundaries remain explicitly held.
10. PASS: no new policy default or ruling is introduced.
11. Pending guarded landing: no main equality, COMPLETE publication scan, successful candidate Verify or Run site receipt is claimed here; readiness uses only the expressly permitted generated-view exception.

## Remaining scope and plan rows

The only plan row advanced is SURFACE-002: native acceptance-point-4 snooze and clear now have implementation and proof; status stays PARTIAL. Retain all earlier ct, uip, payments, provider, device, account and release holds. Retain the wider SURFACE-001 and SURFACE-003 through SURFACE-007 and BASE-AGENT families, D-6 embedded agents, provider work and new risk classes outside this round. The brief selects no next unblocked same-file clause after this bounded slice; none is invented.

## CI and custody

No pull request is needed: branch pushes directly start Verify Penny. Candidate run: 42199129439, event push, exact head d1d45bf94c51f3645445ad7611c9507eb2f67187. Its final observed state is recorded in CI-RECEIPT.json.

Existing-main Verify run 42194484496, job 127814272471, failed at `reviewPrivateSearch` in `tests/browser/operator-completeness-read.mjs:70`: page.waitForURL timed out after 30000 ms. The same main SHA also has successful branch Verify 42192912570. This round makes no repair to that unrelated browser journey and does not assert it was reproduced or repaired. Existing-main Run site 42194484854, job 127814206039, failed with provider-http-503 and no healthy upstream from Cloudflare. Report both to the lane; the provider failure is a known infrastructure class. Neither failure is presented as a passing candidate run.

Publication scan is not run in cloud and no COMPLETE or zero-findings receipt is claimed. The fleet must scan full history, write the contract views, rerun required exact-SHA gates as required and perform guarded landing. There are no local failing product checks and no provider key dependency for the selected native slice.

Final CI observation: Verify Penny 42199129439 completed with failure on d1d45bf94c51f3645445ad7611c9507eb2f67187. The plan job succeeded; all 29 failed shard jobs failed only at Check generated contract documents. Representative static job 127829841392 reports ACCEPTANCE.md generated content differs. The source lock passed before that step. The fleet instruction expressly permits READY for this generated-view-only failure; no test failure is hidden and no generated view is committed to turn CI green. GitHub budget: nine calls of ten, including the single diagnostic archive read for that job.

Pre-ready self-check: selected public-door behaviours have direct outcome assertions; no existing assertion was removed or narrowed; scope, consent, Pause, revoked agent, removed sponsor and replay refusals preserve state; the existing retained-agent-evidence erasure fence remains in conformance. No screen was touched. Exact-SHA touched tests and conformance pass, source lock and Base custody pass, views generate and check before restoration. Actual CI, main site, publication scanning and guarded landing limitations are reported without a green or COMPLETE claim.
