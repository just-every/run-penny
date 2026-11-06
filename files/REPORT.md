# sd-penny-c-f82 — OPS-006 title-filter handoff

Product repository: just-every/run-penny.
Product branch: `cloud/sd-penny-c-f82`.
Product head: `44516243b5cda49e56d7278ccc3691007a42f32c`.
Assigned base: `4588e84551ad74f779976225a3e78b04f318db63`.
Integrated main: `bc006e93ab58927b5db2d12d8ac35ff0a9341bf0`.

## Outcome and custody

The assigned f78 base already implemented every selected POINT in this brief, including the persisted title filter, filtering before formula sorting, mounted form, two matching requests plus an excluded control, complete owner and peer result equality, and private-view refusal. This continuation verified that implementation, merged current main without rewriting its published history, resolved the changelog by keeping both entries, restored generated views from main and regenerated the lock. It adds no duplicate implementation or new test registration. New merge commit `44516243b5cda49e56d7278ccc3691007a42f32c` preserves f78 and all newer main work, including OPS-004's hierarchy search judgment.

OPS-006 is MISSING → PARTIAL relative to current main, and PARTIAL → PARTIAL relative to the assigned f78 base. There is no DONE claim. Main counts 79 done, 124 partial, 78 missing become 79 done, 125 partial, 77 missing; total remains 281. Every parent retains all 281 Status rows and all 445 table rows. No acceptance sentence changed. No other clause status changed.

The fleet push guard succeeded on attempt 1. `git ls-remote` verified the named remote branch at the full product head above. No default branch was pushed. No PR was needed: a push starts Verify Penny. Exact-head push Verify is run `42176296674`, observed in progress with no conclusion. No green claim is made for the candidate. Current main's Verify runs `42172145288` and `42170777562` and Run site `42172145197` were completed successfully at the integrated main SHA. Two GitHub API calls were used, one for main and one for candidate discovery; there was no dispatch or rerun.

Candidate publication scanning, landing and exact-main Run site remain the fleet lander's duties. No cloud publication scan was performed and no COMPLETE or zero-findings receipt is claimed. Evidence publication is separate report custody and grants no product acceptance or landing.

## Selected acceptance proof

The native route journey is the existing registration in `tests/base/prioritisation.test.ts`: “[OPS-006 PRIO-003 REQ-035] saves and shares transparent native-demand comparisons, re-sorts explicit inputs and keeps decisions and public records score-free”. It passed: 1 test, 1 file, 10.94 seconds. The mounted journey is `tests/browser/prioritisation.mjs`, named “prioritisation”; it passed on the committed candidate. Both already run in the repository's existing Verify commands, without changing its workflow or verification configuration.

1. Persistence and native request filtering: `tests/base/prioritisation.test.ts` lines 33–53 creates and approves a third request through native doors. It saves whitespace-padded uppercase REQUEST with weighted_sum reach -1, reads back the trimmed filter, asserts exactly the two independently expected request identities in their formula order, and requires the peer's full rows and saved definition to match. It edits to no-match, clears to all three and restores the selected subset. Persistence is in the existing definition JSON; no migration is required. Old definitions default to the empty filter in `src/core/features/prioritisation/formulas.ts` line 30. Filtering precedes sorting in `src/core/features/prioritisation/repository.ts` lines 18–21.
2. Mounted owner and peer flow: `tests/browser/prioritisation.mjs` lines 54–90 saves FINANCE through the existing labelled form, reloads the owner page and checks the persisted form value and the complete ordered headings: “1. Department finance summaries”, then “2. Schedule monthly finance exports”. Export invoices is the independently seeded excluded control. The peer opens that same view, gets the exact same headings and full route rows, and has no edit form. Behavioral assertions run once at 1440. The same saved owner and peer screens are captured at 1440 and 390 with overflow and serious or critical axe checks, without a second behavioral test registration. Screens are actual output from this exact committed head.
3. Existing point 2 remains intact: `tests/base/prioritisation.test.ts` lines 57–59 and `tests/browser/prioritisation.mjs` lines 92–97 require the peer's private list omission, direct route 404, unavailable mounted page and absence of the private title. The peer cannot update the owner's shared view (native lines 27–32). Revision refusal, audit-write rollback, invalid inputs, no-session 401 and cross-origin 403 remain at native lines 54–72. Public projections remain free of private comparison definitions and scores.

PROBE OPS-006 1 persistence: POST `/api/operator/prioritisation` with titleFilter “  REQUEST  ” and reach weight -1, then owner and peer GET -> persisted “REQUEST”, exactly the two matching identities in formula order, excluded control absent; empty filter restores all three and no-match returns zero.
PROBE OPS-006 1 mounted form: save FINANCE in `/app/prioritisation`, reload owner and reopen as peer -> both render exactly Department finance summaries then Schedule monthly finance exports; owner edit retains FINANCE and peer has no edit form.
PROBE OPS-006 2: save a private view, list and directly read it as peer -> omitted from list, API 404 and Comparison unavailable without the private title.

