# Decision loop acceptance

This change adds operator evidence capture and review, comparable candidate bets, atomic commitment to an internal Planned item, explicit safe publication, and recorded roadmap moves. Commitment never approves public wording. Editing draft customer-safe fields retains the last explicitly approved wording until a separate approval. New approvals require an explicit active public board. Pre-existing approvals retain their previously approved fields with no inferred board; an operator can explicitly add one on reapproval. Published requests on archived boards remain valid mapping targets under REQ-018, which keeps their URLs reachable. A publication has its own opaque public slug; internal item identity is never projected. Declined bet items retain their exact internal records. Historical duplicate item associations survive upgrade and archive restore; new duplicates are refused, and commitment requires an operator to retain one association before proceeding.

The queue includes draft, ready, committed and review-due records. Readiness follows question, owner, candidate and linked evidence. Linking and unlinking record decision activity without changing committed/review-due state. Affected requesters are the distinct requesters explicitly named on linked evidence. Affected accounts are the union of explicit evidence accounts and stored candidate-bet account links; account membership alone does not infer that a requester is affected. Metrics also use evidence stances and actual observed instants; shared evidence/accounts count once in brief totals. There is no score or ranking.

Moves are atomic with the safe status-update draft seam. Drafts capture the approved wording and public identity plus exact approval and mapping witnesses at the write point. Dropped hides the public item and projection while retaining approvals and mappings for draft publication validation. Explicit withdrawal preserves internal records and mapping history, and frees withdrawn mapping slots for reuse. Status-update publication and release delivery are separate work; the draft seam alone is not proof of that lifecycle.

## Verification status

The Worker tests, the empty-store browser journey, the route review and the operator-page checks are recorded in [ACCEPTANCE.md](../ACCEPTANCE.md). They ran on the reviewed head.

- The populated 0012-to-0013 migration test compares every pre-existing column of every old table, including original evidence, snapshots, account links, approved and declined items and withdrawn mappings, checks foreign keys and checks no-write replay.
- Worker tests cover lifecycle, dimensions, refusal, atomicity, privacy, projection, concurrency and populated ownership. The unchanged all-table ownership suite also passes.
- The operator-page browser script checks both desktop and mobile widths.

## Open contract boundaries

EVID-008 attachments, EVID-005 account creation/editing beyond choosing an existing account, EVID-007 duplicate suggestions, and EVID-010 wording-version editing remain open in this loop. Existing evidence versions are preserved and the current version is snapshotted. DEC-006 revision, DEC-007 review-due automation, NOTIFY-003 review-due notifications, DEC-008 outcome evidence remain open. Merely displaying a legacy review-due record does not implement its scheduler.

The release work retains its separate open outcome responses/coverage (REL-008/009), every-release subscriptions (REL-012), and published corrections (the remaining REL-003). Existing consent, suppression, identity-merge custody, quiet hours and coalescing rules are not replaced. REL-007 remains limited by SendGrid’s lack of provider duplicate suppression for Penny’s durable key: an ambiguous send remains unknown with no automatic retry. This change makes no claim of exactly-once provider delivery. REL-011 also retains the existing Base intake limitation for delayed or asynchronous SendGrid bounce events without a message ID; historical attempts without trusted recipient and attempt correlation are not retroactively accepted.

The release version and private tag are unchanged; feature completion does not authorize a public flip or tagged release.
