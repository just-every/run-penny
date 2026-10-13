# Penny read spine

Penny's UI/data spine began read-only and still serves every screen through
explicit DTOs from `src/core/shared/api/`; no endpoint serializes a database
row. The operator decision loop adds its own write routes (listed in the README
screen map and proven in [the acceptance record](../ACCEPTANCE.md)); none of them
uses a fixture-backed UI state, a mock service, or a substitute for an
unavailable provider.

Documents now render these DTOs through TanStack Start route loaders and hydrate
with generated read functions. Native Hono endpoints retain their contracts;
[Stage 0 evidence and source reconciliation](start-migration.md) records the
rendering change and the unported write backend.

## Public routes and DTOs

| Client route | API route | Current result |
| --- | --- | --- |
| `/portal/feedback` | `GET /api/public/boards` and `GET /api/public/requests?board=&status=&sort=` | public boards and published customer-safe request cards |
| `/portal/feedback/:slug` | `GET /api/public/requests/:slug` | one public request and approved public comments; a previously public withdrawal is `410`, every other hidden record is `404` |
| `/portal/roadmap` | `GET /api/public/roadmap` | approved customer-safe roadmap projections and their approved mapped requests |
| `/portal/updates` | `GET /api/public/releases` | published release versions only; truthfully empty until a release is published |
| `/portal/updates/:slug` | `GET /api/public/releases/:slug` | one published release or `404` |
| `/portal/feedback/new` | none | a fresh unavailable state; submission and requester identity are not implemented and no input is collected |

Public request status is derived at read time. A Declined request is Declined;
otherwise an active approved roadmap mapping projects its roadmap state, and an
unmapped request is Open. Readers select only public title/description, board,
counts, approved comments, roadmap-publication copy, and published release
fields. They never join account, evidence, or decision tables.

## Operator routes and DTOs

Every `/api/operator/*` route requires an allow-listed, unexpired D1 operator
session. Missing or invalid sessions return `401` with
`{ "authenticated": false }`; the Worker redirects an unauthenticated browser
request for `/app` to `/signin`. `/api/auth/session` can inspect a session, but
the current port has no native session-issuance or sign-out route.

| Client route | API route | Current result |
| --- | --- | --- |
| `/app/overview` | `GET /api/operator/overview` | ready/review-due decisions, unreviewed evidence, Planned/In-progress roadmap, recent published releases |
| `/app/feedback` | `GET /api/operator/evidence` | attributed evidence, current wording, account/requester context, tags |
| `/app/decisions` | `GET /api/operator/decisions` | decision queue |
| `/app/decisions/:slug` | `GET /api/operator/decisions/:slug` | comparable decision brief |
| `/app/roadmap` | `GET /api/operator/roadmap` | internal roadmap cards and current public-projection status |
| `/app/releases` | `GET /api/operator/releases` | draft and published release records |
| `/app/releases/:slug` | `GET /api/operator/releases/:slug` | release detail and internal targets |
| `/app/customers` | `GET /api/operator/accounts` | commercial account cards |
| `/app/customers/:slug` | `GET /api/operator/accounts/:slug` | commercial context, requester addresses, evidence, linked decisions |

The SQL remains in small feature-owned `read-repository.ts` files. Public
request, roadmap, and release projections remain with their features; the
portal mounts public routes and the workspace composes overview data only.

## Contract areas: represented versus proven

The table maps the port to the product contract without pretending that a
screen fulfils the timing or operational remainder of a clause.

| Ported surface | Contract area represented | Current proof |
| --- | --- | --- |
| public feedback board | REQ-001, REQ-016 (HOME-001 superseded by HOME-002) | configured board route at `/portal/feedback`, published-only DTOs, derived Open/Planned state |
| public roadmap | ROAD-003, ROAD-004, ROAD-006 | approved projections and mappings only; internal records never reach public reads |
| public updates | REL-010 | draft releases are filtered and an empty feed renders no placeholder release |
| public/privacy boundary | DATA-002, EVID-006 | explicit public DTOs and Worker tests reject account, evidence, decision, and commercial data |
| operator overview/read workspace | read portion of OPS-003; evidence, request, decision, roadmap, release, and account read areas | every existing operator reader requires a real D1-backed allow-listed session |

Tests do **not** claim completion for unimplemented request actions, decision
commitment, roadmap changes, release publication/delivery/outcomes, session
issuance, search, rate limits, notifications, or accessibility. Add tagged
contract tests with the corresponding real behavior; never create a green
placeholder to cover a deferred clause.

## Seeded projection

`sample-data/penny.v1.json` declares `roadmapPublications` and
`roadmapRequestMappings`, graph-validates them, and inserts them idempotently
after roadmap records. The SCIM request has its approved SCIM roadmap mapping,
so its derived public state is Planned. Shared external threads has no mapping,
so it is Open. The only seeded release is a draft and remains absent from public
reads.

## Deliberately deferred work

This read spine does not add portal submission, voting, following, comments,
moderation, status updates, roadmap publication mutations, decision commitment,
release publication, requester identity, mail delivery, Queue/Cron consumers,
outcome recording, rate limiting, setup/deploy/export/import, or accessibility
and load verification. The UI names unavailable capabilities instead of
inventing local state.
