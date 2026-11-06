# sd-penny-c-f100 results

Product repository: https://github.com/just-every/run-penny
Branch: `cloud/sd-penny-c-f100`
Candidate: `676857454ae3d817900f89ca1a104c7c2a7a1390`
PR: none; the existing branch push workflow is the entry point.

DATA-006 remains PARTIAL -> PARTIAL. Counts remain 79 done, 124 partial and 78 missing. Every one of the 281 parent Status rows remains, with 445 table lines before and after. Acceptance sentences and Gap text are unchanged. Only DATA-006's Evidence cell gained the new bounded proof.

The predecessor `7652bb6591cb59c1523a72fdaab857977b52e663` is already an ancestor of current main `6c1eb018f6391de17e04fc8868c0c74f8732abd8`. The fresh full-history branch retains it and every other writer's commit. The requested final main refresh and an autostash rebase completed before generation and locking; no published history was rewritten. The product push succeeded on its first attempt with fleet author and committer, active commit hooks and no trailers.

## Selected point and changes

Acceptance point 1's selected scope is the existing 14 REST operations: list boards; list, create and get requests; list and create comments; list and publish status updates; find proxy contacts and record proxy votes; list, create, get and publish releases. Main already had the machine-readable document, shared input validators, official offline structural validation and the native least-scope HTTP journey. This round finishes its ordinary response-variant proof in the same journey, with no new test registration.

The served document now explains JSON canonical and withdrawn lookups, unavailable history subresources, draft release privacy and successful replay semantics. The native journey validates those responses against the served schemas, proves held requests and draft releases remain absent from reads and lists, checks positive demand with hidden totals and optional public voter lists, and proves proxy, status and release replay leaves the selected business, consent and delivery rows unchanged. Release replay returns the same exact publication identifiers. Known empty-filter behavior and unsupported-query refusal are also exercised. Existing structural, valid-input, invalid-input, approval, scope, revoked-key, unknown-path, no-consent, HTTP admission and native namespace assertions are retained.

Evidence: `tests/base/integration-openapi.test.ts`, test “serves an offline OpenAPI contract and reconciles every documented operation with native allowed and unchanged-state refusal journeys”. Lines 22–47 fetch and structurally validate the document; 129–189 reconcile operations, scopes, invalid cases and HTTP admission; 190–212 cover held and draft isolation plus populated projections; 214–222 cover no-change replay; 224–238 cover board privacy variants; 240–256 cover canonical, withdrawn, missing and filter cases; 271–294 preserve namespace and revoked-key boundaries. Operation descriptions are in `src/core/features/integrations/openapi/document.ts` lines 44–55. `docs/API.md` records the supported semantics.

No UI or layout source changed. The existing docs page still returns 200 and unknown nested document paths return 404 in the native journey. The selected brief omits visual work, so no design tooling, browser screenshot or hosted publication was needed.

## Remaining contract work

Point 1 still lacks other operator record types, their complete OpenAPI coverage and full pagination and filters. Point 2 still requires every lifecycle webhook's signature and replay proof. These are explicit omitted remainders in this round's POINTS, not newly invented external blockers. Existing provider, device, account, Base, publication-custody and release holds remain unchanged; the API-003 scope ceiling is unchanged. No next clause touching these files was selected in the supplied extract. No DONE claim or ct judge request is made.

## Plan and execution

PLAN.md contains the full plan. Its inspection, native response proof, touched checks, contract Evidence update, generation, locking and product push steps are complete. The campaign row to update is DATA-006 point 1: retain PARTIAL and record native response variants and unchanged-state replay for existing operations. No other plan row changes and no Mac-only plan file was edited.

The baseline passed 5 tests in the two API files. An initial new expectation assumed an empty visible voter list; the fixture already has an author vote. It was corrected to require the original author exactly and exclude the proxy customer. The final candidate passed all 9 tests in the 3 touched API-family files. This was a local new-test fixture correction, not a CI repair. No original assertion was removed, narrowed, skipped or put behind a condition. The touched files retain their original 9 registrations, and the OpenAPI file retains its one existing journey. No dependency or Base pin, workflow, migration or homepage changed.

## Checks and exact-head evidence

RECEIPT.json contains actual command exits and output hashes bound to the full candidate SHA. NATIVE-TESTS.log records 3 files and 9 passing tests on the committed candidate. Typecheck, targeted lint, first-party check, edition source lock and copied Base source checks all exited 0 on the candidate. The build completed successfully before commit, with no subsequent relevant product-code change. Copy verification establishes local bytes against their recorded hashes; it does not claim an upstream network qualification.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0 (no migration).

