# sd-penny-c-f95-rb2 replay report

Repository: just-every/run-penny
Product branch: cloud/sd-penny-c-f95-rb2
Product head: fd9d46a022b2e9818cfa491096b61defb4797134
Fresh main base: 4eb55215274ec4f91e365c7ab1e85713ed626f57
Original candidate: 56d7cabddb344e8286aef98217c2da4dd5782f7b (fetched branch head matched exactly).
PR: none; repository instructions name the fleet landing path and impose no PR requirement for this replay.

## Plan and execution

The complete plan is in PLAN.md. The disposable full-history clone used `git clone --filter=blob:none` without depth. The named branch started at the original candidate. Its two original commits were squashed while rebasing onto fresh origin/main, leaving one fresh replay commit with no skip-CI marker. All commands creating commits explicitly supplied the fleet author and committer environment. Clone-local cleanup hooks preserved repository hooks throughout.

CONTRACT.md auto-merged only the leased A11Y-001 row at both replay stages. The row equals the original candidate's final row byte-for-byte. Conflicts in the changelog and keyboard tests were resolved by taking main's versions, preserving its stronger voter-identity and signed-in audit assertions and its cross-platform keyboard selection. No product behavior, tests, assertions, ID-MAP, other clause rows or unrelated prose changed. Source-lock conflicts were regenerated rather than hand-resolved.

Final product diff: CONTRACT.md (one evidence/gap row) and sources.lock.json (its CONTRACT.md SHA-256 entry). No evidence, generated views, setup state, migration or configuration files were committed. No status promotion, hold release, deployment or landing is claimed.

## Clause accounting

Before and after: 281 clause status rows; 79 done, 124 partial, 78 missing. Published: 59 done, 56 partial, 1 missing (116). Target and push further: 20 done, 68 partial, 77 missing (165). All statuses and all other status rows are unchanged; contract-receipt.json records the comparison.

A11Y-001 remains partial. Its evidence now names `tests/browser/keyboard-journey.mjs` and `proveKeyboardJourney`, covering native keyboard submission, vote and evidence triage at both widths. Every-page axe, widget keyboard and broader Base accessibility proof remain unproved. R-1 VPAT and R-2 human screen-reader review remain held, with all other holds intact.

## Mechanical checks

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; views=node src/base/contract-docs.mjs write && node src/base/contract-docs.mjs check exit=0

Both rebase conflict stages ran write/check, restored origin/main's ACCEPTANCE.md and docs/CLAIMS.md, then staged intended inputs and regenerated/check-validated the lock before continuing. The final source check also passed after dependency setup. The generator accepts no touched-clause arguments in this repository. After restoring main's generated views, its check predictably exits 1 solely with `ACCEPTANCE.md: generated content differs; run contract-docs write.` That is the brief's explicit generated-view exemption; generated views remain for the Mac lander.

## Local probes

- `cloud_run timeout 900 npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive`: exit 0; frozen dependencies and emitted local application setup succeeded.
- `cloud_run timeout 240 pnpm run typecheck`: exit 0.
- `cloud_run timeout 240 pnpm run verify:base-source`: exit 0.
- `PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium PENNY_EVIDENCE=<packet>/requester-board cloud_run timeout 600 pnpm run test:browser`: exit 0. This is the original candidate's changed requester-board entrypoint, including proveKeyboardJourney and keyboardControls. Main's newer assertions remained intact.

PROBE replay: native mounted portal and operator forms; sequential Tab, typed text, keyboard select and Enter/Space at 1440 and 390 pixels -> held submission remains private; a separate approved request gains the same native voter identity; evidence link and reasoned review persist after reload; exact signed-in operator and distinct audit identities persist; zero pointer events and zero programmatic focus calls in each measured flow. Actual keyboard-receipt.json binds 26 total captures and two width-specific keyboard checks to the clean product SHA; no page errors were recorded. The initial requester flow also wrote manifest.json.

