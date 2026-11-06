# sd-penny-c-f88 report

Repository: just-every/run-penny
Branch: cloud/sd-penny-c-f88

## Scope and plan

ROLE-004 remains PARTIAL. Close acceptance point 1 only for native API reading and bounded exports of existing audit metadata, and point 2 only for that projection. Preserve all other acceptance text, every existing hold and operator-erasure and agent policy.

1. Read native audit projection, current session authority, contract and existing public-door proof.
2. Add metadata-only Owner and Admin reads, exact actor, action, subject and date filters, bounded stable continuation, CSV and JSON exports.
3. Exercise existing native privileged actions by distinct operators and a real signed agent effect; reconcile actual event identity and order across filters and exports. Check CSV quoting, spreadsheet safety and private-marker exclusion. Refuse members, requesters, anonymous and revoked sessions with event custody unchanged.
4. Run touched Worker journey, typecheck, first-party structural check and mechanical source checks. Generate contract views and check them locally, restore main views, stage and regenerate source lock last.
5. Preserve every Status row, use fleet identity and hooks, merge current main after any published save, push only the named product branch, inspect exact-SHA CI via REST, and publish the separate report packet.

## Baseline

79 done, 124 partial, 78 missing. ROLE-004 partial to partial; no acceptance or status count change. Existing audit evidence was the board journey. Native filtered audit reads and exports had no route or passing assertion. Audit UI, completeness for all actions (including unbuilt content-edit and removal flows), privacy outside the projection and audit UI erasure readback remain outside this selected slice. Provider, device, account, Base, cross-seed, ct, uip, payment and release holds remain unchanged.

## Implementation

Three native GET routes read the existing agent projection without widening its tool. Role and session guards are rechecked in each read transaction. Exact filters and inclusive UTC-normalized date bounds apply identically to all formats. Descending event time and event id determine order; continuation preserves an append high-water mark, excluding later backdated events. Exports have explicit continuation and bounded page size. Private details and person or credential tables are never loaded. CSV escapes multiline cells and quotes and prefixes spreadsheet formulas. Responses are private and uncached. No migration, configuration or browser change.

## Validation

Candidate: `7c6fe309489271b0c5a177a8a28892797ddb4a15`. Base: `8d4b0ac3eebe3e50003b61820f9c366282986327`. Product push succeeded on attempt 1. No PR is required; the push starts Verify. `RECEIPT.json` records the actual checks and their outcomes, with actual terminal logs alongside it.

Build, typecheck, first-party structural check, touched-file lint and source lock freshness all passed. The touched Worker suite passed all 7 tests on the exact committed candidate (19.48 seconds). Both generator commands passed with local generated views; ACCEPTANCE.md and docs/CLAIMS.md were restored from main before committing. The unchanged source lock passes on the committed candidate. No migration was added.

Exact-SHA Verify `42182510736` completed with failure. The plan job passed; all 29 shard failures name only `Check generated contract documents`. The exact committed check reproduces only `ACCEPTANCE.md: generated content differs; run contract-docs write.` This is the explicit generated-view exception and no repair or rerun was attempted. Actual API job receipts and the failed base shard log excerpt are included, excluding the workflow environment listing. Tests could not run inside that branch Verify because the expected freshness guard precedes them; the local candidate journey is passing. Do not describe CI as generally green. Main at the baseline had green Verify `42176843779` and Run site `42176843655`.

No new registration was added: the suite was already above its declared cap, so `tests/base/audit-read-export.ts` is a helper called unconditionally by the existing `tests/base/board.test.ts` audit journey, “catalog destruction, board withdrawal and configuration revocation commit durable actor audits or roll back”. Every earlier assertion remains in place. No pin test or duplicate was removed. The seven touched registrations are unchanged.

No browser proof is needed for this API-only slice; no screen, homepage, brand or shared Base module changed. No provider, account, device or deployment qualification is claimed. Complete publication scan, merged-view generation, main equality and exact-main Run site remain fleet duties. There is no product blocker within the selected POINTS.

## DONE riders

No DONE claim. Row 1 remains incomplete outside the selected API slice; row 3 exact-SHA Verify is reported separately. Rows 5 and 7: existing Base citations and all acceptance text are unchanged. Row 6: partial Gap preserves remaining work, and generated views are checked locally then restored for the lander. Rows 8 and 9: native authority and private projection are exercised; no provider boundary is claimed. Row 10: existing explicit Owner and Admin authority comes from ROLE-004, no new policy default. Row 11 is the independent lander duty; cloud does not publish, scan or land main.

## Public-door probes

PROBE ROLE-004 1: Native owner creates a request, a distinct current Admin moderates it, both save workspace settings, and a signed agent captures evidence; GET /api/operator/audit and both export routes reconcile exact event identities and descending time and id order across all filters and bounded pages. A later backdated append is excluded from the established continuation; a fresh read can include it. Empty filters and empty matches, tied times, normalized timezone offsets and invalid continuation inputs are exercised.
PROBE ROLE-004 2: Open nonempty JSON and parsed CSV downloads containing real agent attribution and seeded private detail markers; customer wording, commercial marker, credentials, email fields and details_json are absent. Quoted, comma-containing and multiline attribution round-trips; spreadsheet formulas are prefixed. Owner and Admin reads succeed; member, requester, anonymous, prior-role and signed-out sessions are refused without changing event custody.

## Pre-ready self-check

The supported behavior is exercised through emitted Worker routes and a real signed MCP effect. No old assertion was removed, narrowed or conditionalized. Current role and session checks are in the read transaction; revoked sessions cannot continue a captured cursor. Audit reads perform no data writes and retain no cursor payload containing erased person records. Existing operator erasure and replay fences are untouched; their broader certification is not claimed. There are no touched controls or screens. Source lock freshness passes. Added lines contain no email-shaped identities; existing unrelated fixture identities remain unchanged. Every parent Status row is retained. The cloud does not claim a publication scan or main landing.

## Plan return

Only the ROLE-004 selected row changes: PARTIAL to PARTIAL, with native API reads and exports and projection privacy now proven. Keep the audit UI, every-action completeness, general point-2 certification and other native and external remainders listed in the contract Gap. Keep the existing operator-erasure implementation and ROLE-001 custom-role work outside this slice. No other plan row or release requirement changes.
