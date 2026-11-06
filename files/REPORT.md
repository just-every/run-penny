# Penny main Unicode suggestions repair

Date: 2026-11-06T15:33:19.058194+00:00
Tag: sd-penny-main-unicode-fix-1
Repository: just-every/run-penny
Branch: cloud/sd-penny-main-unicode-fix-1
Candidate: 0a14e2fd24bdee47cbe880bb96215c6e0e9f4aed
Fresh main/base: f52beea3be587114d61166d21e4be26777fa96f3

## Outcome and custody

**BLOCKED by exact-SHA Verify.** The narrow main-health repair is implemented and pushed. The complete unchanged committed scale journey passes on the exact candidate, including all eight workloads and all final 500ms timing assertions. Existing affected public/operator-door semantics and typecheck pass. This is one main-health repair, not a FIX verdict against Penny118 and not a DONE claim.

Exact-SHA Verify: completed/failure, run 42243440254, https://github.com/just-every/run-penny/actions/runs/42243440254. The scale journey passed in that CI run. The later requester-repair browser journey failed its request-controls disclosure assertion; details and actual full failed-job log are retained below. This is not a contract-generator failure and the candidate is not READY. No PR is required by this repository's documented builder landing path; no PR was created. The fleet's guarded Mac lander owns publication scan, admission and landing after builder exit. There was no main/default-branch push, deployment, release, workflow dispatch/rerun, hold change or landing-record mutation.

## Plan and execution

The full original plan is PLAN.md. Its six steps cover fleet setup/custody; source analysis; the smallest indexed NULL-terms selection; pinned runtime setup and a real fleet commit/push; exact-candidate affected checks, complete scale journey and bounded query evidence; exact-SHA Verify and separate report transport/cleanup. All product work stays in the one declared repository. The exact fetched historical evidence head is fa007b129ec15492b19fe3b4fae33ff67b25061f from evidence/sd-penny-main-unicode-triage-1. Selected original source/query receipts are retained under before/ with their original bytes. They were never adopted into the product tree.

Commands and exits are in RECEIPT.json, individual *-receipt.json files and their full non-secret logs. The product commit contains only src/core/features/requests/suggestions.ts and its regenerated sources.lock.json entry. Fleet hooks remained active; all unpublished candidate author/committer identities and complete messages were inspected before the push (candidate-messages.txt). The first real commit was preserved through the required cloud push guard, exit 0 on attempt 1, with no retry, rewrite or force push. Fetch/rebase before that push reported the branch current with fresh main. No substantial follow-up product change was necessary.

## Source cause and correction

Previously, a query like résumé had zero ASCII terms. The D1 score became constant zero, yet indexed AS MATERIALIZED still selected the full eligible corpus, then ranked/scanned it and discarded every non-NULL-term candidate before returning NULL-term wording for JavaScript matching. Migration 0109 already maintains a read-only view and covering expression index; a new index or migration is unnecessary.

The candidate shares the exact existing candidates fragment between both paths. When asciiTerms.length is zero, selected reads that fragment with AND r.terms IS NULL before broad materialization or ranking. The ASCII-bearing path is unchanged. ASCII-only source wording cannot contain a non-ASCII lexical query term, so the former zero-score ranked branch contributed no matches; the new path preserves the same complete candidate set for the JavaScript matcher.

All public publication/moderation/withdrawal/merge, public-board/archive and blocked-author predicates remain in the shared fragment. Operator visibility and the board join remain unchanged. Public text remains public_title/public_description, operator text remains title/description, and the id/showVoters projections are unchanged. Native operator admission and fresh transactional authority remain in the untouched evidenceMutation/loopMutation/integrationOperator path. No SQL LIMIT is introduced before Unicode matching. The same whole-term lexicalTerms matcher, matchedTerms, descending overlap/slug ordering and final slice(0,5) remain unchanged.

Owner-reviewed homepage, all UI, applied migrations, contract source/judgments, generated views, seed limits, package/lock pins, test files and assertions are byte-identical to main (source-hashes.json). No new permanent test, retry, fallback or mock was added. ASCII-absent timing was recorded but its query path was not changed or expanded into new work.

## Complete end-to-end proof

Command: cloud_run node tests/runtime/duplicate-suggestions-scale.mjs, executed through the supplied subreaper and receipt wrapper after a fresh production build from clean committed candidate 0a14e2fd24bdee47cbe880bb96215c6e0e9f4aed. Exit 0; elapsed 23.976 seconds. The script logged that exact SHA itself. Its original bytes match main and the triage source hash.

Corpus before/after: **100000 requests / 100 boards / 250000 requesters**. Every workload retained **25 samples**, the unchanged **500ms p95 cap**, original exact result/term assertions and all final timing assertions. All 200 endpoint samples passed through the real emitted Worker and native HTTP doors. No isolated timing substitutes for this proof.

