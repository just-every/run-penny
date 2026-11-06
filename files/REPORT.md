# sd-penny-c-f74 — native CSV vote reconciliation

Repository: https://github.com/just-every/run-penny

Branch: `cloud/sd-penny-c-f74`

## Scope and plan

Keep DATA-005 partial. The selected slice is its first acceptance point for native requests and individual voters. Other CSV record families, saved views and ROLE-001 commercial field restrictions are explicitly excluded by the planner. Preserve all existing provider, device, account, cross-seed, Base, ct, uip, payments and release holds. No homepage, visual, provider qualification or release work is authorized.

1. Inspect the full clause, its current Status evidence and Gap, the named source, existing route journeys, test budget and Verify entry point.
2. Preserve the specified full-history base and its distinct eligible-person request total. Validate parsed request and voter exports against explicit fixture identities, public totals, authenticated context and stored record counts.
3. Extend the existing journey only where the selected reconciliation proof is incomplete: changing direct participation, repeated votes, addressless proxy demand with multiple account associations, and refused-export identity privacy. Add no test registrations.
4. Run the affected route tests, typecheck and first-party structural check. Generate and check contract views locally, restore main's views, stage intentional inputs and regenerate the source lock last. Preserve every Status row.
5. Publish a guarded save, integrate current main without rewriting published history, repeat the relevant mechanical checks, then publish the final candidate. Record exact-SHA CI honestly; leave publication scanning and landing to the fleet.
6. Publish this complete non-secret packet on the separate evidence ref, then remove the successfully pushed clone and dependencies.

## Initial inspection

The requested base `e3ebcc7130fd1879bb5ed8c736b0f7f1b3c097ef` already contains the request CSV `vote_count` column and the native reconciliation helper. That base has zero, direct, mixed and proxy-only fixtures, a direct takeover of a proxy vote, blocked-person exclusion, multiple verified addresses and accounts for a direct voter, and unauthenticated, requester and revoked-operator export refusals. The two affected files pass five registrations before this round's edits.

Base Verify `42158298559` completed with failure only at **Check generated contract documents** across its shards. This is the documented generated-view exception, not a product failure or a repair round. No CI retry or dispatch was made for the base.

The selected native exports already implement the requested product behavior; this round preserves it and closes the remaining lifecycle and joined-proxy proof without rebuilding the plan or adding unrelated functionality. DATA-005's full requirement remains unfinished because other CSV families, saved views and role field restrictions remain unproved.

## Results and provenance

Final candidate: `0e34f894705e0026a0306bfc3323816786608c28` on `cloud/sd-penny-c-f74`. Save: `4dbd3513e698eef1358b77940dae697c03fd5f33` (the actual full save identity is also recorded in VALIDATION.json and product-commits.txt). Both product pushes succeeded on their first attempt. No PR was needed: branch push is this repository's Verify entry point. Main was never pushed or changed.

The specified base's product change supplies `vote_count` using eligible distinct requester identities. Its parsed exports preserve the voter identity, native proxy mark and recorder attribution. This round extends that proof to a direct vote removed and then recorded twice, an addressless proxy linked to two accounts, summed per-request totals, and identity-free refusals. The existing erasure journey now reads both CSVs before and after erasure, attempts to record the erased proxy identity again, and verifies both exports again after the 409 refusal.

DATA-005: **PARTIAL → PARTIAL**. The selected native request and voter slice is proved. Other CSV record families, exports from saved views and ROLE-001 field restrictions remain named in the Gap; none is represented as complete. All previous external and release holds remain. No new policy, acceptance sentence or scope ruling was introduced. The plan extract's DATA-005 continuation row is the only plan row affected; no plan was rebuilt. No further clause is selected in this run.

Contract totals: **79 done, 124 partial, 78 missing, 281 total → unchanged**. Status table line count: **445 → 445**. Every parent's Status identity was retained at each commit. Test registrations: **0 added, 0 removed**; the affected files retain their five registrations under the existing cap of 200. No assertion was removed, narrowed, skipped or put behind a width or branch condition. No pin or duplicate test was encountered in the touched area.

`git fetch origin main` and `git merge --no-commit --no-ff origin/main` ran after the save; the merge reported **Already up to date**. Integrated main is `e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f`. Its exact-SHA Verify `42153984585` and Run site `42153984645` are successful. Its pre-existing Nightly journeys `42156564353` failed; no nightly work or rerun was authorized by this slice.

## Runtime proof

The public doors are authenticated GET `/api/operator/requests/export.csv`, GET `/api/operator/votes/export.csv`, GET `/api/operator/requests/:slug/context`, public request detail, and native vote, proxy, block and erasure routes. Mail is faked only at its HTTP edge. All five touched registrations passed on the final committed SHA; `exact-sha-tests.json` is the actual Vitest result. The prior passing build's product source is byte-identical to the final candidate; only test and documentation changes were made in this round.

- `tests/base/proxy-votes.test.ts:11`, “records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote”: explicit four-request fixture, totals `[2, 1, 0, 1]`, exact person identities and proxy marks, recorder source, comma/quote/newline source content, multiple address and account associations, removal, replay, direct takeover, blocking and revoked authority. Lines 30–59 establish the mixed, direct, zero and proxy-only populations and private joins; lines 60–85 exercise changing participation and revoked export refusals.
- `tests/base/csv-vote-reconciliation.ts:33`, `reconcileVoteCsv`: opens both CSVs and parses their records. Lines 44–49 compare request identities, stored request count, total eligible voter records and summed request totals. Lines 50–69 compare each request's exact people and proxy marks with its public total and authenticated context, including participation timestamps. Lines 71–80 refuse unauthenticated and requester reads without disclosing fixture identities.
- `tests/base/proxy-votes.test.ts:116`, “refuses stale or invalid authority and rolls back every effect if auditing fails; requester erasure removes proxy custody”: lines 125–137 read the two-person export, erase the proxy person through the native data door, verify the remaining one-person export, refuse replay with 409, and repeat both exports unchanged.
- `tests/base/board-categories.test.ts:19`, “upgrades populated boards and supports category browsing, ranking, canonical merges and board participation and privacy through routes”: lines 96–99 parse the request export, bind category and vote total to the request identity, and reconcile its request-record count.

