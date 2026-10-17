# Requester subscriptions and sender identity

Migrations `0070_requester_subscription_provenance.sql` and
`0071_author_publication_permission.sql` expand the schema and restrict publication
notices to authors who subscribed on submission. Apply
them through the maintained migration ledger; repeated migration commands skip their
applied entries. Do not execute the ALTER statements twice or remove the expanded
columns on a source rollback. Older code cannot correctly revoke automatic
permissions and must not drain notifications after rollback.

Existing boards retain `vote_subscriptions=0`. A newly created native board uses
`1` only if the company postal address is already recorded. Imported boards keep
the persisted mapping's off default. Historical checkbox permissions retain
`grant_origin=explicit`, including rows whose existing `source` is `vote` or
`submission`. The imported native mapping format remains unchanged; default
policy fields added by this migration do not change historical receipt hashes.
An owner's subsequent policy change remains part of the native custody fence.

`GET /api/public/boards` supplies `subscriptionDisclosure` with `enabled`,
`version`, `vote` and `submission`. Render the relevant disclosure **before** the
action. `POST /api/public/requests/:slug/vote` and `POST /api/public/requests`
accept `subscriptionVersion` alongside their existing body fields. It is required
when the current board enables automatic subscriptions. The current version,
setting, board and postal-address admission are compared in the same transaction
as the vote or submission. A stale disclosure returns 409; refresh and redisplay
it. Held verification actions retain their displayed version and fail if it has
changed before replay. Existing idempotent submissions replay their first result.

Automatic permissions use `grant_origin=vote_subscription` with `source=vote`,
or `grant_origin=author_subscription` with `source=submission`. Both carry
`granted_at`, `board_id` and `setting_version`. Explicit choices have independent
permission records and survive removal of an automatic vote grant. Submission
always contributes one author vote after verified identity admission. Removing
that vote retains the author subscription; withdrawing the request revokes it.
The original durable follower, release, rejection and unsubscribe paths apply.
Publication creates an author-only durable event, with no historical backfill.

The owner uses `PUT /api/operator/boards/:slug/vote-subscriptions` with
`{enabled, version, withdrawExisting?, reason?}`. Withdrawal requires a recorded
reason and revokes only automatic vote grants for that board. Turning the setting
off leaves existing grants in force.

`GET /api/operator/settings/mail` exposes identity, owner permission, missing
postal address and provider test availability. `PUT /api/operator/settings/business`
accepts `{companyName, postalAddress, confirmPostalAddress:true}` and works before
mail is configured. `/setup` requires these company/address fields and the native
owner confirmation; completion and business details commit together under
current native owner authority and the configured origin. Legacy owners see a
postal-address prompt across the operator app until they confirm the address.

Sender configuration is `{companyName, senderName, fromAddress, replyTo,
postalAddress}`; `replyTo` is nullable and a blank sender name uses the company
name. `POST /api/operator/settings/mail/test` sends the candidate through the
real Base SendGrid/Resend client to the signed-in operator and returns
`{testId, provider, result, accepted, message}`. `PUT` on
`/api/operator/settings/mail` adds `testId` and `acceptProviderResult:true`.
Only a fresh, unused acceptance for that exact configuration, provider credential
and native operator version can save. Development suppression and the v1 relay
cannot verify candidate sender identity and show an unavailable state. Requester,
release, rejection and operator mail use the saved sender and optional reply-to;
requester mail includes the postal address and existing unsubscribe links.

Business identity, board policy and permission provenance are product archive
data. Provider test receipts and Base's first-run completion remain installation
state. Archive validation checks identity and automatic permission provenance.

## Bounded verification and remaining acceptance

Three route-flow tests cover NOTIFY-008, NOTIFY-011, and combined
NOTIFY-013/OPS-005. The mail fixture replaces only provider HTTP. Focused route
checks cover automatic and explicit permission withdrawal, one-time author
publication, requester/release/rejection delivery, sender rejection and reply-to,
archive round-trip, historical explicit permission preservation and old-board
defaults. A populated previous-schema upgrade and repeated migration command
check the migration ledger. Live inbox/provider acceptance remains unproved.
Base copied files are unchanged.

OPS-005 remains partial because OPS-008 timezone choice and quiet-hour setup are
outside this change. INT-007 company logo/theme/global name application is also
outside it. The native role model currently admits the owner for configuration;
the future Admin role is not introduced here. CAP-009's capture address, native
proxy-vote creation, MIG-007 carry-over, captured-contact sends and weekly digests
have no implemented choice in this tree; no substitute routes are introduced.
Reply-to is a provider header and creates no inbound record, but a future capture
address must be explicitly excluded when CAP-009 ships. Shared widget forms use
the same disclosure; a separate SDK UI, if added, must render it too.

The common setup fixture now submits company and postal details. Tests creating
new boards must deliberately choose automatic subscriptions off through the
settings route when proving historical explicit-only behavior, or display/pass
the returned disclosure version when proving the new default. Author vote totals
must include the real submission vote. No permanent wording or version pins were
added.
