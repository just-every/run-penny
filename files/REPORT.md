# Penny102 exact failed-case diagnosis

Task: `sd-penny102-ci-triage-1`. Repository: `just-every/run-penny`. Role: read-only technical triage. No product fix, acceptance gate, migration qualification, status change, retry, release, deploy or landing is authorized by this report.

## Results and disposition

**Both original failures are REPRODUCED on the exact candidate and PASS on fresh main on the same runner.** The smallest supported cause is candidate packaging/specification drift: source migration `0110_saved_segments.sql` is absent from the committed deployment specification. That directly fails the build-derived spec check and leaves the Platform branch of the unchanged older-archive test with an incomplete authoritative ledger. No shared Base or infrastructure cause is established. Return this candidate-specific scope to SD; do not classify the preserved refusal itself as a migration-authority defect. This is a diagnosis, not a patched-candidate verification.

| Target | Candidate `2b24048f80b48cb59043620245e519b3fd01b73a` | Main `6c1eb018f6391de17e04fc8868c0c74f8732abd8` |
| --- | --- | --- |
| Normal frozen install / rer install / rer build | all exit 0 | all exit 0 |
| Deployment-spec check | exit 1; exact reported line-37 drift | exit 0; exact build/spec byte match |
| Single named older-archive test | exit 1; 0 pass / 1 fail / 0 skipped | exit 0; 1 pass / 0 fail / 0 skipped |
| Internal native-ledger restore | printed 172 tables / 10 rows / 1 object / settings 1 / clock 1 | same complete comparison printed |
| Internal Platform-ledger restore | `rer import` refuses `migration_ledger:unapplied`, invocation line 51 / wrapper line 33 | same complete comparison printed; test's authority and one-ledger assertions pass |
| Source migrations / committed spec entries | 105 / 104 | 104 / 104 |

Each target ran **once per revision**. No assertion was weakened, no input fixture changed, and no timeout fired. The candidate's native leg completes import, export, both archive comparisons and authority/ledger assertions before the Platform leg refuses. Main completes both variants. The older fixture's archived table count stays 172; it is not the destination's current schema table count. See both complete `*-older-archive.log` files, not merely this summary.

Next for SD: decide whether to authorize a narrowly scoped candidate delivery-spec synchronization round for the appended migration, preserving actual migration ownership and all assertions. **Default: retain existing holds, no retry/readmission/acceptance action.** FV receives the candidate-only diagnosis for awareness; the condition for a shared-main/infrastructure NOTE G is not met by these paired results. No automatic product FIX or broader migration qualification follows. The effect of a repaired specification was deliberately not tested here.

There are no unrun prerequisites for this bounded diagnosis and no terminal blocker. The initial launcher review rejection was resolved. Product branch `cloud/sd-penny102-ci-triage-1` was created locally from fresh main and has no new commits; its full head is `6c1eb018f6391de17e04fc8868c0c74f8732abd8`. It was not pushed. No PR was created. No new CI run exists; the only cited run is the supplied original failure `42206110432`, jobs `127853112509` and `127853112552`. Evidence publication is separate and conveys no READY or PUSHED product custody.

## Scope and identities

- Failed candidate: `2b24048f80b48cb59043620245e519b3fd01b73a`, fetched from `cloud/sd-penny-c-f102-rebase-2b24048f80b48cb59043620245e519b3fd01b73a`.
- Fresh `origin/main`: `6c1eb018f6391de17e04fc8868c0c74f8732abd8`, fetched 2026-11-06T11:14Z. It matches the brief's observed main: no drift at fetch.
- Original builder source `b6647daf56c00f4738fdc0fbf8a2e68bed2b94d6` has an independent affected PASS according to the supplied brief; it was not rerun or qualified here.
- Original Verify Penny run `42206110432`, attempt 1: supplied completed failure, static job `127853112509`, older-archive job `127853112552`. No CI logs were fetched, no CI API was called, and no workflow was dispatched, polled or rerun. The supplied lander BLOCKED at 2026-11-06T11:06:10Z with no main advance remains historical evidence, not a new observation here.
- One owned disposable clone and one runner: hostname `75a04694cd9c`, Linux x86_64 kernel 6.18.57, Debian GNU/Linux 13.6, glibc 2.41. Both revisions use Node `22.20.0`, pnpm `10.12.4`, pinned `@runeditrun/rer 0.2.94` and Wrangler `4.129.1`. See `identity.json` and actual runtime logs.
- Platform limitation: this is Debian Linux, not the original Ubuntu 24.04 GitHub runner. The same host, boot, paths, pinned toolchain and declared ordinary CI configuration are used for the paired runs. Inherited cloud network proxy/CA transport is retained; no provider or application credentials enter product tooling. This is not a claim of Ubuntu equivalence or a shared infrastructure cause.

