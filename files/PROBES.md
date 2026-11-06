# Public-door probes for sd-penny-c-f101

Candidate: f88e5ab2a4011c542e4f36c77197b482d011621f.

PROBE SURFACE-002 point-4-snooze: PATCH `/api/operator/triage/evidence/:id/snooze` and MCP `penny.evidence.update` on separate captured records with a future instant at +05:30 -> both GET `/api/operator/triage` records carry the same canonical UTC instant; both clear operations remove their records from snoozed readback. The native actor and event types match, with the real agent and sponsor added only to MCP activity.

PROBE SURFACE-002 point-4-policy: autonomous, held review, and explicit held approval policies through the MCP door -> standard is the only class; pending approval writes nothing; approved snooze and clear retain the named native approver. A snooze whose time passes before approval returns `snooze_must_be_future` and preserves native state and audit entries.

PROBE SURFACE-002 point-4-replay: repeat original snooze and clear calls with the original idempotency key, including a snooze replay after clear -> original result returned; no restored snooze and no extra native activity. Transport checks repeat each selected operation under both conformance policies.

PROBE SURFACE-002 point-4-refusal: malformed, current and past times, missing time and missing record, insufficient scope, local Pause, revoked consent, revoked agent and removed sponsor -> expected refusals, with evidence, versions, snooze state and native snooze activity unchanged. Sponsor removal refuses the next native HTTP mutation and MCP mutation.

Evidence: `tests/base/agent-snooze.test.ts` lines 55 to 168 and `tests/agent-door/journey.mjs` lines 9 to 31; native-checks.log (3 tests), agent-door.log (2295 conformance checks), CHECKS.json. These are actual runs on the candidate's source, using native routes and built Worker transport. No live provider or visual qualification is claimed.

MECHANICAL lock=`node scripts/edition-authoring/cli.mjs check` exit=0; views=`node src/base/contract-docs.mjs write` and `node src/base/contract-docs.mjs check` exit=0; ledger=none exit=0. The generated files were then restored whole from integrated main, with no candidate differences from main in either generated view. A subsequent candidate view check returns exit=1 solely because ACCEPTANCE.md is deliberately left for the lander. Mechanical details and exact command arrays are in mechanical.json.
