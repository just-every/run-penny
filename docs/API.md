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
| GET `/proxy-vote-contacts?q=...` | `votes:write` | Private active customer choices (name, ID and an address), limited to 25 results. Use a server-held key. |
| POST `/requests/:slug/proxy-votes` | `votes:write` | Record demand for an explicitly selected requesterId or new unverified contact `{displayName,email?}`, with required source and optional sourceUrl/evidenceId/importance. Importance is a board-enabled level (1–3 or 1–4), null or omitted. An existing supporter adds no second vote. This creates no verification or email permission. |
| GET `/boards` | `requests:read` | Public boards, participation/display settings, optional importanceChoices labels and public category counts. |
| GET `/requests` | `requests:read` | Current approved published public requests; filters `q`, `board`, `category` (category ID, including its subcategories), `status` and `sort` (`recent`, `votes`, `newest`, `trending`). |
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

Public request cards and details include `category` (`null`, or `{id,name,parent}`,
with `parent` null or `{id,name}`). Boards include `categoryMode` (`off`,
`optional`, `required`), `postingPolicy` (`requesters`, `operators`),
`commentsAllowed`, `showVoteCounts`, `showVoters`, `anonymousRequesters` and
`categories` (`id`, `name`, `parentId`, `position`, `archived`, `requestCount`).
A parent category's count and filter include its direct subcategories. Archived
categories remain on existing requests but cannot be chosen for a new submission.
Public counts exclude unpublished, held, withdrawn, merged, blocked-author,
and internal-board requests. Archived boards leave navigation; their published request URLs stay reachable.

When a board hides vote totals, `voteCount` is absent from its public cards,
details and status-roadmap cards, including scoped API reads. Sorting by votes
still works. A detail includes `showVoters` and `commentsAllowed`; `voters` is
absent unless enabled, and then contains display names only. Board anonymity
changes requester attribution and voter names to `Anonymous`; operators retain
private identities. The portal discloses a public voter list before voting.
`trending` scores current votes and approved comments from the last 14 days,
each weighted by `1 / (1 + age in days)`; `newest` uses request creation time.

Requester POST `/api/public/requests` accepts optional `categoryId`; required
boards refuse its omission (400), and operators-only boards refuse requester
submission (403). Disabled requester comments and comment edits return 403.
These controls apply to requester actions, including embedded portal actions;
operator API request creation and approved operator comments remain available.
Operators can download a private CSV of up to 2,000 requests, including parent
category and category, at `/api/operator/requests/export.csv`. Larger exports
return `csv_export_limit` (413); use the complete portable archive instead.
