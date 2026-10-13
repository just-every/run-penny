# Stage 0 — runtime conversion and source reconciliation

Candidate based on main `d85943153dbf88e5bba3e658bb95e0cea0de0052`, 29 September
2026. This completes the local runtime prerequisite; it does not advance Penny
to Stage 1 or reopen the flagship's proposed AI, connector or effect scope.
The maintained Base `TANSTACK-START-MIGRATION.md` is the recipe, not copied
product source. Edition source remains owned here.

## Request ownership

| Owner | Surface | Admission and result |
| --- | --- | --- |
| Hono | GET `/health`, `/api/auth/session`, `/api/public/*`, `/api/operator/*` | Existing native JSON bodies/statuses and D1 projections. Operator namespace authenticates before route matching: anonymous unknown members are 401, admitted unknown members 404. |
| Hono preflight, Start document | GET `/app`, `/app/*` | Existing missing/expired/revoked session response: 302 `/signin`, empty body for HTML requests; JSON requests 401. Valid sessions render SSR; unknown admitted documents 404. |
| Hono preflight, Start document | GET `/`, `/signin`, named `/portal/*` documents | Request-time D1 data; public detail preflight retains withdrawn 410 and missing/draft/internal 404. `/portal` and `/portal/` retain a 302, now to `/portal/feedback` (amended 10 October 2026; they were 302 `/` when `/` was the board). `/portal/feedback` is a 200 Start document, and `/` is the public landing (HOME-002), which reads no D1 data. |
| Start | `/_serverFn/<generated-id>` | Two generated GET functions: public projected resources and independently authenticated operator resources. Operator denial is Start's serialized redirect to `/signin`. Foreign Origin is denied before dispatch; native same-origin checks also apply. |
| Assets | `/assets/*` | Built JS/CSS/fonts only, no SPA fallback. Missing assets 404, including navigation requests. |
| Development assets | Observed Vite and Start client/style paths | Restricted local module paths; emitted production artifacts have no such files and return 404. |
| Worker events | None on this main source | The parked Queue/Cron handlers are unported; declaring a Queue producer binding is not an event implementation. No scheduled, queue, email or named event handler was removed from main. |

Configured `APP_ORIGIN` is authoritative for document/HTTP/RPC hosts. Without it,
only `localhost`, `127.0.0.1` and the local Worker-test host `penny.test` are
admitted. Unsupported hosts return 404. No production host is guessed.

Every router request gets its own Router instance. File routes load the existing
Hono DTOs through generated server functions; no repository imports reach the
browser. A request-scoped AsyncLocalStorage carries the real Worker bindings,
not shared mutable state. Each private function revalidates the native D1
session even when called directly. Client navigation calls the same generated
function and does not depend on a prior document gate. Hooks consume dehydrated
loader resources, retaining the existing native HTTP retry controls.

The old `index.html`, `createRoot` entry and SPA asset fallback are removed.
The accepted layouts, fonts and routes are retained; a missing intrinsic SVG size on account-card arrows was corrected after visual inspection. Server deployment configuration moved unchanged into `src/ext/config.server.ts`, preventing the development module graph from carrying private configuration. Date rendering now uses
explicit `en-AU` and UTC on both server and browser to prevent hydration drift.
The `/app` index renders the same overview directly, retaining its native HTTP 200 instead of introducing a framework redirect. Sign-in remains honestly unavailable; its new “Open existing operator session”
link exposes existing provisioned native sessions without adding issuance.

## Deliberate test supersession

`read-spine.test.ts` and `trust-boundary.test.ts` previously demanded the empty
`<div id="root"></div>` SPA shell. Those rendering assertions are superseded
by real emitted-Worker SSR content, scripts and unchanged status/auth checks.
Document tests now use the emitted Worker, while Hono tests retain the original
custom configuration and fixtures. The operator SSR test creates a separate
native allow-listed session for the emitted default configuration; the original
API fixtures and their assertions are unchanged. No security guarantee is waived.

`start-migration.test.ts` adds the missing/expired/revoked/valid session matrix,
independent generated-RPC authentication, same-wire positive controls, foreign
Origin denial, fresh D1 HTML changes, private-field absence, unknown documents,
assets and hosts. The test derives function IDs from the current build, uses
its matching Seroval plain-data protocol and decodes the raw cross-JSON result.
The browser proof additionally captures the actual generated-client wire on
hydrated navigation. No generated ID is a stable public API. These tests use
the edition's existing `[CLAUSE-ID]` reporting convention; a complete baseline
reporter and complete clause suite remain Stage 1/release debt.

