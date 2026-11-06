# sd-penny-c-f83 — REL-016 feed proof

Scope: just-every/run-penny; product branch cloud/sd-penny-c-f83. REL-016 stays PARTIAL. Only acceptance point 1 is selected. Counts before and after: 79 done, 124 partial, 78 missing, 281 total.

## Plan and acceptance map

1. Read the current contract, public release projection, publication and correction paths, existing release fixtures and selected tests. Main has no feeds; requested predecessor c538718ba72fb8ef341c76a1f8f5f4cef9cd0e01 already supplies both feeds and their built-Worker journey. Preserve that predecessor and main's newer writers rather than duplicate its implementation.
2. Integrate the predecessor into a branch created from main bc006e93ab58927b5db2d12d8ac35ff0a9341bf0. Resolve CONTRACT first, retain every parent Status row and main judgment, keep both independent changelog entries, regenerate the source lock, and push an intermediate save with skipped CI.
3. Strengthen the existing sanity journey, without new registrations, with canonical public document link retrieval, independent original-wording checks, and before-and-after snapshots around feed reads. Include publication versions, recipients, contexts, delivery attempts, outbox and update permissions; no provider calls may occur during those reads.
4. Build the Worker, run touched feed and release-custody journeys, typecheck, touched lint and the first-party structural check. Use only native publication and correction routes; fixture identities and network mail edge remain synthetic. No live provider or customer send is authorized or claimed.
5. Fetch and merge current main, preserve judgments and generated views, run contract write and check then restore generated views to main, regenerate source lock last and check it. Commit and push the candidate after identity and trailer inspection. Discover exact-SHA Verify with REST; retain accurate pending or failing status.
6. Publish this report and actual receipts only on the separate evidence ref. The fleet owns the complete publication scan, guarded landing and main Run site.

## Frozen rubric for the selected point

- R1: Both public feed routes respond with well-formed XML and the required RSS 2.0 or Atom feed and entry structure, including the empty-feed case. Offline XML validation and parsed required-field checks consume the actual built-Worker responses.
- R2: Native draft and scheduled releases are absent from both feeds and native public detail. Published releases appear in the same identities and publication order as native public list and detail reads, including same-day slug ordering.
- R3: Native corrections retain canonical release identity and replace the old title and body in both feeds with the current approved wording; Atom update time changes while publication identity remains stable.
- R4: Markup, quotes, ampersands, CDATA terminator text and supplementary characters remain literal content. Distinct private identity, commercial, draft, schedule and superseded values are absent.
- R5: Canonical entry links open public HTML without authority; repeated feed reads do not change publication, recipient, permission or delivery custody or contact the provider. Approved independently published wording survives requester erasure.

Each row is exercised in tests/base/release-feeds.test.ts, “RSS and Atom reconcile current published wording across correction and requester erasure”. Existing release-custody tests retain dangerous-path refusal and erasure checks. The predecessor removed only the duplicate approved-public-phrase erasure registration, whose seeded approval and exact retained-version assertions moved into the feed journey. The separate private copied-phrase refusal journey remains. This round adds zero test registrations and removes zero assertions.

## Held remainder and campaign decision

Acceptance point 2's consent and segment recipient intersection, SEG-006 membership and WIDGET-003 distribution are expressly omitted by the selected POINTS. Live mail and provider qualification and all deployment, release, ct, uip and payments holds remain. Feed proof alone cannot complete REL-016. No next target or new campaign entry is selected; the supplied plan must not be rebuilt or re-sorted. Only REL-016's evidence and gap are carried forward; no acceptance text or status is promoted.

## DONE-RIDERS assessment

1. Selected feed outcomes are exercised; the complete clause is not covered because point 2 and widget work remain held. PARTIAL retained.
2. Populated fixtures, real publication and correction routes and erasure readback replace vacuous empty-only proof. Empty, unpublished and scheduled exclusion cases are also exercised.
3. Push Verify discovers the new test through its existing base test glob. Exact candidate run status is recorded in the receipt; no earlier SHA is claimed green.
4. Final receipt binds the touched test results to candidate bytes and records any subsequent main merge.
5. No inherited duty or acceptance sentence changes. Base public privacy remains applicable.
6. The PARTIAL gap preserves omitted work; contract generation is checked locally. Generated views are restored from main and left to the lander. No DONE provenance is claimed.
7. No acceptance point changes and no Status row loss; both parent row sets are checked before the merge commit.
8. Feed routes are public reads, never a weaker publication or correction authority. Existing authority and refusal tests remain.
9. No hosted mail, delivery, real-provider, device or legal proof is claimed.
10. No new consent, custody, spending or authority policy is introduced. Existing conservative boundaries remain.
11. Not landed and not counted DONE. Full-history publication scan and exact main Run site are fleet duties.

## Pre-handoff self-check

No homepage, logo, visual design, application screen or copied Base bytes changed. No browser screenshots are needed for read-only XML routes. No assertion is skipped, narrowed or width-gated. Feed read snapshots and requester erasure preserve private custody. No migration is added, so the migration-ledger check is not applicable. No provider account is used. Publication scan is not run in cloud and is not claimed complete.

Results and exact head will be appended after the candidate is finalized.

## Product result

Candidate: `4e8dc9dcf46049c7f2bab2771c12bf7026519350` on `cloud/sd-penny-c-f83`.
Preserved predecessor: `c538718ba72fb8ef341c76a1f8f5f4cef9cd0e01`.
Published integration save: `72f48b9cfc01c0bd94f19997c805188a9cf0c85e`.
The final fetch found main unchanged at `bc006e93ab58927b5db2d12d8ac35ff0a9341bf0`, already an ancestor of the candidate. No history was rewritten, and no product push targeted main. No PR was created because Verify has a branch-push entry point.

