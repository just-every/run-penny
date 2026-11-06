# sd-penny-c-f58 result

LEARN-001 remains PARTIAL → PARTIAL. The selected acceptance-point-4 proof is complete for the native model boundary. Deployment pinning of the source installation and permitted principals, live Orbit and model qualification, and wider source qualification remain open in the Gap. No other clause, acceptance text, inherited hold or release requirement changes.

Product: just-every/run-penny, branch `cloud/sd-penny-c-f58`, head `2761a4bc87b80a218713bb6c8337886b26cbfc01`. No PR is required or created. Main remains `84bad894d12e7f969f567177a126cb544a3237b1`; this cloud did not change it. Main already contains predecessor `438da05c1bb046f2d4cce276d46ede470eecf8df`, so there was no unfinished predecessor patch to replay. The fresh full-history branch preserves that work and every other writer's history. Final fetch and rebase found main unchanged. The guarded product push succeeded on its first attempt.

Counts before and after: 79 done, 124 partial, 78 missing, 281 total; no status promotion or demotion. All 281 parent Status rows and all 445 pipe-table rows remain. The touched test file has two registrations before and after, with no new or removed tests. The plan row changed is only LEARN-001 point 4: strengthen the existing native refusal and valid-output proof with populated requester identity and existing explicit permission custody. The Mac plan was not edited; PLAN.md records the full executed plan.

## What changed and why

The production schema already strictly refuses model identity and grant fields. The predecessor already tested root and first-option attacks. This round extends that same public-door sanity journey instead of duplicating it or changing production code.

A real signed host claim establishes a native requester and account. The requester submits a native request with an explicit update permission through the public route. An authenticated operator selects that request and separate native account evidence for an investigation. Eight otherwise valid model HTTP-edge responses inject camel-case identity, native identity, grant and authority, or derived identity fields at the root and first option.

Each attack is refused with 409 `learning_model_output_invalid`. Authenticated detail retains exactly the selected native originals. Populated requester, address, account, host mapping, explicit permission, follow and authority records remain unchanged, as do all selected investigation scope and source rows. Global artifact, contribution and commitment snapshots remain unchanged. Session use timestamps and legitimate run accounting may advance; no attacker identity, permission or derived work is minted.

The following valid model response completes with one artifact. Both compared options derive the real requester from the selected native request and the real account from the selected account evidence, with supporting count two. The existing explicit permission and grant scope remain unchanged. The successful run costs 1100 micros; all nine paid model calls have metered token accounting. The native-only block makes no source HTTP request. Fakes are only at the model HTTP boundary for this block; native authentication, routes, storage, acquisition, validation and readback all run normally.

Files changed: `tests/base/learning-stage2.test.ts`, LEARN-001's existing Status Gap in `CONTRACT.md`, `CHANGELOG.md`, and the generated `sources.lock.json`. No runtime, UI, migration, provider configuration or homepage change is required. The source pin is unchanged. No generated contract view is committed.

## Proof and checks

The named journey is `tests/base/learning-stage2.test.ts`, “refuses model identity and grants, captures permitted originals and commits an accountable protocol”. Native setup and the preexisting explicit permission are at lines 13–27; authority and scope snapshots at lines 33–41; the eight refusals and unchanged-state assertions at lines 42–60; valid native identity derivation and cost accounting at lines 62–70. The same journey's remaining original-capture, commitment, redaction and restore assertions are retained, as is the second existing AI journey.

- Exact committed SHA, Node 22.20.0: `pnpm exec vitest run --config vitest.base.config.ts tests/base/learning-stage2.test.ts`, exit 0, two tests passed. See runtime-receipt.json and learning-stage2-exact-sha.log.
- `pnpm run typecheck`, exit 0 on the same source and test bytes with Node 22.20.0. See typecheck.log.
- `npx -y @runeditrun/rer check --profile first-party`, exit 0. Its output is empty; first-party.log preserves that actual result. Setup completed successfully through the supplied cloud subreaper and pinned dispatcher; its build and migrations completed without provider deployment.
- `node src/base/contract-docs.mjs write`, then `check`, both exit 0. Restore ACCEPTANCE.md and docs/CLAIMS.md from origin/main before staging. See views-write.log and views-check.log.
- Regenerate source lock last with `node scripts/edition-authoring/cli.mjs lock`; its `check` passes, including after the final rebase. See lock-check.log and mechanical-receipt.json. No migration was changed, so no migration-ledger check is needed.
- Parent-row preservation, staged and committed diff checks, fleet author and committer checks, and absence of co-author trailers all pass. No new email-shaped literal or unintended prose repository reference is added. See row-preservation.json and diff-hygiene.json.
- No assertion is removed, narrowed or moved behind a new condition. The original one-observation and empty-requester control is strengthened to two explicitly identified native observations and a nonempty derived requester. The existing model attack matrix and all subsequent journey assertions remain.

