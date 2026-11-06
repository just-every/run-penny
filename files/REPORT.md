# sd-penny-c-f98 report

SEG-006: missing → partial. The selected native slice of acceptance point 1 is implemented and proved. This is not a general segment completion or a DONE claim. Counts: 79 done, 124 partial, 78 missing → 79 done, 125 partial, 77 missing; 281 Status rows remain. Only SEG-006 and generated summary counts changed in the Status section. The plan row to update is SEG-006 with this bounded result; no lane files were changed.

Product branch: cloud/sd-penny-c-f98
Product head: 4381f49c0ca4fcb8358e44b7393fd7e3093c433f
Parent and fetched main: 0d6f3416c75fe29675323ad1a2ef4bd1f8086756
PR: none; branch push starts Verify directly.
Product push: first attempt succeeded; remote branch was independently read back at the exact head. No default branch or published history was changed. All candidate authors and committers use fleet identity; there are no co-author trailers. The checkout was clean after commit and push.

The complete implementation plan is in PLAN.md. All seven steps are complete. This packet contains the actual relevant local logs, first-party check results, source-lock output, CI discovery and failed-step metadata, with no credentials, private settings or environment dumps.

Implementation and public doors:

- POST /api/operator/segments accepts a strict name and rule: attribute internalOwnerId, operator equals, value a current product operator ID. GET at that collection lists saved definitions; GET of a saved ID returns its definition and exact accountIds. PATCH of the saved ID changes the definition. Other attributes and operators fail validation. The native current-operator and same-origin transaction guards are reused. The target owner is checked again within the business transaction. Save and audit are atomic.
- Membership joins the stored rule to current accounts in one read transaction. There is no membership cache, new account writer or polling delay. Native PATCH account reassignment causes exact entry and exit on the next read, while an unaffected member retains its identity.
- Migration 0110 adds the normalized product table and lookup indexes. Every prior table cell, including authority, survives a populated previous-head upgrade. The ledger adds only the new migration; repeat application is a no-op. Keep the additive schema on source rollback. No applied SQL, package pin, copied Base bytes or Verify workflow was changed.
- Archive inventory and validation include the new product records. The native export and import preserve rule, creator and account references without transferring operator sessions. Reviewed erasure of a removed operator deletes rules targeting that operator in the existing erasure transaction, creates opaque tombstones, anonymizes segment audit references and preserves unrelated rules, accounts and anonymous creator attribution. A stale archive and attempts to save a rule targeting the erased operator are refused.

Proof mapping through the emitted Worker:

- ./tests/base/segments.test.ts:43, “saved native owner rules follow exact current account membership and refuse unauthorized or invalid saves without public exposure”: populated upgrade and ledger no-op at lines 45–57; native create, list, definition edits and exact entry and exit with control at lines 59–74; atomic audit rollback, invalid rules and anonymous, requester, foreign-origin and revoked refusals with unchanged saved state at lines 75–115; populated public request list and detail exclusion at lines 116–123.
- ./tests/base/segments.test.ts:126, “native archives restore rules and membership while operator erasure removes targeted rules and fences replay”: native invitation and removal, source export, empty destination restore, exact membership and authority isolation at lines 127–148; targeted erasure, retained control and anonymous attribution at lines 149–160; erased-reference refusals, opaque tombstones and stale-archive no-resurrection at lines 161–172.
- Two new base registrations; no existing assertion was deleted, narrowed, skipped, moved behind a condition or replaced. Base registration listing: 189 → 191. No UI was added or touched, and the segment UI is explicitly omitted, so screen and browser-width proof do not apply to this round.
- The selected SEG-006 journeys passed again on the exact pushed head. Their total test execution was 5.93 seconds. Each native reassignment and membership read was also asserted below five minutes. This bounds the native current-record behavior; it does not qualify provider arrival or scheduled refresh timing.

PROBE SEG-006 point 1 native membership: POST saved owner rule, GET nonempty membership, PATCH account owner to match and then away -> exact changing account entry and exit; control identity retained; saved rule edit retained its ID and changed the selected owner.
PROBE SEG-006 validation and authority: invalid rule fields, missing operator, anonymous and requester reads and writes, foreign and absent write origins, signed-out session and removed operator -> 400, 422, 401 or 403 as applicable; saved definitions, accounts and segment audit records unchanged; refused reads expose no private segment values.
PROBE SEG-006 custody: native export, empty-target import, removed-operator erasure and stale-archive import -> exact restored rules and members; only targeted rule removed, unrelated rule and accounts retained; old source sessions refused; stale replay 409 stale_archive; erased operator rule saves 422.
PROBE SEG-006 bounded public exclusion: nonempty approved request list and detail with an account association -> public request present, segment identities and names and owner-rule attributes absent.
PROBE SEG-006 point 2: none, omitted by the selected POINTS scope; request, inbox and report filter agreement remains in the Gap.
PROBE SEG-006 full point 3: none, universal payload certification omitted; the two nonempty public-request projections above prove only the stated bounded exclusion.

