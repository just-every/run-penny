# REQ-006 exact-source verdict

**REQ-006: ACCEPT ON LANDING**, conditional on the final integration guards below. The three frozen substantive rows are MET, with no NEW finding. This review awards no DONE, changes no status or source pin, releases no hold, and authorizes no landing. Final DONE-RIDERS rows 3 and 11 remain **PENDING** as expressly required by the commission.

## Identity, scope and authority

- Tag: ct-judge-penny-req006-20261105-1305-sol1; original commission: ct-judge-penny-req006-20261105-1305.
- Repository: just-every/run-penny, treated as public.
- Exact judged source: **7d301296156d821e83b347292c1caecbeb600df3**, on **cloud/sd-penny-c-f17**. No replacement product branch was created.
- Stated original comparison main: 1d278bb9a1582cb59f92d7a41e131ed6286444c0.
- Fresh main inspected: **84bad894d12e7f969f567177a126cb544a3237b1**. This is context for preservation, not the judged runtime and not a replacement pin.
- Execution: one Codex subscription session. The explicit replacement commission routes **gpt-6.1-sol, xhigh** and supersedes historical Opus-only and same-session wording. No alternate model, agent, session, paid inference API or usage-credit request was launched. The runtime does not expose an independent backend-model or effort attestation; the exact alias and effort here are the commissioning authority's routing metadata, not a newly measured receipt. CT retains the original-to-replacement custody and must establish actual admission before retiring its original waiter.
- Product checkout was disposable, shallow and filtered. All tracked product bytes, HEAD and index remained unchanged. Product commits: 0; product pushes: 0; PRs: 0; CI API calls, polls, reruns and dispatches: 0. Evidence-only publication is separate.
- No earlier exact-source CT judgment was supplied or found in the bounded inputs. The commission says accepted(source)=[] before this review. No other clause or previously judged SHA was rejudged.

The supplied original builder exit-0 READY, independent sd-penny-c-f17-gate-1 exit-0 GATEPASS at 13:00:46Z, judged scope exactly [REQ-006], source and exact-chain lander ACTIVE holds, and prior 10-test and browser receipts are **commission-supplied prior evidence**, not executions by this reviewer. No source-pin, hold, FIX-lifetime, lifecycle, award, submission, provider, deployment or successor action was taken. No private held-out material was sought or published.

## Product context from the pinned contract only

**Category:** Product feedback management and public roadmaps.

**Buyer:** A US product team—head of product, product managers and product operations—at a B2B SaaS business, installing Penny in its own Cloudflare account. Revenue is ARR and MRR in USD, with US time zones.

**Incumbents:** Canny, Productboard, Aha! Ideas and UserVoice. **Newer comparison products:** Featurebase, Productlane and Enterpret.

The category job is to capture attributed customer feedback, consolidate requests, weigh demand, make accountable decisions, publish roadmaps and releases, and close the loop. A correct distinct-current-voter count and predictable voting closure are substantive parts of that job; no design or visual-quality judgment is assigned here.

## Source and document review

Full pinned CONTRACT.md, ACCEPTANCE.md and AGENTS.md were fetched from immutable raw.githubusercontent.com URLs and matched the checkout byte for byte. CONTRACT.md is 351705 bytes, SHA-256 9827207a74e95173d047a7a481047027fd043a1e5b0120199451f94f8125d029; ACCEPTANCE.md is 309987 bytes, SHA-256 a1892ab4b7e449b40e22e11ee344bbf07d2e625d63a1bf79d9900d8e46e03378. The native contract parser traversed all 281 clauses; its complete parsed receipt is retained. The target requirement, all three acceptance points, named journeys and their called helpers were inspected end to end. Relevant identity, vote, contribution, consent, submission and public-read implementations were inspected. Immutable raw reads cover 46 relied-on source, helper, documentation and workflow files, all HTTP 200 and byte-identical; see immutable-source.receipt.json.

The complete diff against the stated comparison main is limited to CHANGELOG.md, CONTRACT.md, sources.lock.json and tests/base/request-status-workflow.test.ts. Every byte before CONTRACT.md's Status section is unchanged, including all acceptance text, policies, door rules and field holds. All 281 IDs survive. The only changed Status row is REQ-006. Runtime code, routes, styles, migrations, the duplicate-vote journey, author-vote journey and browser decline journey are byte-identical to comparison main. The new test extends the existing end-to-end route journey; it weakens no old assertion and adopts no new default.

