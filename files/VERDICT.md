# CAP-014 exact-source verdict

**Verdict: CAP-014 ACCEPT ON LANDING.** R1/AP1 through R5/AP5 are MET on the original pinned source. There are no unmet native acceptance outcomes and no NEW correctness, exposure, data-loss or regression finding. This is a conditional product judgment, not a DONE award, release, landing or product READY claim. Final DONE-RIDERS rows 3 and 11 remain PENDING.

## Authority and custody

- Replacement task: ct-judge-penny-cap014-20261105-1305-sol1, replacing ct-judge-penny-cap014-20261105-1305 under the shipped 2026-11-06T01:26Z routing authority.
- Model and reasoning effort: **gpt-6.1-sol, xhigh**, the authorized Sol execution in this Codex session. No delegated or successor session, paid model API or usage-credit execution was launched.
- Repository: just-every/run-penny. Exact reviewed source: **2e3cfa5aff5a21e7f99b6de6be62c30f7d9583bf**, original branch **cloud/sd-penny-c-f16**.
- Original comparison main: **1d278bb9a1582cb59f92d7a41e131ed6286444c0**.
- Fresh main observed during this review: **84bad894d12e7f969f567177a126cb544a3237b1**. It is comparison evidence, not a substitute review pin or an authorization to replace newer main work.
- The product checkout remained on the original branch and exact pin, with a clean tracked tree and index. No product branch was created, no source file was edited, no product commit or push or PR was made, and no CI run was polled, rerun or dispatched.
- The brief supplies original builder exit 0 and READY, original independent sd-penny-c-f16-gate-1 exit 0 and GATEPASS at 12:55:59Z, judged scope exactly CAP-014, prior accepted(source)=[], and both source and exact-chain lander holds ACTIVE. These are inherited receipts, not commands executed by this judge. This review changes no source pin, hold or lifecycle. CT retains original-to-replacement custody; it alone handles retirement of the original waiter after admission.
- No earlier exact-source CT judgment was supplied; the brief states none was found. No private fleet files, inbox, state, held-out material or Mac receipts were accessed. The supplied five-row rubric was retained without adding thresholds or criteria. FIX lifetime and all existing frozen material remain unchanged; no new fix round is opened.

## Product context, derived only from the pinned contract

Category: **Product feedback management and public roadmaps**.

First buyer: a US product team—head of product, product managers and product operations—at a B2B SaaS business installing Penny on its own Cloudflare account, with ARR and MRR in USD and US time zones.

Incumbents: **Canny, Productboard, Aha! Ideas and UserVoice**. Featurebase, Productlane and Enterpret are the contract's newer comparison bar. The category job is capturing attributed customer feedback, deduplicating demand, weighing it by customer value, making accountable decisions, publishing approved roadmap and release wording, and closing the loop with requesters.

This judgment covers native proxy demand, identity and consent boundaries, historical proxy marks and attributed export. It makes no UI design or visual-quality judgment and no complete replacement claim.

## Clause coverage table

| Clause | Named journeys and public doors | Acceptance reached | Verify relationship | Judgment |
| --- | --- | --- | --- | --- |
| CAP-014, including cited REQ-026, SEG-007, REQ-010 and IMP-008 duties and DONE-RIDERS 1–11 | `tests/base/proxy-votes.test.ts` — “records inbox, request-page and Zendesk customer demand once with its CSV recorder, without verification or consent, and collapses with each customer’s later own vote”; “server-held scoped keys record proxy demand, refuse a read-only key and stop on revocation”; the same file's merge, unmerge, archive, audit-failure rollback and erasure journeys. `tests/base/feedback-import-uservoice.test.ts` — “previews, applies, replays and reverses UserVoice ideas with their supporters and a filtered-history warning”, plus that file's identity, privacy, refusal, undo and erasure journeys. `tests/browser/proxy-votes.mjs` — proxy-votes, mounted inbox and request-page controls and signed-out portal. `tests/browser/zendesk-proxy-votes.mjs` — zendeskProxyVotesJourney, real sidebar assets through the Zendesk SDK and secure proxy network-edge fixture into the real Worker. | All five original acceptance points. Operator routes, scoped API, requester verification and direct vote, private context, public projection, import preview and apply and undo, and authenticated CSV are exercised on populated fixtures. | `.github/workflows/verify.yml` runs on push, pull_request and workflow_dispatch. `verification.json` includes both Worker files in the base shards and both browsers in the push proxy-votes shard. Supplied push Verify **42028937737** completed failure solely on generated-view freshness; affected functional shards did not execute there. This is the expressly permitted candidate exception, not behavior green. Final complete exact-FINAL-SHA runtime Verify remains pending. | **ACCEPT ON LANDING**, native outcomes MET; final rows 3 and 11 PENDING. |

