# REQ-014 exact-source independent judgment

Verdict: **REQ-014 STAYS PARTIAL**. R1 is UNMET on its frozen generic-401 response item; R2 is MET. All executed commands completed successfully except the expected generated-document freshness check. Passing the existing no-mail tests establishes an actual response-contract mismatch: those tests require 503 where the frozen R1 requires generic401. This is the sole substantive blocker identified. No invalid identity was admitted in these runs, and no exposure or data-loss finding was established.

## Authority and immutable source

- Tag: ct-judge-penny-req014-20261105-1430-sol1.
- Actual model and reasoning effort: **gpt-6.1-sol, xhigh**, under the 2026-11-06T01:26Z replacement authority. One judge session; no delegated agents, successor or paid API use.
- Repository: just-every/run-penny. Source branch: cloud/sd-penny-c-f22. Exact source: **c74fc1d24e1632a6136e2768e129a78d177d416d**.
- A disposable depth-one, blob-filtered clone of that branch returned the exact required HEAD. The pinned public raw CONTRACT.md, ACCEPTANCE.md, AGENTS.md and RULINGS.md each returned HTTP 200 and matched the checkout byte-for-byte. Their hashes are in pinned-documents.json.
- Product scope is read-only. No product commit, product push, PR, source edit, assertion edit, generator write, lock write, mutation experiment, provider operation, CI lookup, poll, rerun or dispatch was performed. The assigned cloud/ct-judge-penny-req014-20261105-1430-sol1 product branch was not created. Report transport uses only the separate evidence ref.
- The brief supplies accepted(source)=[] and says no earlier same-source CT judgment or duplicate judge was found. Those custody assertions remain attributed to the brief; private fleet logs and held-out gate material were neither requested nor read. This verdict neither awards source acceptance nor releases any original hold or lifetime FIX custody.

## Category, buyer and incumbents

These are derived only from the pinned CONTRACT.md product target, not from AGENTS.md, marketing or incumbent research.

- Category: **Product feedback management and public roadmaps**.
- First buyer: **A US product team (head of product, product managers, product operations) at a B2B SaaS business, installing Penny on its own Cloudflare account; revenue is ARR and MRR in USD, on US time zones**.
- Incumbents: **Canny, Productboard, Aha! Ideas, UserVoice**.
- The same contract names Featurebase, Productlane and Enterpret as up-and-comers. They are context, not extra criteria for this judgment.

## Original full clause

**REQ-014 — Identity failure**

**Requirement.** A host-signed identity is expired when its signed issue time is more than 24 hours old or more than 5 minutes in the future.

**Acceptance.**
1. An identity that is expired, or whose signature does not verify, is rejected for every identity-required action, changes no data, and reveals no account or identity match; the visitor is offered email verification (REQ-023) instead.

The published clause metadata says Core and has no explicit Base citation. The written context includes REQ-002 identity-required actions, REQ-031 signed host identity, REQ-023 subsequent emailed verification, REQ-027 frame admission, EVID-006 and DATA-002 privacy, DATA-003 erasure precedence and the shared session, transaction and migration duties. Those duties were assessed only where the original R1 and R2 rubric and named journeys rely on them. No WIDGET, JWT, SSO redirect, live-mail, device or other-seed capability is added to REQ-014.

## Frozen rubric, verbatim

> R1 / Requirement and original native refusal: host claims more than twenty-four hours old or more than five minutes in future expire. Expired/future-dated/wrong-signature identity is refused for every identity-required action, generic401, no account/identity match disclosure or data/network/mail effect. Retain current native conflicting/older-claim, authority rotation, transaction and erasure fences; permitted claim succeeds.
>
> R2 / AP1 rendered fallback: an authenticated allowed example parent exercises rejection at the emitted production Worker. Former identity and private activity are cleared, visitor visibly receives email-verification fallback and can open/fill a usable email form without a requester session, DB write or mail effect. Desktop cases cover expiry/future/signature; phone expiry smoke and clause screens1440+390 are present. REQ-023 owns actual subsequent mail delivery; this clause must offer a usable fallback, not qualify a provider.

## One row for the complete named clause