ACCEPTANCE.md at the candidate intentionally remains the older generated view: REQ-006 partial, old Evidence and Gap, 77 done, 126 partial, 78 missing. CONTRACT.md proposes REQ-006 done and 78 done, 125 partial, 78 missing. Neither generated view was edited. The local generator check fails only for ACCEPTANCE.md and docs/CLAIMS.md freshness. The global Judged from line at the candidate still names 4249757c7f9914e47903ec3d53b68298317ed6c7; this is a disclosed mechanical provenance follow-up, not evidence that this reviewer ran that SHA.

## Frozen rubric and scores

The supplied original AP1, AP2 and AP3 are retained as R1, R2 and R3. No new acceptance row, threshold, test-count gate or receipt-form gate was introduced.

| Frozen row | Original acceptance and retained duty | Exact-source verification | Score |
| --- | --- | --- | --- |
| R1 | The vote total is the count of distinct current voters, and a vote is accepted only while the request's public status is Open, Under review, Planned, or In progress (REQ-016). Preserve one vote per identity, removability, Shipped and Declined refusal, unchanged participation on refusal and reopening. | tests/base/request-status-workflow.test.ts, named status journey: four distinct email-verified requesters vote twice each across the four active statuses; public totals progress 1, 2, 3, 4. Both closed statuses return 409 voting_closed for a waiting verified requester. Full snapshots of votes, vote contributions, permission records and follow contributions, plus the public response, remain unchanged. Reopening accepts the waiting requester twice with total 5 and five unique identities. tests/base/board.test.ts retains duplicate votes and a collapsed total of one through merge. Browser request-decline removes the existing vote while declined, leaves the add-vote button disabled, reopens, votes and posts a held comment, then checks planned, voteCount=1 and the existing public comment. | **MET — executed** |
| R2 | The author's vote recorded at submission is NOTIFY-011's and counts once like any other. Preserve the full existing NOTIFY-011 inheritance and its independent permission. | tests/base/requester-subscriptions.test.ts, submission journey: verified author submits without ticking email updates; public count is 1, DELETE vote yields 0 while submission permission remains active; one operator reply and one status update each deliver to the fixture edge, then withdrawal revokes the permission. With subscriptions off, a new published submission still has one author vote and no active permissions. Board journey repeats the author's vote without increasing the public count. Native submission and contribution code retain atomic author-vote creation and grouping by requester identity. | **MET — executed**, separate NOTIFY-011 status and gaps retained |
| R3 | Policy request.vote-eligibility.v1; default: any verified requester may vote and every vote counts once. The verified requester eligibility policy and default remain unchanged. | Active-status and board journeys authenticate through the real email-verification HTTP doors. Existing requester OAuth journey in tests/base/auth.test.ts, with tests/base/requester-oauth-fixture.ts, applies one held vote after provider-verified identity. Four unverified or insufficiently attested provider cases stay in email verification; vote count remains unchanged. Invalid, replayed, expired or mismatched OAuth callbacks return 401 with full database snapshots unchanged. Runtime identity admission and transactional write guards require a verified current identity, and contribution grouping counts each identity once. Policy text and all runtime bytes are unchanged. | **MET — executed and inspected** |

**Frozen score: 3 of 3 MET. NEW findings: 0. Substantive blocking rows: none.** Missing per-point assertions, mutations not attempted, number of tests, receipt format and separately owned incomplete duties were not used as refusal criteria.

### One clause row and public-door mapping

