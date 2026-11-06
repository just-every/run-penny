# sd-penny-c-f106 results

SEG-006 moves from MISSING to PARTIAL on `6845ceb30666d0df6cdd51b88866dee9cf1db253`, branch `cloud/sd-penny-c-f106`. The selected native account internal-owner slice is implemented and locally proved. The full dynamic-segment clause is not DONE.

Counts before: 79 done, 124 partial, 78 missing. Counts after: 79 done, 125 partial, 77 missing. All 281 parent Status rows remain, with 445 table lines both before and after. Only SEG-006 changes status. Acceptance sentences, ct judgments on other clauses and all previous holds are unchanged.

Plan row changed: SEG-006's native account-owner part of acceptance point 1 now has saved rule and current-membership proof. No other plan row changes. The current brief explicitly excludes the broader attributes, filters and UI; those obligations remain in the clause Gap. No general segment completion or live CRM proof is inferred. Full execution plan is in PLAN.md.

## Product and ancestry

The refused predecessor's unfinished change at `b6647daf56c00f4738fdc0fbf8a2e68bed2b94d6` was replayed without its commit onto current main `6c1eb018f6391de17e04fc8868c0c74f8732abd8`. That main already contains the newer OpenAPI work and judgments, which remain intact. The candidate is one new fleet-authored commit. A fresh main fetch and no-op rebase preceded the product push. No published history was rewritten.

The product branch was pushed through cloud-push.py and read back at the exact candidate SHA. There is no PR: this repository's existing push workflow admits cloud branches directly. The product checkout is clean. Only the named repository and branch were changed; main remains a fleet landing duty. The complete commit identity and product custody receipt is provenance.json, with the actual transport output in product-push.log.

Saved segments accept exactly a bounded nonempty name and an internalOwnerId equals rule referencing a current native operator. Reads require current native operator authority, use no-store responses and evaluate membership from current account records in the same guarded read transaction. Writes reuse the seed's existing same-origin and current-authority transactions; saved definitions and their audit records commit atomically. Existing account create and PATCH admission is unchanged.

Migration 0110 adds the saved-rule table and lookup indexes. Its populated upgrade preserves every previous column and ledger entry, and repeated migration is a no-op. No applied migration is edited. Retain the additive schema on source rollback. No configuration, external account or provider key is required.

Archives classify and validate saved definitions, target references and creator attribution. Product records restore while destination authority remains independent. Reviewed erasure removes rules targeting the erased operator, clears related audit references and records tombstones; unrelated rules, accounts and anonymous creator attribution remain. Erased targets cannot be saved again, and stale archive replay is refused.

The new journeys are the predecessor's two focused registrations. This continuation additionally checks list reads after session revocation and privacy in nonempty rendered public request list and detail documents. No existing registration or assertion is removed, narrowed, conditionally skipped or hidden behind a flag. No UI, homepage, logo, copied Base source, package pin or workflow is changed.

## Exact-head proof

candidate-worker-tests.json records 17 passed, 0 failed on the full candidate SHA: 2 segment journeys, 7 existing erasure journeys and 8 existing hosted archive journeys. Earlier working-tree receipts are retained separately as worker-tests.json and erasure-tests.json; they are not substituted for the exact-head receipt.

The two added journeys in tests/base/segments.test.ts are:

- Line 43: saved native owner rules follow exact current account membership and refuse unauthorized or invalid saves without public exposure. Native create, list, read and edit are at lines 59 to 74. Account PATCH produces exact entry and exit immediately, with an unaffected control, at lines 64 to 69. Audit failure rolls the save back at lines 75 to 80. Invalid rules and absent identities are refused at lines 81 to 96. Anonymous, requester, missing-origin, foreign-origin and revoked-session attempts are refused without disclosure or persisted changes at lines 97 to 120. Populated upgrade and repeated no-op preserve prior cells and the ledger at lines 45 to 57. Nonempty public API responses and rendered documents omit distinct segment, account-owner and rule markers at lines 121 to 128.
- Line 131: native archives restore rules and membership while operator erasure removes targeted rules and fences replay. Populated export, restore, independent destination authority and exact rule and account readback are at lines 133 to 153. Erasure preview and completion, target-rule removal, unchanged control data, anonymous attribution, tombstones, refused erased-target saves and refused stale replay are at lines 154 to 177.

