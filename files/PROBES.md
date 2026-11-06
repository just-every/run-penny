# Native runtime probes

Head: f9dd8964d39d76ffa0ee85eb35594745480cea85
Door: the emitted Worker, driven by the existing first board journey in `tests/base/board.test.ts`. HTTP mail is the only network-edge fake; D1 transactions, routes, authorization and R2 original objects run natively. No UI changes were made.

PROBE REQ-008 evidence: native evidence creation and merge with two original evidence items plus distinct source, distinct canonical and shared evidence -> exactly five unique evidence links on the canonical request; each evidence reader returns exactly its canonical request link; origin contribution rows and evidence content unchanged.

PROBE REQ-008 followers: verified requester follows on source and canonical with one overlapping person and one distinct person on each -> exactly three canonical followers, all three authenticated activity readers show one canonical follow, earliest projected grant retained.

PROBE REQ-008 permissions: four native follow grants at distinct controlled times -> all four permission rows, identities, addresses and grant times remain unchanged after merge; no additional permission row is minted.

PROBE REQ-008 attachments: native upload of approved source and canonical images plus one held source image, then merge -> exactly two approved files in canonical public detail; original IDs, filenames and bytes retained; moved approved file keeps its source origin; held file stays on the source, returns public 404 and remains privately readable with original bytes.

PROBE REQ-008 atomicity: abort the final request.merged audit insert, then POST native merge -> 503; complete persisted merge graph and R2 object list unchanged; both public details, both operator contexts, all three requester activity responses and all five evidence-link readers exactly equal their nonempty pre-merge snapshots; both approved file byte streams unchanged and held file remains private. Remove only the test-owned trigger, retry -> 200 with the expected complete union, moved comment, collapsed vote and 301.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, restored ACCEPTANCE.md and docs/CLAIMS.md from origin/main; ledger=none exit=0 (no migration change).
