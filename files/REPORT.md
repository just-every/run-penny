# sd-penny-c-f107 results

Product repository: just-every/run-penny.
Branch: cloud/sd-penny-c-f107.
Candidate: 1a239ac5af69af56b76fc0ea1484a40c91901553.
Requested f106 base: 6845ceb30666d0df6cdd51b88866dee9cf1db253.
Integrated main: bd98ed565d1dd6fdebea3df93f7e8fca5cd283ca.
No PR is required: this repository starts Verify Penny on branch pushes. No default branch was pushed.

SEG-006 remains PARTIAL against the pinned f106 base. Against integrated main, this candidate carries forward f106's MISSING to PARTIAL change. Counts against main change from 79 DONE, 124 PARTIAL and 78 MISSING to 79 DONE, 125 PARTIAL and 77 MISSING, total 281. Against the requested f106 base, all three counts are unchanged. No DONE claim, ct judge request, release claim or live qualification is made.

The selected native account internal-owner slice was already implemented in f106. Reuse that implementation rather than creating another rule model. It validates and saves a noncommercial internalOwnerId equality rule through current native operator authority and reads membership from current account rows. Native PATCH reassignment produces exact entry and exit immediately with an unaffected member. Existing tests cover invalid rules, unauthorized reads and writes, origin refusals, transaction rollback, populated upgrade and repeated no-op, archive restore, operator-reference erasure and replay refusal, and bounded public-projection exclusion.

This continuation integrates that work with main's newer feedback-volume report routes and adds proof for two remaining restore scenarios in the existing custody journey. Source sessions cannot create or change segments after restore, and the rules, accounts and audit snapshot stays equal. The destination session edits the restored rule, reassigns an account through the native account route and reads exact current membership. Re-export retains the rule identity and anonymous creator reference. The journey uses the actor returned by the destination's authenticated session because portable attribution may legitimately retain the source product operator ID.

The deployment check exposed a genuine delivery gap inherited from f106: the managed deployment specification omitted migration 0110. Regenerating it through the documented build-derived command adds that migration and its actual SQL and digest. The specification check now passes. No applied SQL was changed and no additional migration or configuration is required.

## Scope and remaining outcomes

The selected POINTS permit only the existing noncommercial native account internal-owner attribute. The brief expressly excludes requester and other account attributes, commercial and custom fields, ROLE-001 restrictions, provider-origin attributes and SEG-001, SEG-002 and SEG-005 arrival and refresh timing, request/inbox/report agreement, filtering every list and other operator view, the segment UI and universal public-payload certification. All remain named in SEG-006's Gap, with all prior ct, uip, payments, provider, device, account, cross-seed and Base holds and release requirements retained. These omitted outcomes prevent a whole-clause DONE claim. They are not reported as implemented or as a newly discovered account blocker.

The campaign plan row to update is SEG-006: selected native slice verified; pinned-base PARTIAL to PARTIAL; main MISSING to PARTIAL through the carried f106 implementation. Counts are stated above. The inline extract was read as planning context; no plan was rebuilt and no lane file was read or written. PLAN.md records the complete execution plan and PROBES.md records each runtime observation.

## Validation and proof

All three touched native journeys pass on the exact candidate. The two segment journeys in tests/base/segments.test.ts are:
- Line 43: saved native owner rules follow exact current account membership and refuse unauthorized or invalid saves without public exposure. Populated upgrade and no-op are at lines 45 to 57; save and current membership at 59 to 74; rollback and admission refusals at 75 to 120; populated public API and document exclusion at 121 to 127.
- Line 131: native archives restore rules and membership while operator erasure removes targeted rules and fences replay. Export and restore are at 134 to 150; source-session write refusal at 151 to 157; preserved archive and erasure custody at 158 to 183; destination edit and current reassignment with re-export at 184 to 194.

The retained main regression in tests/base/feedback-volume-report.test.ts also passes: native feedback volume reconciles private JSON and CSV windows without multiplying linked records. It protects the report routes retained when resolving the API registration conflict.