PROBE SEG-006 point 1, selected account-owner slice: POST and GET saved segments, then PATCH the changing account to the selected owner and back -> exact membership changes from the control account to both account identities and back to the control; editing the saved rule matches exactly the changing account.
PROBE SEG-006 admission: anonymous and requester reads and writes, revoked-session list and detail reads and writes, foreign or absent Origin writes, invalid rules and absent operator targets -> 401, 403, 400 or 422, without disclosed private markers or changed saved state.
PROBE SEG-006 custody: populated migration twice, native product export and import, reviewed operator erasure and stale archive replay -> prior cells and ledger preserved, rules restored with independent destination authority, target rule deleted, unrelated records unchanged and stale replay refused.
PROBE SEG-006 bounded privacy: nonempty public request list and detail through API responses and rendered documents -> public request wording retained, private segment names, rule fields, owner identities and account markers absent.
PROBE SEG-006 point 2: none; request, inbox and report filter agreement is explicitly omitted by the selected brief and remains open.
PROBE SEG-006 point 3 in full: none; the bounded request privacy probe does not certify every public payload.

The candidate's typecheck, first-party check, focused lint, source-lock check and retained Base custody check all return exit 0. validation.json records each command, exact head, real exit and duration. Build and setup completed through cloud_run. All commands and browsers started by this task have finished; no browser session was needed for this route-only slice.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=populated migration and hosted Platform-ledger Worker journeys exit=0.

mechanical.json records those actual command results on the candidate. Generated views were restored whole from origin/main after generation; neither ACCEPTANCE.md nor docs/CLAIMS.md is committed. The lock was regenerated last, is fresh and is unchanged after exact-head regeneration. The restored-view check intentionally returns 1, reporting only stale ACCEPTANCE.md, as required by the cloud landing protocol.

## CI and landing boundary

Exact-head push Verify is run 42210077655, completed with failure. The plan job passed. Every failed shard has exactly one failing step: Check generated contract documents. The representative base-1 job 127866299266 reports `ACCEPTANCE.md: generated content differs; run contract-docs write.` Its later test steps were skipped. ci-runs.json, ci-jobs.json, ci-generated-views.log and ci-log-receipt.json retain the actual results. This is the brief's permitted generated-view exception; no green Verify test run is claimed. No workflow repair, dispatch or rerun was performed.

Current base main has green Verify 42201695865 and green Run site 42201695577 on its exact SHA. Four GitHub diagnostic invocations were used: main run discovery, candidate run discovery, candidate job discovery and one representative completed failed-job log read. No fast polling occurred.

Candidate publication scanning, generated-view landing commit, exact landing checks and Run site remain with the fleet. No COMPLETE publication-scan receipt or main equality is claimed. Changed-text inspection finds no newly added literal email addresses or bare prose slash tokens; diff-hygiene.json is explicitly a bounded inspection, not a publication scan.

## Remaining scope and DONE riders

Requester and other account attributes, commercial and custom fields and ROLE-001 restrictions remain open. Provider-origin attributes and SEG-001, SEG-002 and SEG-005 arrival and refresh timing remain open. Point 2's request, inbox and report agreement, every operator list, prioritization, roadmap, report and agent-scope filter, the segment UI and point 3's universal public-payload certification remain open. Existing provider, device, account, cross-seed, Base, ct, uip, payments and release holds remain unchanged. There is no newly discovered blocker to this partial slice.

No DONE claim is submitted. DONE-RIDERS assessment:

1. PARTIAL: both named segment journeys reach the selected slice; the omitted full-clause outcomes remain unproved.
2. PASS for the slice: populated exact identity readbacks and unsafe-path refusals with unchanged persisted data, lines 59 to 128 and 133 to 177.
3. UNESTABLISHED for DONE: exact-head local proof passes, but Verify skips its tests after the permitted generated-view failure in run 42210077655.
4. PASS locally: all 17 journeys and structural checks were rerun on the pushed full SHA.
5. NO NEW INHERITANCE CLAIM: acceptance sentences and inherited duties are unchanged; broader authority and privacy obligations remain named in the Gap.
6. PARTIAL metadata is truthful. Generation and its check pass before the mandated view restore. Historical Judged from provenance remains unchanged, without a DONE claim.
7. PASS: no acceptance rewrite or ruling change; every parent Status row remains.
8. PASS for existing native operator authority: allowed native saves and reads, unauthorized and revoked refusals, independent restore authority and erasure custody are exercised in the two journeys.
9. PASS boundary: no live provider, legal, commercial or external installation guarantee is claimed; their gaps remain.
10. NO NEW POLICY: current native operator admission is reused. Finer ROLE-001 restrictions remain open; there is no new delegation grant.
11. PENDING LANDER: branch custody is confirmed; main equality, candidate Run site and COMPLETE publication scan are not claimed.

Pre-handoff self-check: selected behaviours have public-door assertions; no existing assertion is weakened; revoked authority, erased-operator targeting and stale replay are exercised; no screen changes require visual proof; the source lock is fresh. Exact-head CI has only the documented generated-view exception. The fleet must generate the views, scan and enforce its landing checks before landing or counting this partial progress.

The complete actual non-secret packet is published separately on evidence/sd-penny-c-f106. It is report transport only and does not itself establish READY, acceptance or landing. Product source contains only the requested implementation, additive migration, tests, contract status and gap, changelog and generated source lock.
