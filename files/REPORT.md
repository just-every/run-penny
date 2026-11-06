# Penny100 operator-completeness CI diagnosis

**Result: NOT REPRODUCED.** The exact selected operator-completeness command passed once on the failed DATA-006 candidate and once on fresh main, on the same Linux runner with identical commands, toolchain and ordinary configuration. Each execution retained both existing widths (1440 and 390), produced 36 passing check entries (18 per width), and wrote 34 screenshots. No failing locator or assertion was observed locally. The original dual TimeoutError cannot be localized from the supplied excerpt, and this diagnosis does not establish an infrastructure cause or grant retry authority.

## Revision and custody

- Repository: `just-every/run-penny`, treated as public.
- Failed regenerated candidate: `ad5e5b85c2a0f14a83c9fcc4fbc450a01a43bd89`; source ref `cloud/sd-penny-c-f100-rebase-ad5e5b85c2a0f14a83c9fcc4fbc450a01a43bd89`.
- Original builder source: `676857454ae3d817900f89ca1a104c7c2a7a1390`; its independent affected PASS is supplied brief context, not a new check by this diagnosis.
- Fresh main: `6c1eb018f6391de17e04fc8868c0c74f8732abd8`, fetched before the candidate read and again immediately before the main comparison. Main drift from original observer `6c1eb018f6391de17e04fc8868c0c74f8732abd8`: **none**.
- Supplied failing CI: Verify Penny run **42208214989**, job **127860127222**, shards `(import-statuses, true)`, step **Run this shard**. Supplied original observer ended blocked at 2026-11-06T11:22:49Z. No CI run or job logs were refetched. No new CI run was requested, polled, rerun or dispatched.
- Local branch `cloud/sd-penny100-ci-triage-1` was created from main at `6c1eb018f6391de17e04fc8868c0c74f8732abd8`. Product commits: **0**; product pushes: **0**; PR: **none**. No READY/PUSHED or landing claim applies to this report-only diagnosis. Only `refs/heads/evidence/sd-penny100-ci-triage-1` is authorized for report transport.

## Full plan and execution controls

The complete plan is in [PLAN.md](PLAN.md). It was carried out as an exact-revision comparison: read the shipped RULES and repository AGENTS, resolve the command from source, record revisions and runner identity, perform declared ordinary setup/build, run the focused case once per revision, compare observations and unchanged assertion source, preserve actual outputs and receipts, publish only report custody, and remove owned runtime/checkout/dependencies. No product/test/tracked configuration edits, weakened waits, retries, added mocks, fallback application, status/Gap/ledger changes, acceptance gate, migration qualification, provider/deployment/tag/release actions or broad test suites were performed. The previous COMPLETE full-history publication scan was not repeated.

## Exact workflow-to-case trace

1. Candidate `.github/workflows/verify.yml` runs Ubuntu 24.04 and Node 22.20.0. Its **Run this shard** step sets SHARD from the matrix and executes `node scripts/verify-ci.mjs "$SHARD"`.
2. `scripts/verify-ci.mjs` loads `verificationPlan()` from `scripts/verify-app.mjs`, selects `import-statuses`, and invokes `pnpm run verify:app` with `SEED_VERIFY_SHARD=import-statuses` because this shard has `hosted: false`.
3. `scripts/verify-app.mjs` reads `verification.json`, selecting that shard's ordered commands: `pnpm run build`, `node tests/browser/import-statuses.mjs`, then **`PENNY_EVIDENCE=../evidence/operator-completeness PENNY_OPERATOR_FIELDS_ONLY=1 node tests/browser/operator-pages.mjs`**. The reported AggregateError is emitted by the last case, not inferred from the shard name. Only that last case was executed here; the unrelated import-statuses case and full shard/suite were not run.
4. In `tests/browser/operator-pages.mjs:36`, `PENNY_OPERATOR_FIELDS_ONLY=1` makes `fieldsOnly` and `completenessOnly` true. Line 251 invokes **reviewOperatorFields**, not the full reviewOperatorCompleteness flow. Lines 262–267 run `Promise.allSettled([1440,390].map(reviewWidth))`, wait for both runtime cleanups, and emit **Operator completeness failed at both widths** only if both reject. Thus the supplied excerpt establishes two rejected widths, without identifying which operation timed out.
5. `tests/browser/operator-completeness.mjs:31` defines the selected fields flow: seed the existing fixture, invite a native peer, reviewPrivateSearch, reviewCustomFields, then close the peer context. No phase, assertion, locator, viewport, timeout or wait was removed or replaced. Copies of the relevant exact sources and the assertion trace are in `source/` and `assertion-trace.txt`. `harness-diff.txt` is empty: workflow, runner mapping, plan, package/lockfile and browser sources are byte-identical between candidate and main.

## Existing assertions retained

