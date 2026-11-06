# Bounded read-only diagnosis plan

1. Refresh the fleet launcher, install bundle-backed Git authentication, and shallow-filter clone only just-every/run-penny. Read repository AGENTS.md and the inline briefs/RULES.md.
2. Fetch the exact failed head and fresh main; record full SHAs and toolchain/runner identity. Main fetched at task start equals the failed head, so the comparison is the identical source commit rather than two different revisions.
3. Install the frozen dependencies and pinned Node 22.20.0 / pnpm 10.12.4. Build via the native cloud runner. Run only tests/runtime/duplicate-suggestions-scale.mjs unmodified with its full corpus and 500ms assertions. If the Unicode cost reproduces, repeat only the operator Unicode case, at most three total Unicode measurements, without changing product source or the committed journey.
4. Trace the exact generated SQL and SQLite EXPLAIN QUERY PLAN on the same disposable dataset; collect bounded query timings and row counts to distinguish database work from JS/HTTP overhead. No stress, concurrent benchmark, fixture shrinking, or application retry.
5. Save actual commands/exits, timings, source references and limitations. Propose the smallest fix scope without implementing it. No code, lock, contract, status, threshold or test edits; no product commit/push, PR, CI API call, watcher, rerun or dispatch.
6. Publish selected non-secret evidence through evidence/sd-penny-main-unicode-triage-1 only, preserve its receipt, delete the owned clone/dependencies, and relay one dated result to sd and fv in the final response.
