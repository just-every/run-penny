# sd-penny-c-f55 report

DEC-002 changes PARTIAL to DONE in the branch candidate, with all native outcomes of its unchanged acceptance sentence covered. This is a candidate status, not a claim of landing or live qualification. Counts: 79 done, 124 partial, 78 missing before; 80 done, 123 partial, 78 missing after; 281 total.

Repository: https://github.com/just-every/run-penny. Branch: cloud/sd-penny-c-f55. Candidate: cec0ebc982c0e9ad11615d5be8796650a6f1c338. Source implementation: 93afd32743565cef8306096568a9f45b993378ec. Initial selected base: e914abb719264d8021f974ab61b75127d06268a5. Merged main: 84bad894d12e7f969f567177a126cb544a3237b1. Merge save: 09584a2187c7c469860c330b3188479d005a03b4. All product heads were pushed through the fleet guard. No PR was needed because branch pushes invoke Verify.

The supplied base already contained the planner-selected confidence and review-date proof. The continuation explicitly requires finishing all remaining native acceptance outcomes, so this run closed the remaining native assumptions and mapped-requester gaps instead of repeating an already-completed slice. PLAN.md records that execution plan. No other plan or clause was reordered.

## Product behavior

The existing bet route accepts bounded optional assumptions. Native creation stores them; editing can change or explicitly clear them. An edit omitting this newly supported field retains the previous value, including when an older native caller edits the other comparison dimensions. Existing commitment and authority guards remain in place. Both existing create and edit forms expose the field using the current Field component; the existing bet card already rendered assumptions.

The private decision detail now carries eligible requester identities and current display names. Its read-only query reuses the existing REL-004 recipient selection, starting from the decision's approved active roadmap request mappings. It deduplicates identities across requests and addresses and retains the shared verification, permission, suppression, mute, blocked-person and public-request fences. It creates no permission, snapshot, notification or delivery. The existing brief summary renders these names. No public projection changed.

No migration, provider credential, live account, Base refresh, role policy or configuration change was needed. Source rollback needs only source rollback; no schema change occurred. Earlier provider, device, account, company-agent, payment and release qualification holds remain in their own contract clauses and field register. No homepage, logo or visual polish work was performed.

## Proof and frozen rubric

The one DEC-002 acceptance sentence is covered by these existing sanity journeys, not by new test registrations:

- ./tests/base/decision-loop-dimensions.test.ts, “[DEC-001][DEC-002] retains confidence, review dates and per-bet assumptions and reads current eligible requesters through approved mappings”, lines 13–77. The public doors are native decision and bet creation and edits, decision detail GET, requester verification and follow, roadmap approval and withdrawal, mute, block, erasure preview and erasure execution.
- The same file, “[DEC-003][DEC-004] compares distinct stored relations, null provenance, shared evidence and offset instants without summing duplicate accounts”, lines 81–109. The native evidence and link routes and decision detail return exact supporting and contradicting identities and wording, three distinct account identities, unchanged dimension figures and commitment snapshots.
- ./tests/browser/operator-pages-decisions.mjs, reviewDecisionPages, lines 52–91, invoked by ./tests/browser/operator-pages.mjs. The existing Manage this bet form saves assumptions, and the reloaded built page renders that assumption and the eligible mapped requester. New DOM assertions run at 1440. The changed page has screenshots at 1440 and 390, with the existing axe, overflow, console and external-request checks.

Frozen rubric items, all MET by local execution:

| Item | Outcome | Proof |
| --- | --- | --- |
| R1 | Question, accountable owner and candidate identity survive native edits | Dimensions journey lines 14–36, 67 |
| R2 | Independent per-bet assumptions persist, update, retain on omission and clear explicitly | Dimensions journey lines 19–27, 67; browser lines 52–59, 84–89 |
| R3 | All confidence values and changed and cleared review dates read back under the same identity | Dimensions journey lines 14–36 |
| R4 | Linked accounts and actual supporting and contradicting evidence belong to the intended bet | Dimensions journey lines 81–109 |
| R5 | Current mapped audience is deduplicated, changes on consent or mapping changes and grants no new permission | Dimensions journey lines 40–66; browser lines 60–89 |
| R6 | Private admission, native block and erasure prevent stale requester data or replay resurrection | Dimensions journey lines 62, 68–77 |

Three distinct temporary mutations were detected, each by its own failed assertion in the same native journey. Dropping creation-time assumption storage failed the assumption readback; returning an empty audience failed the populated audience assertion; including withdrawn mappings failed the empty-after-withdrawal assertion. Every mutation exited 1, and all mutated source bytes were restored. MUTATIONS.json and the three actual logs retain the details. No test or assertion was removed, weakened, skipped or moved behind a new width condition. The only new width condition surrounds new desktop DOM assertions; all pre-existing assertions remain unchanged.

## Actual checks

Final candidate: 13 focused native tests in three files passed; typecheck passed; first-party rer check passed with generated views temporarily current; copied-source verification passed with copied bytes unchanged; source lock check returned ok true. The generator write and check both passed, after which main's entire ACCEPTANCE.md and ./docs/CLAIMS.md were restored as required. No generated view is in the product diff. The generator alone updates source summary counts. No migration ledger check applied.

