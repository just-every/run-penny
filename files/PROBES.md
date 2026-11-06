# Exact-candidate runtime probe

Head: dedeb95c15fe8e699559ef000a5fcdd552315b4a

PROBE API-003 point 1: native saved-feedback preview then reviewed apply and replay, GET /api/operator/data/export, POST /api/operator/data/import into an empty migrated installation, followed by public request, roadmap and release readback -> four imported requests and two comments remain held; approved publication identities and content are unchanged; imported job and held-record identities survive replay; portable event and command holds retain their expected normalization; repeated scheduler drains add zero outbound calls.

Door journey: tests/base/egress-delivery.test.ts, selected public effects and durable receipts preserve custody across restart. Its existing registration invokes tests/base/integration-effects.ts. Helpers in tests/base/integration-publications.ts assert independent content expectations; full-record comparisons retain every field, timestamp and composite identity before and after the native operations.

Evidence locations on this head:

- integration-publications.ts lines 11–53: approved request, comment and status identities and content, both roadmap update versions and their relationships, release version, target and recipient snapshot content.
- integration-publications.ts lines 56–68: exact public comment and status history, mapped roadmap history, roadmap and release payloads.
- integration-effects.ts lines 98–110: native read-only preview checkpoint and reviewed apply; complete publication and integration comparison.
- integration-effects.ts lines 111–119: repeat apply retains the job and exact held-record set, public projections and publication and effect records.
- integration-effects.ts lines 131–153: authenticated export, expected portable normalization, empty migrated destination, authenticated import and exact readback.
- integration-effects.ts lines 154–165: source credentials stay absent, restored events remain held, repeated drains with independently entered credentials create no new call or effect identity.

Fake boundaries: outbound mail and enforcing egress HTTP edges only. Native D1 migrations, publication, import, export, restore, identity admission and public projections execute real application code. The preexisting late target-write fault, revoked destination, private-board and blocked-requester refusal assertions remain intact.