These are observations from passing public-door assertions on the actual fixtures, not an empty-list or self-derived expected-set check. Filter removal would include the excluded control; persistence removal would lose FINANCE after reload; sort removal would change the independently expected order. No mutation campaign was run and no mutation receipt is claimed.

## Local verification and mechanics

- Frozen setup completed the install, build, 109 migrations and owner claim. Private local settings, generated credentials and setup logs are excluded from this public packet.
- Rebuilt the integrated Worker successfully through `cloud_run npx -y @runeditrun/rer build`.
- `cloud_run pnpm exec tsc -b` passed on the integrated source; no tracked source changed after this check.
- `cloud_run npx -y @runeditrun/rer check --profile first-party` passed.
- The existing targeted native test and committed-head browser journey passed. Raw non-secret output is retained in `prioritisation-test.log` and `browser.log`.
- `node scripts/verify-base-source.mjs` passed its offline byte and mode comparison. No Base source, rer version or copied workflow changed.
- Contract generation write and check passed before the merge commit and again at the exact committed head. Generated views were then restored whole from origin/main. Neither view has a candidate diff against main. A stale-view freshness failure in candidate Verify is expected under the cloud landing contract.
- Source lock regenerated last with the documented lock command. Its check passed again on the committed candidate after view restoration. Hashes were never hand-edited.
- Before the merge commit, all parent clause IDs and table-row counts were compared. Before the product push, every commit in origin/main..HEAD, including side parents, passed fleet author, committer and trailer checks. No co-author trailer was added. Added product text contains no email-shaped value; changed prose uses actual paths rather than ambiguous slash pairs.
- No migration or migration-ledger change, configuration change, provider operation, homepage edit, logo work or visual redesign occurred. Browsers, contexts and the test runtime closed; no started server remains.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock followed by check exit=0; views=node src/base/contract-docs.mjs write followed by check, then restore views from origin/main exit=0; ledger=none exit=0.

No permanent test registration was added or deleted in this continuation. Relative to main, the assigned base extends the existing native and browser sanity journeys. The changed list and archive expectations account for the added fixture view. No protected assertion was removed, narrowed or hidden behind a viewport condition. The new field uses the existing labelled form control, text is at least 13px and fields have one complete border. The comparison controls are labelled; no icon-only control was introduced. Captured screens passed layout and accessibility checks. Configuration placement was unchanged.

## Honest remainder and DONE riders

The selected title-filter slice is complete, but the whole OPS-006 requirement remains PARTIAL. The Gap retains saved views across the inbox, request queue, features, evidence, accounts, roadmap and releases; other fields, custom fields, tags, themes, segments, owners and dates; selectable columns and broader sort controls. All prior provider, device, account, Base, cross-seed, ct, uip, payment and release holds remain. These omitted native requirements were explicitly excluded by the selected POINTS; they are not described as an external blocker. No other clause was started.

No policy ruling was needed: this continues the existing sharing and owner-edit authority. No grant, identity, erasure, replay, credential or outbound behavior changed. This slice makes no new claim about erasure or credential revocation.

DONE-RIDERS review, recorded for clarity without a DONE request:

1. NOT MET for the full clause: the explicitly omitted lists and controls have no complete journey. Selected outcomes pass the native and mounted journeys cited above.
2. MET for the selected slice: two real matching requests, one real excluded control, exact expected order, allowed shared read and refused private read.
3. PENDING: existing Verify includes both journeys; exact candidate run 42176296674 was in progress at discovery.
4. MET locally: mounted browser proof ran on the exact committed candidate. Relevant source and test bytes also match assigned f78; their integration with main was rebuilt and checked.
5. NOT APPLICABLE: no new inherited duty or Base citation was claimed.
6. PARTIAL maintained honestly: the Gap names all remaining scope. Generator write and check pass locally; generated views are intentionally restored for fleet regeneration. Historical overall Judged-from provenance was retained, with no DONE claim attached to it.
7. MET: acceptance sentences unchanged, no ruling change, all 281 parent Status rows retained.
8. MET for touched authority: peer read allowed only for shared views; peer edit and private read refused; unauthenticated and cross-origin admission checks preserved.
9. HELD: no live provider or legal boundary claimed; existing holds remain.
10. NOT APPLICABLE: no new custody, consent, spending or authority default.
11. PENDING fleet landing, exact-main Run site and complete publication scan. Product remains branch-only at handoff.

## Plan return and blockers

The plan was not rebuilt and no shipped read-only plan was edited. The row to return is OPS-006: native request title-filter slice verified and preserved; status remains PARTIAL on the assigned base, or MISSING → PARTIAL against current main. The broader saved-view work remains open exactly as the selected brief says. No true external blocker was encountered in this slice, no repair round was needed and no judge request is appropriate for a PARTIAL clause.

The complete relevant public packet comprises this report, PLAN.md, RECEIPTS.json, the three actual non-secret command logs, and every listed screen from the bounded prioritisation journey. It contains no credential bundle, environment dump, symlink, private gate material or product data from a real installation.