The existing operator core browser command passed with 100 captures across its existing desktop and phone flows. Only the two screenshots relevant to this change are selected into this packet. They were inspected visually. The browser run began on the implementation tree before its source-save commit; git diff proves that every relevant runtime and browser-test byte, indeed all ./src bytes, is identical from source commit 93afd32743565cef8306096568a9f45b993378ec to the final candidate. The later merge changed only unrelated learning tests and contract evidence. PROVENANCE.json binds the exact candidate and file hashes. The native tests and typecheck were rerun on the final committed SHA.

One new local expectation initially used 200 for native unblock, whose documented response is 204. It was corrected to that existing response and the complete native journey passed, including erasure and replay. This was a local test-authoring correction, not a CI repair. No failing Verify repair round occurred.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0.

CHECKS.json is the actual check receipt; its referenced logs are selected separately. The existing two native test registrations were extended; zero registrations were added or removed. All parent contract table rows survived every commit, including both merge parents: 445 table lines retained. Main's newer LEARN-001 judgment and tests remain intact. Changed added lines contain zero email-shaped literals, and all candidate author and committer identities including side parents are fleet identities. There are no coauthor trailers. Full Git history is retained for the lander scan.

## DONE-RIDERS check

| Row | Result | Evidence and boundary |
| --- | --- | --- |
| 1 | PASS locally; post-regeneration Verify pending | The acceptance outcome is fully exercised by the three journeys and lines above. |
| 2 | PASS | Seeded populated results, independent expected identities and wording, and the three detected mutations; native refusal and unchanged-permission checks at lines 60–77. |
| 3 | EXPECTED VIEW-ONLY FAILURE; post-regeneration Verify pending | Run 42141867258 on the exact candidate stopped every matrix job before product tests at the generated-view preflight. Existing base globs and the operator-core command load these journeys after that preflight. This is the explicit READY exception, not a claim that CI executed and passed product assertions. |
| 4 | PASS | Final native checks execute on the candidate; relevant source and browser-test diff from the implementation commit is empty, recorded in PROVENANCE.json. |
| 5 | PASS | DEC-002 acceptance point 1 already names its inherited REL-004 eligibility duty; the implementation calls that shared selection without inventing a new policy. |
| 6 | PASS generation; mechanical provenance note | Generator write and check exit 0; DONE Gap is empty and evidence names the actual journeys. CONTRACT names the implementation proof commit; the final candidate SHA is bound by PROVENANCE.json rather than a circular self-referential hash in its own source. Main's generated views are intentionally restored for lander regeneration. |
| 7 | PASS | No acceptance sentence or scope changed. Only the target Status, Gap, evidence, source provenance and generated summary counts changed. |
| 8 | PASS | Populated private detail refuses signed-out reads; native block removes a requester, erasure completes, the erased session is refused and the audience stays empty; lines 62, 68–77. Existing commitment refusals are retained. |
| 9 | PASS bounded claim | No provider or legal effect is claimed. All earlier field-proof and release holds remain unchanged. |
| 10 | PASS existing ruling | No new custody, consent, spending or authority default; unchanged REL-004 policy and existing current-operator admission are reused. |
| 11 | PENDING guarded landing | Main equality, exact-SHA Run site and COMPLETE publication scan with zero findings are lander duties, not established by this cloud run. |

## Pre-ready self-check and handoff

Every changed user-visible native outcome has a populated runtime assertion; three removed-behavior mutations were detected. The existing authority and transaction guards remain, and the new list is uncached and read-only. Native erasure and replay refuse resurrection. Existing assertions remain. Added controls have text labels and introduce no icon-only action; existing screen components and text sizes are retained. The new list and assumption field were inspected at both widths. Existing decorative icons are not interactive controls. No configuration moved or new top-level action was added.

Publication scan: NOT RUN in cloud, as the assignment requires the fleet lander to run it. No COMPLETE or zero-findings result is claimed. Candidate Run site and main equality are NOT RUN, because this task never pushes main. Initial main 1db862912dc18165739d5385fcca0f886c023ca4 had successful Verify runs 42135153133 and 42133495378 and successful Run site 42135153158. Those are not candidate proof.

Candidate Verify: run 42141867258, event push, exact head cec0ebc982c0e9ad11615d5be8796650a6f1c338, completed with failure. Every failed matrix job has exactly one failed step, Check generated contract documents. Job 127643936633's archived failed log says: `node src/base/contract-docs.mjs check` then `ACCEPTANCE.md: generated content differs; run contract-docs write.` with exit 1. The exact same command reproduces that expected failure locally on the committed candidate. Generator write and check passed before restoring main's generated views. This is the assignment's explicit generated-view-only READY exception; no product assertion failed, and product CI assertions did not run past this preflight. No workflow was rerun or dispatched and no view was committed to turn the check green. The lander must regenerate the views and require green Verify on its resulting commit. Actual state and all job ids are in verify-run.json and verify-jobs.json; the sanitized archive and local reproduction are selected separately. Five GitHub API or archive invocations were used. Product custody and evidence publication remain separate.

Plan row changed: DEC-002 only, PARTIAL to DONE candidate. No unmet native outcome remains in this clause, and no next target was started. No product blocker is known. The maintained lander must retain the upstream sd-penny-c-f50 work and enforce exact-SHA Verify, generated-view regeneration, publication scan and Run site before counting a landing.
