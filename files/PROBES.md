# Native public-door probes

PROBE DEC-002 confidence: authenticated POST /api/operator/decisions with low confidence, then native PATCH with medium and high, each followed by GET /api/operator/decisions/:slug -> exact low, medium and high values returned under the original decision id and slug.
PROBE DEC-002 changed review date: native POST with 2026-11-12 then PATCH with 2026-12-03 and 2027-01-14, each followed by detail GET -> exact saved dates returned under the original identity.
PROBE DEC-002 cleared review date: native PATCH with reviewAt null then detail GET -> reviewAt null with unchanged decision id, slug, owner, linked-evidence count and candidate-bet id.

All three probes execute in the existing readiness journey in tests/base/decision-loop-dimensions.test.ts:9, using the native Worker test environment and real D1 with current migrations. Final run: 2 tests passed, exit 0. Relevant committed bytes match the tested bytes; RECEIPT.json records their Git blobs.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0 (no migration changes).

Temporary fault probes M1, M2 and M3 each caused the specific new assertion to fail with exit 1. Full logs are selected separately. Runtime files were restored byte-for-byte before the final passing journey and source lock generation. These intentional local faults are not Verify failures or repair rounds.