No prerender is enabled. No already-applied migration bytes changed; no schema
migration, R2 object change, remote binding, mail, provider effect or deployment
was performed. The existing importer/idempotency suite still runs on real local
D1. This does not establish a production-data migration or restore guarantee.

## Parked source custody and decision

Both historical lineages remain intact: `83d7da5` (the earlier implementation checkpoint)
contains substantial native backend work and migrations 0002–0008;
`2ec4fff7738b2ee04df8402a96886712ae304b8f` (the later implementation checkpoint) is its
later WIP descendant with runtime changes, baseline work and broader proposed
customer-learning modules, migrations 0009–0016. Their histories were
read and left unchanged. Their historical test receipts are
provenance only. The main initial migration is byte-identical in all three.

**Current adoption decision:** retain main's verified read behavior and convert
its runtime. No parked mutation, mail adapter, additional schema or event handler
is carried in this Stage 0 candidate. Their coupled schema, consent, delivery and
recovery obligations belong to the next operable-write milestone; importing
those bytes would silently widen the authorized milestone. Useful source remains
available for selective adaptation, with fresh tests, rather than reimplementation.

**Pending owner decision for Stage 1:** accept/adapt the parked native backend
and select its actual provider/default policy choices (the parked mail default
is Resend), or specify different behavior. Recommended default is selective
adaptation of its native auth, feature-owned write services and durable delivery
mechanisms, keeping later AI/source/grant/tracker work deferred. No provider
choice blocked this local Stage 0. Neither source checkpoint is a complete seed.

## Clause reconciliation

“Read proof” below is narrow: it does not claim the whole clause. `read-spine`
means current `tests/e2e/worker/read-spine.test.ts`; `migration` means current
`start-migration.test.ts`.
All parked write candidates below are **unported and uncovered on this candidate**.
Source names are relative to `src/core/features` at the named checkpoint.

