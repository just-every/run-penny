# sd-penny-c-f102 results

SEG-006 moves from MISSING to PARTIAL on `b6647daf56c00f4738fdc0fbf8a2e68bed2b94d6` at `cloud/sd-penny-c-f102`. The selected native account internal-owner slice is proved. The full clause is not DONE.

Counts: 79 done, 124 partial, 78 missing before; 79 done, 125 partial, 77 missing after. All 281 parent Status rows remain. Only SEG-006 changes status. No acceptance sentence changes. Plan row: SEG-006 native owner-rule point 1 is complete; all wider remainders stay open. No other plan row is changed.

Product custody: the named remote branch was read back at the exact candidate SHA. No PR is needed because the existing push workflow admits the branch. The product checkout is clean. The first real commit was pushed immediately after the final fetch and no-op rebase, source-lock check and complete candidate identity audit. No published history was rewritten. Unfinished predecessor 4381f49c0ca4fcb8358e44b7393fd7e3093c433f was replayed onto main 6c1eb018f6391de17e04fc8868c0c74f8732abd8; newer OpenAPI source, contract judgments and changelog work remain intact.

## Work and proof

Saved definitions accept exactly a nonempty bounded name and the internalOwnerId equals rule. List and membership reads require current native operator authority, and writes reuse the existing same-origin guarded transaction. Account create and PATCH admission are unchanged. Membership reads current account records rather than a stored audience, so changing an account's owner changes membership immediately. Saves and their audit records commit atomically.

Migration 0110 adds the saved-rule table and owner indexes. Every populated prior cell and existing migration-ledger entry survives upgrade; repeating migrations does nothing. The schema is additive and remains on source rollback. No new configuration, external account or provider credential is required.

Product archives validate and retain rule references and creator attribution, while destination authority remains independently established. Reviewed erasure removes rules targeting the former operator, clears their related audit reference and writes tombstones. Other rules, anonymous creator attribution and account records remain intact. Erased-owner saves and stale archive replay are refused.

Two added registrations in `tests/base/segments.test.ts` cover the selected flow. They are the unfinished predecessor's tests, now run against this candidate. Existing registrations and assertions were not removed, narrowed or gated. The focused run includes 2 segment journeys, 7 existing erasure journeys and 8 existing hosted archive journeys: 17 passed, 0 failed. The exact-head raw test receipt is `worker-tests.json`; commands and exits are in `validation.json` and `mechanical.json`.

Selected proof map:

- Native rule create, save, list and read: `tests/base/segments.test.ts:43`, first journey, lines 59 to 74.
- Account entry and exit with exact identities and an unaffected control: same journey, lines 64 to 69; native account PATCH followed by membership GET, with elapsed time below five minutes.
- Invalid definitions and absent target identities: lines 81 to 96; HTTP 400 and 422, with unchanged persisted state checked at line 115.
- Anonymous, requester, revoked-session and foreign-origin refusals: lines 97 to 115; HTTP 401 and 403 and no disclosed rule identity or saved data change.
- Failed audit rolls back a save: lines 75 to 80; HTTP 503 with unchanged saved definition, accounts and audits.
- Populated migration and repeated no-op: lines 45 to 57; prior columns and ledger preserved. Existing Platform migration-ledger archive journey also passes in `tests/base/hosted-export.test.ts:112`.
- Bounded public exclusion: lines 116 to 123; nonempty approved public request list and detail omit segment names, IDs, account-owner values and rule fields.
- Native archive transfer and installation-session exclusion: `tests/base/segments.test.ts:126`, second journey, lines 129 to 148; exact rule and account rows restored, source sessions refused at destination.
- Operator-reference erasure, control preservation and replay custody: second journey, lines 149 to 172; target rule reads 404, unrelated rule remains exact, erased target saves return 422, stale import returns 409 and changes nothing.