## Plan and method

The complete pre-run plan is `PLAN.md`; the executable recorder is `run-targets.py`. Read the shipped RULES.md, launcher AGENTS.md and repository AGENTS.md. Fetch exact sources, run the paired targeted checks once, trace the producer and archive/ledger fixture, keep actual outputs/receipts, publish only an explicit evidence packet, then remove the owned clone and dependencies.

The launcher was required for authenticated disposable cloning and the separately mandated evidence-only publication. An initial automatic review rejection interpreted the read-only skip exception as applicable; presenting the explicit evidence publication requirement resolved it, and refresh succeeded. No alternate credential was sought or disclosed.

For each revision, from the checkout root, the command shell sources `/tmp/rer-cloud-toolchain.sh` with the local exact Node 22.20.0 directory first on PATH. It sets exactly the workflow's four relevant flags: `CI=true`, `WRANGLER_SEND_METRICS=false`, `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`, `PLAYWRIGHT_SKIP_BROWSER_GC=1`. Product commands receive only ordinary process paths, real HOME, locale, proxy/CA transport and these flags; no credential file or environment dump is included.

Commands are identical on both revisions:

```sh
cloud_run timeout 900 pnpm install --frozen-lockfile
cloud_run timeout 900 pnpm run deps
cloud_run timeout 900 pnpm run build
cloud_run timeout 120 node scripts/build-deployment-spec.mjs --check
cloud_run timeout 720 node --test --test-name-pattern='^\[DATA-001 DATA-003\] import before setup restores an older backup with either migration ledger and replays later settings and status clocks$' tests/installer/older-archive.test.mjs
```

`pnpm run deps` is `rer install`; `pnpm run build` is `rer build`. The repository build adapter runs `pnpm exec tsc -b` and `pnpm exec vite build`, without tests. The workflow installs frozen dependencies and runs these same normal build prerequisites before the static spec check. No installation-owner `rer setup` is needed by that shard, and the archive case deliberately imports before setup. No private local settings or owner authority were created to change that path. The older-archive file contains exactly the one named test registration; the explicit name filter limits the request without changing its assertions or the two-ledger loop. No full shard or suite ran.

The computed-spec comparison in `compare-build-spec.mjs` invokes only the read-only producer, not its `--write` CLI. It reports hashes and differences outside the checkout. No deployment spec was regenerated into the checkout or committed. `source-identities.json` records per-revision source hashes; `candidate-v-main.diff` records the relevant source/config changes.

## Source/config causal trace

### Deployment specification

`scripts/build-deployment-spec.mjs:12` calls `deploymentSpec(root, packaging.artifact.specInputs)` after the build. `scripts/delivery/base/spec.mjs` reads `dist/server/wrangler.json`, resolves its `DB` migration directory, and `collectMigrations` (`scripts/delivery/base/migrations.mjs:36–58`) reads sorted SQL filenames and their actual bytes, computing SHA-256. The CLI byte-compares its pretty-printed result with `management/integration/deployment-spec.json` and throws on the first drift at line 37.

The candidate introduces `migrations/core/0110_saved_segments.sql` (table `penny_segments` and two indexes), SHA-256 `376bd4fbd8dcd4784120b58460cf69559a912165c0c60aa0a1d6125741686817`. Candidate migration files: **105**; committed specification entries: **104**. The candidate and main committed specifications are byte-identical, SHA-256 `a254e3520ca277b02169f041508457220354ea25f7b0a5412927b1e1f7a3ddc7`. Main's source has **104** files, all represented by identical name/hash entries in that spec. Counts describe actual SQL files, not the largest numeric prefix.

After the successful candidate build, the read-only computed spec has SHA-256 `85d57094907de8e9d8763a8aeaa9f93b121937d5d66b6625fdca24cc9f0977f7`. Its **only differing top-level field is `migrations`**; its only added migration is `0110_saved_segments.sql`; there are no removed or altered existing migration entries. See `candidate-build-spec-comparison.json` and both `*-migration-inventory.json` receipts.

### Older archive and migration authority

`tests/installer/older-archive.test.mjs:25` runs `[false, true]`, native destination first, then Platform destination. Both copy the same synthetic older archive/journal; the archive is documented as through migration 0071, with 172 archived tables, ten rows and one original object. The file, journal, README and comparison helper are byte-identical between candidate and main. No input fixture was modified by this task.

