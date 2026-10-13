# Requester activity, identity endpoints and approval ordering

This local requester-board repair extends `aed9287f81c1baafb0660673ed4e6787b15764b3`.
It preserves the requester board and all earlier repairs. No contract meaning,
applied migration, existing test, fixture, dependency pin or runner is changed.

- **REQ-005/019/025:** activity projects canonical identifiers only while that
  request passes the complete public publication predicate. Votes and follows use
  their contribution origins; comments and comment edits use the comment origin.
  When the canonical is unavailable, the response retains the known original
  context and the requester's own history with `available:0`. Public canonical
  votes still collapse to one. The votes UI labels unavailable history and does
  not link to an unavailable request. Own requests and request edits retain their
  existing ownership and public-board boundaries. This exposes no canonical
  title, description, ID or slug merely because a merge occurred.
- **REQ-030:** a rejected own comment or comment edit can still be appealed using
  its original known request slug. The same transaction checks ownership and
  rejection and records the subject's current request internally. This preserves
  usable moderation controls without disclosing the unpublished target.
- **REQ-024:** both identity merge endpoints must be active at transaction time.
  A retired source or target returns `409 identity_merge_changed` with no partial
  transfer. An operator selects the current survivor explicitly. Active survivor
  chains retain historical edges and transfer sessions, verified addresses and
  contributions together. The existing transient D1 assertion table fences the
  whole batch, including an opposite concurrent merge; it is empty on success
  or rollback. Historical merge records are not rewritten.
- **REQ-020:** an own edit always creates a held revision, but its initial draft
  update now requires `published_at IS NULL` inside the same transaction. First
  approval can commit between the ownership read and edit batch without hiding
  the approved request or replacing its public snapshot. The held revision can
  subsequently be approved or rejected through the existing operator workflow.

Sixteen new real local D1/Worker regressions live in
`tests/e2e/worker/requester-activity-identity.test.ts` and its three case files.
The first 13 checks ran against the unchanged parent production source: 12
failed and the serial edit-before-approval control passed. The final focused
16-check run passed, including native API calls, three controlled interleavings,
opposite concurrent HTTP merges and an injected late SQL failure. Scheduling
proxies and SQL fault triggers exist only in tests and execute actual D1 SQL.
The controlled edit/approval race is a native D1 test, not an ordinary HTTP
reproduction of that scheduling window.

Historical verification and emitted-Worker browser receipts were captured
privately. Re-run the shipped checks for the current candidate; see
[acceptance](../ACCEPTANCE.md).

No push, PR, merge, deployment, remote migration or provider mail occurred. Native
email links use only the explicit synthetic local outbox. No claim is made to
repair identities already stranded by an older installed version: this candidate
has never been deployed. installation bootstrap, accepted Base operator-auth, mail and deployment adoption, provider
acceptance, the main integration remain the root's wider gates.