| Clause | Public doors and named journeys | Outcomes reached | Exact-SHA Verify | Judgment |
| --- | --- | --- | --- | --- |
| REQ-014, full requirement and AP1, with the written inherited duties and DONE-RIDERS 1–11 | POST /api/public/identity/host through the native Hono API in `tests/base/host-identity.test.ts`: rejects invalid signed claims without writes or identity disclosure; accepts supplied account context only privately, with no email permission or operator authority; fences conflicting or older claims, erased identities and identity changes at the business transaction; populated-prior-history upgrade. The emitted production Worker and authenticated allowed parent in `tests/browser/host-identity.mjs`: host-identity: allowed-parent rejection and email fallback. POST /api/public/requests through the existing no-mail native journey in `tests/base/no-mail-identity.test.ts`: valid host identities may submit without outbound mail and retain private commercial claims; no mail admits neither invalid trust, first-time provisioning nor an unverified hold. | Permitted host identity and real submission succeed; invalid configured exchanges give generic 401, clear browser identity and private activity, and offer a filled usable email form. Populated DB custody and zero mail are checked. The no-mail submission path instead gives 503 for invalid host claims, contradicting R1's generic401 item. | Supplied push run **42037370154** failed solely at generated-view freshness and consequential steps; product runtime shards did not execute. No fresh CI claim is made. Full-green exact-FINAL runtime Verify remains pending. | **STAYS PARTIAL: R1 UNMET; R2 MET.** |

## Scores and sole substantive blocker

| Frozen row | Score | Evidence and limits |
| --- | --- | --- |
| R1 | **UNMET** | The six original host-identity native tests passed once. They establish configured-door expiry, future and signature 401 refusals, unchanged custody, no fetch calls, a permitted control, private account context, secret rotation, stale/conflicting claims, transaction-race refusal, tombstone refusal and populated migration preservation. The browser also starts with a real populated request and checks unchanged rows after each rejection. However, the existing no-mail journey passed all four tests once and explicitly asserts **503** for expired and forged host claims at POST /api/public/requests, including a previously accepted identity. This is an executed contradiction of the frozen generic401 item, rather than an absent per-field assertion. |
| R2 | **MET** | The unchanged browser journey passed once: twelve recorded checks, eight captured screens, desktop expired/future-dated/wrong-signature refusals and phone expiry smoke. It authenticates the example parent, configures its allowed origin through the operator API, submits through the emitted Worker, reads the submitted private activity, exchanges a bad claim and checks 401, removes former and rejected names and private request text, opens Email verification, fills Display name and Email, checks the enabled Send verification link button, absence of the submission title field and requester session, an unchanged populated DB snapshot, and zero outbox mail. Unexpected errors and external browser requests are zero. |

**B1 — R1 response-contract mismatch, existing no-mail submission path.** At `src/core/features/auth/requester.ts`, lines 78–90, existingVerifiedHostIdentity catches a 401 from verifyHostClaims and returns null. At `src/core/features/requests/native-routes.ts`, lines 24–26, missing mail and a null existing-host result become mail_unavailable with status 503 before identityOrHold executes. `tests/base/no-mail-identity.test.ts`, line 24, expressly tests an accepted identity followed by wrongly signed and expired replacements and expects 503; the later no-mail refusal journey also requires 503 and checks that requests, evidence, requesters, held actions and magic links remain empty. The independent run executed those assertions successfully. Future-dated claims take the same catch path by source inspection; a separate no-mail future case was not manufactured or run.

The underlying full clause's refusal, privacy and unchanged-data outcomes remain supported. The failure is the explicit response class frozen into R1. No new product criterion was added. It is not a security-exposure severity claim and does not imply any invalid claim succeeds. Existing no-mail assertions and provider-availability fences were preserved. Resolving the mismatch must preserve the valid existing-identity no-mail path and the refusal of new provisioning and held actions when mail is unavailable; this read-only judge does not choose a new policy, edit assertions, open a FIX successor or authorize implementation. The existing CT custody decides the response-contract conflict.

## Production-path and sensitivity inspection

The native and browser journeys, support code, previous-notification fixture, feedback-import fixture, legacy-feedback fixture, D1 observation wrapper, migration configuration, generated transport helper, browser options and local-port helper were read. The example's server, sign.mjs and embed.js were read end to end. Browser runtime assembly loads dist/server ES modules and dist/client assets into a fresh native Miniflare Worker and applies the real migrations; the sole mail edge is a synthetic provider fixture. The browser test changes the example host's signing configuration, not Penny's implementation, and takes native DB snapshots around each refused exchange.

The relevant production chain was inspected: host-claims signature/schema/audience/time validation; requester identity resolution; host provisioning and claim/tombstone guards; native and public request routes; requesterWrite transaction fences; release outcome and subscription admission; notification and weekly-summary admission; client host credential clearing; bridge origin and parent checks; submission form, signed-in header and private activity refresh. The shared verifier rejects before host provisioning. The business transaction checks current requester authority and claim custody. The no-mail precondition above is the one observed response exception. All such source-only statements are **INSPECTED**, with executed outcomes identified separately.

