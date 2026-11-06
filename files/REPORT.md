# Penny original-family B1 correction — sd-penny-c-f99-fix1

B1 is repaired through the built production Worker's native TLS HTTP doors. This is the one authorized correction of rejected source `599d82f10cb4a6c5746f3b68b66515eb4872826e`; it preserves that source as a parent. The correction is pushed at `51cd7de98d013cc4e4dbcb97f4a8fac7a8194d52` on `cloud/sd-penny-c-f99-fix1`, merged with fresh main `6c1eb018f6391de17e04fc8868c0c74f8732abd8`. No PR was opened: the declared fleet branch/re-gate path governs. No submission, source pin, hold release, provider operation, deployment, tag or release was performed.

The independent original-family B1/frozen-rubric re-gate remains required before guarded landing. This report and its evidence publication do not authorize landing or change any existing hold. PRIO-004 stays **PARTIAL**. No DONE/count award was made. The source already had 79 done / 125 partial / 77 missing / 281 total; the correction has the same counts. Fresh main without the original scorecard work had 79/124/78: that original missing-to-partial change is preserved, not newly awarded by this fix.

## Plan and outcome

The complete pre-edit plan is in `PLAN.md`. Completed: native before reproduction; schema-aware scorecard erasure repair; fresh-main integration with original history preserved; affected tests, typecheck and mechanical/custody checks; identical exact-candidate HTTP replay; guarded product push; report-only evidence publication. Permanent scorecard registrations remain **2 → 2**, with their entire assertion file byte-identical to the rejected source. No whole-suite/baseline rerun was performed. No UI changed, so no new UI journey or screenshots were needed.

## Actual native before/after observations

`b1-probe.mjs` starts a real TLS listener around the emitted Worker with real D1/R2, runs migrations, claims a native owner, creates a native request titled `impact`, creates a criterion `{key:"impact",name:"Customer impact",scale:5,weight:1}`, scores that request, revises the definition, reads current/history, previews request erasure, submits its preview hash and every offered `redact` resolution, then reads current/history and exports. It uses no fake API/service/validation implementation. The sole storage inspection reads the actual persisted definitions to expose corruption. Its ephemeral TLS key, installation state and native session are discarded, and no provider request occurs.

| HTTP observation | Rejected source | Exact correction |
| --- | --- | --- |
| Native request and scorecard creation; score; revision | 201 / 201 / 204 / 201 | 201 / 201 / 204 / 201 |
| Current and historical reads before erasure | 200 / 200 | 200 / 200 |
| Erasure preview | 200; both retained criteria copies offered resolvable | 200; both retained criteria copies offered resolvable |
| Accepted preview-hash erasure with offered redact | 200, complete | 200, complete |
| Persisted criterion keys, both versions | `[erased]` | `impact` |
| Persisted criterion names, both versions | `Customer [erased]` | `Customer [erased]` |
| Current read after erasure | 503 | 200 |
| Historical read after erasure | 503 | 200 |
| Archive export after erasure | 409 `scorecard_archive_invalid` | 200 |
| Outbound provider calls | 0 | 0 |

PROBE B1 accepted erasure=200 complete; current=503→200; history=503→200; export=409 scorecard_archive_invalid→200; both retained criterion keys preserved and copied names redacted.

The full actual responses and persistence observations are in `b1-before.json` and `b1-after.json`; the latter records the exact pushed head. The earlier successful uncommitted-tree after probe is retained separately as `b1-after-worktree.json`. A post-commit rerun binds the same native sequence to the pushed head without rerunning the original baseline.

`b1-custody-probe.mjs` additionally creates two scored requests across two definition versions. Seven reviewed rename attempts (malformed JSON, invalid or different key, changed scale, changed weight, empty criteria and invalid criterion name) return 409 `erasure_scorecard_invalid` before any mutation of requests, definitions, scores, audit, data state or operations. Repeating erased wording returns 409 `erasure_rename_repeats` with the same unchanged state. A valid reviewed wording rename returns 200; the surviving request's original attributed inputs and weighted results remain identical in current and retained history, and export retains its two score rows and both versions. An ordinary request whose title matches only the JSON structural property `scale` erases with no false wording copy and export still succeeds. Full actual outcomes are in `b1-custody.json`.

Two one-off harness mistakes were corrected transparently and their failed receipts retained: the first custody fixture accidentally reused a root description on the surviving request, which truthfully produced a third copy; the first ledger wrapper incorrectly treated `nativeApply:false` as failure even though the adapter uses it for a fully applied ledger. Neither required a product change. The first GitHub discovery query used a mistranscribed SHA and found no runs; the real discovery derives HEAD directly from Git. No result from another SHA is used.

## Source-to-fix mapping

- `src/core/features/scorecards/erasure.ts` defines the scorecard schema/content boundary. Human criterion names enter wording matching and redaction. Criterion IDs, JSON property names, numeric scales/weights and numeric score-input associations retain their structural meaning. Redaction parses and reserializes only the named wording fields; it does not manufacture criterion IDs, scores or other application data.
- `src/core/features/data/erasure-native.ts` uses those human fields when deciding whether a retained scorecard cell contains a wording copy. Existing graph closure, deletion, authority, bounds and erasure provenance remain intact.
- `src/core/features/data/erasure-redaction.ts` applies the same adapter to preview values and committed updates, checks definition validity/structural equality for reviewed resolutions before admission and again under the existing erasure lock, and checks renamed human wording for repeated literals without treating preserved structural keys as personal words. Existing one-choice-per-copy requirements, preview-hash checks, atomic transaction, audit and tombstones remain.
- `CONTRACT.md`, `OPERATIONS.md` and `CHANGELOG.md` document only this bounded correction and unchanged PARTIAL judgment. `sources.lock.json` is regenerated last from staged intentional source. No applied migration, validator, archive validator, scorer/ranking logic or provider configuration changed.