The selected case includes the real first-run owner form, native invitation/confirmation and peer management/admission checks. It seeds its existing small test-owned records and drives the emitted production Worker through Miniflare, ordinary native operator documents/APIs, generated loader transport and public projections. Its existing mail network-edge fixture remains exactly as committed; no new fixture, mock, route interception or app substitute was introduced.

Private search checks real hierarchy creation; mixed entity ordering; full/partial search, active peer access and destination hrefs; duplicate-name identity; desktop focus, reload and scrolling; named record-field search and real destination admission; anonymous private-read refusal; absence of private fixture values from real public documents/APIs; and the empty-search state. Existing mobile captures and desktop-only behavioural branches are preserved.

Custom-field assertions create and edit definitions through settings UI for all seven existing entity kinds (request, evidence, decision, roadmap item, release, account, requester), save/reload/peer-read values, distinguish empty string from cleared null, and verify real clear audit custody. Typed number/boolean/date probes retain invalid-type/calendar 400, cross-entity 409 and nonexistent-record 404 refusals. Published fixtures retain private values while real nonempty public projections and anonymous generated reads exclude them.

Every capture retains no horizontal overflow, zero serious/critical axe violations and no milestone placeholders. Final checks retain no console/page errors and no external browser requests. No unrelated full-completeness phases (durable lists, requester/privacy flow, rejection notices, frame/rate/destruction/revocation/owner transfer) were added to the selected case.

## Runner, toolchain and platform limits

Both arms ran serially on the same owned Linux VM `8cd0548f16da`, Debian 13.6 x86_64, kernel 6.18.57. Both used Node **22.20.0**, pnpm **10.12.4**, local rer **0.2.94**, Playwright **1.63.0**, Vite **8.2.2**, Wrangler **4.129.1**, and `/usr/bin/chromium` **154.0.8037.57**, headless with the repository's `--no-sandbox` option. The inherited VM Node is 24.19.0; after sourcing the required cloud toolchain in every command shell, the explicitly installed Node 22.20.0 prefix was put first in PATH for both setup/build/test arms. Actual versions and package/lockfile hashes are in `toolchain-receipt.json`.

The original CI uses **Ubuntu 24.04**, and installs Playwright-managed Chromium. This VM uses **Debian 13.6 and system Chromium** as required by the cloud adaptation. Ubuntu-specific timing, resource allocation and the original managed browser artifact are not reproduced exactly. The comparison controls this VM/toolchain across both revisions; it does not reproduce the original GitHub-hosted runner or establish a flaky/infrastructure root cause.

Both arms used `CI=true`, `WRANGLER_SEND_METRICS=false`, `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`, `PLAYWRIGHT_SKIP_BROWSER_GC=1` and `PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium`. Each ran the exact commands below, with the same owner email. Candidate-generated private settings, local database, installer state, build and node_modules were removed before main's fresh setup; source and tests stayed clean. Package/lockfile pins match. Neither case was retried. Existing real limiter pacing was preserved, including its logged waits; no application/limiter bypass was applied.

```sh
. /tmp/rer-cloud-toolchain.sh
export PATH="$HOME/.rer/toolchain/node-22.20.0/node_modules/node/bin:$PATH"
export CI=true WRANGLER_SEND_METRICS=false CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false PLAYWRIGHT_SKIP_BROWSER_GC=1 PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium
pnpm install --frozen-lockfile
pnpm run deps
cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive
cloud_run npx -y @runeditrun/rer build
cloud_run env PENNY_EVIDENCE=../evidence/operator-completeness PENNY_OPERATOR_FIELDS_ONLY=1 node tests/browser/operator-pages.mjs
```

Each command was wrapped by `/tmp/penny-triage-cmd.py` to write its actual full stdout/stderr, exit, PID, SHA and timestamps; cloud_run used the supplied child subreaper. The case command is identical in both receipts. The separate Node package preparation used a 300-second installer timeout; there was no added case timeout or lane clock.

## Actual outputs, commands and exits

| Revision | Case executions | Widths | Exit | Passing check entries | Actual PNGs | Exact terminal summary |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Candidate `ad5e5b85c2a0f14a83c9fcc4fbc450a01a43bd89` | 1 | 1440, 390 | 0 | 36 (18/width) | 34 | `operator-pages: 36 captures passed` |
| Fresh main `6c1eb018f6391de17e04fc8868c0c74f8732abd8` | 1 | 1440, 390 | 0 | 36 (18/width) | 34 | `operator-pages: 36 captures passed` |

The script's terminal wording counts two bounded-first-page timing check entries as captures; its actual PNG count is 34. Neither arm produced a timeout, failed assertion, browser error or failed final external-request assertion. Each `captures/<arm>/results.json` contains the actual check entries, and all generated screenshots are retained alongside it. Full byte-exact command outputs are gzip-compressed in `runtime/`; `runtime-receipt.json` records each uncompressed byte count/hash and exact argv, with no log redactions. Decompress with `gzip -dc runtime/<label>.log.gz`.

