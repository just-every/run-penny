# sd-penny-c-f79 results

Repository: https://github.com/just-every/run-penny
Product branch: cloud/sd-penny-c-f79
Candidate: c538718ba72fb8ef341c76a1f8f5f4cef9cd0e01
Parent main: e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f

REL-016 remains PARTIAL to PARTIAL. Acceptance point 1 now has native RSS and Atom read routes and offline XML and feed-structure validation. Acceptance text is unchanged. Counts remain 79 done, 124 partial, 78 missing, 281 total; all 281 Status rows and all 445 table rows were retained.

## Plan executed

1. Read the supplied campaign extract, current REL-016 requirement, acceptance and Gap, DONE-RIDERS and current ruling index. The only supplied Penny ruling concerns TRIAGE-005 and does not change this clause. Keep the selected feed slice and every earlier hold.
2. Reuse the current-public release projection, including its published state, current-version selection and date-descending then slug-ascending order. Add a feed-specific modification timestamp without changing native JSON release fields.
3. Expose RSS 2.0 and Atom through the existing declared public release prefix. Use configured canonical origins, stable canonical release identities, publication dates and correction timestamps. Encode Markdown as text and prevent cached pre-correction content.
4. Add one built-Worker release journey covering empty, draft, scheduled, populated, ordered and corrected releases; independently validate XML and the required feed structure; reconcile entry identities, links, dates and wording with populated native list and detail reads; exclude private fields, recipient identity and superseded wording.
5. Preserve the existing approved-public-phrase erasure assertions in that same populated journey, then read both feeds again after erasure. Replace that isolated duplicate fixture registration, with no net registration increase. All remaining release-custody tests and their unsafe private-copy refusal remain active.
6. Run touched release checks, typecheck, lint, first-party structural validation and Base-copy verification. Generate and check contract views, restore them whole from main, stage intentional inputs, regenerate the source lock last and check it. Commit with the fleet identity, fetch main and perform the required unpublished rebase check, inspect all candidate identities and trailers, then push only the named branch using the fleet guard.
7. Rebuild and rerun the touched journeys on the committed candidate. Read exact-SHA branch Verify through the bounded REST watcher, preserve actual non-secret receipts and publish this separate report packet. The Mac lander owns publication scanning, generated-view landing, main and Run site.

## Product and proof

RSS: GET /api/public/releases/rss.xml
Atom: GET /api/public/releases/atom.xml
Native reconciliation: GET /api/public/releases and GET /api/public/releases/:slug
Publication and correction: authenticated native release create, edit, publish, schedule and correction routes, with existing native release fixtures. All storage is local test D1; fakes are confined to the existing mail HTTP edge. No hosted publication or customer send occurred.

Journey: tests/base/release-feeds.test.ts, “RSS and Atom reconcile current published wording across correction and requester erasure”. The journey opens both actual Worker responses with fast-xml-parser, validates XML offline, checks RSS and Atom required fields and reconciles each current release. It checks empty feeds, unpublished draft and future-scheduled exclusion, three published entries with deterministic date and slug ordering, literal XML-sensitive Markdown and Unicode, stable identity after native correction, updated Atom timestamp, absent old wording, absent distinct private markers and recipient identifiers, unchanged delivery custody on feed reads and correction, and retained approved public wording after requester erasure.

Preserved regression: the former “approved public phrase survives requester erasure” fixture in tests/base/release-custody.test.ts is consolidated into the new journey. Its empty blocked-copy set, successful erasure and unchanged release-version snapshot assertions remain. The new journey also proves the feeds remain byte-identical after erasure. No assertion was weakened or moved behind a width or branch condition. All other tests are retained. No test-budget exception is claimed; the run adds one registration and removes its replaced registration.

Local touched tests: 4 files, 12 tests passed before push. Final exact-candidate receipts are in TEST-RECEIPT.json and the selected logs. Typecheck and touched lint passed. First-party check returned ok=true, exitCode=0 for 1142 structural checks. Base-copy verification passed offline against recorded bytes.

The first local build exposed an optional-origin TypeScript error, corrected before commit. The first XML parser could not load under the Worker ESM runtime; it was replaced with an ESM parser before commit. The final dependency is fast-xml-parser 5.12.0, used only by tests. These were local iteration failures, not CI repair rounds.

## Remaining scope and holds

Acceptance point 2 remains open: segment-targeted email must prove exactly the consent and SEG-006 membership intersection. WIDGET-003 distribution remains unmet. Live mail and provider qualification, device and account requirements, cross-seed and Base prerequisites, and existing ct, uip and payments holds and release requirements are retained. Feed implementation alone does not complete REL-016. No policy ruling, homepage, logo, visual or polish change was introduced. No UI screen changed, so viewport browser proof is inapplicable to this read-route slice.

Plan row proposed for the sd campaign: REL-016 point 1 proved; keep REL-016 PARTIAL and retain point 2, SEG-006, WIDGET-003 and all external qualification and release remainders. No plan was rebuilt or written into the product branch.

## Gate and custody

DONE is not claimed, and no ct DONE judge request is made. Rider 1 is met locally for the selected feed point only; point 2 remains unproved. Rider 2 uses nonempty native data and excludes unsafe private content. Rider 3: exact-SHA branch Verify completed with only the permitted generated-view freshness failure; the lander must regenerate the views and run Verify on its landing candidate. The touched journeys passed locally on this exact source candidate; no CI journey success is claimed. Rider 4 is bound by the final candidate receipts. Rider 5 adds no inherited duty claim. Rider 6 keeps the remaining Gap and regenerates and checks views locally before restoring them. Rider 7 preserves acceptance text. Rider 8 introduces no weaker mutation permission. Rider 9 retains provider boundaries. Rider 10 introduces no policy default. Rider 11 remains the guarded lander's duty, including exact-main equality, Run site and the complete full-history publication scan.

Main Verify: 42153984585, push, success on e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f.
Main Run site: 42153984645, push, success on e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f.
Existing nightly: 42156564353, schedule, failure on e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f; this is not a red main Verify or Run site.
Candidate Verify: 42171795269, push, exact head c538718ba72fb8ef341c76a1f8f5f4cef9cd0e01; current receipt is in CI-RECEIPT.json.
PR: none required; branch push starts Verify.
Publication scan: not run in this cloud; full-history COMPLETE scan with zero findings remains a lander gate, not a claim made by this packet.
Product push: succeeded on attempt 1. No default branch, force push, deployment or release tag was written.

## Final CI observation

Verify 42171795269 completed with conclusion failure on the exact candidate. All 29 failed shard jobs failed only “Check generated contract documents”; the plan job succeeded, and there were no other failed steps. This is the explicitly permitted generated-view exception: the product commit intentionally restores ACCEPTANCE.md and docs/CLAIMS.md from main after successful local generation and check. No view was committed, no workflow was changed, and no Verify was rerun. CI-JOBS.json contains every job and failed step. CI-FAILURE.log contains the selected failed-job command and actual error output, with workflow environment metadata omitted. The underlying journey commands were skipped behind that freshness step, so the 12 passing local exact-source tests are not described as green CI journeys. The maintained lander must generate the views and obtain its own exact-SHA Verify.

Pre-handoff self-check: every selected feed outcome is asserted through actual Worker HTTP responses with nonempty published fixtures; the replaced erasure assertions remain effective; no existing assertion was narrowed or made conditional; only approved current-public data is serialized, and requester erasure leaves no recipient identity in the feeds; no screen was touched. Source lock and local generation checks pass, the product push is verified and the checkout is clean. Full-history publication scanning and exact-main Run site remain lander duties. No real product blocker was identified.
