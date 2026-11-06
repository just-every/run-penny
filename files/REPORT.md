# Penny main Unicode suggestions performance diagnosis

Date: 2026-11-06T15:11:26.143641+00:00
Tag: sd-penny-main-unicode-triage-1
Repository: just-every/run-penny
Role: bounded read-only triage; no landing candidate.

## Outcome

REPRODUCED on current main, with substantial variation. The unchanged committed journey measured operator Unicode p95 **2321.522 ms** (maximum 6376.799 ms), exceeding the unchanged 500 ms cap. Its first failing final timing assertion was operator absent (p95 3465.451 ms); the JSON independently records the Unicode overrun. The only completed isolated operator Unicode repeat measured **153.015 ms** p95 (maximum 197.336 ms), below the cap. Its final timing assertion was NOT RUN because a post-measurement diagnostic failed; every sample's response and suggestion assertions did run. No full journey is claimed green.

The exact source query unnecessarily materializes and scans the whole eligible corpus for a Unicode-only query, even though an existing covering expression index can select the one non-ASCII row directly. That avoidable cost is proven by D1 query plans and bounded query probes. The multi-second tail in the failed journey and original CI is **not fully attributed**: later direct D1 execution took 67 ms. This is evidence of an inefficient source path plus timing variation, not proof of an infrastructure cause or a uniformly repeatable multi-second query.

## Revisions, runner, and comparability

- Failed head: `f52beea3be587114d61166d21e4be26777fa96f3`.
- Fresh main, fetched at task start: `f52beea3be587114d61166d21e4be26777fa96f3`. It is the same commit. One unchanged source checkout therefore represents both requested revisions; there is no candidate-only regression to compare.
- Local custody branch: `cloud/sd-penny-main-unicode-triage-1`, never pushed. Product head stayed at the exact SHA above. No commit, PR, product branch publication, CI request, watcher, dispatch, rerun, deployment, source lock, contract, status or threshold change.
- Runner: Linux x64 6.18.57, INTEL(R) XEON(R) PLATINUM 8573C, five reported logical CPUs with a 4-core cgroup quota, 18,882,662,400 reported memory bytes / 16 GiB cgroup limit. No deliberate load, parallel benchmark, throttling, stress or load waiting. The first measurement's load averages were 1.12/1.04/0.49 at start and 1.31/1.10/0.56 at end. Load averages alone do not establish CPU availability or exclude host variance.
- Identical Node **22.20.0**, pnpm **10.12.4**, frozen dependency lock and unchanged production build throughout all completed measurements. Dispatcher 0.2.94. Actual runtime Miniflare (resolved through vitest-plugin 1.4.0) is **5.20261006.1-alpha**, distinct from the direct package pin 5.20260907.0-alpha. See `toolchain.json`.
- Reported original CI: Verify **42218054922**, job **127892981073**, operator Unicode p95 1062.746 ms on Node 22.20.0 at the failed SHA. This observation came from the brief; it was not re-fetched or independently verified here. No new CI run exists.
- The independent EVID-007 acceptance at source `27c67093f6b1924ee4ad515f73ddf804950a879d` used its own corpus. No regression claim is made against that incomparable corpus.

## Plan and exact execution

The complete original plan is `PLAN.md`. Refresh fleet credentials; shallow-filter clone the one declared repository; read AGENTS.md and the inline briefs/RULES.md; fetch failed head and fresh main; install exact tools/frozen dependencies; build once; run only the named scale journey; use at most three endpoint attempts including bounded isolated repeats; trace source/SQLite plans; publish only selected reports; delete owned clone/dependencies.

`COMMANDS.md` records setup commands and exits. Measurement commands (each through the supplied cloud subreaper, exact Node pin first on PATH, toolchain shell sourced, and the same documented non-secret CI configuration):

