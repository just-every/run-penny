# Native probe results

Candidate: 580c5541b47ab211ac4700ae64fcb724235a15aa

PROBE REQ-019 point 1: native PATCH board visibility with an approved subject, approved roadmap mapping, draft release, follower and queued status event -> both populated public roadmap sources retain exactly the public control and omit the internal subject; subject detail and attachment return 404; release publication returns 409 with publication, snapshots, outbox, attempts and audit unchanged; built-Worker Cron suppresses every queued subject batch and emits no subject mail; later internal status and reply routes return 404 without mail-graph changes; public status, reply and release deliveries match the follower, accepted durable attempts and provider receipts, with no duplicate send on repeated drains.

Evidence: tests/base/board.test.ts, existing board-management journey at line 45, invoking tests/base/internal-board-exclusion.ts proveInternalBoardExclusion at line 10. Native fixture preparation is in tests/base/release-fixture.ts nativeReleaseTarget. Final board file: 7 passing tests. The unchanged notification file passed 15 tests in the baseline run.

PROBE REQ-019 point 2: none, omitted by the planner-selected brief. Changing board visibility does not prove moving a request to an internal board or the five-second withdrawal guarantee.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0. Main's generated views were restored after validation. The committed view check exits 1 for ACCEPTANCE.md, as expected under the cloud generated-view rule.
