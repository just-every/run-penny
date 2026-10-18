> Current requester-board integration is recorded in [Base adoption](base-adoption.md).
> The reconciliation below describes the preceding requester source and repairs;
> its statements about unavailable Base/provider code are historical.

# Requester board reconciliation

This milestone ports the requester-board implementation from parked `2ec4fff` onto
verified lineage `f90c5fd`. It retains A's native sessions, opaque submission
URLs, requester-scoped idempotency, atomic submission graph, moderation fences,
TanStack Start documents, data operations and every pre-existing test/fixture.
The parked branch is comparison source, not an integration or deployment claim.

Ported product responsibilities: request write and operator repositories,
merge provenance and transfer history, attachment storage/publication, host claim validation,
held actions, catalog writes and typed custom fields. A's submission algorithm
replaces B's global idempotency implementation; the unused B table is omitted.
No Base module has been copied, invented or substituted.

`0005_requester_board.sql` is a new provisional migration number for the lane
integrator. Applied migrations 0001–0004 remain byte-identical. This additive
migration brings over relevant B request structures and records A's existing
approved names, request content and moderation events. The new prior-data test
starts with migrations 0001–0004, populates private and approved text, sessions,
evidence, comments and an idempotency receipt, then upgrades and exercises reads,
replay and voting. It does not manufacture a new release's data before upgrade.

The default holds every requester submission, edit and comment for moderation,
including the owner's moderated first-post default. Votes never grant consent
unless the unticked updates control is selected. Follows write explicit timestamped
permission; unfollow revokes it. Status updates create durable notification intent.
Actual provider acceptance/delivery is unproven and unavailable in this candidate.

Public projections exclude internal boards, held text, private tags and fields,
identity addresses and host account assertions. Attachments require independent
approval and return 404 after their request leaves publication. Merge preserves
original rows and journals transfers; unmerge keeps later canonical additions.
Cross-visibility merges require an explicit board move first. Private data remains
accessible only through native operator authorization. Host signatures require
valid HMAC, complete claims and the 24-hour/five-minute freshness window.

No consumer launch, remote migration, provider call, deployment, push or main merge
is established by local checks. installation bootstrap's first inbound CI/bootstrap, accepted Base
operator-auth operator-auth, mail mail and deployment refs/provider proof are integration gates.
The 6 October launch review was reconciled alongside the UI audit and complete requester-board scope. Its
requester-board outcome is covered by this local candidate; its provider, Base,
CI and consumer-launch gates are still external. This receipt closes no whole-task
launch claim. See [the repair record](requester-board-repair.md).


The first repair adds provisional migrations `0006_request_contribution_provenance`
and `0007_requester_board_maintenance` after the unchanged candidate 0005. All four
applied migrations remain unchanged. Origin ledgers are the authority for current
vote/follow/evidence projections; immutable transfer journals remain historical
records. Reversals recompute the current graph instead of restoring stale snapshots,
so revoked consent stays revoked and later canonical contributions survive. Identity
merges move the origin ledgers to the surviving identity without rewriting history.
The prior-data regression retains every old table cell and original R2 byte while
upgrading an existing merged chain, then reverses both links.

The maintenance migration extends A's existing write fence to every new business
table. Attachment uploads reserve custody before storing bytes. An uncertain D1
result leaves recoverable bytes and an operator-visible reservation; recovery checks
size and SHA-256 before finishing metadata. Export refuses unfinished reservations
until recovered, and erasure includes their original R2 keys. It never silently
exports incomplete custody. When bytes are missing, the recovery form accepts only the matching original file
and finishes the same reservation. Different bytes cannot replace it.

Pending-action recipient hashes are stored on each issued verification link.
Previously issued links have no such immutable hash, so they can authenticate but
cannot authorize replay; a new verification link is needed for held actions. No old
link, action, permission or receipt is deleted by migration. Terminally invalid held
actions are consumed and reported so later valid actions can proceed. Normalized
submission hashes retain compatibility with A's original idempotency receipts.

Customers withdraw their own feedback from **Your feedback**. A pending request leaves moderation; a published request leaves the board and its public URL returns 410. Its votes stop counting, while its original evidence remains private for operators.

In Moderation, **Customer demand** shows separate voter, linked-evidence and distinct-account counts. Expand **Votes by account** for its breakdown and **Supporters** for verified addresses and linked accounts; **Show more supporters** reaches the rest of the history. These details are private. Historical UserVoice proxy marks remain visible; native proxy entry and ARR/MRR/opportunity/churn demand are not yet available.
