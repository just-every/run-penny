# sd-penny-c-f109 results

Repository: just-every/run-penny. Branch: cloud/sd-penny-c-f109.
Candidate: c73d2c585fbc28799e6f3fb7c282577046cc79d4.
Parent and integrated main: bd98ed565d1dd6fdebea3df93f7e8fca5cd283ca.
Product push succeeded on attempt 1. No PR was needed: push starts Verify Penny.

INT-005 remains PARTIAL → PARTIAL. Counts remain 79 done, 124 partial and 78 missing. All 281 Status rows and all 445 table rows were retained. Acceptance text, other clause judgments, existing provider-account holds, ct rulings and release requirements are unchanged. The plan row to update is INT-005: the selected acceptance-point-2 known-issue reconciliation admission is proved; no whole-clause DONE claim is made. DELIV-002, DELIV-003, DELIV-006, DELIV-008 and sibling-provider work remain outside this selected guard. Full provider qualification and the remaining INT-005 proof remain open.

## Reproduction and change

Before editing production code, `reproduce-queued.mjs` ran against the emitted Worker from the parent. A native deliberate create produced a queued delivery. Posting a supplied known issue to its reconciliation route returned 200 and inserted a link while leaving the delivery queued. The next real scheduled event sent one create and accepted that same delivery. `reproduction.log` records:

```
REPRODUCED {"before":{"status":200,"delivery":"queued","linked":true,"creates":0},"after":{"delivery":"accepted","creates":1}}
```

The production change is limited to `src/core/features/integrations/tracker-service.ts:35`: inspect the matching namespaced delivery before reconciliation and recheck the command identity, subject, connection, current link and uncertain state inside the existing guarded D1 transaction. The transaction inserts the link, sets command linkage, writes one accepted operator-known-issue resolution and accepts the delivery atomically. An accepted replay returns only the identical original link with an existing accepted known-issue resolution. Ordinary link admission and the scheduler remain unchanged.

The guarded transaction retains current native session, connection-owner version and idle-data-operation authority. A vanished subject fails the existing subject check and dependent writes; this change creates no restored authority, outbound replay or public projection. No Base byte, migration, workflow, homepage, logo or visual component changed. No installation or provider setup is required. Rollback requires restoring the source; no schema rollback applies.

## Runtime and browser proof

The existing `checkTrackerActions` journey in `tests/browser/integration-tracker-actions.mjs`, invoked by `tests/browser/integration-states.mjs`, retains Linear and Jira plus request and decision coverage. No test registration was added, removed, skipped or narrowed; no existing protected assertion was weakened. The extension stays within the existing test budget. Fakes are confined to the tracker HTTP edge; native routes, D1, Worker lifecycles and scheduled events execute normally. One deliberate D1 abort proves late-write rollback.

| Selected outcome | Public door and assertion |
| --- | --- |
| Ordinary entered-only create and explicit link remain intact | Native mounted controls at lines 31–50; exact subject and known-link readback at lines 35–40; complete outbound body and privacy checks in `tests/browser/integration-tracker-edge.mjs:18`. |
| Queued reconciliation refuses and changes nothing | Native reconcile route, complete link, command, delivery, attempt and resolution snapshots at lines 13–25 and 54. |
| Sending reconciliation refuses and changes nothing | Real scheduled send paused only at its provider HTTP response, native reconcile and readback at lines 55–59. |
| Rejected reconciliation refuses and changes nothing | Native create, HTTP 400 provider outcome, scheduler, reconcile and complete snapshots at lines 91–100. |
| Failed reconciliation rolls everything back | An abort on the final delivery update yields 503 and unchanged complete custody at lines 69–73. |
| Uncertain reconciliation succeeds once | Native mounted known-issue form, accepted delivery and one resolution at lines 74–85. |
| Identical replay preserves its original link and history | Native reconcile replay and complete unchanged snapshots at lines 78–80. A changed known issue is refused at lines 81–82. |
| Restart and drains never create again for the reconciled command | Real `runtime.restart()` and repeated `runtime.schedule()` at lines 83–85 and 97–100, checked against HTTP-edge create calls. |

The full touched journey passed with `/usr/bin/chromium` and `--no-sandbox`: 46 captures at 1440 and 390, 28 synthetic HTTP-edge calls, 48 native runtime restarts, zero unexpected browser errors, zero browser external requests and fulfilled teardown. The existing journey also checks serious and critical axe violations, horizontal overflow and masked settings secrets. Twenty-four relevant tracker captures are included under `screens`. The tracker forms exercised have labelled text controls; this change adds no icon-only control or configuration surface.

The full journey ran immediately before committing; `local-receipt.json` binds its three relevant file hashes to the exact candidate and confirms byte equality. A second focused native probe ran on the committed candidate and reported:

```
PROBE INT-005 point-2 queued: native reconcile -> 409; complete tracker custody unchanged
PROBE INT-005 point-2 sending: native reconcile -> 409; complete tracker custody unchanged
PROBE INT-005 point-2 uncertain: native known-issue reconciliation -> accepted; identical replay retains original link and one resolution; real restart and two scheduler drains add zero creates
PROBE INT-005 point-2 rejected: native reconcile -> 409; complete tracker custody unchanged
```

No provider installation, live qualification, status mapping, health presentation, resync or demand refresh was attempted or claimed.

## Mechanical checks