PROBE DATA-005 native-request-voter-reconciliation: authenticated GET of both CSVs for mixed, direct, zero and proxy-only native requests -> four request rows and four distinct eligible voter rows; totals `[2, 1, 0, 1]`; exact fixture person identities and proxy marks match public participation and authenticated demand.

PROBE DATA-005 joined-demand: authenticated context and both exports after two verified addresses and two account links for a direct voter, and two account links for an addressless proxy -> four direct context join rows still count one person; two proxy context join rows still count one person; each exported voter occurs once per request.

PROBE DATA-005 changing-participation: DELETE a direct-only vote then POST that vote twice -> native export totals change to `[2, 0, 0, 1]`, then `[2, 1, 0, 1]`; current stored record counts, public totals and authenticated demand reconcile after every change.

PROBE DATA-005 authority-and-erasure: unauthenticated, requester and signed-out operator GETs -> 401 with no fixture identities; erase a proxy requester, replay its requester identity -> 409; repeated native exports retain only the direct voter, never the erased person.

## Mechanical checks and CI

MECHANICAL lock=`node scripts/edition-authoring/cli.mjs lock` then `node scripts/edition-authoring/cli.mjs check` exit=0; views=`node src/base/contract-docs.mjs write` then `node src/base/contract-docs.mjs check` exit=0, then restored main's ACCEPTANCE.md and docs/CLAIMS.md; ledger=none exit=0 (no migration changed).

Typecheck and `npx -y @runeditrun/rer check --profile first-party --json` pass. The committed source lock was checked again successfully. No generated view changed in either of this round's product commits. The worktree was clean at final validation. All four candidate commits, including the inherited base commits, have fleet author and committer identity and no trailers. Changed lines contain no email-shaped strings or bare prose slash tokens.

Exact-SHA push Verify: **42164520482**, https://github.com/just-every/run-penny/actions/runs/42164520482, **completed/failure**. All 29 failed shard jobs failed only at **Check generated contract documents**. The plan job succeeded. This is the brief's explicit generated-view exception for READY; it is not claimed as an ordinary successful Verify, and no runtime CI shard reached execution. No workflow was changed or weakened, and no run was dispatched or retried. `CI.json` contains the actual run and job identities and conclusions. Five GitHub API calls were used: base run discovery, base jobs, current-main run discovery, final run discovery and final jobs.

There is no reproduced product failure and no VERIFY repair round. Publication scanning, regenerated-view CI, main equality and candidate Run site remain the guarded lander's duties. A scan was not run in cloud; there is no COMPLETE scan or landed-main claim here. No screen was touched, so visual proof is not applicable.

## DONE riders and pre-READY review

No DONE claim or judge request is made. The following records each rider honestly against the selected proof and the still-partial full clause.

1. **Full clause unmet; selected slice passes locally.** The named native CSV journeys reach the selected outcomes; other CSV families, saved views and role restrictions remain in the Gap. Exact-SHA Verify has the generated-view-only exception above.
2. **Pass for selected slice.** Nonempty native fixtures independently specify people and totals. Both supported reads and unsafe authority or erased-identity attempts are exercised; exports are opened and parsed.
3. **Unestablished as ordinary CI proof.** The existing base test glob invokes these registrations in push Verify, but this exact run stopped before them at the expected generated-view check. Actual final-SHA local proof is attached, and lander regeneration must obtain CI runtime proof.
4. **Pass locally.** The five registrations were rerun on final SHA `0e34f894705e0026a0306bfc3323816786608c28`; source hashes are in VALIDATION.json.
5. **Unchanged.** No new inherited Base duty or acceptance text was introduced. Existing universal duties and named holds remain; this partial slice does not claim the full export surface.
6. **Mechanical pass with documented candidate exception.** Evidence and Gap name current proof and held work. Local generator write and check pass; candidate views intentionally remain main's bytes. The historical global Judged-from line is retained because no clause is promoted or newly judged DONE.
7. **Pass.** No acceptance point changed and no original obligation or Status row was lost.
8. **Pass for native authority.** Unauthorized, requester and revoked operator exports are refused; the existing audit-failure rollback assertions remain. Future ROLE-001 field restrictions remain unproved.
9. **Pass as a boundary statement.** No provider, legal, hosted qualification or release guarantee is claimed.
10. **Not applicable.** No policy default or new authority decision was adopted.
11. **Pending lander.** The product is branch-only. Candidate main equality, regenerated-view Verify, Run site and complete publication scan are not claimed.

Pre-READY review: selected user-visible export behavior has passing route assertions; no existing assertion was weakened; revoked authority, erasure and replay paths are covered; no screen changed; source lock is fresh. The exact candidate's only CI failure is the permitted generated-view check. Scan and landing receipts remain pending the fleet, and no new email-shaped fixture text was introduced.

## Packet and custody

The packet includes this report, VALIDATION.json, the actual touched and exact-SHA Vitest JSON outputs, their logs, the actual first-party check output, source-check output, typecheck output, generator outputs, CI.json and product-commits.txt. Evidence is published only to `refs/heads/evidence/sd-penny-c-f74`. Evidence publication does not signal product acceptance, READY or landing. No credential, environment dump, private gate material, setup output or symlink is selected.
