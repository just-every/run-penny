# Native public-door probe results

All observations below come from the three passing journeys on product head 1a239ac5af69af56b76fc0ea1484a40c91901553 in touched-tests.json. These are real emitted-Worker route calls with D1 records; mail alone is faked at its HTTP edge.

PROBE SEG-006 point1-rules: POST and PATCH /api/operator/segments with internalOwnerId equals a current operator -> 201 create and 200 edit; GET returns the same saved identity and exact rule.
PROBE SEG-006 point1-membership: PATCH /api/operator/accounts for the changing account, then GET /api/operator/segments/:id -> exact changing and control identities enter together, then only the control remains on reassignment back; both reads finish within five minutes of their completed write.
PROBE SEG-006 point1-refusals: invalid rule and unknown owner, anonymous and requester sessions, revoked operator session and foreign or absent Origin -> 400, 422, 401 or 403 as appropriate; saved rules, accounts and their audit rows remain unchanged.
PROBE SEG-006 point1-rollback: a late D1 audit abort during PATCH /api/operator/segments/:id -> visible 503 and the complete saved-state snapshot remains unchanged.
PROBE SEG-006 point1-upgrade: populated pre-0110 records and native migration application -> every prior cell and ledger prefix remains equal; applying again changes no rows or ledger entries.
PROBE SEG-006 point1-restore: native export, empty-destination import and segment read -> exact rule and account identities retained; both source sessions receive 401 for new and edited rules with the product snapshot unchanged.
PROBE SEG-006 point1-erasure: reviewed native operator erasure -> only the targeted segment is absent, the unrelated rule and accounts remain, creator attribution is anonymous and retained, recreation is refused with 422, and old capture replay is refused with 409 stale_archive.
PROBE SEG-006 point1-destination-edit: the destination session edits the restored rule and reassigns an account through native PATCH routes -> the same rule identity returns the exact current membership; re-export preserves its changed rule and anonymous creator reference.
PROBE SEG-006 point2: none, request, inbox and report segment filters are expressly omitted from the selected POINTS.
PROBE SEG-006 point3-bounded: populated public request list and detail API responses and rendered documents -> approved public wording remains present while the segment names, identities, rule and private owner attributes are absent. Universal public-payload certification remains unproved and is not claimed.
PROBE MEAS-004 retained-main-regression: native feedback-volume JSON and CSV routes -> private board and evidence-source windows reconcile without multiplying links; the existing journey passes after API conflict resolution.