REL-016: PARTIAL to PARTIAL. Acceptance point 1 is implemented and locally proved. Its Status evidence cites the populated feed journey; the Gap retains segment delivery, SEG-006 membership, WIDGET-003 and live qualification and release prerequisites. Acceptance text is unchanged. Summary: 79 done, 124 partial, 78 missing before and after. Plan row changed: REL-016 point-1 proof complete; full clause still held for the expressly omitted remainder. No Mac plan file was modified.

The new route paths are `/api/public/releases/rss.xml` and `/api/public/releases/atom.xml`. Both derive from the existing current published-release projection. Native API output does not gain the feed-only update timestamp. Correction preserves permalink identity and excludes superseded wording. RSS encodes Markdown as literal HTML text; Atom emits text content. No migration, owner configuration, hosted publication or customer send is introduced.

The combined diff retains main's hierarchy search work and both independent changelog entries. Every candidate author and committer is fleet identity, there are no co-author trailers, all candidate commits retain each parent's Status ids, and the integration preserves 445 table rows in CONTRACT.md. Added content contains zero email-shaped literals. The predecessor's approved-public-phrase erasure test was consolidated into the larger feed journey, preserving its assertions and the separate private-wording refusal case. Registration delta relative to main is zero.

## Probes

PROBE REL-016 point 1 validation: GET both public feed routes through the built Worker with empty and populated stores -> HTTP 200, the declared XML media types, no-store, no cookie, well-formed XML and RSS 2.0 or Atom required structure.
PROBE REL-016 point 1 publication: native create, schedule and publish followed by feed GET -> drafts and scheduled records absent, three published releases present in native public order including same-day slug ties.
PROBE REL-016 point 1 correction: native correction followed by both feed GET and native detail -> version 2 current wording, unchanged canonical identity, changed Atom update time and no superseded wording.
PROBE REL-016 point 1 privacy: distinct private markers plus markup-rich approved content -> private values and private field names absent; quoted text, ampersands, literal markup, CDATA terminator and supplementary character retained as text.
PROBE REL-016 point 1 read custody: repeated GET and canonical public document links -> HTTP 200 HTML, publication and recipient records, permissions, outbox and attempts unchanged, no additional provider calls.
PROBE REL-016 point 1 erasure: erase the requester after independent publication -> approved release versions unchanged and both feed bodies byte-identical.
PROBE REL-016 point 2: none, expressly omitted by selected POINTS; no segment delivery or membership claim.

## Mechanical result

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0; ledger=none exit=0 (no migration change).
Generated views were then restored whole from origin/main as instructed, and neither generated file is committed. A subsequent exact-tree `contract-docs check` exits 1 solely for stale ACCEPTANCE.md, which is expected and reserved for the lander. Source lock was regenerated after the last test edit, checked, and committed. The source check includes 2,419 tracked file records.

## Proof locations

- R1: tests/base/release-feeds.test.ts lines 16–18 and 56–88, exercised initially empty at line 119 and populated after native publication at lines 133–144.
- R2: lines 48–52, 88–99, 124–144 and 163–164.
- R3: lines 146–159.
- R4: lines 62–65, 94–106, 122–130 and 157–159.
- R5: lines 44–47, 107–113 and 165–172.

No mutations were applied. Assertion coverage is INSPECTED as described above and runtime outcomes are backed by the exact-head touched-test receipt; this is not a DONE judge request. No exact-SHA CI success or publication scan is inferred from local tests. Main's pre-task Verify runs 42172145288 and 42170777562 and Run site 42172145197 were observed successful at the initial main SHA; they are not candidate proof.

Remote product ref was independently read back through Git and equals the candidate; remote-product.json records the result. Local touched tests and typecheck ran with VM Node 24.19.0 and pnpm 10.12.4; the rer build selected project Node 22.20.0. CI keeps its existing Node 22.20.0 pin. No tool or Base pin changed.

Final local result on the exact candidate: 2 touched files, 6 passing tests; typecheck, touched lint and first-party check exit 0. Complete commands, UTC times, exit codes and log hashes are in receipt.json; the actual logs are included. Build succeeded before the final test-only change, with no subsequent runtime byte changes. probes.json maps the bounded runtime result to the frozen rubric.

## CI and handoff disposition

Exact candidate push Verify run **42176667361** finished **failure** at `4e8dc9dcf46049c7f2bab2771c12bf7026519350`. The plan job succeeded; all 29 shards passed source-lock freshness and failed only **Check generated contract documents**, before product tests could run. The local exact-tree command confirms the expected message: `ACCEPTANCE.md: generated content differs; run contract-docs write.` This is the brief's explicit generated-view exception, not a product assertion failure and not a Verify repair. No CI run was dispatched or rerun, and no workflow was edited. The local generated write and check passed before restoring main's views. The lander must generate and commit those views, then run its required exact-head gates. The candidate is READY under that exception; actual CI success, a publication scan and a landing are not claimed.

CI receipt: ci-receipt.json. Complete per-job step metadata: ci-jobs.json. Representative failed archive log: ci-failed-job.log for base-1 job 127756647322. No product assertions ran in CI, so there are no failed product test jobs to reproduce or repair. Five permitted GitHub invocations were used: initial-main discovery, candidate discovery, candidate status after five minutes, completed job metadata and one failed-job archive request. No polling interval was shorter than 300 seconds.

Blockers: no blocker to this bounded feed candidate. The complete REL-016 target remains partial because of its expressly omitted segment, membership, widget and field-qualification remainder. No DONE claim or ct judge request is made. Publication scan, guarded landing and exact landed Run site remain the fleet's independent duties.

The representative archive log retains the failing command, output and exit. Its runner environment section is omitted from public evidence; no credential, process environment dump or private held-out gate input is selected.