| Clause | Journeys and public doors | Acceptance coverage | Recorded exact-SHA Verify |
| --- | --- | --- | --- |
| REQ-006 — Voting, full original clause | `tests/base/request-status-workflow.test.ts` — “sets a direct plan and ETA, resolves latest changes, configures private statuses and projects only eligible roadmap cards”; operator status route, public vote POST and public request GET. `tests/base/board.test.ts` — “Base-signed operator moderates first posts, comments, status and merge reversal with real requester mail”; real requester verification, public submit, vote and detail routes, operator moderation and merge. `tests/base/requester-subscriptions.test.ts` — “submission records one removable author vote and independent permission, delivers replies and status, and withdrawal revokes it”; public submit, vote DELETE, detail and withdrawal, operator reply and status, fixture mail transport. `tests/browser/request-decline.mjs` — request-decline; mounted operator controls and `/portal/feedback/<slug>` through the emitted Worker. `tests/base/auth.test.ts` — “requester OAuth verifies at the provider edge without cookies or operator authority; missing mail fails closed”; native public OAuth and vote doors, fixtures only at provider edge. | R1, R2 and R3 as above, with populated records, allowed and refused paths, unchanged participation and verified-identity refusal. | Supplied run **42028886979**, event **push**, exact source 7d301296156d821e83b347292c1caecbeb600df3, completed **failure** solely on generated-view freshness. Functional shards and aggregate were not executed as a consequence. This is the explicitly permitted candidate exception, not full behavior green. |

Workflow inclusion is INSPECTED: .github/workflows/verify.yml runs on push to every branch, pull_request and workflow_dispatch; verification.json includes all base journeys in base-1 or base-2 and the browser decline journey in the request-decline push shard. scripts/verify-ci.mjs and scripts/verify-app.mjs execute those declarations. There is no extra opt-in flag on these journeys. No CI service was queried; the run's event and result above are the supplied prior receipt. It is never represented as a successful run.

## DONE-RIDERS 1–11

| Rider | Judgment for REQ-006 |
| --- | --- |
| 1 — Every acceptance outcome reached | **MET locally** by the named route journeys and browser journey, subject to row 3 final Verify. Full original R1–R3 scored together. |
| 2 — Populated data and dangerous paths both ways | **MET.** Four and then five real verified voter identities, existing permissions and contributions; active-status allowed votes, closed-status refusals with full participation and public-response equality. Existing identity journey also rejects unsafe callbacks without state changes. |
| 3 — Loaded in recorded exact-SHA Verify | **PENDING for final runtime.** Source inclusion inspected; supplied push run 42028886979 failed only generated views and did not execute functional shards. Candidate exception permits this conditional verdict. The merged final runtime must actually execute a full green exact-SHA Verify. |
| 4 — Evidence belongs to candidate | **MET for this local execution.** All focused tests and screenshots ran on the exact source with clean tracked bytes. Older builder and gate receipts are identified as prior. No code or test changed during review. |
| 5 — Inherited duties written | **MET for this clause.** AP2 explicitly names NOTIFY-011 and AP1 names REQ-016. No inherited duty was deleted or silently marked complete. |
| 6 — Honest Gap, Evidence, provenance and generated counts | **Mechanical landing follow-up, no refusal.** CONTRACT proposes done with empty Gap and names the three route journeys. Generated views and global provenance are stale as disclosed. Fresh-main Status, Gap, Evidence and added provenance must survive; generator write and check and lock-last belong to final integration. |
| 7 — No acceptance change or lost obligation | **MET by complete source diff.** All text before Status, including full acceptance, field register and policy defaults, is byte-identical to comparison main and fresh main. No contract rewrite or new rubric. |
| 8 — Permission and authority holes | **MET within frozen scope.** Identity journeys check allowed verified vote and unsafe identity refusal with unchanged state. Closed-status vote refusal occurs before consent or participation writes. No correction, refund, money or wider authority verb is added. |
| 9 — Provider and legal boundaries honest | **MET as a boundary.** Mail and OAuth use existing synthetic edges, not real provider accounts. R-6 remains not run and NOTIFY-011 remains partial. Hosted inbox, domain, device and other-seed qualification are unestablished, not newly required acceptance rows. |
| 10 — Policy default unchanged | **MET by diff and executed behavior.** No acceptance, runtime, configuration, role, consent or spending default changes. |
| 11 — Final landing conditions | **PENDING.** No guarded landing, main equality to final SHA, COMPLETE full-history publication scan NEW 0, exact-main Verify, or exact-main Run site was executed or claimed. |

## NOTIFY-011 inheritance remains intact

The complete NOTIFY-011 requirement still covers author vote, board disclosure on portal, widget and SDK, permission provenance, once-only publication notice, public replies and comments, statuses and declines, chosen rejection notice, shipped release, why-sent wording, unsubscribe, postal address, vote-removal independence, withdrawal and block behavior, held verification, board-off behavior and non-authorizing operator or imported posts. This candidate changes none of that text or its Status row. The scoped REQ-006 author-vote outcome is exercised; the independently owned clause is **not promoted or reopened**.

