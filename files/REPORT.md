# DATA-005 native CSV reconciliation

Repository: just-every/run-penny
Branch: cloud/sd-penny-c-f65
Candidate: 6b1548b699a36a5ebc553ecfc9e57d29d7f88f23
Base: 84bad894d12e7f969f567177a126cb544a3237b1

DATA-005 remains PARTIAL to PARTIAL. The selected native request and individual-voter slice of acceptance point 1 is closed locally. Full target counts stay 79 done, 124 partial, 78 missing, 281 total. Core counts stay 79 done, 108 partial, 71 missing, 258 total. No acceptance sentence changed. All 281 parent Status rows and all 445 parent table rows are retained.

The native request export now includes vote_count, calculated from distinct eligible people. It uses projected request_votes, excludes blocked people and withdrawn requests, and does not join addresses or accounts into its tally. Existing status, category, moderation, quoting, limits and private response headers remain. The individual-voter export and authenticated context implementation required no production edit.

The existing proxy journey now creates three native requests and reads both actual CSV responses. Its independent expected fixtures have totals 2, 1 and 0, with three individual-voter records altogether. The mixed request has one direct supporter and one proxy supporter. Adding two verified addresses and two account links gives four context rows for its direct supporter while its export still has one row for that person. The exported source contains a comma, escaped quotes and a newline and is compared exactly. Recorder identity comes from the authenticated operator. Native direct takeover preserves totals and changes the proxy mark to zero. Native blocking removes that person from eligible rows and reduces the mixed total to one. The request export still has exactly three records. Anonymous and requester reads of both exports return 401. Existing proxy replay, lack of verification or consent, public privacy, audit rollback, erasure, merge, unmerge, archive, scoped-key refusal and revocation assertions remain in the five passing touched registrations.

The category journey now parses the request CSV and binds Platform and vote_count=1 to the canonical request. It also reconciles request record count. Both previous substring assertions were replaced by stronger parsed assertions; no user assertion was removed or narrowed. No registration was added, deleted, skipped or made conditional. Test-registration delta is zero.

Evidence through public doors:

- tests/base/proxy-votes.test.ts, lines 11 to 65, records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote.
- tests/base/csv-vote-reconciliation.ts, lines 34 to 67, reconcileVoteCsv, executes authenticated request CSV, voter CSV and per-request context reads and the two unauthorized export refusals.
- tests/base/board-categories.test.ts, lines 96 to 100, parsed category, canonical total and record-count checks in the existing populated-board journey.
- Existing proxy safety journeys remain in tests/base/proxy-votes.test.ts and were included in the same passing touched run.

PROBE DATA-005 point-1-native: authenticated GET /api/operator/requests/export.csv and GET /api/operator/votes/export.csv with native zero, direct and proxy participation -> three request records; totals 2, 1, 0; three individual voter records; exact voter identities and proxy marks; authenticated context agrees.
PROBE DATA-005 point-1-joins: two verified addresses and two account links on one supporter -> four joined context rows, one exported person and unchanged eligible totals.
PROBE DATA-005 point-1-takeover: native direct vote by the proxy customer -> same person and totals, proxy mark becomes 0, no new permission.
PROBE DATA-005 point-1-block: native block -> mixed request total 1, blocked person absent from voter CSV, direct-only total 1 and zero total 0 remain.
PROBE DATA-005 point-1-authority: anonymous and requester GET requests to both export doors -> 401.

Local validation:

- Frozen dependency installation and native rer setup passed.
- Pinned rer build passed. Typecheck passed after correcting nullable count result types in the new assertions.
- Final touched run: pnpm exec vitest run --config vitest.base.config.ts tests/base/board-categories.test.ts tests/base/proxy-votes.test.ts: exit 0, 2 files, 5 registrations, 22.60 seconds. Final precommit source bytes are unchanged in the candidate.
- npx -y @runeditrun/rer check --profile first-party: exit 0.
- Contract write and check: exit 0. Generated views were restored whole from origin main and are absent from the product diff.
- Source lock regenerated last and checked: exit 0. The final fetch and rebase found the branch already up to date; the lock was regenerated and checked again with no diff.
- Identity and trailer audit covered every candidate commit, including side parents: one fleet-authored and fleet-committed commit, no trailers. Commit hook active. Diff whitespace check passed. No new email-shaped literal; no new bare repository-like prose token.
- No migration, UI, homepage, logo, provider, dependency or workflow change. Migration ledger and browser screenshots do not apply to this slice.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock followed by check exit=0; views=node src/base/contract-docs.mjs write followed by check exit=0, then both generated views restored from origin main; ledger=none exit=0.