| Command label | Exit | Start UTC | End UTC | Complete output |
| --- | ---: | --- | --- | --- |
| node22-install | 0 | 2026-11-06T11:29:51.984454+00:00 | 2026-11-06T11:29:57.058399+00:00 | `runtime/node22-install.log.gz` |
| candidate-install | 0 | 2026-11-06T11:29:57.096924+00:00 | 2026-11-06T11:30:10.398366+00:00 | `runtime/candidate-install.log.gz` |
| candidate-deps | 0 | 2026-11-06T11:30:26.618434+00:00 | 2026-11-06T11:30:35.061778+00:00 | `runtime/candidate-deps.log.gz` |
| candidate-setup | 0 | 2026-11-06T11:30:35.120033+00:00 | 2026-11-06T11:32:03.361492+00:00 | `runtime/candidate-setup.log.gz` |
| candidate-build | 0 | 2026-11-06T11:32:12.452534+00:00 | 2026-11-06T11:32:52.437920+00:00 | `runtime/candidate-build.log.gz` |
| candidate-operator-completeness | 0 | 2026-11-06T11:32:52.509065+00:00 | 2026-11-06T11:35:21.579150+00:00 | `runtime/candidate-operator-completeness.log.gz` |
| main-install | 0 | 2026-11-06T11:35:56.312955+00:00 | 2026-11-06T11:36:08.535232+00:00 | `runtime/main-install.log.gz` |
| main-deps | 0 | 2026-11-06T11:36:08.574832+00:00 | 2026-11-06T11:36:17.159724+00:00 | `runtime/main-deps.log.gz` |
| main-setup | 0 | 2026-11-06T11:36:17.220015+00:00 | 2026-11-06T11:38:00.616540+00:00 | `runtime/main-setup.log.gz` |
| main-build | 0 | 2026-11-06T11:38:00.740265+00:00 | 2026-11-06T11:38:45.243174+00:00 | `runtime/main-build.log.gz` |
| main-operator-completeness | 0 | 2026-11-06T11:38:45.323458+00:00 | 2026-11-06T11:41:10.539310+00:00 | `runtime/main-operator-completeness.log.gz` |

## Smallest supported causal result and routing

**NOT REPRODUCED** is the supported result. The previously red Verify remains a supplied fact; neither passing arm converts it to green. The exact focused case passed on both candidate and unchanged fresh main, so there is no observed candidate-only ordinary failure to return as a scoped DATA-006 product FIX, and no reproduced same-main failure. Infrastructure failure is not established either. The failing locator/cause in the original CI remains unknown from the supplied excerpt; the brief forbids another GitHub log read or retry.

`candidate-change.diff` records the complete seven-file candidate delta: OpenAPI operation **description strings**, the existing integration OpenAPI test's extended response-variant/replay assertions, docs/evidence text and hashes. The changed OpenAPI object is served only by `src/core/features/docs/openapi-route.ts` at `/docs/openapi.json`; no private search/custom-field implementation changes are present. The extended integration test is not executed by this browser command. Workflow, selected assertion source, fixture/public doors, package/lockfile and relevant search/custom-field implementations are unchanged. Together with both passing controlled arms, this supplies no supported causal link from DATA-006's delta to the original browser timeout. It does not prove that every possible CI/bundling/timing interaction is impossible.

Return this bounded observation to SD and FV. Do not automatically classify it as established same-main/infrastructure NOTE G or authorize a product FIX. Default: retain the original red CI hold and await a separately authorized original-Ubuntu/log diagnosis; no CI rerun/dispatch, re-admission or retry follows from these passes. Required auth/data/money/UI acceptance retains the original Opus path; later-seed Opus reviews wait. Final actual full-runtime exact-SHA Verify, guarded main and site remain owed.

## Counts, clauses and cleanup

Before and after candidate/main: **281** clause status rows, **79 done / 124 partial / 78 missing**. Status changes: **none**; DATA-006 stays **partial → partial** with its existing gaps unchanged. This diagnosis changed **0** tracked files, added/removed **0** test registrations and created **0** product commits. Two bounded case invocations exercised four width executions total. This is not a recount/qualification of the full suite; the unchanged declared test cap is 200. Exact row/status mapping is in `clause-counts.json`.

Actual runtime/process/local-state cleanup and checkout/dependency disposal are recorded in `cleanup-receipt.json`. Only owned PIDs or owned paths are eligible for cleanup; no global stop/kill command is used. Private settings values, environment dumps, credential files, symlinks and held-out material are excluded. The selected packet is transport-only public material; publication audit details are in `packet-selection-receipt.json`. Evidence publication is not product readiness, acceptance, landing or final Verify.