PROBE SEG-006 point 1: native segment POST and GET, then account PATCH to the selected owner and back -> exact membership grows from the control account to both account identities and returns to the control; a native rule edit then matches exactly the changing account.
PROBE SEG-006 admission: anonymous and requester GET, POST and PATCH; signed-out operator GET, POST and PATCH; foreign or absent Origin writes; invalid definitions -> 401, 403, 400 or 422 with saved state unchanged.
PROBE SEG-006 custody: populated migration twice, native export and import, owner-reviewed operator erasure and stale archive replay -> prior cells preserved, rules restored with current destination authority, target rule deleted and stale replay refused.
PROBE SEG-006 bounded privacy: nonempty public request list and detail linked to a matching account -> public request retained and segment names, owner IDs and rule fields absent.
PROBE SEG-006 points 2 and 3 in full: none; explicitly omitted by the selected brief. The bounded privacy probe does not certify every public payload.

## Checks and CI

The exact-head typecheck and `rer check --profile first-party` pass. Setup and the production build completed through cloud_run. Focused lint passes. No screen changes are included, so no new browser proof is needed for this API slice.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=populated migration and Platform-ledger archive Worker journeys exit=0.

Generated views were restored whole from main after the successful generator check. Neither ACCEPTANCE.md nor docs/CLAIMS.md is committed. The source lock was regenerated last, checked again after rebase and checked after the view restore. No applied migration or copied Base source changes.

Exact-head Verify: push run 42203664331, completed failure. Its plan job passed; every failed shard reports only Check generated contract documents. The representative base-1 job 127844928286 says: `ACCEPTANCE.md: generated content differs; run contract-docs write.` No assertion failure occurred; product tests were skipped after that mechanical step. This is the brief's permitted generated-view exception, not a green test run. No workflow edit, dispatch, rerun or repair was performed. `ci-runs.json`, `ci-jobs.json`, `ci-generated-views.log` and `ci-log-receipt.json` retain the actual sanitized diagnostics.

Base main 6c1eb018f6391de17e04fc8868c0c74f8732abd8 has successful Verify 42201695865 and successful Run site 42201695577. Candidate Run site and publication scanning remain guarded lander duties; this task makes no landing or COMPLETE scan claim. Five GitHub diagnostic invocations were used, including one initial abbreviated-SHA lookup that returned no runs and was not treated as evidence. There was one exact-head discovery and no status polling loop.

## Remaining scope and DONE riders

Requester and other account attributes, commercial and custom fields, ROLE-001 restrictions, provider-origin attributes and SEG-001, SEG-002 and SEG-005 arrival and refresh timing remain open. So do request, inbox and report filter agreement, every other named segment filter, the segment UI and universal public-payload certification. These are the brief's explicit held or omitted remainders. Existing ct, uip, payments, provider, device, account, cross-seed, Base and release holds remain unchanged. No CRM installation, live-provider qualification or general segment completion is inferred. There is no new blocker to landing this partial slice.

DONE-RIDERS assessment, with no DONE claim:

1. PARTIAL: selected native point 1 is reached; omitted broader outcomes remain unproved.
2. PASS for the selected slice: populated identity assertions and refused writes with unchanged data, both named segment journeys.
3. UNESTABLISHED for full DONE: exact-head Verify stops at the permitted generated-view check; local exact-head journeys pass.
4. PASS locally: the 17 journeys and structural checks were repeated on the pushed candidate.
5. NO NEW INHERITANCE CLAIM: existing authority and DATA duties remain as written; no acceptance text is changed.
6. PARTIAL metadata is honest; generated views pass after write and are restored as required. The historical Judged from line is retained; no DONE provenance is claimed.
7. PASS: acceptance sentences and ct rulings are unchanged; all parent Status rows survive.
8. PASS for the selected authority scope: native operator success and unauthorized or revoked refusal paths run; existing account admission is reused.
9. PASS boundary: provider, commercial and external installation claims remain open and named.
10. NO NEW POLICY: existing native operator admission is reused; narrower role delegation remains explicitly open.
11. PENDING LANDER: branch-only candidate; no main equality, candidate Run site or publication-scan receipt is claimed.

Pre-handoff self-check: selected behaviours have public-door assertions; no existing assertion is weakened; revoked authority, erased-operator targeting and stale-archive replay are exercised; no screen is changed; source lock is current. The exact-head generated-view exception is documented. The Mac must generate views, obtain its required exact-head checks and complete its publication scan before landing.

Full plan: PLAN.md. Complete actual selected receipts are published only on the separate evidence ref. Product changes are limited to the native segments implementation, additive migration, archive and erasure registrations, focused tests, contract status and changelog, and source lock.
