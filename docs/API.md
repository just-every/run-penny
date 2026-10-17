# Scoped Penny REST API

An operator creates a named key in Settings, selecting only needed scopes and an
optional expiry. Save the password-masked value immediately: Penny stores its
SHA-256 hash and cannot reveal it again. Revoking the key takes effect on its next
request. Removing or changing the issuing native operator's authority also
invalidates it; reactivating that operator does not reactivate old keys.

Send `Authorization: Bearer <key>` over the installation's HTTPS connection.
Keep keys in a server's private secret store. Do not embed them in browser code,
URLs, logs or command arguments. Keys never admit operator documents, generated
server functions, data exports, owner claim or editor configuration.

All routes are under `/api/v1`. JSON writes require `Content-Type:
application/json`; requests from a foreign browser Origin are rejected. A
server client may omit Origin. Route handling chooses scopes and resource
identifiers; request bodies cannot choose either. JSON bodies are bounded to
32 KiB and unknown fields are rejected. Responses use private no-store headers.

| Method and route | Scope | Behavior |
| --- | --- | --- |
| GET `/requests` | `requests:read` | Current approved published public requests. |
| GET `/requests/:slug` | `requests:read` | Native found, redirect or withdrawn result; absent returns 404. |
| POST `/requests` | `requests:write` | Create an unpublished operator request with title, description, boardSlug and optional evidenceIds. It does not publish wording. |
| GET `/requests/:slug/comments` | `comments:read` | Approved published comments, with safe display names. |
| POST `/requests/:slug/comments` | `comments:write` | Publish `{body, approve:true}` on an already published public request. |
| GET `/requests/:slug/status-updates` | `status:read` | Native public status history. |
| POST `/requests/:slug/status-updates` | `status:write` | Publish `{status,body?,idempotencyKey,approve:true,pinned?,publicEta?,internalStatusId?}`. Status accepts open, under_review, planned, in_progress, shipped or declined. Declined requires a public body. ETA is a month or quarter (`YYYY-MM` / `YYYY-Q1`); null clears it, omission preserves it. The internal status must map to the supplied public status. An unchanged status without wording or ETA change publishes nothing. |
| GET `/releases` and `/releases/:slug` | `releases:read` | Immutable native published release wording. |
| POST `/releases` | `releases:write` | Save a native draft with title, body, releaseType, tagIds, publicationDate, targetIds and optional setupUrl. The server selects the issuing actor. |
| POST `/releases/:slug/publish` | `releases:write` | Explicit `{approve:true}` publication, subject to the native reviewed targets, Shipped state, mappings and snapshot seals. |

`approve:true` means the automation's owner has explicitly approved that exact
customer-safe wording. A write key is powerful: delegate it only to a server
that enforces this review. It cannot bypass native target checks, consent,
moderation, maintenance locks or immutable publication snapshots. Requests and
history imported or restored from saved files do not invoke this API or queue
new publication effects. Existing notification consent rules still select the
only recipients eligible for an intentionally published update.

Keys are installation credentials, excluded from portable product archives.
After recovery or moving an archive, re-enter integration configuration and issue
new keys. Safe durable usage records contain key ID, time, route-selected scope,
resource and generated request ID, never the bearer or request body. Usage
storage failure refuses authorization. Native authority is checked again in
the same D1 transaction as each business read/write batch.

Errors are JSON `{error:<code>}`: `integration_token_required` (401),
`integration_token_denied` (401), `integration_authority_changed` (401),
`validation_failed` (400), `forbidden_origin` (403), `not_found` (404),
`integration_route_not_found` (404), `integration_mutation_refused` (native
400/404/409/422), or `service_unavailable` (503). Idempotency conflicts retain
the native `idempotency_conflict` code. A refused request creates no business
rows; a safe authorization-attempt receipt may remain. Retry only after reading
the error, and use the same native idempotency key for an intended status action.
