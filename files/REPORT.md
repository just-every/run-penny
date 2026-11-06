# sd-penny-c-f76 results

DATA-005 remains PARTIAL to PARTIAL. Counts remain 79 done, 124 partial and 78 missing. The selected native request and individual-voter CSV portion of acceptance point 1 is proved; the full clause is not DONE.

Product: just-every/run-penny, branch cloud/sd-penny-c-f76, head 5cc1f1aa2e657af14b373d521feb83f5f334bae9. Base: 0e34f894705e0026a0306bfc3323816786608c28. Main at final integration: e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f. The branch retains all four inherited CSV commits from the named base. Main was already an ancestor, so the final fetch and merge changed nothing. No published history was rewritten. No PR was needed: the repository starts Verify on a branch push.

The pinned base already includes the eligible distinct-person vote_count column and the reconciliation helper the planner requests. This round preserves that work and adds a missing useful boundary to the existing sanity journey: all four published requests have their votes removed through native routes; the request export still has four rows, each with zero demand, while the individual-voter file has only its header. Re-adding two direct votes restores exactly those two people and prepares the existing mixed, zero and proxy-only scenarios. The first local attempt redundantly re-added all four votes and later hit the real identity write-rate limit (429 rather than 204). The final fixture avoids those redundant writes. It changes no limit, clock, product code or existing assertion.

The only new product-branch changes relative to the pinned base are seven lines in the existing proxy-vote journey, a truthful DATA-005 proof note, a changelog entry and the regenerated source lock. There are zero additional test registrations and no removed assertions. No migration, account configuration, UI, homepage, logo or design change was made. Existing copied Base bytes and rer pins remain unchanged.

## Acceptance map and frozen rubric for the selected native slice

These rows describe the selected portion of the existing acceptance sentence; they add no acceptance obligation. The native route journey named below is `tests/base/proxy-votes.test.ts`, “records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote”. Its reconciliation helper is `tests/base/csv-vote-reconciliation.ts`, reconcileVoteCsv.

| Item | Outcome and public door | Proof on the candidate |
| --- | --- | --- |
| R1 | Request export includes eligible vote totals and retains zero-vote requests | Native authenticated GET `/api/operator/requests/export.csv`; request vote_count uses the existing distinct eligible-person count. Journey lines 13–19 exercises all-direct, entirely zero and two-direct states; helper lines 42–51 checks exact request identities, fixture counts, totals and each request total. |
| R2 | Individual voters reconcile with request totals without joined-row multiplication | Native authenticated GET `/api/operator/votes/export.csv`; helper lines 46–54 checks the total, exact person identifiers, names, proxy marks and distinct people. Journey lines 43–68 creates two linked accounts and an additional verified address, proves four context rows for one person but one voter export row, and proves addressless proxy demand linked to both accounts still counts once. |
| R3 | Native participation and authenticated context agree with the CSVs | Helper lines 55–66 reads nonempty public request details and authenticated request context, compares demand totals, exact supporter identities, proxy marks and vote timestamps. Journey preserves mixed, direct-only, zero and proxy-only states, direct removal and idempotent replacement, direct takeover and blocked-person exclusion. |
| R4 | Private export doors refuse unauthenticated people, requesters and revoked operators | Helper lines 69–76 asserts 401 and absence of fixture identities from both export refusals. Journey lines 87–92 revokes the native operator session and asserts both exports still refuse without exposing identities. |
| R5 | Erasure and replay cannot resurrect exported voters | Existing journey “refuses stale or invalid authority and rolls back every effect if auditing fails; requester erasure removes proxy custody”, lines 123–144, reconciles a populated export, erases the proxy requester through the native data door, reconciles the reduced counts, refuses replay with 409 and reconciles again. |
| R6 | Category and hidden public totals do not corrupt operator export records | `tests/base/board-categories.test.ts`, “upgrades populated boards and supports category browsing, ranking, canonical merges and board participation and privacy through routes”, checks parsed request rows, category, vote_count and fixture request counts while retaining internal-board and public privacy checks. |

PROBE DATA-005 point-1-native-csv: authenticated GET `/api/operator/requests/export.csv` and `/api/operator/votes/export.csv` after native vote changes -> four request rows with totals [1,1,1,1], then [0,0,0,0] with zero voter records, then [1,1,0,0], then mixed demand [2,1,0,1] with four exact individual-voter records; native participation, authenticated demand, proxy marks and fixture counts agree; unauthenticated, requester and revoked-operator export attempts return 401 without fixture identities.

## Validation and receipts

