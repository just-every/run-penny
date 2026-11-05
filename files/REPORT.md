# sd-penny-c-f46 results

REL-004 remains PARTIAL to PARTIAL. The selected native request snapshot work is closed; the clause is not claimed DONE. Counts stay 79 done, 124 partial and 78 missing. No acceptance sentence changed.

Product repository: https://github.com/just-every/run-penny
Branch: cloud/sd-penny-c-f46
Candidate: b9760c756087e2666fd708a7f0f62398bbbf48ae
Branch Verify: 42114655305, push event, exact candidate SHA, completed failure only at generated-view freshness. All 29 failed shards stopped at Check generated contract documents; their source-lock checks passed. Job 127551038898 reports "ACCEPTANCE.md: generated content differs; run contract-docs write." No CI test command ran after that step. This is the explicitly permitted generated-view exception, not a claim that CI tests were green. CI discovery, all job steps and the sanitized representative log are in the packet. Four GitHub calls were used; no dispatch, rerun or repair was made. No PR was needed: the branch push starts Verify.

## Work and provenance

The fresh full-history clone began at main fab3d0e52aae1c7ed640dbdc38791027416e40d3. The required predecessor b1d4a1f4747fbaf14652b34b5f356acaca6fd9f6 was not an ancestor of main when inspected. Both of its published commits are retained as the second ancestry of the candidate, without rewriting them; current main is the first parent. A fresh main fetch immediately before the first push required no further integration. No other writer's work was dropped. The candidate's three commits beyond origin main have fleet author and committer identities and no trailers.

The predecessor already implemented exact snapshot comparison, native request merge with subscriber notification disabled, roadmap withdrawal and reapproval, and a global-unsubscribe delivery refusal. This round preserves it and extends the existing release journey with the missing isolated mail-edge outcomes. Native global mute and updates unsubscribe are each tested while live request, follow, roadmap publication and mapping rows remain unchanged. One unaffected recipient gets the actual HTTP-edge mail envelope with the expected delivery identity. The withdrawn recipient has a suppressed delivery and suppressed attempt with no recipient email or provider message identity. Later opting back in and repeated emitted-Worker scheduler calls neither replay delivery nor change a sealed snapshot.

No runtime, migration, version, Base pin, workflow or configuration bytes changed. No UI, homepage, logo or visual work was done. The retained source-lock file was regenerated after staging all intentional inputs. Generated acceptance and claims views are byte-identical to main and are not committed by this round.

## Proof map and runtime probes

The existing registered journey at ./tests/base/penny-releases.test.ts:126 is the proof entry point: "request mute retains update subscription and global unsubscribe withdraws permission while preserving votes, follows and release snapshots through request merge and roadmap relink". It invokes the helpers below. Registration count is unchanged; no assertion was removed, narrowed, skipped or moved behind a condition. All 150 assertion lines from main and all 152 from the predecessor remain. No duplicate or pin test was introduced or deleted.

R1 — Publish and capture exact native target, recipient and request context records. ./tests/base/release-snapshot-stability.ts:21 checks complete target records, exactly two unique recipients and their address verification epochs, and complete request contexts, then compares all three nonempty tables after each change. ./tests/base/penny-releases.test.ts:138 publishes through the native release API.

R2 — Merge a mapped request without subscriber notification. ./tests/base/release-snapshot-stability.ts:54 submits and approves a distinct canonical request, calls the native merge route with notifySubscribers false, verifies the canonical identity and root, and requires an unchanged outbox and all original snapshots.

R3 — Withdraw the original mapping and approve a request onto another roadmap item. ./tests/base/release-snapshot-stability.ts:71 checks native context readback, the withdrawal timestamps of every mapping, the replacement item's title, request identity, approval time and active state, and exact original snapshots after each action.

R4 — Change native recipient preferences without changing snapshots. ./tests/base/release-preference-stability.ts:15 exercises global mute and updates subscription in two isolated runs of the same journey. It publishes each fixture through the native API, checks before and after preference readback and exact snapshot equality, and retains all live request and mapping rows.

R5 — Preference withdrawal prevents pending delivery without replay. ./tests/base/release-preference-stability.ts:44 invokes the emitted Worker's scheduled entry point. Lines 48 through 58 bind the sole HTTP-edge envelope to the control's durable delivery and address, while the withdrawn recipient is durably suppressed without provider acceptance. Lines 61 through 75 restore the preference and prove two more scheduler calls cannot replay or alter any delivery, attempt, live source or snapshot.