Frozen rubric for this selected slice:

R1 MET locally: the native request export supplies the distinct eligible total; helper line 50 compares independently named fixture totals.
R2 MET locally: zero, direct-only and mixed native participation reconcile request rows, exact individual identities and record counts; helper lines 44 to 58.
R3 MET locally: native proxy attribution and takeover remain accurate; proxy journey lines 48 to 62 and helper lines 59 to 62.
R4 MET locally: address and account associations do not multiply people; proxy journey lines 33 to 53 and helper line 53.
R5 MET locally: current operator reads succeed and anonymous or requester reads refuse; helper lines 35 to 40 and 65 to 66.
R6 OPEN outside the selected slice: other CSV record families, saved-view exports and ROLE-001 field restrictions remain in the DATA-005 Gap. Existing provider, device, account, cross-seed and Base holds and release requirements are retained. No policy default, live qualification or DONE claim is made.

DONE-RIDERS assessment (no DONE promotion requested):

1 PASS for selected native slice; FAIL for complete clause: other families, views and field restrictions remain unproved. Named journey and lines above.
2 PASS for selected slice: independent nonempty seeded identities, native state changes and both unauthorized doors asserted. Proxy audit, erasure and key safety remain passing.
3 PENDING final lander Verify: this exact branch Verify stopped solely at the permitted generated-view check. The unchanged base-test globs include both files; no new environment flag or nightly-only proof. No completed CI execution of the touched tests is claimed for this branch SHA.
4 PASS source relation: the final touched run used the exact source bytes committed in the candidate; no relevant byte changed afterward.
5 NOT APPLICABLE: this change adds no inherited Base duty or claim.
6 PASS for honest partial metadata and successful local regeneration. Legacy unrelated judgment provenance remains. Restored generated views are intentionally stale on the branch and belong to the lander.
7 PASS: acceptance text is unchanged; no rewrite or new rider.
8 PASS for this export slice: operator allowed, anonymous and requester refused. Scoped writes and revocation still pass in the existing proxy test.
9 PASS: no live provider, legal or device qualification claimed; holds retained.
10 NOT APPLICABLE: no custody, consent, spending or authority policy changed.
11 PENDING guarded landing: cloud branch only; main equality, full-history publication scan and Run site are lander duties. No scan was run or claimed in cloud.

Pre-ready self-check: all selected CSV outcomes have assertions that fail on missing or wrong totals, duplicate or missing identities, wrong proxy marks, missing source attribution or an unauthorized successful read. These assertion-to-failure relations were inspected; no mutation run is claimed. No assertion was removed, narrowed or moved behind a width or branch condition. Existing replay, erasure and revoked-key journeys passed. No screen was touched. Source lock is fresh. Publication scanning and Run site are not established by this report.

Plan row changed: sd-penny-replan-10 DATA-005 native request and voter CSV slice. This cloud report records the closed slice and retained remainders; no Mac plan file was edited. The complete execution plan is PLAN.md.

Product push: succeeded on attempt 1 through the fleet guard. No PR is required for this all-branch Verify workflow, so none was opened. Evidence publication is separate from product readiness.

Existing-main observation: SHA 84bad894d12e7f969f567177a126cb544a3237b1 has successful branch Verify 42138503924 and successful Run site 42140171051. Its later Verify 42140171112 failed browser job 127638280568 at Run this shard. The single permitted gh run view 42140171112 --repo just-every/run-penny --job 127638280568 --log-failed invocation exited 0 and returned zero bytes. No assertion or error could be extracted, no repair was attempted, and no flake classification is claimed.

CI result: Verify Penny run 42153455617, push event, completed failure, exact head 6b1548b699a36a5ebc553ecfc9e57d29d7f88f23. All 30 jobs were returned: the plan passed and all 29 failed shard jobs failed only Check generated contract documents. There was no source-lock failure or failing runtime assertion. The exact candidate reproduces ACCEPTANCE.md: generated content differs; run contract-docs write. with exit 1 after restoring main’s generated views. This is the explicit permitted generated-view exception for READY; no ordinary green conclusion is claimed. The lander must regenerate the views and rerun its exact-SHA gates. No workflow dispatch, rerun or repair was attempted. GitHub budget used: five invocations. No product blocker remains for this selected partial slice.