Its exact preserved Status is **partial**. Evidence: `tests/base/requester-subscriptions.test.ts`; the existing `visual/requester-subscriptions/NOTIFY-011/` source directory. Exact preserved Gap:

> Verified submissions record the author vote and disclosed submission permission; publication notifies once, replies/status/release/rejection use the durable permission path, removing the vote retains it, and withdrawal/unsubscribe revoke it. Held-verification and board-off cases pass through routes; 1440/390 journeys pass. Gap: a separate SDK disclosure journey remains unproved; live inbox acceptance is R-6.

Those are inherited source assertions, not a claim that this reviewer reran every separately owned notification scenario. The separate SDK disclosure proof remains unproved. The field proof R-6 remains not run and unestablished externally. All 17 field-register entries and their dates and receipts are untouched.

## Actual commands and results

The complete logs and machine receipts are in this packet. Long-running setup, build, tests and browser commands were executed through cloud_run. No full suite or baseline suite was run, no per-point test was added, and no mutation testing or live-provider call was made.

| Actual command or read | Exit and outcome |
| --- | --- |
| Fleet global and repository Git identity configuration; launcher refresh; decrypted-bundle helper setup | 0; values never printed. No alternate credential used. |
| git clone --depth 1 --filter=blob:none --branch cloud/sd-penny-c-f17 https://github.com/just-every/run-penny.git <disposable-checkout> | 0; exact HEAD 7d301296156d821e83b347292c1caecbeb600df3. |
| git fetch --depth 1 origin main:refs/remotes/origin/main 1d278bb9a1582cb59f92d7a41e131ed6286444c0 | 0; read-only comparison metadata. No product ref published. |
| Immutable raw source retrieval and byte comparisons, 46 files | 0; all HTTP 200, all match. |
| pnpm install --frozen-lockfile | 0. |
| cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive | 0; local build, migrations and empty local owner only; no remote account or provider. |
| cloud_run pnpm exec vitest run --config vitest.base.config.ts tests/base/request-status-workflow.test.ts tests/base/board.test.ts tests/base/requester-subscriptions.test.ts | **0; 3 files, 10 tests passed**, 02:01:34Z–02:01:55Z. The imported existing custom-field journeys are included; no new test-count criterion. |
| PENNY_BROWSER_EXECUTABLE=/usr/bin/chromium PENNY_EVIDENCE=<packet>/browser cloud_run node tests/browser/request-decline.mjs | **0**, 02:01:35Z–02:01:51Z. Behavioral interaction at 1440; captures at 1440 and 390. All capture-time no-overflow and serious-or-critical axe assertions passed; page errors and external browser requests were empty. |
| cloud_run pnpm exec vitest run --config vitest.base.config.ts tests/base/auth.test.ts -t 'requester OAuth verifies at the provider edge' | **0; 1 selected journey passed, 10 unrelated tests skipped by filter**. Real fixture-backed OAuth and held-vote path; not live OAuth. |
| cloud_run npx -y @runeditrun/rer build | **0**. Dispatcher selected project Node 22.20.0 and pnpm 10.12.4. |
| pnpm run typecheck | **0**. |
| pnpm run source:check | **0**; source lock current. |
| pnpm run verify:base-source | **0**, offline hashes only; no upstream provider or repository query. |
| node src/base/contract-docs.mjs check | **1**, only ACCEPTANCE.md and docs/CLAIMS.md generated content differ. No structural or count error. Expected permitted exception. |
| Native parseContract over full CONTRACT.md; full status and source diff audit | **0**; 281 IDs; only REQ-006 Status change against original main; counts verified independently. |
| git diff --exit-code HEAD; git diff --cached --exit-code HEAD; git status --porcelain=v1 | **0**, clean, unchanged product. |
| Full Verify, full-history publication scan, Run site, guarded main equality and landing | **NOT RUN** by this reviewer; final integration conditions remain pending. |
| contract-docs write, source lock write, product commit or push, PR, CI poll or dispatch | **NOT RUN**; read-only judgment owns no such mutation. |