In `platformMigrations` (lines 19–22), the Platform branch reads **the committed deployment specification in the source checkout**, creates the test-owned `rer_migrations` ledger, and batches each declared entry and its SQL into the destination. Thus the candidate's Platform test destination gets only the 104 declared migrations; its copied `migrations/core` directory contains 105. The native branch starts empty and uses normal Wrangler migration application from the actual checkout files.

Before either local transfer, `scripts/portability/adapter.mjs:26` calls `nativeMigrationsAllowed`; its IPC child (`scripts/portability/ledger.mjs`) calls the installed pinned runtime's `nativeMigrationPreflight`. The runtime reads the migration directory from `wrangler.jsonc` and matches authoritative ledger names/hashes against checkout files (`@runeditrun/rer/cli/portability-migrations.mjs:30–35,100–123`). For a `rer_migrations` database, line 119 refuses any checkout file absent from applied history with `migration_ledger:unapplied`. It never grants Wrangler authority to add the missing file. Penny's IPC wrapper preserves the constant refusal code, and the adapter emits the reported message at line 14. The missing filename is not included by this wrapper's error message, but the inventory and exact fixture setup identify the sole unmatched file as `0110_saved_segments.sql`.

This is a causal source trace, not an inference from matching error text: candidate-only source migration -> unchanged 104-entry spec -> Platform test's 104-entry ledger -> pinned preflight compares against 105 files -> refusal before native migration/transfer. Real Platform migration authority and every assertion remain intact. The full numbered source trace, including installed runtime ledger matching, is in `source-trace.txt`.

## Boundaries retained

No application/test/tool source, ledger, fixture source, spec, CONTRACT.md, ACCEPTANCE.md, claims, lock, status, Gap, hold, lifecycle, budget, cap or credit was edited. Normal build outputs and the test's own disposable fixture writes are the only product-side generated state. No product commit, branch push, PR, submit/readmit, tag, provider, release or deployment action occurred. No new publication scan ran: the supplied complete-history scan had zero findings, and the brief explicitly says none is needed for this diagnosis.

The triage itself changes **zero clauses and zero test registrations**. Context only: main's contract counts are 79 done / 124 partial / 78 missing (281 total); the already-failed candidate records 79 / 125 / 77, including SEG-006 missing -> partial. Those are existing source differences, not a new judgment, promotion or acceptance by this task. All current-main assertions and existing provider/device/account/cross-seed/Base, ct/uip, payments and release holds remain. Penny99 data repair and Penny95–98 carry recovery were not duplicated.

Final runtime Verify, guarded main and Run site remain unproved. Any later migration/data acceptance still requires the original Opus path; later-seed reviews continue waiting. Diagnosis alone grants no rerun or retry authorization.

## Actual command receipts

| Revision | Command stage | Exit | Seconds | Complete output |
| --- | --- | ---: | ---: | --- |
| candidate | install | 0 | 7.457 | `candidate-install.log` |
| candidate | deps | 0 | 6.088 | `candidate-deps.log` |
| candidate | build | 0 | 34.203 | `candidate-build.log` |
| candidate | deployment-spec | 1 | 0.742 | `candidate-deployment-spec.log` |
| candidate | older-archive | 1 | 145.495 | `candidate-older-archive.log` |
| main | install | 0 | 8.192 | `main-install.log` |
| main | deps | 0 | 6.456 | `main-deps.log` |
| main | build | 0 | 33.943 | `main-build.log` |
| main | deployment-spec | 0 | 0.694 | `main-deployment-spec.log` |
| main | older-archive | 0 | 245.62 | `main-older-archive.log` |

The runtime JSON receipts bind each exact command, start timestamp, PID and exit to its revision. `candidate-post-run.json` and `main-post-run.json` record clean tracked source, test-owned scratch removal and no remaining recorded owned processes. The `cloud_run` subreaper waits for all descendants, and the test's `t.after` removes its own scratch; no browser or manual server session was started and no process was killed manually.

## Cleanup and evidence return

The original full clone and its node_modules/build/installer outputs are removed before report publication. Only its original Git metadata is temporarily converted to a bare evidence transport to preserve the recorded branch/head and declared origin while the supplied report-only entrypoint runs. `cleanup.json` records that actual prepublication state. This minimal transport is removed after successful publication. Report-only publication uses fleet identity, preserved hooks and a pre-push full-candidate author/committer/message audit in its isolated report repository, including side parents. It publishes only explicitly selected non-secret regular files to `refs/heads/evidence/sd-penny102-ci-triage-1`; no product ref or index is changed. The returned evidence head/manifest identifies the packet, independently of product custody.