No per-point tests, input special cases, mutation sensitivity probes, full suite or baseline suite were created or run. No known business-flow assertion was deleted, skipped or weakened: the checkout's tracked and untracked status remained clean. Original sensitivity mapping is **INSPECTED**, not reproduced through mutations. No private held-out contents were available or used. NEW findings: **0 in this bounded REQ-014 review**; the R1 mismatch is within the frozen rubric. This is not the required complete full-history publication scan NEW 0.

## DONE-RIDERS 1–11

| Row | Assessment |
| --- | --- |
| 1 | **UNMET for R1's generic401 item** at the no-mail submission door; configured refusal and all R2 outcomes execute and pass. The exact-FINAL Verify proviso also remains pending as expressly allowed by the commission. |
| 2 | Allowed and dangerous paths execute with real native D1 and seeded data. Browser rejection snapshots contain the previously submitted request and identity; no empty-list privacy proof is substituted. The no-mail control accepts the existing valid identity and refuses invalid replacements. R1's response mismatch persists. |
| 3 | **PENDING, permitted candidate exception only.** The named native file is in the push base shards through vitest.base.config.ts; the browser file is a direct push-browser command in verification.json, invoked through scripts/verify-app.mjs and scripts/verify-ci.mjs. Supplied push Verify 42037370154 failed before runtime shards. It proves no full-runtime green. A real full-green exact-FINAL run containing these journeys is required before counting. No CI calls were made. |
| 4 | Fresh independent build, native runs, browser run and screenshots use the exact pin. No earlier-SHA execution is presented as this run. |
| 5 | **INSPECTED.** REQ-014 has no explicit Base cite; its acceptance directly writes refusal, unchanged data, non-disclosure and email fallback. The listed shared privacy/session/migration/erasure duties remain preserved in the observed chains. Duties of REQ-023, JWT/widget, provider or device clauses are not reassigned. |
| 6 | **Mechanical and pending.** CONTRACT.md proposes done with the two journey files and an empty Gap; the generated ACCEPTANCE.md still says partial and has the old missing-fallback Gap. All 281 requirement and acceptance bodies match between source and view. Source counts are 78 done, 125 partial, 78 missing; the stale view shows 77, 126, 78. The provenance line still names 4249757c7f9914e47903ec3d53b68298317ed6c7. contract-docs check exits 1 on ACCEPTANCE.md. This mechanical failure alone is not the reason for STAYS PARTIAL. No generated view was written or committed. |
| 7 | **INSPECTED.** The pinned full requirement and AP1 match the shipped excerpt and generated acceptance. RULINGS.md contains no REQ-014 acceptance replacement. No acceptance, rider or original assertion was changed by this judge. Bookkeeping does not create a product FIX. |
| 8 | Native allowed admission, authority rotation, blocked-in-transaction race, stale/conflicting claim and erased-identity refusal passed. Server requester actions share admission and transaction fences by inspection, subject to the R1 no-mail response exception. No operator or email permission is inferred from host identity. |
| 9 | Only local native and emitted-Worker fixture proof is claimed. REQ-023 owns sending the subsequent email; hosted inbox delivery, real provider qualification, real device, external seed and live-account proof are **UNMET-EXTERNAL or outside this rubric**, not additional blockers. |
| 10 | No policy default, status award, source acceptance, hold release or lifecycle choice was adopted. B1 preserves the pre-existing no-mail tests and flags their conflict with the fixed rubric for CT custody. |
| 11 | **PENDING.** No landing or main equality, exact-main Run site, full-history scan, guarded fast-forward or integration receipt is established. This judgment cannot authorize any of them. |

## Actual commands, exits and readings

See command-receipt.json for the exact commands and logs. Every fresh shell in the clone sourced /tmp/rer-cloud-toolchain.sh; long build and test processes used cloud_run. Chromium was /usr/bin/chromium with the repository's Linux --no-sandbox setting.

| Command | Exit | Actual result |
| --- | ---: | --- |
| pnpm install --frozen-lockfile through cloud_run | 0 | Frozen 282-package install. No provider configuration or rer setup was needed for these native fixture doors. |
| npx -y @runeditrun/rer build through cloud_run | 0 | Emitted production build; rer selected project Node 22.20.0. |
| pnpm exec vitest run --config vitest.base.config.ts tests/base/host-identity.test.ts through cloud_run | 0 | 6 of 6 passed, once; 18.03 seconds. |
| node tests/browser/host-identity.mjs through cloud_run, with the explicit Chromium and evidence path | 0 | 12 checks, 8 screenshots, desktop and phone; once; native runtime and browser teardown fulfilled. |
| pnpm exec vitest run --config vitest.base.config.ts tests/base/no-mail-identity.test.ts through cloud_run | 0 | 4 of 4 passed, once; 9.56 seconds. Confirms the pre-existing 503 behavior and valid no-mail control. |
| node scripts/edition-authoring/cli.mjs check | 0 | Source lock fresh; read-only check, no lock regeneration. |
| node src/base/contract-docs.mjs check | 1 | ACCEPTANCE.md generated content differs; expected mechanical view freshness. |
| pnpm run typecheck | 0 | TypeScript build check passes. |
| git diff HEAD and git status --porcelain | 0 | Zero tracked diff bytes; clean tracked and untracked status. |

