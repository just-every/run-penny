# sd-penny-c-f48 — REL-004 native snapshot continuation

Repository: just-every/run-penny
Branch: cloud/sd-penny-c-f48
Candidate: 9908e38a8301bd21039306d2efaa02a49e03ae28
Requested continuation base: b9760c756087e2666fd708a7f0f62398bbbf48ae

REL-004 remains PARTIAL → PARTIAL. Counts remain 79 DONE, 124 PARTIAL and 78 MISSING (281 Status rows). No acceptance sentence changed. The selected native snapshot points are proved; this round does not claim the full clause is DONE.

## Plan and result

1. Read the inline campaign extract, DONE-RIDERS, standing Penny ruling and builder rules, then the repository's AGENTS.md, CONTRACT.md, ACCEPTANCE.md, BASELINE.md, HANDOVER.md, OPERATIONS.md, relevant runtime and release journeys. REL-004 has two acceptance sentences. Native target and recipient snapshot stability was already implemented and proved in the requested base. Captured-contact evidence contexts and the complete permission-source policy remain explicitly omitted by this brief.
2. Use a fresh full-history clone at the requested continuation base. Install fleet identity and commit hooks, pinned package-manager tooling, and complete local setup. Do not refresh Base or change applied migrations. The initial setup and emitted Worker build succeeded.
3. Extend the existing release consent sanity journey rather than adding a test registration. Add isolated native per-request mute changes alongside the retained global-mute and updates-subscription withdrawal cases. Each publication has two mapped requests, one recipient with both contexts, and an independently subscribed control recipient. Mute each followed request through its public route, assert the saved follow preference and unchanged permission rows, compare every original target, recipient and context snapshot exactly, then execute the emitted Worker's scheduler. Only the control reaches the mail HTTP edge; the withdrawn recipient is durably suppressed with no provider acceptance. Restore both request preferences, run the scheduler twice more, and assert no replay and unchanged delivery custody. Preserve every earlier assertion; the new case allows only the exact expected follow timestamp change.
4. Merge current origin/main into the candidate, retaining main's newer REQ-020 judgment and browser proof and the continuation's REL-004 proof. Resolve CONTRACT.md first; retain both changelog entries; regenerate the lock last. Every Status ID from both parents remains present (281 each); all table-row counts remain 445. No published history was rewritten.
5. Run the affected release files and typecheck, first-party structural check, contract generation followed by its check, source-lock and Base-source checks. Restore ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main, then regenerate and check the source lock. Generated views have no candidate diff against main. Their expected candidate freshness failure is reported rather than repaired.
6. Commit and publish the product branch through the fleet guard after checking all four candidate commits, including side parents, for allowed author, committer and trailers. Push succeeds on the first attempt. Run the two affected release files again on the committed candidate: 10 tests pass. Publish this actual report and receipt packet only through the separate evidence ref. The maintained lander owns publication scanning, view generation, final exact-SHA gates and main publication.

## Runtime probes and frozen rubric

All probes below were performed by the passing native route and emitted-Worker journeys on the candidate; SQL reads inspect their durable results. Fixtures use native request creation, moderation, follow and publication. Existing private roadmap fixture infrastructure is retained.

- PROBE REL-004 target snapshot: native release publication with two mapped requests and two recipient identities -> exact target rows, exactly two recipient rows and both original request contexts, with deduplicated recipient identity. `tests/base/release-snapshot-stability.ts` lines 21–51.
- PROBE REL-004 merge: native mapped-request merge with notifySubscribers false -> canonical request changes, no additional mail intent, all three snapshot tables unchanged. Same file, lines 54–66.
- PROBE REL-004 relink: native withdrawal of the original roadmap publication and approval on a replacement item -> original mappings withdrawn, replacement mapping approved, all snapshot rows unchanged. Same file, lines 68–82.
- PROBE REL-004 preferences: native global mute, updates unsubscribe and per-request follow mute -> saved preferences change, original snapshots stay exact. `tests/base/release-preference-stability.ts` lines 15–52.
- PROBE REL-004 pending withdrawal: emitted Worker scheduled delivery with current withdrawal and an unaffected control -> exactly one HTTP mail envelope for the control, withdrawn delivery suppressed, no provider recipient recorded, no replay after restoring preferences and two later ticks. Same file, lines 53–93.

Rubric R1 native snapshot completeness: MET by exact record comparisons, including snapshot identities and context values.
Rubric R2 later request merge: MET by native merge and canonical-root readback.
Rubric R3 later mapping withdrawal and replacement: MET by native routes and mapping readback.
Rubric R4 later preference edits: MET for native global mute, updates subscription and per-request mute.
Rubric R5 current preference withdrawal: MET for each isolated preference, with an allowed control delivery and unsafe delivery suppression, plus no replay.
Rubric R6 evidence-linked captured-contact snapshots: OPEN, explicitly omitted by the selected brief.
Rubric R7 complete release.recipient-eligibility.v1 policy: OPEN, explicitly omitted; includes MIG-007 carry-over, voting without subscription, operator-entered addresses, and NOTIFY-009 one-snapshot addition without permission.

The primary registration is `tests/base/penny-releases.test.ts`, “request mute retains update subscription and global unsubscribe withdraws permission while preserving votes, follows and release snapshots through request merge and roadmap relink” at lines 126–175. Helper assertions run through that existing registration in Verify's existing base-test glob. No new permanent registration, test deletion, assertion narrowing or width condition was introduced. Existing identity-merge, correction, in-flight fences, export, restore and erasure journeys remain intact.

## Checks and receipts