## Frozen rubric and scores

The five original acceptance sentences below are retained verbatim, with stable R1/AP1 through R5/AP5 identifiers. Live external qualification is kept separately, not added as a sixth native rubric row.

| Row | Frozen acceptance item | Verification and observed result | Score |
| --- | --- | --- | --- |
| R1/AP1 | A proxy vote counts once per customer in demand (REQ-026, SEG-007), is marked proxy with who recorded it, and collapses with that customer's own later vote. | The first Worker journey records three contacts through the inbox-sourced operator route, request-page operator route and Zendesk scoped route, retries each, reads one native proxy attribution with the authenticated recorder, then verifies each contact through the requester email door and casts its own vote. Demand stays four throughout the direct-vote collapse and each nativeProxy becomes zero. The mounted browser shows the private proxy and recorder. | **MET — executed PASS** |
| R2/AP2 | It grants no verified identity or email consent (REQ-010), and appears publicly only inside the vote total. | Worker checks unverified addresses, unchanged permission and session counts, and public responses with public voter lists enabled. Browser checks no permission record, absent private customer and source data on the signed-out portal, and visible public total. Zendesk checks both existing and new contacts, no permission, no new-contact mail, and no private person or source values in the public request. Unsafe scoped and revoked requests preserve populated state. | **MET — executed PASS** |
| R3/AP3 | Native proxy recording works from the inbox, the request page and the private Zendesk sidebar at the connector edge, proved with a network-edge fixture. | Both committed browser journeys passed at 1440 on the pin. The first creates from the mounted inbox and attempts an existing-customer duplicate on the request page. The Worker journey successfully records the corresponding request-page route. The Zendesk browser successfully records an existing customer and a confirmed new unverified contact through the secure SDK proxy into Penny's Worker. Unselected customer, revoked key and invalid origin are visibly refused. | **MET — executed PASS** |
| R4/AP4 | Supporters imported from UserVoice (IMP-008) retain their historical proxy marks. | The UserVoice route journey previews and applies populated ideas and voters, asserts proxy and unmarked supporter types in storage and private operator context, matches the receipt, replays without changed counts, refuses changed replay, reverses with removed counts and applies again. Additional executed journeys preserve non-authorizing historical identity and refuse unsafe undo after later native work. | **MET — executed PASS** |
| R5/AP5 | A base test records proxy votes from the inbox, the request page and a Zendesk sidebar fixture: each counts once, collapses with the customer's own later vote, creates no permission record, and appears in the CSV export with its recorder. | The first Worker journey performs all three doors and later direct votes, then parses an authenticated CSV into exactly one matching row per exercised customer, binding request, customer ID and name, address, proxy flag, source, source URL, recorder ID and recorder name to the authenticated actor. Both browser journeys also parse and verify exact per-customer CSV recorder rows. | **MET — executed PASS** |

**Native score: 5 of 5 MET; substantive blockers: none; NEW findings: none.** These scores describe this execution's bounded acceptance results; they do not turn skipped CI shards into passing runs.

## Dangerous allowed and refused paths

The scoped-key Worker journey begins with nonempty votes and existing permission records. A read-only key is refused, and complete snapshots of votes, contributions, proxy records, permissions, requesters, addresses and sessions are unchanged. A votes:write key adds exactly one attributed demand and an unverified contact without new permission or session. Read-only attempts after the successful write preserve that populated state. Revocation then refuses both an existing-customer vote and a new-contact vote and preserves the post-revocation snapshot.

The other native Worker journeys exercise missing and requester-only operator authority, cross-origin refusal, missing source, an audit-failure rollback that leaves neither proxy nor new contact, and allowed erasure. They preserve source and importance through merge, unmerge and archive restore. The UserVoice journeys refuse unsafe undo after a later native vote with unchanged retained data and refuse ambiguous shared-copy erasure. These are existing broad journeys; no application-source mutations and no new per-point tests were created.