| Door | Workload | Historical main p95 ms | Candidate p95 ms | Candidate max ms |
| --- | --- | ---: | ---: | ---: |
| public | exact | 198.280 | 129.286 | 131.106 |
| public | partial | 356.387 | 107.388 | 110.258 |
| public | absent | 268.660 | 107.968 | 111.443 |
| public | unicode | 155.569 | 29.964 | 33.597 |
| operator | exact | 228.557 | 80.082 | 133.278 |
| operator | partial | 211.004 | 84.175 | 85.248 |
| operator | absent | 3465.451 | 86.135 | 97.630 |
| operator | unicode | 2321.522 | 16.133 | 16.802 |

Historical measurements are from the exact fetched triage evidence, not a new baseline run. That full journey exited 1 (its first final assertion failure was operator absent, although operator Unicode also exceeded the cap). The historical isolated operator Unicode measurement of 153.015ms is numerically below cap but its final assertion was NOT RUN after a diagnostic error; it remains diagnostic only. Historical Verify 42218054922/job127892981073 was not rerun or re-read.

Runner/toolchain: Linux x64 6.18.57, AMD EPYC 9V74 80-Core Processor, 5 reported logical CPUs, 4-core cgroup quota, 16GiB cgroup memory limit; Node 22.20.0, pnpm 10.12.4, rer 0.2.94, TypeScript 6.0.3, actual helper-resolved Miniflare 5.20261006.1-alpha, workerd 1.20260907.1. Full metadata is toolchain.json. The initial dependency install used the VM's Node 24.19.0; the exact Node 22.20.0 pin was then installed and explicitly prepended for setup/build/typecheck/door check/scale/probe. The supplied toolchain shell itself retains an already-newer VM Node, so its printed v24 line is followed by explicit pin selection; the journey's own process.version and toolchain receipt confirm v22.20.0.

The historical triage runner reported an Intel Xeon Platinum 8573C. Different CPUs and timing variation mean the p95 differences do not establish uniform hardware-independent speedups or attribute the original multi-second tail. The narrower source cost removal is independently shown by query plans and rows read below. ASCII workload timings also improved here even though their source query is unchanged; no causal claim is made for them.

## Existing affected door checks

pnpm exec vitest run --config vitest.base.config.ts tests/base/penny-evidence.test.ts -t 'deterministic published-only suggestions' — exit 0, one existing test passed, five unrelated registrations excluded by the name selection. No committed skip, deletion or weakened assertion occurred. This existing public-door check covers deterministic ASCII overlap/ties/case/punctuation/whole terms and Unicode matching through both public and native operator routes; excludes held, archived and blocked public results; retains operator ids and all pre-existing no-mutation/no-outbound assertions. It also preserves requester vote/follow behavior after suggestions. pnpm run typecheck — exit 0. The complete local/baseline suite was not run; branch CI is the full wall. No UI changed, so no browser screenshots or two-width UI proof are claimed or needed for this query-only repair.

## Bounded actual-source query evidence

query-probe.mjs is a diagnostic outside the product. It copies the unchanged scale corpus setup, imports/transpiles the actual candidate source without changing its logic, and invokes the real function once for each door against disposable D1. A prepare wrapper records the exact SQL, EXPLAIN QUERY PLAN, metadata and result, and preserves the expected résumé result assertions. Exit 0; no endpoint repetition. query-trace.json and query-probe.log contain the complete actual receipt. Every query reports zero changes/rows written.

| Door | Historical full query rows read | Candidate full query rows read | Candidate rows returned | Candidate D1 duration ms |
| --- | ---: | ---: | ---: | ---: |
| public | 600003 | 100006 | 1 | 22 |
| operator | 500001 | 5 | 1 | 1 |

The operator plan now searches penny_suggestions_operator with merged_into_request_id=? AND <expr>=?. Neither plan materializes indexed, scans indexed/ranked or creates a rank-order temporary B-tree. Public retains its existing index-prefix scan (merged_into_request_id and moderation_state) because other index columns precede the expression; the reduction to 100006 reads is bounded evidence of removing unnecessary intermediate work, not a claim of a direct one-row public index seek. Historical direct NULL-terms operator stage read 2 rows without the full route's joins; the comparable full candidate query reads 5 including joins. No sqlite_version() diagnostic is attempted.

## Checks and command receipts

All heavy runtime commands ran in this dedicated VM through cloud_run. No Mac slot/load polling or deliberate load was used. Runtime helpers clean up their own Miniflare instances and temporary state in finally blocks; setup stops only its own temporary server. No broad kill command was used.

| Actual command | Exit | Receipt |
| --- | ---: | --- |
| `pnpm run verify:base-source` | 0 | `base-source-receipt.json` |
| `npx -y @runeditrun/rer build` | 0 | `build-receipt.json` |
| `node scripts/edition-authoring/cli.mjs check` | 0 | `candidate-source-check-receipt.json` |
| `node src/base/contract-docs.mjs check` | 0 | `contract-check-receipt.json` |
| `pnpm exec vitest run --config vitest.base.config.ts tests/base/penny-evidence.test.ts -t deterministic published-only suggestions` | 0 | `door-check-receipt.json` |
| `node tests/runtime/duplicate-suggestions-scale.mjs` | 0 | `journey-receipt.json` |
| `python3 /home/agent/rer-consolidation/.tools/cloud-push.py origin cloud/sd-penny-main-unicode-fix-1` | 0 | `push-receipt.json` |
| `node ../packet/query-probe.mjs` | 0 | `query-probe-receipt.json` |
| `cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive` | 0 | `setup-receipt.json` |
| `node scripts/edition-authoring/cli.mjs check` | 0 | `source-check-receipt.json` |
| `node scripts/edition-authoring/cli.mjs lock` | 0 | `source-lock-receipt.json` |
| `pnpm run typecheck` | 0 | `typecheck-receipt.json` |