| Stable clause | Current disposition and proof | Parked candidate/provenance |
| --- | --- | --- |
| HOME-001 — Public feedback portal. | Superseded by HOME-002 on 9 October 2026 (the board now lives at `/portal/feedback` under REQ-001, whose tests carry the read proof below; `/` is the landing). Read proof: read-spine customer-safe DTOs; migration first HTML and browser navigation. | 83d7 portal/read services and UI; main read spine retained. |
| OPS-001 — Equal operators. | Partial: equal native session admission, migration matrix. Operator administration uncovered. | 83d7 auth/accounts/catalog/workspace services; later 2ec4 operations work remains unadopted. |
| OPS-002 — Management. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth/accounts/catalog/workspace services; later 2ec4 operations work remains unadopted. |
| OPS-003 — Overview. | Read proof: read-spine overview recency/outcomes and operator pages. Write/scheduling obligations uncovered. | 83d7 auth/accounts/catalog/workspace services; later 2ec4 operations work remains unadopted. |
| OPS-004 — Global search. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth/accounts/catalog/workspace services; later 2ec4 operations work remains unadopted. |
| EVID-001 — Capture. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-002 — Provenance. | Read proof: supplied sample identity preserved by read-spine; capture provenance writes uncovered. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-003 — Review lifecycle. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-004 — Non-destructive linking. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-005 — Account context. | Read proof: read-spine authenticated accounts and evidence chronology; context edits uncovered. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-006 — Private commercial data. | Read proof: read-spine public DTO exclusions and migration HTML/RPC exclusions. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-007 — Duplicate suggestions. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-008 — Evidence attachments. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/attachment-service.ts and read repositories. |
| EVID-009 — Tags. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| EVID-010 — Versions. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 evidence/write-service.ts and read repositories. |
| REQ-001 — Public portal. | Read proof: read-spine projections; migration SSR. Submission/identity portions uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-002 — Requester identity. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth service/requester modules; later 2ec4 identity hardening requires fresh review. |
| REQ-003 — Submission. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-004 — Duplicate prevention. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-005 — Publication. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-006 — Voting. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-007 — Discussion. | Read proof: approved public comments projected; comment writes/moderation uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-008 — Merge. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-009 — Unmerge. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-010 — Follow and consent. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-011 — Portal attachments. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/attachment-service.ts and R2 access. |
| REQ-012 — Portal search and browse. | Partial: board/sort filters and malformed filter denial in read-spine. Search and complete browse obligations uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-013 — Submission idempotency. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-014 — Identity failure. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth service/requester modules; later 2ec4 identity hardening requires fresh review. |
| REQ-015 — Status updates. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-016 — Public status. | Read proof: derived request status in read-spine; status writes uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-017 — Decline. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-018 — Boards. | Partial: public boards read; board management uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-019 — Internal boards. | Read proof: internal board requests excluded in read-spine; board mutation controls uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-020 — Requester's own content. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-021 — Requester withdrawal. | Read proof: withdrawn document/API 410 and exclusion in read-spine; withdrawal writes uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-022 — Blocking a requester. | Read proof: blocked-author projection filtering in read-spine; blocking writes uncovered. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-023 — Email verification. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth service/requester modules; later 2ec4 identity hardening requires fresh review. |
| REQ-024 — Requester identity merge. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth service/requester modules; later 2ec4 identity hardening requires fresh review. |
| REQ-025 — Requester activity. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-026 — Demand attribution. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-027 — Portal embedding. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-028 — Request queue. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-029 — Operator-authored request. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-030 — Moderation verdicts. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| REQ-031 — Host identity claims. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 auth service/requester modules; later 2ec4 identity hardening requires fresh review. |
| REQ-032 — Internal notes. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 requests/operator-routes.ts, public-routes.ts and feature repositories; coupled auth migrations. |
| DEC-001 — States and queue. | Partial: authenticated decision queue reads; lifecycle writes uncovered. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-002 — Brief. | Partial: decision brief read in read-spine; authoring uncovered. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-003 — Comparable bets. | Partial: existing comparable-bet UI preserved and read-spine account/evidence links; comparison authoring uncovered. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-004 — Commitment. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-005 — Commitment effects. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-006 — Revision. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-007 — Review due. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| DEC-008 — Outcome evidence. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 decisions/commitment-service.ts, routes.ts and repositories. |
| ROAD-001 — Internal states. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-002 — Internal record. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-003 — Public projection. | Read proof: approved customer-safe projection in read-spine/migration. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-004 — Approval is publication. | Partial: only approved publication rows are projected; actual approval write uncovered. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-005 — Commitment mapping. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-006 — Public roadmap. | Read proof: public roadmap DTO/SSR; movement/publication writes uncovered. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-007 — Status update draft. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| ROAD-008 — Status update publication. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 roadmap/write-service.ts, routes.ts and repositories. |
| REL-001 — Draft and targets. | Partial: private draft/target reads in read-spine; composer writes uncovered. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-002 — Publication. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-003 — Published wording. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-004 — Recipient eligibility and snapshot. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-005 — Customer-safe delivery. | Read proof: published public DTO boundary; email delivery uncovered. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-006 — Acceptance and retry. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-007 — Idempotent delivery and provider events. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-008 — Outcome response. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-009 — Outcome coverage. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-010 — Empty feed. | Read proof: true empty published feed in read-spine/migration and browser. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-011 — Bounces and complaints. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-012 — Update subscription. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| REL-013 — Delivery states. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 releases/write-service.ts, outcome repositories; notifications delivery/callback services. |
| NOTIFY-001 — Requester updates. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 notifications/service.ts, handlers.ts, routes.ts and durable outbox; known coalescing/policy/UI gaps. |
| NOTIFY-002 — Preferences, timing, and unsubscribe. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 notifications/service.ts, handlers.ts, routes.ts and durable outbox; known coalescing/policy/UI gaps. |
| NOTIFY-003 — Decision review. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 notifications/service.ts, handlers.ts, routes.ts and durable outbox; known coalescing/policy/UI gaps. |
| NOTIFY-004 — No mail loops. | Preserved absence of inbound-mail implementation; no reply-loop effects carried. | 83d7 notifications/service.ts, handlers.ts, routes.ts and durable outbox; known coalescing/policy/UI gaps. |
| NOTIFY-005 — Notification failure. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 notifications/service.ts, handlers.ts, routes.ts and durable outbox; known coalescing/policy/UI gaps. |
| DATA-001 — Export contents. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 schema/custom fields; 2ec4 data archive/erasure/journal service and migrations 0013/0015, unverified here. |
| DATA-002 — Public/private boundary. | Read proof: read-spine API projections, migration HTML/RPC matrix, emitted asset scan. | 83d7 schema/custom fields; 2ec4 data archive/erasure/journal service and migrations 0013/0015, unverified here. |
| DATA-003 — Erasure outranks history. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 schema/custom fields; 2ec4 data archive/erasure/journal service and migrations 0013/0015, unverified here. |
| DATA-004 — Custom fields. | Unported; no current behavior or acceptance proof for this write/operational obligation. | 83d7 schema/custom fields; 2ec4 data archive/erasure/journal service and migrations 0013/0015, unverified here. |