Build, typecheck, all 1,148 first-party structural checks, source-lock freshness, generated deployment-specification check and the native migration-ledger preflight pass. The ledger returns nativeApply false, retaining its owning runner's migration authority. The existing populated-upgrade journey proves prior data and migration-prefix preservation and repeat no-op. Actual logs and the machine-readable test result are included.

Generator write and check both pass before the generated views are restored from origin/main. ACCEPTANCE.md and docs/CLAIMS.md are not committed. After restoration the expected check reports that ACCEPTANCE.md generated content differs. The final source lock is generated after the last source, test and documentation changes and passes its check. The final merge of refreshed main is a no-op. Every parent Status row is retained in both product commits: 281 before and 281 after. All candidate authors and committers are the fleet identity and all trailers are absent.

No test registration was added or removed in this continuation; existing assertions remain in place. There are no new conditions, skips or narrower expectations. No UI source changed, so no screen, visual redesign or browser-width proof is claimed. No homepage, logo, shared Base module or Verify workflow was changed.

The first local extension failed because its fixture guessed a new product operator ID after restore. The corrected fixture reads the authenticated destination actor; the same extension then passes. An initial one-off ledger launcher inherited Node's input-type flag into fork; removing that inherited flag lets the unchanged ledger check run. Both initial outputs are preserved for transparency. The deliberate D1 audit-abort test emits a request-error diagnostic while successfully proving visible refusal and rollback; it is not a failing journey.

## DONE riders and self-check

1. NOT SATISFIED for whole-clause DONE: acceptance point 2 and universal point 3 remain omitted and unproved. The selected native point-1 outcomes are reached by the two named journeys.
2. PASS for the bounded changed surface: seeded nonempty records, exact identities, refusal snapshots and allowed plus unsafe erasure and replay paths are exercised.
3. CI proof status is recorded separately below. Local exact-candidate journeys pass; no broader recorded proof is inferred.
4. PASS for local candidate proof: the final test run is bound to the candidate; relevant runtime bytes have not changed since the passing build.
5. Existing SEG-001 timing and DATA-002 privacy duties remain named in the requirement and Gap. No new inheritance claim is made.
6. Partial Gap retains all missing work and names the added restore proof. Generator write and check pass; restored stale generated views are deliberately left for the lander. No DONE provenance is claimed.
7. PASS: no acceptance sentence or clause ID changed, no ct rider was duplicated, and every parent Status row remains.
8. PASS for bounded native authority: anonymous, requester, revoked and source-session paths refuse writes with saved state unchanged; current destination authority succeeds.
9. PASS as a boundary statement: no provider, CRM, sibling install, legal or live-account qualification is claimed.
10. No new policy default is adopted. The existing noncommercial operator admission is reused; ROLE-001 remains a named remainder.
11. PENDING FLEET: default-branch equality, exact landing Verify, Run site and full-history publication scan remain guarded-lander duties. Publication scan is NOT RUN here; complete false, historyScanned unknown and findings unknown. No zero-finding or landing receipt is invented.

The applicable pre-READY security, data-loss and assertion-preservation checks pass for the changed native slice. Full SEG-006 acceptance and DONE are not claimed. Screens are outside this round. Source lock is fresh. The publication scan and landing checks remain explicitly pending.

## Mechanical receipt

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, generated views restored from origin/main; ledger=scripts/portability/ledger.mjs via Node IPC exit=0. Deployment declaration write then check exit=0. See MECHANICAL.json.

## CI and custody

Verify Penny push run 42215504858 is completed with conclusion failure on the exact candidate, discovered through the required REST endpoint. The second permitted REST call confirms all 30 jobs completed: plan passed, and all 29 failed shards have exactly one failed step, Check generated contract documents. No assertion or runtime test ran and failed in that workflow. The only local generator error after restoring main's views is ACCEPTANCE.md generated content differs. This is the brief's explicit permitted generated-view exception, not a runtime failure and not a repair round. Job IDs and failed steps are preserved in ci-jobs.json. Only two GitHub API calls were used, separated by more than 300 seconds. No workflow was dispatched or rerun, and no other SHA's CI is used. The product branch is pushed and its remote head equals the candidate. Publication scanning, generated-view landing output, main publication and Run site remain fleet duties. Reports are transported separately through the evidence ref and do not signal product acceptance or landing.