Other setup: fleet identity and launcher refresh exited 0; decrypted-bundle Git helper and guard installed; git clone --depth 1 --filter=blob:none exited 0; frozen pnpm install exited 0; exact evidence fetch exited 0; commit/fetch/rebase exited 0; source lock was regenerated last for staged intentional source inputs and its check plus verify:base-source passed. The first toolchain script write had a shell heredoc/SyntaxError and was corrected before any dependent command ran. This setup error did not affect the candidate, checks or their exits. Full setup/build/install logs are retained with local credential-bearing lines omitted.

## Clause/count status and limitations

Clause changes: **none**; no CLAIM, DEFAULT, promotion or demotion is made. EVID-007's existing done judgment is retained, not re-awarded. Published counts remain 59 done / 56 partial / 1 missing (116); all counts remain 79 done / 124 partial / 78 missing (281). Tests added/removed/changed: 0/0/0; corpus counts unchanged; source files changed: 1 plus generated source lock. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were not changed, and the generator check passed. No view regeneration was necessary because contract source was untouched.

The fleet's full publication scan cannot run in this cloud and remains an independent mandatory exact-tree Mac gate. The own product diff contains only the query correction and one source hash. No hosted capacity, live provider, deployment, release, uniform tail-latency or incumbent-corpus regression claim is made. Existing release/provider qualifications remain unchanged. Evidence publication is report transport only; it cannot signal product READY, acceptance or landing. Unpushed work would be preserved via the guarded bundle path on rejection; this push succeeded, so no rescue bundle was required.

## Final CI and terminal custody

Verify run **42243440254** completed with **failure** on exact head **0a14e2fd24bdee47cbe880bb96215c6e0e9f4aed**. Plan and 28 shard jobs succeeded; requester-board job **127979480403** failed in Run this shard. The native scale script completed all eight workloads successfully before the failure. CI used Linux x64, Intel Xeon Platinum 8370C @2.80GHz, reported memory 16759304192 bytes, Node 22.20.0; counts 100000/100/250000 and 25 samples per workload. Actual CI scale output is ci-journey-measurements.json.

| Door | Workload | CI p95 ms | CI max ms |
| --- | --- | ---: | ---: |
| public | exact | 120.459 | 124.582 |
| public | partial | 121.262 | 123.238 |
| public | absent | 116.711 | 116.861 |
| public | unicode | 29.457 | 35.487 |
| operator | exact | 96.108 | 100.700 |
| operator | partial | 102.451 | 107.207 |
| operator | absent | 110.426 | 114.820 |
| operator | unicode | 16.195 | 39.260 |

The subsequent browser failure was `AssertionError [ERR_ASSERTION]: request controls are open`, at tests/browser/requester-evidence.mjs:34, called from tests/browser/requester-repair.mjs:71. The helper observed a null details.open attribute after its conditional summary click. The call occurs following synthetic interrupted attachment metadata setup and review.reload(), before the original-file recovery control interaction. This is a different flow from Unicode suggestions; it is not an allowed generator-only exception. The failure does not invalidate the completed scale assertions, and those passing assertions do not make the whole Verify green.

The helper, browser repair test and product operator-request-controls component are byte-identical to main (updated source-hashes.json). No causality for the disclosure failure, pre-existing reproduction or infrastructure defect is asserted from that fact alone. Its root cause remains unproved. Correcting the disclosure UI or its test is outside this round's explicit suggestions.ts lease; no test was weakened and no speculative fix or retry was added. No local browser/baseline rerun or CI rerun/dispatch was made. A separately scoped repair must clear the normal exact-SHA Verify gate before the fleet can land this branch.

One REST watcher used discovery, then run-state polls separated by 303 and 306 seconds, with post-completion jobs/log diagnostic reads: **5 GitHub calls total**. The required one-time archive command `gh run view 42243440254 --repo just-every/run-penny --job 127979480403 --log-failed` exited 0. Complete actual stdout/stderr and jobs response are selected into evidence; no direct blob redirects or Authorization-header workaround was used. ci-final.json records the blocker and transport command.

Product custody is still the successfully pushed cloud/sd-penny-main-unicode-fix-1 at 0a14e2fd24bdee47cbe880bb96215c6e0e9f4aed. No unpublished product work or push rejection remains; no rescue bundle is necessary. Evidence is separately published to evidence/sd-penny-main-unicode-fix-1. Cleanup occurs only after remote product/evidence custody is verified; the actual post-transport cleanup receipt is retained outside the deleted clone. **No READY, DONE or acceptance claim is made.**
