# sd-penny-c-f69: DATA-005 native CSV reconciliation

Repository: https://github.com/just-every/run-penny
Product branch: cloud/sd-penny-c-f69
Starting product head: 6b1548b699a36a5ebc553ecfc9e57d29d7f88f23

## Authorized plan and scope

1. Inspect DATA-005 acceptance, its status gap, native request and voter CSV implementations, context readers and existing journeys.
2. Preserve the base implementation of eligible distinct-person vote_count and existing zero, direct, mixed proxy, takeover, blocked-person and joined-row checks. Extend the same public-door journey for the unexercised proxy-only request, independently read public participation totals, and refuse revoked operator exports.
3. Retain current main's newer clause judgments and tests. Run the two affected route suites and typecheck, then first-party check. No new test registrations, UI change, provider qualification or broader CSV implementation.
4. Generate contract views and check them locally; restore both generated files from current main; regenerate the source lock last and check integrity.
5. Commit with fleet identity and active hooks, inspect all candidate identities and trailers, push only the named cloud branch through the fleet guard. Discover exact-head Verify by REST and report its actual state. Publish this report and real receipts only to the separate evidence ref.

## Starting evidence and gaps

DATA-005 is PARTIAL. Its one acceptance sentence requires fixture CSV totals, individual voters and record counts to reconcile. The base already adds vote_count and parses native exports in the existing proxy-vote registration, covering a mixed request, a direct-only request, an empty request, later direct takeover, a blocked person, multiple addresses and accounts, and unauthenticated and requester refusals.

The selected gap in this continuation is a request with only proxy support, independent public participation readback and current operator revocation on the export doors. Remaining full-clause outcomes are CSV for evidence and notes, features and hierarchy, accounts and requesters with attributes, roadmap and releases, saved views and ROLE-001 field restrictions. These are explicitly omitted by the selected POINTS. Provider, device, account, Base, other seed and release holds are retained. No DONE claim is made.

Base Verify 42153455617 at 6b1548b699a36a5ebc553ecfc9e57d29d7f88f23 completed failure only at Check generated contract documents across its shards. This is the permitted generated-view exception; no product repair was made for it. Main e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f has successful push Verify 42153984585 and Run site 42153984645. Nightly 42156564353 failed and is outside this slice.

## Results

The product candidate is e3ebcc7130fd1879bb5ed8c736b0f7f1b3c097ef. It has both the pinned base and current main e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f as parents. The final fetch and merge reported Already up to date. No history was rewritten. The push guard succeeded on its first attempt, and ls-remote advertised the same candidate on refs/heads/cloud/sd-penny-c-f69. No PR was created: Verify starts on branch pushes.

DATA-005 stays PARTIAL to PARTIAL. The native request vote-total implementation is inherited from the pinned base, not newly reimplemented. This continuation adds proof for a request with only proxy support, compares every fixture request's public vote total with its two parsed exports and authenticated context, and confirms a revoked operator session is refused by both CSV doors with no fixture identity in the refusal body.

The only plan row updated is DATA-005's native acceptance-point-1 slice. The actual shared plan remains read-only in this cloud run; its retained remainder is unchanged. Contract counts before and after, on main, the base and this candidate: 79 DONE, 124 PARTIAL, 78 MISSING, 281 total. The affected test suites contain 5 registrations before and after; none was added, removed, skipped or narrowed.

## Public-door proof

The existing journey `tests/base/proxy-votes.test.ts:11`, “records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote”, now exercises all four request cases. It is included by the existing base test glob in push Verify. Its helper `tests/base/csv-vote-reconciliation.ts:34`, reconcileVoteCsv, parses both authenticated CSV responses and verifies exact request and voter identities, proxy marks, timestamps, row counts, public vote totals and authenticated demand. The fixture has four request rows and four eligible voter rows initially; after direct takeover it still has four voter rows, with the same customer and its proxy mark cleared; after blocking that person it has three eligible voter rows.

PROBE DATA-005 1: authenticated GET /api/operator/requests/export.csv and /api/operator/votes/export.csv over native zero, direct-only, mixed and proxy-only requests -> 4 request rows; per-request totals 0, 1, 2 and 1 match the exact eligible voter identities and marks, fixture record counts, public GET /api/public/requests/:slug and authenticated GET /api/operator/requests/:slug/context. Two verified addresses and two linked accounts produce four context join rows for one direct person while each export counts that person once. Duplicate proxy replay changes no demand; direct takeover preserves the total and clears the proxy mark; blocking removes that voter from both counts. Unauthenticated, requester and signed-out operator GETs to both export doors return 401.

The proxy-only request is created through native submission and moderation, has the author's automatic vote removed through the native DELETE vote door, and gains one operator-recorded proxy vote (`tests/base/proxy-votes.test.ts:30`). Fixture expectations list its distinct person independently of export output (`:44`). Existing native email verification and takeover are retained (`:56`); blocked-person reconciliation is retained (`:65`). Revoked operator refusal and body non-disclosure are at `:68`.

`tests/base/csv-vote-reconciliation.ts:42` performs both exports; lines 44 to 53 reconcile request identities, native counts and voter identities; lines 54 to 65 compare public participation and authenticated context, including exact proxy marks and vote time. Lines 68 to 69 preserve anonymous and requester refusals. `tests/base/board-categories.test.ts:96` retains category identity, the canonical request's vote_count and all fixture request record counts.

