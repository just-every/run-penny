# Candidate CI receipt

Head: 11be6a4569fc56196e3cfa1e40e04fa085112156
Branch: cloud/sd-penny-c-f64
Workflow: Verify Penny
Event: push
Run: 42154024873
URL: https://github.com/just-every/run-penny/actions/runs/42154024873
Status: completed
Conclusion: failure

The complete jobs response returned 30 of 30 jobs: the plan succeeded; all 29 shards failed only at step 5, Check generated contract documents. The source lock check passed before that step. No behavior assertion ran or failed in this CI attempt. Both generated views were intentionally restored from main and excluded from the product commits.

This is the explicitly permitted generated-view exception, not a claim of an entirely successful Verify. Local generator write and check succeeded, and the subsequent restored-view check reports the expected stale ACCEPTANCE.md. The fleet lander must generate the views from the merged contract, scan the exact full-history candidate and rerun its exact-SHA gates before landing.

The single watcher discovered the exact-head run, then read its completed status after more than 300 seconds. A single completed-job inspection classified the failure. Six total GitHub commands were used, including the main status and failed-job inspection; no dispatch or rerun was created.
