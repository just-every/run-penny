# Replay plan: sd-penny-c-f95-rb2

Repository: just-every/run-penny. Product branch: cloud/sd-penny-c-f95-rb2.
Original builder head: 56d7cabddb344e8286aef98217c2da4dd5782f7b.

1. Prepare fleet identity, refreshed credential bundle, credential helper, guarded push entrypoint and clone-local message hook. Clone full history with blob filtering; fetch and verify the original builder head.
2. Create the named branch at the original candidate, squash its two commits during rebase onto fresh origin/main, and retain main's newer tests, assertions, changelog, ID-MAP and other contract rows. Resolve the A11Y-001 status row by lines. Retain partial and all holds. Stop for a real semantic conflict.
3. Generate contract documents and check them, restore origin/main's ACCEPTANCE.md and docs/CLAIMS.md without committing generated views, stage the intended source, regenerate sources.lock.json last and check source custody. Preserve the exact final candidate row and only the intended source/lock delta.
4. Install frozen dependencies using the required cloud toolchain and setup. Run typecheck and the candidate's requester-board keyboard test entrypoint. Run import-statuses once through the repository's actual shard command, recording any failure without modifying tests. Use /usr/bin/chromium with --no-sandbox; close only owned runtimes.
5. Validate all candidate authors, committers, trailers and messages, commit once with fleet identity and hooks, and push only the named cloud branch with the fleet guard. Do not force push or change main. Follow exact-SHA Verify using REST within ten calls and at most one run poll per 300 seconds.
6. Record actual command results, before/after clause counts, unchanged status, terminal product SHA and CI runs. Save non-secret reports and actual receipts outside the product tree and publish explicitly selected files only to evidence/sd-penny-c-f95-rb2. Preserve recovery data on failed push; after successful custody and report publication, remove the disposable clone and its dependencies.

No behavior, test, status promotion, hold release, deployment or landing is authorized. Generated-view-only Verify failure is the stated READY exemption. Otherwise READY requires exact-SHA success; incomplete running CI is PUSHED; genuine unfixable failures are BLOCKED.