## Commands and receipts

The required setup and build ran through cloud_run. Setup completed successfully; its private local settings and output are excluded from the public packet. Build completed with exit 0 in BUILD.txt.

BASELINE-TESTS.txt records 2 files and 5 tests passing. TOUCHED-TESTS.txt records the extended assertions passing. EXACT-HEAD.txt names the committed candidate, and EXACT-HEAD-TESTS.txt records the same 2 files and 5 tests passing on that clean committed head, exit 0. Only the two affected route suites ran, rather than the complete suite.

TYPECHECK.txt records `pnpm run typecheck`, exit 0. FIRST-PARTY.txt is the actual empty successful output from `pnpm exec rer check --profile first-party`, exit 0. LINT.txt is the actual empty successful output from touched-file oxlint, exit 0. COMMAND-RECEIPT.json contains command, exit, head and custody metadata.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0.

VIEWS.txt records successful generation and freshness checking. Both generated view files were then restored from main. They have no diff against origin/main. LOCK.txt is the complete actual source-lock write and check output; a second committed-head source-lock check also passed. All 445 table rows were retained from both parents, and every parent Status identity was checked against the staged result. The main learning tests and newer LEARN-001 judgment were retained whole. No migration, provider configuration, dependency version, workflow or UI was changed.

## DONE-RIDERS assessment

This is a bounded PARTIAL update; no DONE claim or judge request is made.

1. PASS for the selected native slice, with exact-head local public-door proof above; full-clause coverage remains PARTIAL for the explicitly retained record families, saved views and field restrictions.
2. PASS for this slice: populated fixture identities are independent of CSV output; allowed exports work, anonymous and requester exports refuse, and revoked operator exports refuse without data. See the named proxy journey and helper.
3. NOT EXECUTED in CI: the existing push base shards select this journey, but candidate Verify stopped at generated-document freshness before tests. This is the expressly permitted cloud exception, not proof of a green test job. The exact-head local journey passed. The full clause stays PARTIAL.
4. PASS: EXACT-HEAD-TESTS.txt records tests on the committed candidate. No relevant byte changed afterward.
5. NOT APPLICABLE: no new inherited Base duty or receiving acceptance sentence was introduced.
6. PASS for this PARTIAL row: the full remainder is retained and Evidence names the real journeys. Local generation and its check passed before restoring main's generated views as instructed. No new judgment or full-clause DONE provenance is claimed.
7. PASS: acceptance text is unchanged; only DATA-005's Status evidence and gap changed.
8. PASS for export admission: authorized exports succeed; anonymous callers, authenticated requesters and revoked operator sessions are refused. No new grant, role or destructive verb was introduced.
9. PASS: provider, device, account, other seed, Base, live qualification and release boundaries remain explicit and unclaimed.
10. NOT APPLICABLE: no new policy default was adopted.
11. PENDING guarded landing: no main push, exact-main Run site or cloud publication scan is claimed.

## Pre-READY self-check and limits

The native slice is exercised through emitted-Worker routes and parsed exported content. Existing assertions were preserved, with one fixture expanded from three to four requests. The touched journey still checks duplicate proxy no-op, unchanged permissions, private public projections and collapse on direct takeover; the affected suite's existing erasure journey also passed. Operator revocation now has explicit export refusal and non-disclosure checks. No runtime authority or erasure implementation was changed.

No screen was changed, so browser screenshots, tooltip checks and visual work were not part of this authorized CSV slice. No new email-shaped fixture literal or provider-shaped key was added. The code diff was inspected for the publication slash-token trap. The required full-history publication scan remains the maintained Mac lander's duty; no COMPLETE or zero-finding scan result is claimed from this cloud.

The broader clause remains PARTIAL because the selected brief omits the other record families, saved-view exports and commercial-field role restrictions. Those are remaining work rather than a newly discovered external blocker. Existing live provider, device, account, Base and other-seed holds remain unchanged. There is no reproduced product failure or account blocker in this slice.

## CI and handoff

Candidate push Verify: 42158298559, event push, head e3ebcc7130fd1879bb5ed8c736b0f7f1b3c097ef. After the permitted five-minute interval, REST reported completed with conclusion failure. All 29 failing jobs among 30 jobs failed only at Check generated contract documents, as recorded in CI-FINAL.json and CI-JOBS.json. This is the explicit generated-view exception accepted for cloud READY. The locally generated views passed their check and were restored from main as required; no generated output is added to repair CI. The branch CI test shards therefore did not run, and no green test-run claim is made. No workflow was dispatched or rerun. Six GitHub API calls were used, including completed-run failure diagnostics. Publication scan, regenerated landed views, final exact-SHA Verify and Run site remain guarded lander gates. READY is custody of this pushed PARTIAL candidate, not clause acceptance or landing.

Report-only evidence is published separately under refs/heads/evidence/sd-penny-c-f69. It contains only explicitly selected report and actual non-secret receipt files. The product branch contains the CSV implementation, tests, contract status evidence, changelog and regenerated source lock, with none of this fleet packet.