- Fleet launcher setup and the requested frozen repository setup: exit 0.
- `npx -y @runeditrun/rer build`, through `cloud_run`: exit 0.
- `pnpm run typecheck`: exit 0.
- Touched-file `pnpm exec oxlint`: exit 0.
- `npx -y @runeditrun/rer check --profile first-party --json`: exit 0, all 1,148 reported checks pass, including Status Evidence paths.
- `pnpm run verify:base-source`: exit 0; retained copied bytes match their custody record. No Base refresh was performed.
- `node src/base/contract-docs.mjs write`, then `check`: both exit 0. Both generated views were restored whole from origin/main before the commit. Exact-candidate `check` then reports only `ACCEPTANCE.md: generated content differs; run contract-docs write.` This is the instructed lander-owned generated-view exception.
- `node scripts/edition-authoring/cli.mjs lock`, then `check`: both exit 0. Lock generation followed the final intentional source, test and documentation edits and restored views. The check was repeated after the final fetch and rebase and passed.
- No migration changed, so the migration-ledger check is not applicable.
- The final fetch found main unchanged; rebase reported up to date. No published history was rewritten.
- `git diff --check`: exit 0. The complete staged result retained every parent Status row. Added content contained no email-shaped string or injected credential value. Commit author and committer are the fleet identity; no co-author trailer exists. All candidate messages and trailers were inspected before the guarded push.

```
MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check, then restore origin/main views exit=0; ledger=none exit=0
```

## DONE-RIDERS review

This is a partial progress candidate; no DONE flip or judge request is made. The rows below distinguish selected local proof from gates or wider proof still owned elsewhere.

| Row | Assessment | Evidence or retained boundary |
| --- | --- | --- |
| 1 | PASS for selected guard; whole-clause proof remains partial | Native public-door sanity journey and committed probe cover each selected outcome, as listed above. |
| 2 | PASS | Populated custody snapshots; supported uncertain case succeeds and queued, sending, rejected and conflicting replays refuse unchanged. |
| 3 | Local proof PASS; exact-SHA Verify recorded separately | Existing push `workspace-clock` shard invokes the unchanged journey entry point. See the final CI observation below; generated views can stop that shard before assertions. |
| 4 | PASS | Exact-candidate native probe; relevant production and journey file hashes equal the committed bytes in the local receipt. |
| 5 | UNCHANGED | No new inherited duty is claimed or acceptance text edited. |
| 6 | PASS for honest partial bookkeeping | INT-005 Evidence and Gap updated without promotion. Generator write and check pass; views intentionally restored for the lander. Original global judgments retained. |
| 7 | PASS | Acceptance sentences untouched; all parent Status rows retained. |
| 8 | PASS for selected wrong-state admission | Native state refusals and unchanged custody; existing authority guard retained in the write transaction. No new permission policy. |
| 9 | PASS boundary | Only synthetic HTTP-edge provider proof is claimed; live provider qualification and account holds stay open. |
| 10 | NOT APPLICABLE | No new policy default or ct decision is needed. |
| 11 | PENDING FLEET LANDER | Candidate is branch-only. Main equality, full-history COMPLETE publication scan with zero findings, fresh landed Verify and Run site are fleet gates, not claimed here. |

## Pre-ready self-check

Selected visible behavior is exercised through native routes and mounted controls; the baseline public-door reproduction establishes that the unsafe queued behavior was real. Existing assertions are preserved. Current native authority and subject checks stay in place; replay adds no link, history or outbound create. Browser proof retains the existing desktop and phone checks without changing visual code. The edition source lock is fresh. No cloud-side publication scan or landing is claimed. No real test failure is known from local proof. Exact-SHA CI status is reported below, and a generated-view-only failure is handled only under the task's explicit exception.

Main at task start was green: Verify Penny run 42212896481 and Run site run 42212896395, both completed successfully on bd98ed565d1dd6fdebea3df93f7e8fca5cd283ca. These are context only and are not candidate green evidence.

The complete plan is in `PLAN.md`, actual test and probe receipts in `local-receipt.json`, `browser-results.json`, `journey.log` and `probe.log`. Product provenance and report-only evidence publication are separate. All report files and screenshots are explicitly selected; credentials, private settings, environment dumps and symlinks are excluded.

## Final exact-SHA CI observation and handoff

Verify Penny run **42217914659**, event **push**, completed **failure** on **c73d2c585fbc28799e6f3fb7c282577046cc79d4**. The plan job succeeded; all 29 failed shard jobs have exactly one failed step, **Check generated contract documents**. This is the generated-view-only exception explicitly allowed by the cloud assignment, rather than a green assertion run. Source freshness passed before that step; the later assertion commands did not run.

The relevant workspace-clock job is **127892519348**. Its failed-step archive was requested once with `gh run view 42217914659 --repo just-every/run-penny --job 127892519348 --log-failed`; its actual result is retained in the packet. The local exact-candidate generator check reports the same sole ACCEPTANCE freshness discrepancy. No repair, rerun, dispatch or workflow edit was made. API budget: five calls total, with candidate discovery and the sole status poll at least 300 seconds apart. The other failed jobs need no assertion repair because their only failure is the same generated-document step recorded in `candidate-ci-jobs.json`.

READY uses only that explicit generated-view exception. The candidate is not landed. The fleet must generate the views, re-lock if required, obtain exact-SHA green Verify and perform its complete full-history publication scan and guarded landing, then confirm Run site. Product state remains INT-005 partial; counts stay 79 done, 124 partial, 78 missing. No real product blocker was found for the selected point.

POST lanes/sd/INBOX.md: sd-penny-c-f109 INT-005 PARTIAL -> PARTIAL; selected point-2 reconciliation admission closed: queued, sending and rejected refusals unchanged, atomic uncertain resolution, original-link replay and restart no-create proved; counts 79 DONE, 124 PARTIAL, 78 MISSING unchanged; branch cloud/sd-penny-c-f109 SHA c73d2c585fbc28799e6f3fb7c282577046cc79d4 Verify run 42217914659 job 127892519348 failed only expected generated ACCEPTANCE freshness; no DONE claim; retained provider and sibling holds, scan and landing remain fleet duties.