- Setup and build completed successfully using cloud_run and the repository's pinned rer; setup created only private local installation state and exited.
- Touched route checks: five passed in two files, 28.88 seconds. `touched-tests.log` is the actual successful output; `touched-tests-initial.log` retains the initial local 429 failure. No failed CI repair round was started.
- The existing proxy-vote route journeys were also run on the committed candidate for an exact-head runtime probe; see `exact-head-probe.json` and its log for the actual exit and head.
- Final typecheck passed under Node 22.20.0. The first-party profile check passed with every returned clause marked OK. Local copied-source custody check passed; its receipt explicitly does not claim a fresh upstream-origin read.
- Generator write and check passed. Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from main and are not committed. Running the generator check on the committed branch therefore correctly reports only stale ACCEPTANCE.md; this is the documented lander regeneration exception.
- Source lock was regenerated after the final source, test and document edit, then its integrity check passed. No migration was changed, so no migration-ledger change check was needed.
- Every candidate author and committer is the fleet identity; there are no coauthor trailers. Every parent status key was retained across all candidate commits, including both parents of the inherited merge: six parent comparisons pass. The new commit retains all 445 pipe rows and all 332 keyed rows.
- The branch was pushed successfully on the first attempt through cloud-push.py. Product custody is separate from this evidence packet.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, generated views restored from main; ledger=none exit=0.

## DONE riders and pre-READY self-check

There is no DONE claim and no new judge request. The riders are recorded to keep the proof boundary explicit.

1. Selected native outcomes are covered by R1–R6. Other CSV families, saved views and ROLE-001 restrictions remain unproved, so the whole clause remains partial.
2. Real populated fixture records and explicit expected identities are checked, including the zero-voter boundary. Authority refusal, erasure and replay are exercised through native doors.
3. Verify run 42168227588 was triggered by push on the exact candidate. Final observed CI custody is recorded below; local proof does not claim an ordinary green full Verify.
4. The final exact-head probe has its own receipt. The two-file successful check used identical relevant source and test bytes; hashes are bound in RECEIPT.json.
5. No new inherited duty or Base claim was introduced. Existing holds remain in the DATA-005 Gap.
6. The partial Gap preserves every omitted obligation. Generation was proved before restoring the views; committed stale generated views are expected. No old judgment or candidate-independent Judged-from line was changed to claim a promotion.
7. No requirement, acceptance point, scope or ct ruling was changed.
8. R4 and R5 prove private export refusal after revocation and erased-person replay refusal; existing rollback and scoped-key journeys also passed.
9. No provider, device, legal or live installation boundary is claimed as proved. All existing holds and release requirements remain.
10. No custody, consent, spending or authority policy default was introduced.
11. Main equality, publication scan and Run site on the landing commit remain the fleet's gates. This cloud run changes only its named product branch and separate evidence branch.

No existing assertion was removed, narrowed, skipped or placed behind a viewport condition. Revoked authority, erasure and replay paths passed. No screen was touched, so there is no new browser, tooltip or layout proof to supply. The added product diff contains no email-shaped string. A full publication scan is not available in this cloud task and is not claimed COMPLETE or clean; the maintained lander must run it. No mutation campaign or live provider journey was added or claimed.

## Remainders and plan return

The DATA-005 plan row changes only its native CSV proof note. Status and counts do not change. CSVs for evidence and notes, features and hierarchy, accounts and requesters with attributes, roadmap and releases; saved-view exports; and ROLE-001 commercial-field restrictions remain explicitly omitted by this brief and unproved. Existing provider, device, account, cross-seed, Base and release holds are retained. No other campaign clause was started.

Main's latest observed Verify was successful (42153984585), as was Run site (42153984645), on e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f. The older scheduled Nightly journeys failure 42156564353 is reported without treating it as a red main. The named f74 base was not yet on main at final synchronization; the lane's stated ordering hold is preserved, and its commits remain in this branch.

Exact-SHA Verify 42168227588 (push) completed with failure. All 29 failed shards failed only at Check generated contract documents; each source-lock check succeeded. The local committed check reports only stale ACCEPTANCE.md. No test assertion ran or failed in branch CI; this is the documented generated-view exception, which qualifies for READY while the lander regenerates views and reruns its gates. No workflow was dispatched or rerun. GitHub budget used: four calls (main discovery, candidate discovery, one candidate status poll after 301 seconds, and one completed-run diagnostic jobs read).

The packet contains actual non-secret reports, command receipts and logs selected explicitly for the report-only evidence branch. It contains no credential file, environment dump, symlink, private held-out material or installation state. Evidence publication grants no product acceptance or landing signal.
