# sd-penny-c-f87 — DATA-006 native OpenAPI scope

Repository: just-every/run-penny. Product branch: cloud/sd-penny-c-f87.
Baseline main: 8d4b0ac3eebe3e50003b61820f9c366282986327.
DATA-006 stays PARTIAL. No acceptance sentence or other clause judgment changes.
Counts before and after: 79 done, 124 partial, 78 missing.

## Selected plan and completed work

The planner selected acceptance point 1 only for the existing native boards,
requests, comments, status updates, releases, proxy-contact lookup and proxy-vote
recording. The initial gap was the absence of a machine-readable OpenAPI document
and document-driven HTTP contract proof. Existing native API and proxy-vote
journeys already covered bounded authority, publication, consent and replay.

1. Read the clause, current Status gap, native routes, public projections, input
   validators, existing journeys and the shipped ct riders and rulings. Penny
   RL-101 concerns bulk actions and does not change this API scope.
2. Share the existing input validators with the scoped API. Serve OpenAPI 3.1
   JSON at GET /docs/openapi.json, with relative installation URL, HTTP bearer
   authentication, required native scopes, concrete schemas, native status codes,
   list limitations and explicit approval and custody prerequisites.
3. Reconcile all 14 documented operations against actual built-Worker requests.
   Exercise successful operations on populated data, absent credentials,
   insufficient scopes, invalid inputs and unchanged product custody on refusal.
   Retain the previous native publication assertions in this broader journey.
4. Validate the fetched document offline, preserve unknown-document refusal and
   private API admission, inspect the unchanged docs at both requested widths,
   regenerate the contract views for checking, restore them to main, regenerate
   the source lock last, and run the touched tests, typecheck and structural check.
5. Push the named product branch with fleet identity and preserved hooks, report
   exact-SHA CI honestly, and publish these actual files on the separate evidence
   ref. Main, tags, releases, provider configuration and hosted publication are
   outside this cloud task.

## Proof and test budget

The permanent journey is tests/base/integration-openapi.test.ts:
“[DATA-006] serves an offline OpenAPI contract and reconciles every documented
operation with native allowed and unchanged-state refusal journeys”. It fetches
the contract through the emitted Worker, iterates every declared operation and
validates native request and response bodies using the independent Worker-safe
JSON Schema validator. No provider or schema service is called by validation.

The prior API-003 native publication registration in
./tests/base/integration-api.test.ts was consolidated into this same API flow.
Every prior assertion remains: missing approval, missing board, unknown body
field, unchanged counts, explicit comment publication, status replay and
conflict, one status event, unchanged permissions, public text and privacy,
missing release refusal, and held new wording. The public door is now the built
Worker. Base test registrations are 186 before and 186 after by static
registration count; no cap raise, skipped case or width condition was added.
Existing revocation, expiry, issuer-removal, usage-storage-failure and transaction
fences still run in the affected API and proxy-vote files.

The scenario also checks distinct response fields, populated nested categories,
held wording absent from public lists, no proxy identity verification or consent,
API keys refused at operator doors, foreign-origin writes refused unchanged, and
unknown API and docs paths returning 404. The schema and native parser both
refuse an impossible calendar date, unsupported setup URL scheme, conflicting
proxy customer selectors and repeated evidence identifiers.

## Honest remainder

DATA-006 point 1 is not complete: the other operator resource families, their
OpenAPI contracts and complete pagination and filters remain required. Point 2
still requires complete lifecycle-webhook signatures and replay proof. All
existing provider, account, Base, device, payment, ct and release holds remain;
API-003's held publication-custody remainder is unchanged. Native release
publication in this fixture is isolated and is not hosted publication or live
mail qualification. No homepage, logo, visual redesign or policy default changed.
No migration or reconfiguration is required.

## Riders and pre-ready assessment

1. MET for the selected resource slice only: one native journey reaches all 14
   operations and checks populated results and refusals. Full DATA-006 remains
   partial for the named remainder.
2. MET for this slice: unsafe calls are attempted against populated custody and
   stable before-and-after snapshots prove no product effect.
3. The journey is under the existing base test glob in both push Verify shards.
   Exact candidate CI status is recorded in ci.json; local passing checks alone
   are not called CI green.
4. Final source and test bytes are exercised by the recorded final local gates;
   the separate probe records the same final candidate and fetched document.
5. No inherited duty or acceptance text is rewritten; existing native authority,
   consent, publication and erasure duties remain with their current clauses.
6. Status and counts remain unchanged. The Evidence and Gap name current bounded
   proof and every selected remainder. Generator write and check pass locally;
   generated view files are restored and excluded from product commits as required.