1. `cloud_run node tests/runtime/duplicate-suggestions-scale.mjs` — **exit 1** at the original line 64 timing assertion. Committed journey, fixtures, 25 samples per workload, cap and assertions unchanged.
2. `cloud_run node --import ./node_modules/tsx/dist/loader.mjs ../packet/operator-unicode-probe.mjs --trace` — **exit 1** during runtime migration 0021 with `TypeError: fetch failed`, `UND_ERR_SOCKET: other side closed`. Operator Unicode measurement and query plans: **NOT RUN**. The exact attempted script is retained as `operator-unicode-probe-attempt-2.mjs`. This local startup failure does not explain the historical CI failure. No OOM or OOM-kill events were reported by the cgroup after it.
3. `cloud_run node ../packet/operator-unicode-probe.mjs --trace` — **exit 1**, after all 25 isolated operator Unicode response/correctness samples and p95 output. D1 refused `sqlite_version()` with `D1_ERROR: not authorized to use function: sqlite_version ... SQLITE_ERROR`. The final timing assertion and plans were **NOT RUN** in this invocation. Numerically its recorded p95 is below 500 ms. The TS loader was removed; no product source or fixture changed.
4. `cloud_run node ../packet/query-plan-only.mjs --trace` — **exit 0**. Diagnostic SQL trace only: same full disposable corpus, no suggestions endpoint measurement or extra journey repeat, no sqlite_version call. It obtained EXPLAIN plans and executed each listed source-query stage once. `query-plan-receipt.json` and `query-trace.json` retain the actual output.

No more endpoint attempts were made. Isolated probes are derived copies outside the checkout: same original corpus insertion, counts, synthetic operator bootstrap, 25 sample loop, result assertions and 500 ms assertion; only the workload/door selection and post-measurement diagnostic are different. They are diagnostic evidence, not a committed replacement test. The original journey and product stayed byte-identical (`source-hashes.json`, `RECEIPT.json`).

## Measurements

Full unchanged journey, all milliseconds:

| Door | Workload | Samples | p95 ms | Maximum ms |
| --- | --- | ---: | ---: | ---: |
| public | exact | 25 | 198.280 | 206.038 |
| public | partial | 25 | 356.387 | 357.485 |
| public | absent | 25 | 268.660 | 297.175 |
| public | unicode | 25 | 155.569 | 183.483 |
| operator | exact | 25 | 228.557 | 324.245 |
| operator | partial | 25 | 211.004 | 249.543 |
| operator | absent | 25 | 3465.451 | 6272.783 |
| operator | unicode | 25 | 2321.522 | 6376.799 |

Only completed isolated repeat: operator Unicode, 25 samples, p95 **153.015 ms**, maximum **197.336 ms**. The failed repeat produced zero timing samples. Thus two completed Unicode measurements are available across three bounded endpoint attempts; there is no basis to call the overrun consistently repeatable or to call it resolved. All completed endpoint responses and matching slug/term assertions passed before the final timing stage.

Before/after fixture counts: **100000 requests / 100 boards / 250000 requesters**, unchanged. Each fresh isolated fixture has the same five ASCII matching requests, with only request-1 appended with ` — résumé`, exactly as committed. No fixture reduction, mock/fallback, application retry or changed timing cap.

## Source and D1 cost trace

Source: `src/core/features/requests/suggestions.ts:3-27`, `migrations/core/0109_duplicate_suggestion_indexes.sql:3-9`, `tests/runtime/duplicate-suggestions-scale.mjs:27-64`. The exact emitted implementation also contains the same query.

1. `lexicalTerms('résumé')` yields one non-ASCII term; `asciiTerms` is empty. The score template consequently becomes constant zero.
2. Migration 0109 keeps ASCII normalized terms in covering expression indexes and deliberately makes `terms` NULL for any non-ASCII source wording. There are **100000 eligible operator rows, 1 NULL-terms row** in the unchanged fixture.
3. The query still builds `indexed AS MATERIALIZED` for every eligible request with a board join. It scans that temporary result for `ranked`, uses a temporary B-tree for ordering, filters the zero scores away, and scans it again for `terms IS NULL`. Only that single row is returned for JS lexical matching.
4. EXPLAIN confirms the operator index **is used and is covering**: `SEARCH requests USING COVERING INDEX penny_suggestions_operator (merged_into_request_id=?)`, followed by board probes, `MATERIALIZE indexed`, `SCAN indexed`, and `USE TEMP B-TREE FOR ORDER BY`. This is not a missing-index or repeated Unicode-normalization diagnosis.