The supplied toolchain leaves a newer VM Node on PATH for direct pnpm calls: their actual Node was 24.19.0 with pnpm 10.12.4, and pnpm reported the 22.20.0 engine warning. The rer build explicitly selected project Node 22.20.0. This is recorded rather than claiming every command used the pin. Native and browser jobs all passed on the stated environment. The lander's exact-FINAL runtime Verify on the declared CI Node remains required.

All eight fresh screenshots were individually inspected for functional states: host-signed-in, host-submitted, host-activity and host-email-fallback, each at 1440 and 390. The email fallback screens visibly show the alert, former identity removal, filled name/email inputs and enabled verification control. The activity screen captures the upper viewport; the journey separately waits for the actual populated private request text before the refusal and checks its absence afterward. The existing captures also run no-overflow and serious/critical axe checks; no UI or visual-quality decision was commissioned.

**NOT RUN:** full or baseline suites; provider calls; live mail; device journeys; gate held-outs; CI discovery, poll, rerun or dispatch; generator write; source-lock write; complete history publication scan; main fetch/integration/replay/landing; exact-main Run site. These are forbidden here, external, or final lander work. No green CI is inferred from the local commands.

## Exact status, Gap, Evidence and counts recommendation

Nothing was edited. On this pin, CONTRACT.md already proposes REQ-014 done, with an empty Gap and both journey files; that proposal is unaccepted. ACCEPTANCE.md remains generated partial with the obsolete no-fallback-assertion Gap quoted in document-review.json.

**Retain fresh-main REQ-014 partial.** Do not count the candidate promotion. The original individual baseline is **77 done, 126 partial, 78 missing, total 281**. This judgment's awarded delta is **0 done, 0 partial, 0 missing**. The candidate's proposed 78, 125, 78 is not accepted. Do not sum it with concurrent candidates. On a source reconciliation of this candidate alone, done to partial would be minus one done and plus one partial, restoring 77, 126, 78; every newer fresh-main judgment takes precedence.

For the REQ-014 row alone, the exact proposed substantive Gap is:

> Expired, future-dated or wrongly signed host claims at POST /api/public/requests with outbound mail unavailable return 503 mail_unavailable instead of R1's generic 401 requester_identity_required. Uniform generic-401 refusal for every identity-required action remains unmet. The allowed-parent email-verification fallback is proven at 1440 and 390 without a requester session, product write or mail effect.

The future-dated no-mail route in that wording is established by the shared catch path's inspection, not by a newly created case. Retain the existing base and browser evidence, and add `tests/base/no-mail-identity.test.ts` — valid host identities may submit without outbound mail and retain private commercial claims; no mail admits neither invalid trust, first-time provisioning nor an unverified hold — as the evidence for the remaining mismatch. Do not revert the proven fallback or replace newer Evidence. No requirement or acceptance edit is proposed. If CT resolves the original R1 response conflict, only that existing custody may decide any rubric or product follow-up.

## Integration guards still pending

The original final DONE bar remains intact, even though the substantive verdict is STAYS PARTIAL:

1. Reconcile against fresh main, preserving **every newer Status AND Gap, Evidence/provenance and business-flow assertion**, all IDs and unrelated legacy prose. Source-first CONTRACT.md conflict judgment; no replay of older current-main decisions.
2. Run the documented merged generator write and check/counts/provenance process. Generated ACCEPTANCE.md and docs/CLAIMS.md belong to the Mac lander; cloud does not hand-resolve or commit them. Regenerate the source lock **last**, then check it.
3. Obtain an **actually executed full-green exact-FINAL runtime Verify containing the relied-on journeys**. The original push 42037370154 is only the permitted generated-view candidate exception; runtime shards did not execute.
4. Complete the **full-history publication scan with NEW 0**, then the guarded landing, remote main equality and exact-main green Run site where applicable. Cite actual receipts and run IDs at that time.

There are no new product commits or PRs and no product READY or PUSHED assertion. The terminal READY means the read-only report is complete. The packet's separate evidence publication does not award acceptance or authorize landing, release, submission or deployment.