- Local setup and emitted Worker build: exit 0. Explicit candidate build through `cloud_run npx -y @runeditrun/rer build` also exits 0; build.log. The supplied toolchain selects Node 24.19.0 on this VM and pinned pnpm 10.12.4; CI uses the repository Node pin.
- Focused changed consent journey: 1 passed; unrelated registrations filtered out in this development run only.
- Both affected release files: 10 passed before commit, then 10 passed on exact candidate 9908e38a8301bd21039306d2efaa02a49e03ae28. Complete committed-run output: release-tests.log.
- pnpm typecheck: exit 0; typecheck.log.
- pnpm exec rer check --profile first-party: exit 0; structural.log.
- node src/base/contract-docs.mjs write, then check: exit 0 and 0; views-write.log and views-check-generated.log.
- Restored candidate views: generator check exit 1, only ACCEPTANCE.md differs; expected under the supplied generated-view policy. contract-views-inherited.log.
- node scripts/edition-authoring/cli.mjs lock, then check: exit 0 and 0. Exact committed source check also exits 0; source-lock.log.
- node scripts/verify-base-source.mjs: exit 0; base-source.log.
- git diff --check: exit 0; diff-hygiene.log.
- Migration-ledger check: not applicable; no migration added or edited.
- No screen, copy, homepage, logo, layout or runtime source change. Browser screenshots and UI proof are outside this selected non-UI scope.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock && node scripts/edition-authoring/cli.mjs check exit=0; views=node src/base/contract-docs.mjs write && node src/base/contract-docs.mjs check exit=0, then restored main views; ledger=none exit=0.

## DONE-RIDERS assessment

No DONE promotion or judge request is made. Each rider is recorded to make the boundary explicit.

1. OPEN for the whole clause: R6 and R7 are omitted. Selected native outcomes pass the named journey.
2. PASS for the selected slice: populated snapshots, allowed control delivery and suppressed withdrawn delivery; preference helper lines 19–68.
3. OPEN remote test proof: push Verify 42120234931 completed with failure only at generated contract documents, before test execution. The exact candidate passes locally. This is the supplied generated-view exception for READY, not a claim that CI ran the tests or that the whole clause is DONE.
4. PASS locally: the committed candidate's two release files pass; relevant runtime bytes match the setup-built Worker, with no runtime changes in the merge.
5. NOT CHANGED: no inherited duty or acceptance point is added or removed.
6. PASS for honest PARTIAL Gap and Evidence. Generated check passes before restoring main's views; candidate stale view is expected and remains the lander's mechanical duty. No new judged-from claim.
7. PASS: acceptance sentences unchanged and all parent Status rows retained; no ruling rewrite.
8. PASS for selected current-consent admission through native routes and the scheduler. Existing in-flight identity-merge authority fence remains proved by the custody file.
9. PASS boundary: no live provider, account, device, legal or hosted qualification claimed. Earlier release requirements and field-proof holds retained.
10. NOT APPLICABLE: no new policy default or permission source is adopted.
11. PENDING lander: main equality, full-history publication scan and Run site are not claimed by this cloud builder.

## Handoff and holds

Plan row changed: REL-004 only, Evidence updated to include isolated per-request mute alongside the existing native snapshot and withdrawal proof. Status and acceptance text unchanged. No next clause selected because the supplied continuation explicitly omits the remaining native captured-contact and policy work; those omissions are scope boundaries, not invented external dependencies or a claim of completion.

The captured-contact remainder and permission-source remainder stay named in the clause Gap. Provider, device, account, cross-seed and Base qualification holds are retained. There is no newly discovered product blocker in the selected slice. No PR is needed: push directly starts Verify Penny. No workflow dispatch, rerun, provider qualification or publication scan was launched.

Publication scan: NOT RUN in cloud, guarded lander duty. Run site: NOT RUN on this branch, main-only guarded lander duty. No main push or default-branch mutation occurred.

GitHub API accounting: the first lookup accidentally used an incorrect expanded hash and returned no runs; no CI evidence was inferred from it. The second lookup uses the exact full candidate hash and discovers Verify 42120234931. Further status is recorded in CI-STATUS.json. No repeated polling within 300 seconds for this run.

## Final CI result and custody

Push Verify 42120234931, event push, head 9908e38a8301bd21039306d2efaa02a49e03ae28, completed with conclusion failure. Every failed job has exactly one failed step: Check generated contract documents. The edition source lock step succeeds in all failed jobs. No test or runtime assertion ran and failed; test execution was skipped after this mechanical failure. The representative base-1 job is 127570442052. Its failed-step log is requested once with `gh run view 42120234931 --repo just-every/run-penny --job 127570442052 --log-failed`; the saved output is verify-failed-step.log. Its generator reports only: “ACCEPTANCE.md: generated content differs; run contract-docs write.” This reproduces the candidate's recorded local restored-view check. No Verify repair, workflow rerun or dispatch is appropriate.

The supplied cloud contract explicitly permits READY for this generated-view-only failure; the lander generates the views and reruns Verify on the resulting commit before landing. This report does not label the remote run successful. The exact product head is independently confirmed with git ls-remote on cloud/sd-penny-c-f48. No PR was created because the branch push starts Verify. All five GitHub CLI invocations remain within the ten-call budget; discovery and final run polling were separated by more than 300 seconds.

Product publication succeeded on the first guarded push. Publication scanning, main equality, final acceptance and Run site remain lander duties. No DONE count, landing or provider qualification is claimed. No newly introduced product blocker was found. The remaining native acceptance work is explicitly omitted by the selected brief, and the prior base's landing-order hold is preserved for the fleet. There is no new reason to mark this selected slice BLOCKED.