Two temporary source mutations independently changed root or option unknown-field handling from refusal to stripping. In each case the public run incorrectly succeeded with 200, and the unchanged refusal assertion at line 50 failed expecting 409. Both mutation runs exited 1. Original schema bytes were restored before final checks, lock generation and commit. See mutations.json and the two mutation logs. These deliberate failures are not CI failures or repair rounds.

The runtime PROBE lines and MECHANICAL line are recorded in PROBES.txt. No browser proof is needed for this test-and-contract-only change; no screen was touched. No live qualification, scale dispatch, visual work or publication scan was performed.

## Exact-SHA CI and landing custody

Verify Penny run `42142692450`, event `push`, head `2761a4bc87b80a218713bb6c8337886b26cbfc01`, completed with failure. The plan job passed. Every failed shard reports only “Check generated contract documents”; all later test steps are skipped. The representative base-1 archive reports that ACCEPTANCE.md differs and requests contract-docs write. The exact committed local check reproduces this same expected stale-view result, exit 1. See candidate-ci.json, candidate-jobs.json, candidate-generated-failure.log and views-committed-check.log. The published diagnostic omits the runner environment stanza; the command and complete failure diagnostic are retained. This is the brief's permitted generated-view exception, not a claim of a green full suite. No workflow was changed, dispatched or rerun. Six GitHub diagnostic invocations were used in total.

The fleet lander must generate the contract views, relock, run its exact-SHA Verify, complete the full-history publication scan, perform its guarded landing, and confirm main-only Run site. The cloud cannot perform that scan and does not claim COMPLETE, zero findings, main equality or candidate Run site success. Product READY custody is separate from evidence publication and from clause DONE.

On the original main SHA, Verify `42138503924` and Run site `42140171051` succeeded. A later main Verify `42140171112`, job `127638280568`, failed in the learning browser journey at line 115 because four resources returned `net::ERR_CONNECTION_REFUSED`. Its failed log was read once. This is reported to fv as an existing-main transport flake, with no unrelated test or infrastructure repair in this branch.

## DONE riders and pre-ready scope check

No DONE flip or judge request is made. The following records the applicable rider state without counting partial proof as full clause completion.

1. Scoped point 4 passes the native public-door journey; clause-wide point 1 and live qualification remain unproved and named.
2. Pass for the selected security outcome: populated custody, eight unsafe refusals, a valid allowed path, and two independently caught boundary mutations.
3. Exact-SHA local journey passes. Exact-SHA push Verify stops only at the permitted generated-view check; full-suite green remains the lander's duty. No DONE claim rests on skipped CI tests.
4. Pass for local evidence freshness: runtime-receipt.json names the exact committed candidate. Mutation evidence precedes the commit, with production schema bytes restored and unchanged.
5. No inherited duty or policy is newly introduced or claimed complete; existing contract obligations remain intact.
6. Partial Gap and Evidence remain honest. Generator write and check pass locally; committed stale views are intentionally restored under the cloud rule. Existing judgment provenance is retained because this is not a ct status judgment.
7. Pass: zero acceptance-point changes and zero parent Status-row loss; no new ruling or coverage rewrite is needed.
8. Pass within the selected boundary: model output cannot mint or alter populated identity, explicit update permission, operator authority, source state or selected grant scope. Native authenticated admission is exercised normally.
9. Pass for reporting honesty: no live provider or deployment guarantee is claimed; those boundaries remain named.
10. No new custody, consent, spending or authority default is adopted. The existing refusal policy is unchanged.
11. Pending guarded lander. This branch is pushed, not landed. Publication scanning, generated-view landing commit, exact green Verify and main Run site are not asserted here.

The pre-ready check finds no new product path affecting erasure, replay, outbound effects or public exposure; production code is unchanged. Existing redaction, revoke, restore and original-custody assertions in the touched file remain and pass. No visual rules apply to changed screens because none changed. The source lock is fresh, the product worktree is clean, and the expected generated-view exception is the only candidate CI failure. There is no blocker to handing over the selected partial progress. The named deployment-principal and live qualification remainders prevent a DONE claim.