The supplied cloud toolchain retained the VM's newer Node v24.19.0 and used pinned pnpm 10.12.4. Browser probes used /usr/bin/chromium with --no-sandbox as required. CI uses the repository's Node 22.20.0 pin. Local evidence is a bounded emitted-workerd fixture proof, not live provider, hosted delivery, field review or publication-scan proof.

## Previously failing shard, publication and cleanup

`cloud_run timeout 900 node scripts/verify-ci.mjs import-statuses`: exit 0. This executes the repository-defined build, `tests/browser/import-statuses.mjs` and operator-fields browser phase. The import test passed at 1440 pixels; the operator phase reported 36 captures passed, with an actual results.json receipt and 1440/390 destination screenshots. The historical `reviewPrivateSearch` waitForURL timeout did not recur. No test was edited, skipped or weakened. The shard paced its own public-entry rate limits normally.

The product push used the fleet cloud-push.py guard and succeeded on attempt 1. It created only cloud/sd-penny-c-f95-rb2; no force push, default-branch update, workflow dispatch, rerun or empty commit occurred. All candidate author and committer identities were Run Edit Run fleet <fleet@runeditrun.com>; there were no trailers and no side parents above main. Actual guarded transport output is in push-receipt.log. Verify Penny run 42475170311 was discovered by REST on exact SHA fd9d46a022b2e9818cfa491096b61defb4797134, initially in progress. The scheduled exact-SHA run read subsequently returned completed/failure. The full job and archive diagnosis is recorded below.


## Evidence and custody boundaries

Evidence is selected explicitly from this packet; no credentials, environment dumps, private held-out gate material or symlinks are selected. The packet's contents have been scanned without revealing injected values. Browser images were produced only from synthetic local fixtures. The original screenshot hashes match their actual browser receipts. Reports and receipts go only to the separate `refs/heads/evidence/sd-penny-c-f95-rb2` ref through cloud_evidence.py; they are absent from the product branch. Product-custody-receipt.json independently reads back the exact published product SHA, verifies the full-history filtered clone and records the clean checkout and single replay commit.

Both browser processes closed their owned runtimes, and the cloud subreaper returned success. Recorded runtime PIDs were absent afterward; no process was manually killed. The disposable clone's node_modules has been deleted after all local checks; dependency-cleanup-receipt.json records this. The remaining clone will be deleted after successful evidence publication, with actual completion confirmed in the terminal report. The packet remains outside that disposable clone for fleet retrieval. The fleet's independent publication scan and landing are outside this cloud task; READY, if applicable, is only the specified builder custody signal.


## Final exact-SHA CI result

Verify Penny run [42475170311](https://github.com/just-every/run-penny/actions/runs/42475170311) completed with conclusion **failure** on fd9d46a022b2e9818cfa491096b61defb4797134. All 30 jobs are accounted for: plan succeeded; all 29 shard jobs failed only `Check generated contract documents`. Every edition source-lock check succeeded and every shard test command was skipped after that view check. The one representative failed-job log was read exactly once with `gh run view 42475170311 --repo just-every/run-penny --job 128714801250 --log-failed`; it confirms `ACCEPTANCE.md: generated content differs; run contract-docs write.` Its actual sanitized output is in ci-failed-job.log, with workflow environment metadata omitted. No runtime assertion failed in CI because these commands were not reached. All runtime proof reported above is from the local exact clean SHA.

This is the task's explicit **generated-view-only READY exemption**, not a fully passing CI run and not a landing or acceptance claim. The Mac lander must generate the views from the merged CONTRACT.md and run Verify again before landing. There are no remaining builder blockers. Four gh invocations were used: discovery, exact-run completion, complete job-step diagnosis, and one failed-job archive read. Each read was scheduled at least 300 seconds after the previous read; there was one watcher, no rerun or dispatch and no retry of a blocked log archive. CI and actual custody details are in ci-receipt.json and product-custody-receipt.json.

READY branch=cloud/sd-penny-c-f95-rb2 head=fd9d46a022b2e9818cfa491096b61defb4797134