Bounded direct D1 query measurements (one execution each, separate from endpoint samples):

| Query | D1 duration ms | Caller elapsed ms | D1 rows read | Rows returned |
| --- | ---: | ---: | ---: | ---: |
| Public full Unicode query | 130 | 146.201 | 600003 | 1 |
| Public candidate materialization/count | 111 | 122.374 | 400002 | 1 count row |
| Operator full Unicode query | 67 | 83.925 | 500001 | 1 |
| Operator candidate materialization/count | 62 | 72.718 | 300000 | 1 count row |
| Operator direct NULL-terms index selection | 0 (reported integer precision) | 11.521 | 2 | 1 |

The final read-only diagnostic query was `SELECT id,slug FROM penny_suggestions_operator_rows WHERE merged_into_request_id IS NULL AND terms IS NULL`. Its plan is `SEARCH requests USING COVERING INDEX penny_suggestions_operator (merged_into_request_id=? AND <expr>=?)`. This is a stage probe, **not an implemented route fix**, and its latency is not an end-to-end acceptance result. All SQL probe metadata reports zero changes/rows written. Existing read-only operator authority wrappers were read; their native session guard remains required and was not bypassed in any endpoint measurement.

The materialization/candidate stage accounts for most of the later direct query duration. It explains unnecessary corpus-scale work for a one-row Unicode result; it does not establish where the failed run's extra seconds occurred. No per-query timing was injected into the original journey, and no infrastructure cause is proven. The later local socket failure is a separately observed limitation.

## Smallest proposed fix scope, not implemented

Within `src/core/features/requests/suggestions.ts`, use a dedicated path when `asciiTerms.length === 0` that selects only the existing view's `terms IS NULL` candidates before broad materialization/ranking. Retain the door's complete visibility/board/block/merge predicates and the existing JS whole-term matcher/ranking/limit. Keep current operator authority and freshness checks. The current expression index already supports the selective lookup, so this narrow proposal needs no migration, new source adoption, new index or contract change (a future code change would still require the documented source lock regeneration). It must not add a premature five-row limit before JS matching of Unicode candidates.

A later authorized fix would preserve and rerun the current committed Unicode/corpus/500ms journey and prove both doors' semantics and the exact-SHA CI contract; this read-only result grants no CI retry, dispatch or fix authorization. ASCII-absent overrun was observed incidentally and was not repeated or expanded into new work. No FIX is charged to Penny118.

## Status, limits, and custody

- Clause changes: **none**. EVID-007 remains at its pre-existing published/done judgment; no claim, promotion or demotion is made. Test/source/contract/status/lock counts and content are unchanged.
- Required broad checks, full suite, browser/UI proof, provider checks, publication scan of a product candidate, `rer setup`, CI re-read/Verify/rerun/watch and landing gates: **NOT RUN**, outside this read-only brief or unnecessary for this journey. The HTTP/D1 runtime helper migrates/bootstrap its own disposable database and does not launch Chromium.
- No product commit, product push, PR, deployment, hold or landing edit. Product branch remains local at `f52beea3be587114d61166d21e4be26777fa96f3`. Evidence publication is separate and grants no READY/PUSHED status or acceptance.
- Complete selected actual report, scripts, non-secret logs and receipts are retained in this packet. Runtime instances dispose themselves through `finally` / the startup failure path. The owned clone and its dependencies are deleted after report publication; no broad process killer is used. Actual terminal cleanup is recorded outside the report-only commit after transport.

Done: bounded triage reproduced an intermittent main overrun, proved avoidable Unicode query work, proposed a narrow source scope, and preserved unresolved tail attribution and failed prerequisites honestly.