The CSV route's native operator and current-session read authority were inspected in `src/core/features/requests/proxy-vote-routes.ts`, `src/core/features/decisions/authority.ts` and `src/core/features/integrations/keys.ts`. Its successful authenticated read was executed. This report does not invent a separate unauthorized-CSV execution.

## DONE-RIDERS disposition

| Rider | Disposition | Evidence and boundary |
| --- | --- | --- |
| 1 | Native outcomes MET; final run guard pending | Every original AP is reached by the named executed journeys. Evidence names are present in the candidate Status row. Full final runtime Verify is still required by the commission. |
| 2 | MET — executed PASS | Seeded request, customer, consent, proxy and import data; exact CSV readback; scoped-key refusal before and after allowed work with full unchanged-state snapshots. |
| 3 | Candidate exception admitted; **final PENDING** | Push Verify 42028937737 is supplied as completed failure only for stale generated views. Workflow wiring was INSPECTED; skipped functional shards are not proof. No CI API calls were made. Complete green exact-FINAL runtime Verify is required before counting. |
| 4 | MET for reviewed source | Local setup, build, nine Worker tests, both browsers and typecheck used 2e3cfa5aff5a21e7f99b6de6be62c30f7d9583bf. No tracked bytes changed during execution. Original 390 receipts remain prior evidence, not this judge's run. |
| 5 | MET — INSPECTED | CAP-014 AP1 explicitly names REQ-026 and SEG-007; AP2 names REQ-010; AP4 names IMP-008. The inherited duties are retained in those original sentences. No independent DONE claim is made for those clauses. |
| 6 | Mechanical follow-through pending | Candidate Status is done with empty Gap, but generated `ACCEPTANCE.md` still has the old partial row and old Gap, and the source's Judged from line names 4249757c7f9914e47903ec3d53b68298317ed6c7. Local generator check exits 1 only for generated ACCEPTANCE content. Lander must regenerate and check after resolving the merged source and preserve newer main Status, Gap and Evidence. This bookkeeping is not a product FIX or refusal. |
| 7 | MET — INSPECTED | Full pre-Status contract body is byte-equal to the original comparison main; the five APs did not change. All 281 Status IDs are identical across original main, candidate and fresh main. No new acceptance, duplicated rider or scope narrowing was introduced. |
| 8 | MET — executed PASS for this authority boundary | Current operator and scoped-key public doors admit supported writes; requester, missing authority, wrong origin, read-only and revoked key paths refuse. The scoped-key journey proves populated state unchanged. No independent roles completion is claimed. |
| 9 | MET — honest external boundary | Zendesk SDK and secure proxy are permitted fixtures; no live Zendesk account or provider installation was tested. R-5 remains not run and UNMET-EXTERNAL. Other provider and legal holds remain active. |
| 10 | MET — INSPECTED | No new policy default or consent exception was adopted; runtime, routes, migrations, assets and workflow bytes are unchanged from the original comparison main. |
| 11 | **PENDING** | No guarded landing, main equality, full final runtime Verify, Run site success or COMPLETE full-history NEW 0 scan was executed by this reviewer. Only the fleet's guarded final integration can satisfy these. |

## Inherited duties and field proof

REQ-026 demand attribution: the proxy slice counts a customer once and keeps proxy and recorder private. The separate paging and full supporter obligations remain owned by REQ-026. At the original pin REQ-026 remains partial; this review does not promote it.

SEG-007 customer-value demand: proxy customers join native demand without duplicate customer counts. Wider ARR and MRR, opportunity, churn, theme, segment and date filtering remain in SEG-007's own Gap. SEG-007 remains partial; native proxy acceptance is not commercial-value completion.

REQ-010 consent: proxy creation grants no verified identity, permission, native session or email audience. This review does not change REQ-010's original-pin status. Fresh main has already advanced REQ-010 to done with newer explicit and automatic consent journeys; preserve that newer judgment and every corresponding assertion.

IMP-008 UserVoice: only documented capturer fields mark historical proxies; imported names and addresses do not authorize, match or merge people. Historical marks survive preview, apply, receipt, private read and replay. IMP-008's existing done status is not re-awarded by this CAP-014 review.