The repair-only path inventory is exactly those seven paths above. `path-inventory.json` also lists every integrated main path and the complete 18-path candidate delta from main (the original scorecard feature plus this correction). The six extra paths inherited from fresh main relative to the rejected source are `ACCEPTANCE.md`, `docs/API.md`, `tests/base/integration-openapi.test.ts` and the three OpenAPI fixture/license/notice files. Main's generated view is taken whole; the candidate has no generated-view delta relative to main. No fleet evidence is in the product branch.

## Frozen R1–R8 and unchanged proof

| Frozen guarantee | Preserved evidence |
| --- | --- |
| R1 named criteria/scales/weights persist | Original first scorecard test passes; unchanged input/repository bytes; native B1 before/after criteria observation |
| R2 attributed components and deterministic ranking | Original first scorecard test passes; ranking/repository bytes identical |
| R3 immutable version readback and no carry | Original first test passes; both retained B1 reads succeed after erasure with original structure; custody probe preserves unrelated current/history inputs |
| R4 absent inputs remain absent | Original missing-input and unscored-row assertions remain byte-identical and pass |
| R5 stale/invalid/unauthorized writes and atomic audit refusal | Original assertions remain and pass; additional reviewed rename refusals are atomic through HTTP |
| R6 populated upgrade and repeated no-op | Original populated predecessor/all-prior-table comparison and repeat pass; all 105 applied migration files byte-identical |
| R7 archive, independent restore and erasure without source authority | Original second scorecard test passes unchanged, including destination authority/source-session refusal/former-scorer anonymisation/stale archive refusal; native B1 export and surviving score history pass |
| R8 score-free decisions and public projections | Original first test's decision/business/public assertions remain byte-identical and pass |

`mechanical-proof.json` contains SHA-256 byte comparisons for all five original scorecard modules, the full original scorecard assertion file, migration 0110, erasure dependencies, archive integration and schema inventory. All are unchanged from the rejected source. It also proves every applied migration unchanged, all 280 unrelated parent Status rows preserved verbatim (including full Evidence/Gap text), generated views equal fresh main, and the original remainders retained. Frozen passing evidence is reused only for these byte-identical parts; new B1 behavior has actual native proof.

## Commands and exits

`RECEIPT.json` records full actual commands, exits and provenance. All relevant long-running `rer` commands and HTTP probes used `cloud_run`; no Mac heavy-slot or load polling was used.

- Frozen checkout setup: exit 0; production build: exit 0.
- Native before reproduction: exit 0, reproducing expected failure; exact-candidate after reproduction: exit 0; custody probe: exit 0.
- `pnpm exec vitest run --config vitest.base.config.ts tests/base/scorecards.test.ts tests/base/penny-erasure.test.ts tests/base/hosted-export.test.ts`: exit 0, **3 files / 17 tests passed**.
- `pnpm run typecheck`: exit 0. Touched `oxlint`: exit 0.
- Contract generator `write`, then `check`: exits 0 / 0. Restore `origin/main` generated views whole. The final `check` then exits 1 solely because `ACCEPTANCE.md` differs from regenerated content; this is the explicitly authorized candidate condition, not a product failure.
- Source lock regeneration last and source check: exits 0 / 0. Base-copy source check: exit 0. `git diff --check`: exit 0. Mechanical byte/status/custody proof: exit 0.
- Native migration preflight via the repository's `scripts/portability/ledger.mjs` IPC door: exit 0, `{nativeApply:false}`; the existing ledger is fully applied and needs no further native migration.
- Candidate identity and full-message inspection covered both candidate commits, including the original side parent. Both authors/committers are fleet; no co-author trailer exists. Hooks remained active. Guarded product push: exit 0 on attempt 1.

The cloud cannot run the fleet's publication/landing scan. That existing independent scan and the final runtime/main/site gates remain with fleet custody; no local full Verify or publication claim substitutes for them. No operator/provider credential was refreshed. No communal CI run was polled, rerun, dispatched or mutated. Only the newly pushed candidate run is read. All owned Worker/test processes are stopped by explicit runtime disposal; ephemeral one-off state is removed.

## CI, evidence and remaining custody

The actual exact-head CI receipt is `ci-receipt.json`; it is the authority for the observed run status, ID, URL and permitted generated-view exception, if applicable. At discovery, Verify Penny run `42204655361` was in progress on `51cd7de98d013cc4e4dbcb97f4a8fac7a8194d52`. There was no CI dispatch, rerun or empty commit. Full report publication uses only `refs/heads/evidence/sd-penny-c-f99-fix1`; it does not alter the product checkout/head/index or signal acceptance.

All original UI/two-scorer visible-card, segment/SEG-006, PRIO-003 columns, other idea-family and scoped role remainders remain. Provider/device/account/Base/ct/uip/payments/release holds and the original-family independent re-gate remain unchanged. Tiny-weight rounding E is untouched. No runtime product blocker was observed in the bounded B1 repair; landing remains subject to the existing independent gates and final exact-SHA CI/publication/main/site requirements.

Final exact-SHA CI observation: run **42204655361** completed with underlying conclusion **failure**. Its plan passed and all **29/29** shard failures are solely **Check generated contract documents**; every source-lock check passed and runtime shard commands were skipped. The completed-job archive command succeeded and confirms only `ACCEPTANCE.md: generated content differs; run contract-docs write.` All 30 job records were checked; one representative generator archive was read once. No runtime assertion failed or was claimed green. This qualifies for **READY under the task's explicit generated-view-only exception**, with the lander required to generate the views and rerun Verify on its final commit. Total GitHub budget used: **5/10 calls** (including the discarded wrong-SHA query). No old shared run was read.