7. No acceptance point or ruling changes; all parent Status rows are retained.
8. All 14 operations exercise insufficient authority and unchanged-state refusal;
   existing dangerous-path revocation and storage-transaction assertions remain.
9. No live provider, legal, device, deployment or hosted portability boundary is
   claimed as proven.
10. No new policy decision or authority grant is introduced.
11. Main equality, full-history publication scan, landing and Run site on the
    resulting main SHA remain guarded-lander duties. No local scan receipt or
    completed landing is claimed.

The selected change adds a machine document and preserves the docs layout; it
adds no product control or new screen. The /docs screenshots are preservation
proof. Existing assertions were retained and none was narrowed or placed behind
an environment or viewport condition. Credential revocation coverage remains in
./tests/base/integration-api.test.ts and ./tests/base/proxy-votes.test.ts. No new
capture, restore, erasure or outbound authority path is introduced. New fixture
text contains no email-shaped address or provider-shaped credential. The source
lock is regenerated after the last source edit. Publication scanning and Run site
are expressly deferred to the fleet lander under the cloud adaptation.

## Probe and mechanical handoff

PROBE DATA-006 point1: native built-Worker document and document-driven requests
for all 14 operations -> valid populated responses; invalid, unauthenticated and
insufficient-scope calls refuse; stable product snapshots on refusal.

Exact commands, exit codes and elapsed times are in checks.json. The actual
fetched document is openapi.json; probe.json records native document and docs
responses and screenshots. Final product SHA, push custody and CI run IDs are
recorded below and in the corresponding JSON receipts. No PR is needed for this
repository's push workflow.

Final product head: 4ab9cda462ad2d3b68106df1f2ddf5f4b76ad748. Tree: a6aa71b5ad088fede00a654e4ce733559f26adc9.
Product save: 1b4ab25, followed by the final candidate above. Both pushes used
the fleet guard and succeeded on the first attempt; both candidate commits have
fleet author and committer identities and no co-author trailers. A fresh main
fetch and non-rewriting merge check immediately before the final push reported
already up to date. Product checkout and index are clean.

Local results: build PASS; 3 touched files and 9 tests PASS; typecheck PASS;
touched lint PASS; first-party structural check PASS; OpenAPI 3.1 offline
specification validation PASS. The source and test hashes above match the final
committed tree; the browser probe ran after that commit.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock, then check exit=0;
views=node src/base/contract-docs.mjs write, then check exit=0, followed by restore
of ACCEPTANCE.md and docs/CLAIMS.md from origin/main; ledger=none exit=0.

Frozen bounded rubric: R1 document fetch and offline validation (test lines 25–40
and probe.json); R2 every native operation has a populated successful contract
case (lines 80–148); R3 invalid, missing-key and insufficient-scope calls refuse
with unchanged custody (lines 103–122 and 149–161); R4 existing approval, replay,
privacy, held wording and admission are retained (lines 46–70 and 163–173). All
four are locally MET. This is no claim that DATA-006 is DONE.

Plan row changed for relay only: DATA-006 PARTIAL -> PARTIAL; existing API scope
now has OpenAPI and native contract proof; all listed remainders remain. No
other plan row changed and no unavailable Mac plan or inbox file was read.

## Exact-SHA CI and custody

Push Verify Penny run 42183620010, event push, completed with conclusion failure
on 4ab9cda462ad2d3b68106df1f2ddf5f4b76ad748:
https://github.com/just-every/run-penny/actions/runs/42183620010
The plan passed. All 29 shard jobs have exactly one failed step, Check generated
contract documents; Check edition source lock freshness passed. Runtime test
steps did not start. This is the explicitly permitted generated-view exception,
not a passing runtime CI run. No repair, rerun or workflow edit was made.
The failed base-1 job is 127778749702; its archive log was read once using the
authorized gh run view command. Jobs and failed-step details are in ci-jobs.json
and the actual sanitized log is ci-failed.log. Four GitHub CLI calls were used:
main status, exact-candidate discovery, completed-job details, and one failed-job
archive. No fast polling or duplicate workflow was started.

Main at the reviewed baseline had Verify 42176843779 and Run site 42176843655
completed successfully. No PR was created: this repository has a push entry point.
Main is not advanced by this task. No blocker remains for handing this pushed
partial-scope candidate to the guarded lander under the generated-view exception.
The lander must generate the views, run exact-SHA Verify, perform its complete
full-history publication scan and confirm Run site on the resulting main head.

No mutation run or full-history publication scan is claimed by this builder.
All fixture-publication effects stay inside the isolated native test Worker.
The report packet is published separately from the product ref.