Field register **R-5** remains: “A live Zendesk installation running Penny's sidebar app, linking, capturing and recording proxy votes” — **not run, UNMET-EXTERNAL**. It is separate from native network-edge acceptance and does not block this conditional recommendation. No live install, OAuth qualification, token uninstall, hosted delivery or provider assurance is inferred.

## Executed commands and actual exits

All dependency, build, typecheck and focused-test shells sourced the supplied toolchain after it was created. Long-lived runtime and browser commands ran through its subreaper. Actual per-command UTC times, exact SHA, durations and log hashes are in commands.jsonl.

| Command | Actual exit | Result |
| --- | ---: | --- |
| cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive | 0 | Frozen install, local build, migrations and owner setup; no provider account used. Private setup log excluded; safe setup-receipt.json retained. |
| cloud_run pnpm exec vitest run --config vitest.base.config.ts tests/base/proxy-votes.test.ts tests/base/feedback-import-uservoice.test.ts | 0 | Two files, **nine tests passed**. |
| PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium PENNY_EVIDENCE=../packet/browser-proxy cloud_run node tests/browser/proxy-votes.mjs | 0 | proxy-votes at **1440**, six captures including region details; layout and serious or critical axe checks passed. |
| PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium PENNY_EVIDENCE=../packet/browser-zendesk cloud_run node tests/browser/zendesk-proxy-votes.mjs | 0 | zendeskProxyVotesJourney at **1440**, six captures; layout and serious or critical axe checks passed. |
| node src/base/contract-docs.mjs check | 1 | “ACCEPTANCE.md: generated content differs; run contract-docs write.” Expected mechanical view exception; no generation write performed. |
| node scripts/edition-authoring/cli.mjs check | 0 | Source lock matches the reviewed source. |
| cloud_run pnpm run typecheck | 0 | TypeScript check passed. |
| cloud_run npx -y @runeditrun/rer build | 0 | Explicit build passed. Browser execution used setup's earlier build of the identical tracked source. |
| git diff --exit-code and git status --porcelain=v1 | 0 and empty | Tracked source and index unchanged after execution. |
| Immutable raw.githubusercontent.com reads of CONTRACT.md, ACCEPTANCE.md and AGENTS.md at the full pin, compared with local bytes | 0 | All three byte-equal; hashes and lengths retained in source-custody.json. |
| Original-base and fresh-main structural comparisons | 0 | 281 IDs each, identical ID sets; only CAP-014 status moves in the candidate; runtime and acceptance body unchanged. |

Host direct commands used Node **24.19.0** and pnpm **10.12.4**, as selected by the supplied toolchain, which retains a newer host Node. The repository and CI pin Node **22.20.0**. This difference is disclosed; it does not establish the pending pinned-CI result.

The 12 local screenshots were inspected for exercised functional states, including private recorder attribution, public count-only presentation and visible Zendesk refusal states. No aesthetic judgment is assigned.

**NOT RUN by this reviewer:** 390 browser execution, full suite, baseline suite, live Zendesk installation, live mail or other provider qualification, private held-outs, mutation testing, final merged runtime Verify, full-history publication scan, landing, main equality and Run site. Nothing is credited as executed solely from reading.

The supplied original independent gate reports nine affected Worker tests, typecheck, build and both proxy browser journeys at 1440 and 390, all exit 0, 24 captures inspected and clean overflow and serious or critical axe checks. That is retained as prior independent evidence. The committed harness selects 1440; the original gate supplied 390. This is existing NOTE F, an evidence follow-up only, not an extra product FIX, acceptance criterion or reason to reject.

## Status, exact Gap and count delta

Original comparison main's CAP-014 row was **partial**. Its exact Gap was:

> UserVoice-imported supporters keeping their historical proxy marks (IMP-008) have no passing assertion in this clause's evidence (`tests/base/feedback-import-uservoice.test.ts` asserts them and is not cited here), and the CSV export is checked for the source text and the customer but never the recorder; counting once per customer, the proxy mark with who recorded it, collapse with the customer's own later vote, no verified identity, consent or permission record, public appearance only inside the vote total, and recording from the inbox, the request page and the Zendesk sidebar fixture are asserted.

