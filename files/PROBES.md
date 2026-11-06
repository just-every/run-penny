# Native runtime probes on the product candidate

Candidate: 3f11d2ec528376af456eac71f44773953b620db1
Journey: tests/base/board.test.ts, line 19, Base-signed operator moderates first posts, comments, status and merge reversal with real requester mail.
The actual built-Worker test log and command receipt accompany this report.

PROBE REQ-008 evidence union: native evidence creation linked distinct source and canonical items plus one shared item, then POST /api/operator/requests/:slug/merge -> three links on each input became exactly five unique canonical links, no source projection remained, authenticated canonical context reported five, and original evidence items, versions and origin contributions were unchanged. Assertions: board.test.ts lines 38–47, 62–64 and 83–91.

PROBE REQ-008 follower union: verified shared, source-only and canonical-only people followed through the native public route, then native merge -> two follows on each input became exactly three canonical follows, with each person's authenticated activity returning exactly one canonical follow. Four original permission rows, their identities, request and address bindings, grant times and original contribution rows were unchanged. Assertions: board.test.ts lines 23–26, 48–51, 64–67, 85–86 and 96–98.

PROBE REQ-008 approved attachment custody: native upload and operator moderation approved distinct source and canonical PNGs, then native merge -> canonical operator context and public detail contained exactly those file identities; the source file retained its source origin, storage key, metadata and original bytes, and the canonical original remained intact. Both public file doors returned their corresponding original bytes. Assertions: board.test.ts lines 52–60, 87–93 and 100–104.

PROBE REQ-008 held attachment exclusion: native upload left a second source file operator-only, then native merge -> the held file remained under source custody, appeared only in source operator context, was excluded from canonical context and public detail, and its public file door remained 404. Assertions: board.test.ts lines 60, 87–88, 92–95 and 100–104.

PROBE REQ-008 atomic rollback: a SQLite trigger aborted only the final request.merged audit insertion after a fully populated native merge attempt -> HTTP 503, all 31 captured business tables or views exactly matched the pre-call snapshot, original object inventory was unchanged, source public request still returned 200, approved bytes stayed available and the held file stayed 404. Dropping the fault and retrying the same route succeeded with HTTP 200. Assertions: board.test.ts lines 68–79; snapshot helper: support.ts lines 24–28.

PROBE REQ-008 preserved outcomes: the original approved comment, collapsed repeated votes, duplicate API 301, status history and native unmerge checks still pass. The 301 now additionally checks its exact canonical Location. Assertions: board.test.ts lines 23–37, 80–82 and 105–108.

PROBE REQ-008 omitted history and chains: none; the selected planner slice explicitly excludes duplicate title/source merge-history proof and acceptance point 2's chain behavior. They remain named in CONTRACT.md's Gap and REQ-008 stays PARTIAL.
