# Native feedback milestone — 2 October 2026

Historical implementation record. Commands and startup behavior below describe
that milestone; use README.md, OPERATIONS.json and current package scripts for
the maintained terminal/outbox path. This record is not current acceptance.


This implements the bounded milestone in `ACCEPTANCE.md` on the accepted Stage 0
Start runtime, not the whole parked app or the full flagship. Requirements remain
in `CONTRACT.md`; the stage gates in `docs/flagship-acceptance.md` are unchanged.

## Implemented scope

- Allow-listed operator link request, 15-minute single-use consumption, HttpOnly /
  Secure / SameSite=Lax cookie, durable revocation on sign-out, and existing native
  document/API/generated-function session admission.
- Requester 30-minute single-use email verification and browser-local bearer
  session with a 30-day idle expiry; no requester cookie. Blocked identities are
  refused. Pre-verification held-action replay is deliberately not enabled.
- Verified requester feedback submission to an available public board. One atomic
  D1 batch creates request, unreviewed evidence, original wording/version, link,
  idempotency reservation and audit entry. Replays return the existing request;
  changed bodies return 409. A concurrent loser rolls back its entire graph.
- Operator moderation at `/app/moderation`, including explicit safe title,
  description, board and display name approval; rejection requires a reason.
  Approval records an immutable moderation event and audit entry atomically with
  the public projection. Original evidence is retained privately. A competing or
  repeated moderation write returns 409; internal/archived boards cannot publish.
- Foreign-origin/cross-site mutation rejection, strict input schemas and 32 KiB
  streaming body cap. Durable auth IP/email and submission IP/identity limits use
  the corresponding declared numeric defaults. Existing public-read limits and
  the complete remaining endpoint inventory are still uncovered.

## Local sign-in transport

Local development and tests capture sign-in and verification messages in Base's
development outbox (`/__dev/outbox`), which exists only for an explicit loopback
local or development origin. Remote origins, preview and production never accept
it and return `mail_unavailable` rather than sending or simulating production
delivery. Issuance returns only `{accepted:true}` for both allowed and
disallowed operator addresses; a disallowed address has no link. Auth HTTP
responses are no-store. The outbox holds the raw synthetic token needed for
browser testing, durable admission stores hashes, and consumption clears the
entry. It is not production mail or proof that someone owns an email address:
do not export the local database as customer identity data or provision the
transport remotely.

Start it with `rer setup --owner-email EMAIL` and `rer dev` (README.md), open the printed outbox and follow the newest
link in the same browser. For requester verification, request a link on the
public board, open the emitted fragment link and choose Verify email. Continue
to submit feedback, then moderate it using the operator session. Public
DTOs/SSR show only explicitly approved fields. Sign out revokes the native
operator session. The bounded local data workflow is documented in
`data-ownership.md`; remote setup/deploy and release remain unavailable.

## Source and migration custody

`0001_initial_data_foundation.sql` remains byte-for-byte unchanged. The additive
`0002_native_feedback_baseline.sql` is this candidate's native scope, not a claim
that the parked migrations 0002–0015 were adopted. The earlier implementation checkpoint's native
services/repositories and migration graph were compared; their broad request,
operator, pending-action and mail dependencies were not copied wholesale.
The ULID utility is adapted from that retained source. Existing public read DTOs,
Start loaders, layout primitives and native D1 session validator are reused.
Future ports must reconcile this new migration lineage explicitly.

## Acceptance mapping and limits

| Clauses | Current proof boundary |
| --- | --- |
| BASE-ACCESS-001/002/004 | Native local issuer/consumer, expiry/replay, sign-out and retained session gates; real email delivery unavailable |
| BASE-ACCESS-003 | New identity/submission limit tests and manifest paths; full read/endpoint limit coverage incomplete |
| REQ-002/003/005/013, EVID-001/002/006/010, DATA-002 | Verified submission, original evidence/version, idempotency, safe moderation/projection and privacy; attachment/editor/other lifecycle parts unimplemented |
| REQ-018/019/022 | New writes refuse unavailable boards and blocked identities; board management and block/unblock UI remain unimplemented |
| REQ-023 | Link expiry/single use and browser-local session implemented locally; real delivery, pending 24-hour actions and host-signed identity remain unimplemented |
| BASE-OPS-002 | Additive migration preserves Stage 0 sample records; no released-tag migration or production recovery claim |

This is a historical local milestone. Private launch receipts are not distributed;
[the current acceptance requirements](../ACCEPTANCE.md) govern a new candidate. A green local gate does not establish export/erasure,
provider acceptance, packaged installation, accessibility conformance, load,
customer outcomes or release readiness.

## Independent privacy correction

Native public slugs are content-independent `feedback-<ULID>` identifiers. The
original title is never used to construct a public URL. Migration 0003 rewrites
only this unreleased native milestone's submission-key-linked records; curated
Stage 0 URLs remain stable. IDs, evidence links and audit references are retained.
Old unsafe native URLs deliberately stop resolving rather than expose private
wording through redirects or public aliases. There is no production rollout or
released-native-URL compatibility claim.

A declined request keeps its existing votes and discussion visible. New votes and requester comments close until an operator reverses the decline in Moderation. A public reason is required; revising that reason does not replace the saved status the reversal restores.