The shell toolchain retained available Node 24.19.0 for direct pnpm checks, producing a declared engine warning; rer setup and build explicitly selected Node 22.20.0. Local command evidence is therefore not a substitute for the final pinned CI runtime. It is not reported as full exact-SHA CI green.

Twenty actual browser captures are retained. The declined and reopened public request screens at both widths were directly inspected: status, one vote, existing public comment and history are visible; declined retains Remove vote and reopened restores participation. The screenshots are functional evidence only; no UI-quality verdict was made. The browser contexts and native runtimes close in finally blocks, and no owned server remains.

## Truthful status, Gap, exact flip and counts

**No status was changed by this review.** The exact original main Status row was partial, with Evidence `tests/base/board.test.ts` and Gap:

> Refusing a vote outside Open, Under review, Planned or In progress, and the author's vote recorded at submission counting once, have no passing assertion; one vote per identity and the distinct-voter total are asserted.

Conditional flip, after the final guards pass: REQ-006 **partial → done**; Evidence becomes exactly the candidate's three named journeys, retaining active-status, closed-status unchanged-participation, reopening, duplicate-vote and author-vote coverage; Gap becomes empty. No requirement or acceptance sentence changes. NOTIFY-011 stays partial with its exact original Evidence and Gap.

| Snapshot or conditional result | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Stated original main 1d278bb9a1582cb59f92d7a41e131ed6286444c0 | 77 | 126 | 78 | 281 |
| Individual candidate CONTRACT proposal at 7d301296156d821e83b347292c1caecbeb600df3 | 78 | 125 | 78 | 281 |
| Candidate's intentionally unregenerated ACCEPTANCE.md | 77 | 126 | 78 | 281 |
| Fresh main 84bad894d12e7f969f567177a126cb544a3237b1 | 79 | 124 | 78 | 281 |
| Arithmetic only, if REQ-006 alone later lands on that unchanged fresh main | 80 | 123 | 78 | 281 |

The only proposed delta is **+1 done, −1 partial, 0 missing**. The original candidate totals are not cumulative acceptance across Penny branches. The last row is conditional arithmetic, not an award or a new status proposal replacing fresh main. Actual final counts must be regenerated from the merged CONTRACT.md at landing.

Fresh-main preservation is mandatory: keep REQ-010 and REQ-032 done with their newer Evidence; keep REQ-020 partial with its newer ownership and comment-edit Evidence and narrowed-but-honest remaining Gap; keep REL-005 partial with tested sender and footer evidence, remaining brand-header and privacy obligations and R-6 hold; keep LEARN-001 partial with its native identity and grant refusal evidence and remaining deployment and provider qualification gaps. Preserve the newer assertion bytes and the additional Judged from provenance for REQ-032 at 1101045f75c39bc8d64aed3ac4fa4a5ae8870ddb and REQ-010 at f83300f869afb058bf9fa2d671cf17f445e4c5cb. Do not restore the older candidate's whole Status section over main. Full text and exact before and after cells are captured in source-audit.receipt.json.

If any final guard remains unmet, keep main's current partial row and its existing Gap until integration supplies the missing final proof; do not invent an additional product acceptance criterion. No substantive unmet R1–R3 outcome was found that requires a STAYS PARTIAL refusal.

## Pending guards and disposition

Before any count is awarded, the landing lane must resolve from the newest CONTRACT.md judgments, preserve all newer assertions and field holds, regenerate the merged contract views and counts with `node src/base/contract-docs.mjs write`, run its check, regenerate the source lock **last** with `node scripts/edition-authoring/cli.mjs lock` and check it, and obtain **actually executed full green Verify on the exact final runtime SHA**. It must also obtain a COMPLETE full-history publication scan with **NEW 0**, guarded fast-forward and main equality to that final SHA, exact-main Verify and exact-main Run site. This report performs none of those actions and releases nothing.

F and G bookkeeping—generated views, global provenance and receipt form—is recorded for the lander. C is the next planned product touch only; no new product FIX or changed lifetime count is claimed. All original source and gate custody, holds and existing frozen rubric or held-out treatment survive. There is no substantive product blocker in this judgment; final row 3 and row 11 remain pending. **REQ-006 ACCEPT ON LANDING.**