The two generated view files were restored whole from main before locking and committing, as required. A subsequent candidate check reports only ACCEPTANCE.md generated content differs, exit 1. This is the declared cloud generated-view exception; the fleet lander generates and checks the views on its landing commit. No generated view is in the product diff. The final committed source lock check passes.

PROBES.md records the concrete runtime probe results. All new text was checked for email-shaped content: zero new email strings. No bare prose token resembling a repository reference was added; added slash-bearing strings are required JSON MIME types and real repository paths. No credential values, private held-out material or environment dump is in this packet.

## DONE riders and pre-ready self-check

1. NOT MET for the full clause: the selected existing-resource journey passes, but remaining resources and webhook outcomes are omitted. No DONE claim.
2. PASS for selected scope: nonempty native fixtures, least-scope successes and refused unsafe actions with unchanged custody, including replay. OpenAPI test lines 129–256.
3. NOT ESTABLISHED for a DONE claim: exact-head Verify stopped before test execution solely on the required restored generated view. All 9 touched native tests passed locally on the exact SHA. The generated-view exception permits the branch handoff, with final generated-view Verify left to the lander.
4. PASS for local proof: all 9 touched native tests reran after the candidate commit; no relevant bytes changed afterwards.
5. UNCHANGED: no new inherited Base duty or acceptance sentence was introduced.
6. PARTIAL accurately retained with its full existing Gap; generation and check pass before the required view restoration. Existing Judgment provenance remains unchanged because no status was promoted.
7. PASS: no acceptance sentence or ct ruling changed, and all parent Status rows were retained.
8. PASS for selected API scope: least-scope authorization, unsafe-origin and revoked-key refusals remain covered with unchanged business state. No correction, refund or erasure door changed.
9. PASS boundary: no live provider, legal, deployment or hosted publication proof is claimed; every existing hold remains.
10. NOT APPLICABLE: no new authority, consent, spending or custody policy default was adopted.
11. PENDING fleet landing: candidate is branch-only. Main equality, final exact-head green checks, Run site and full-history publication scanning belong to the guarded lander.

Pre-ready: the new response behaviors have concrete native assertions; all prior assertions remain; revoked keys and replay are covered, while erasure code is untouched. UI typography and tooltips are not applicable to this change. Source lock is fresh. The cloud did not run or claim the Mac publication scan, main landing or candidate Run site. No broad claim of universal email-free fixtures is made about legacy repository content.

## CI and publication custody

Exact candidate push Verify: run 42204073677, event push, full head `676857454ae3d817900f89ca1a104c7c2a7a1390`, completed with failure solely at Check generated contract documents in all 29 shards. The plan passed, source lock steps passed, and no shard test command ran. The same generated-view check reproduces locally with ACCEPTANCE.md generated content differs. This is precisely the brief’s allowed generated-view exception; it is not a passing CI test run. URL: https://github.com/just-every/run-penny/actions/runs/42204073677 . No dispatch, rerun or short-interval status polling was performed. Six GitHub invocations were used: the initial abbreviated-head query, main full-head discovery, candidate discovery, the candidate status poll more than 300 seconds later, the completed-run job listing and one failed-job archive read. The archive command was `gh run view 42204073677 --repo just-every/run-penny --job 127846256329 --log-failed`; its sanitized actual output is CI-FAILED.log. No repair round was needed or attempted.

For baseline context only, main `6c1eb018f6391de17e04fc8868c0c74f8732abd8` has successful Verify runs 42201695865 and 42200169242 and successful Run site 42201695577. These are not presented as candidate proof.

Product push custody is separate from evidence transfer. All report files are outside the product checkout and selected explicitly for the report-only evidence ref. Evidence transfer does not signify DONE, acceptance, READY or landing. Publication scanning and the guarded landing remain fleet work. There is no known real test failure or missing account blocking this selected slice.

Evidence publication readback: the first report-only head `c0d3fb6994a18930981f35a7147fe6871ba08613` was fetched through the evidence entrypoint. Its manifest, product head and all 14 file hashes verified. EVIDENCE-TRANSFER.json is that actual readback receipt; the final evidence update includes it with the complete packet.

Final CI receipt: CI.json, CI-JOBS.json and CI-FAILED.log supersede the earlier discovery-only observation. The run is eligible only under the explicit generated-view exception; final landing still requires the fleet’s regenerated views, exact-head green Verify and publication scan.