The candidate addresses both missing outcomes: it cites and this judge executes the historical-UserVoice journey; it replaces loose CSV checks with parsed, exact per-customer rows bound to the authenticated recorder in the Worker and both browsers.

The exact proposed flip remains **CAP-014 partial → done**, its Gap becomes empty, and Evidence becomes the candidate's complete journey cell retained in source-custody.json. No requirement or AP is edited. No flip was written by this reviewer. If final integration fails substantively, no award is made; preserve current main pending authorized follow-through rather than treating this report as landing.

| Snapshot | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Original comparison main, 1d278bb9a1582cb59f92d7a41e131ed6286444c0 | 77 | 126 | 78 | 281 |
| Individual original candidate, 2e3cfa5aff5a21e7f99b6de6be62c30f7d9583bf | 78 | 125 | 78 | 281 |
| Fresh main observed, 84bad894d12e7f969f567177a126cb544a3237b1 | 79 | 124 | 78 | 281 |

Candidate-only delta: **+1 done, −1 partial, 0 missing, 0 IDs**. Published counts stay 57 done, 58 partial and 1 missing; original candidate target and push-further counts move from 20 done and 68 partial to 21 done and 67 partial, with 77 missing. These are the original candidate's counts, not cumulative awards across Penny branches. No merged or landed total is claimed. Final counts must be generated from the actually resolved fresh-main contract.

Fresh main differs in Status, Gap or Evidence for **REQ-010, REQ-020, REQ-032, REL-005 and LEARN-001**. Complete compared Status cells and all 281 IDs are in source-custody.json; newer-main.diff retains exact newer assertions. Every newer judgment and assertion must survive integration:

- REQ-010 done: mounted explicit and automatic consent and exact address, grant-time and revocation proof.
- REQ-020 partial: own-comment editing, rejection, approval, public readback and unchanged-state refusal now proved; request-title and description edit gaps remain.
- REQ-032 done: distinct private notes and public comments and privacy proof.
- REL-005 partial: mail sender, reply-to, postal footer and unsubscribe proof; brand-header and remaining privacy gaps and R-6 remain.
- LEARN-001 partial: model-supplied identity and grants refused without authority or scope changes; deployment pinning and live qualification remain open.

The candidate's older rows and tests must not replace newer main. This review does not authorize replaying the old branch wholesale or adding its snapshot counts over another branch.

## Final integration guards, all retained

1. Resolve CONTRACT.md against then-current main first, retaining main's newer judgments, Status, Gap, Evidence and assertions. Retain all 281 IDs, held field proof and unrelated legacy prose.
2. Generate views with the documented node src/base/contract-docs.mjs write, then its check and count validation from resolved source. Restore generated ACCEPTANCE.md and docs/CLAIMS.md from current main in the candidate work branch as instructed; the Mac lander writes merged views at landing. Do not hand-resolve or commit them to make candidate CI green.
3. Regenerate the source lock last using node scripts/edition-authoring/cli.mjs lock, then its check. Preserve newer runtime and test assertions and source custody.
4. Actually execute the complete required final runtime Verify and require green on the **exact final integrated SHA**. Candidate 42028937737 and skipped functional shards do not satisfy this guard.
5. Obtain the COMPLETE full-history publication scan with **NEW 0**, guarded landing receipt, remote main equality to the final SHA, and exact-main Run site success where required. A canceled duplicate Verify does not satisfy final runtime proof.
6. Only the existing fleet lander may integrate under these guards. No direct main push or fast-forward, provider release, source-pin change, hold release, submission or deployment is authorized by this report.

All source and lander holds remain ACTIVE. This report transfers no prior source acceptance, awards nothing and releases nothing. **C:** preserve final integration as the next planned touch. **F:** original 1440-harness and independent 390 evidence bookkeeping. **G:** generated views, Judged from provenance and counts. F and G are not product FIX rounds.

## Conclusion

**CAP-014 ACCEPT ON LANDING** on 2e3cfa5aff5a21e7f99b6de6be62c30f7d9583bf: five frozen rows MET, all substantive native outcomes reached, no NEW finding. R-5 stays UNMET-EXTERNAL and not run. Final rows 3 and 11 stay PENDING. No product mutation, award or release occurred.