Validation:

- Fresh clone setup and production build: exit 0.
- Touched segment, erasure and hosted-export journeys: 17 passing tests across 3 files, 49.91 seconds.
- Exact-head segment journeys: 2 passing tests, 7.40 seconds overall.
- Typecheck, touched lint and first-party profile: exit 0. First-party result contains 1,147 passing clause checks.
- Contract generator write and check: exit 0. Both generated views were restored whole from origin/main and were not committed. The candidate’s direct view check then reports exactly those stale views, as expected.
- Source lock regenerated last using the documented command; check exit 0 before commit and again before push. Native migration preflight exit 0, returning nativeApply true; populated migration ledger and repeat no-op assertions passed.
- All 281 parent Status IDs and 445 pipe rows retained; applied SQL and existing account admission unchanged. New added lines contain zero email-shaped literals; changed text was inspected for slash-token and credential hygiene. Cloud publication scan was not run: the fleet’s exact-head COMPLETE scan remains a landing duty.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, views restored whole from origin/main; ledger=scripts/portability/ledger.mjs native preflight plus populated-upgrade and no-op assertions exit=0.

The initial upgrade fixture incorrectly expected d1_migrations itself to remain unchanged and failed on the single newly applied migration. It now proves the old ledger prefix remains identical, exactly one new entry is added, repeated application changes nothing and every prior non-ledger cell is preserved. This was a new local fixture correction, not a Verify repair. No real product assertion or landing guard was weakened.

CI and landing:

- Candidate Verify Penny 42199428187, push event, exact head 4381f49c0ca4fcb8358e44b7393fd7e3093c433f: completed, failure. The plan job succeeded; all 29 failing shard jobs failed only “Check generated contract documents”. No shard ran its product assertions. This is the explicitly permitted generated-view-only exception, not a claim that the full candidate suite ran green. The native touched tests provide local product proof. The lander must regenerate the two views, run its exact-head Verify and publication scan and retain its normal landing gates.
- Existing-main Verify 42192912570 succeeded on 0d6f3416c75fe29675323ad1a2ef4bd1f8086756. A later Verify 42194484496 on that same SHA failed job 127814272471 on a 30-second page.waitForURL navigation timeout in reviewPrivateSearch at ./tests/browser/operator-completeness-read.mjs:70. Existing-main Run site 42194484854 failed job 127814206039 on Cloudflare provider-http-503, “no healthy upstream”. These are relayed as existing infrastructure and browser flake observations; no unrelated repair, workflow rerun or deployment was attempted.
- Seven GitHub calls used: main discovery, two failed-job metadata requests, one archive log read for each of the two failed jobs, candidate discovery and candidate failed-job metadata. One watcher; no short-interval polling, dispatch or rerun.

Remaining scope and holds:

Requester and wider account attributes, commercial and custom fields and ROLE-001 restrictions remain open. Provider-origin attributes and SEG-001, SEG-002 and SEG-005 arrival and refresh timing remain open. Request, inbox and report membership agreement, every-list and prioritization, roadmap, report and agent filters, segment UI and universal public-payload certification remain omitted. Retain all earlier ct, uip and payments holds and all provider, device, account, sibling, Base and release requirements. No CRM account or sibling installation, live provider qualification or general segment completion is inferred.

DONE-RIDERS were read. No DONE claim or judge request is made: acceptance outcomes 2 and full 3 are intentionally incomplete, and landing proof remains the fleet’s duty. The selected native security and erasure paths were exercised both ways, records were populated, no current authority was restored, and replay could not resurrect an erased rule. No new policy ruling was needed to reuse the existing account operator admission. The native default is not a release of ROLE-001 or provider boundaries.

No product blocker remains for this bounded partial candidate. Independent publication scanning, regenerated views, final exact-head Verify and Run site remain fleet landing duties. The clone is to be deleted only after product and evidence custody are verified.
