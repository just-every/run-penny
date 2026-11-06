# Pre-existing main diagnostics

Main head: 0d6f3416c75fe29675323ad1a2ef4bd1f8086756.

Command: gh run view 42194484854 --repo just-every/run-penny --job 127814206039 --log-failed. Exit 0. Run site failed at pnpm exec rer deploy --site with provider-http-503 while checking site Worker settings: HTTP 503, no healthy upstream. No deployment retry was performed by this task.

Command: gh run view 42194484496 --repo just-every/run-penny --job 127814272471 --log-failed. Exit 0. The import-statuses shard failed at page.waitForURL, Timeout 30000ms exceeded, waiting for navigation until load, in reviewPrivateSearch at tests/browser/operator-completeness-read.mjs line 70. This is the starting main head, before the scorecard change. A separate Verify run 42192912570 succeeded on the same head. No source repair or rerun was performed for this unrelated failure.
