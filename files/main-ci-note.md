The initial main SHA was 84bad894d12e7f969f567177a126cb544a3237b1. Verify Penny 42138503924 and Run site 42140171051 succeeded on it. Later Verify Penny 42140171112 failed in browser job 127638280568 at Run this shard; other jobs succeeded. It was attempt 1. The permitted log read was attempted exactly once:

gh run view 42140171112 --repo just-every/run-penny --job 127638280568 --log-failed

It exited 0 and returned no output. There was no transport error or HTTP body to quote. No log download retry, workflow dispatch or job rerun was made. No unrelated failure was guessed at or repaired. That SHA was superseded by integrated main e9bc2b86ccd6f6fe2634ff5e0750e51c11b19d7f, whose branch Verify 42150563497 and Run site 42153984645 succeeded. This run claims no repair of the old main result.