Additional boundaries not represented by a new product clause:

| Area | Disposition |
| --- | --- |
| Native auth, BASE-ACCESS-002/003 | Main native validation carried and independently proven across HTTP/HTML/RPC. Parked issuance/revocation/verification remain unported. |
| Publication snapshots | Main read schema preserved; 83d7 immutable recipient/target snapshots, corrections and outcome revisions remain unported (REL-002/003/004/008/009). |
| Events/callbacks | 83d7 Queue/Cron and signed mail callbacks, fenced leases, retries, callback deduplication and suppression remain unported; no current external effects (REL-006/007/011/013, NOTIFY-001/002/003/005). |
| Attachments | Main R2 binding/health retained. Evidence/request attachment authorization, limits, object custody and erasure need a port and actual R2 tests (EVID-008, REQ-011, DATA-001/003). |
| Extension contracts | Public configuration import retained and asset-scanned. No client extension contribution mount exists on main; the recipe's temporary buyer-mount probe is inapplicable. Parked replaceable recipient/notification policies were themselves gaps. |
| Operations | Describe/setup/deploy/export/restore commands do not exist on main; none is fabricated. Existing dev/build/verify/type generation and local importer retained. Production providers, load, accessibility and packaging remain uncovered. |
| UI | Existing accepted read layouts preserved, SSR/hydration and phone/desktop browser checks added. Parked write controls are not enabled. Full flagship Results/Learning/Needs you journeys remain future stages. |
| Newly proposed scope | 2ec4 sources, grants, learning, execution, experiments and tracker modules and their branch-only clauses are not main authorizations or adopted guarantees; remain deferred. |

## Current local verification — 29 September 2026

Historical local toolchain: Node 26.0.0 and pnpm 8.15.6.
The following receipts were captured privately and are summarized here; they are
not distributed and do not establish current-candidate acceptance.

| Check run on this candidate | Result and receipt |
| --- | --- |
| Fresh `pnpm install --frozen-lockfile` | Fresh dependency directory; `fresh-install.log`. Final lock also checked by `frozen-final.log`. |
| `pnpm cf-typegen` | Wrangler binding generation passed; `typegen.log`. Generated types remain ignored, not a prerequisite to checked-in application/test types. |
| `pnpm verify` | Typecheck, lint, real D1 importer (1 test), production build, and 23 Worker tests across 3 files passed; `final-verify.log`. |
| Migration custody | `0001_initial_data_foundation.sql` SHA-256 `166f26b66d7472f2c2601ef8c9c034e74761ec389f3c0eb46854de2214a8e544` matches main, 83d7 and 2ec4. No migration file changed. |

Material failed attempts informed the final implementation: initial manual routes
could not provide Start's manifest, so the final tree uses generated file routes;
raw Vite client module paths needed the explicit development allowlist; implicit
locale/date rendering caused hydration drift and is now deterministic; independent
list/detail layouts and awaited route headings exposed and fixed incorrect
nesting. Browser filter navigation exposed an obsolete eager fetch in the old
resource hook; initial data now comes only from Start loaders, while a deliberate
retry still uses the native Hono endpoint. Concurrent local runtimes sharing one
persisted D1 store produced internal binding errors; the final probes used one
server at a time. The observed native query error also prompted a regression test
and sanitized private-RPC failure, keeping query text and values out of transport.
The original importer count test passed after removing the explicitly provisioned
browser-only operator; its fixture/assertions were not changed.

This is local runtime/source proof, not hosted-provider acceptance, a production
migration/restore test, complete baseline/product coverage, a first release or a
customer outcome. No external effect was sent. Browser fixtures were removed and
all launched servers/browsers stopped after verification.

8 October notification correction: REL-011 is now implemented for correlated
signed hard-bounce and complaint events on requester notifications through Base
mail intake and atomic D1 suppression. Historical entries above describe their
original milestone. Hosted callback proof and wider release delivery remain open.