PROBE REL-004 native snapshot: POST /api/operator/releases/:slug/publish with a synthetic fixture containing two mapped requests and two recipients -> exact nonempty release_target_snapshots, release_recipient_snapshots and release_recipient_contexts captured and retained.
PROBE REL-004 request merge: POST /api/operator/requests/:slug/merge with notifySubscribers false -> canonical request and root changed, outbox and original snapshots unchanged.
PROBE REL-004 roadmap relink: POST /api/operator/roadmap/release-item/withdraw followed by POST /api/operator/roadmap/snapshot-replacement/approve -> native readback shows withdrawn original mappings and active replacement mapping; original snapshots unchanged.
PROBE REL-004 preferences: PATCH /api/public/requester/notifications with muted true and PATCH /api/public/updates/subscription with subscribed false in isolated eligible releases -> matching native readback; all original snapshots unchanged.
PROBE REL-004 pending delivery: emitted Worker scheduled entry after each withdrawal -> one control mail accepted, withdrawn delivery suppressed with recipient_no_longer_eligible and no provider message; opting back in plus repeated schedule -> no replay, unchanged deliveries, attempts and snapshots.

## Validation and mechanics

The actual terminal outputs and machine-readable receipt accompany this report. The first affected-flow run passed all ten tests in the release and custody files. The second run on the committed candidate with repository-pinned Node 22.20.0 passed all ten tests in both files in 64.29 seconds; TOUCHED-TESTS.txt and RECEIPT.json contain the actual result. Typecheck, first-party admission, touched-file lint, source lock and retained Base source custody were checked. The build completed during the required clean-clone setup. No full local suite was run.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then node scripts/edition-authoring/cli.mjs check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, restored with git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md; ledger=none exit=0.

Every Status row from both merge parents was retained: 332 row identities and 445 table lines in each parent and candidate. The source lock's hashes for all five changed source, test and documentation inputs match their actual bytes. The generated views remain intentionally stale against the new Evidence text; the Mac lander owns their regeneration. An exact-SHA failure only at generated-view freshness is expected under this task's explicit exception.

## Remaining scope and riders

The full clause remains partial because evidence-linked captured-contact snapshot completeness and the complete release.recipient-eligibility.v1 permission-source policy are excluded from POINTS. MIG-007 carry-over, voting without subscription, operator-entered addresses and NOTIFY-009's one-snapshot captured-contact addition without permission remain named in the Gap. Existing provider, device, account, Base, payments and cross-seed holds are unchanged. This round adopts no new policy default and needs no scope ruling. No unrelated next clause was started.

DONE-RIDERS assessment, without a DONE claim:

1. PARTIAL for the whole clause: native outcomes R1 through R5 are exercised; captured-contact contexts and point 2 still lack complete proof. The Gap retains them.
2. PASS for the changed dangerous path: seeded eligible releases have both accepted control deliveries and suppressed withdrawn deliveries; the latter change no snapshot or live source and never replay.
3. PERMITTED EXCEPTION for this branch handoff: Verify 42114655305 failed only on the intentionally stale generated view, so CI test commands were skipped. The existing test glob loads the journey without an environment flag. The exact-SHA local ten-test run passed. The guarded lander must regenerate views and obtain green Verify before landing; no DONE claim is made.
4. PASS locally: the committed candidate was rerun with the pinned Node; receipt records its exact head. No relevant byte changed afterward.
5. UNCHANGED: the clause's existing requirement and inherited baseline duties are retained; no inherited duty is claimed newly complete.
6. PASS for honest partial metadata and generator write then check. No DONE Gap or candidate provenance claim was fabricated. Main's generated views are restored for the lander.
7. PASS: acceptance sentences are unchanged; all parent Status row identities remain. No rewrite or split was made.
8. PASS for this permission withdrawal path: current preferences suppress pending delivery and the active control is served; existing authentication and in-flight authority fences are preserved.
9. PASS for honest boundaries: no provider delivery, live domain qualification, legal, device or incumbent qualification is claimed from an HTTP-edge fixture.
10. NOT APPLICABLE: no new custody, consent, spending or authority default was adopted.
11. PENDING guarded lander: main equality, publication scan COMPLETE with zero new findings, exact landing Verify and Run site are not claimed by the cloud builder.

Pre-ready checks: the changed native behavior is covered through ordinary routes and the emitted Worker scheduler; all prior assertions remain; identity-merge fences, export, restore and erasure assertions passed in the touched custody journeys. No screen was touched. New test source has no literal email address or provider-shaped key, and changed prose introduces no ambiguous bare repository tokens. A cloud-side publication scan was not run; it remains the maintained lander's exact-tree full-history duty. Run site is likewise a main-only landing duty. No known runtime failure is being handed off.

Plan row changed: REL-004 only, retaining PARTIAL while closing the selected native request snapshot and pending-delivery proof. All earlier holds and release requirements remain. The full work plan is PLAN.md.

Product remote readback verified the exact named branch and candidate SHA. The product checkout was clean before evidence publication. There are no known runtime blockers. The publication scan, regenerated-view commit, complete Verify and main-only Run site remain guarded landing duties.
