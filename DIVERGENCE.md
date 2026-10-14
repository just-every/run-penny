# DIVERGENCE.md

Historical friction between Penny and shared seed-spec documents. The entries below record assumptions and suggestions made when each issue was reviewed; they are not a current ownership rule. Penny's current `AGENTS.md` permits deliberate edits to its contract, manifest, and baseline, with affected IDs, changed consequences, and verification. Shared requirements should be improved from their natural source when that benefits other seeds; a Penny-specific need can be recorded as deliberate local divergence. Suggestions below have not thereby been adopted.

## Adopted: Base's current publication scanner

Penny's CLI copy of Base's publication scanner was the `8981bc2` revision, which
Base's current scan flags because one of its own comments shows a package patch
filename shaped like an address. Penny carries Base's `bba58af` scanner copy
verbatim instead (see [Base adoption](docs/base-adoption.md)); the rest of the
CLI keeps its revision. No product behaviour changes.

## Retired: pace hydration verification through public admission

Penny once adapted the vendored CLI's lifecycle and hydration orchestration to
pause 61 seconds before each hydration load, because each fresh browser context's
asset fetches counted against the single per-IP page-read bucket and the runner
received HTTP 429. Page assets now have their own admission bucket
(`publicAssetRequestsPerMinutePerIp` in `seed.json`), and so do each document's
branding and frame-policy fetches (`publicChromeRequestsPerMinutePerIp`), so one
page view costs one page read. Penny runs the published
`@runeditrun/rer` package unmodified, so the adaptation is gone. Every page, case,
probe and verdict of the shared hydration check still runs, and errors still fail
without retries.

## 1. BASE-INPUT-003 forces a download disposition on images a public surface must render

**Baseline text.** "Uploads are accepted only within the size and type limits in `seed.json`, stored in R2, served with their declared content type and a download disposition, and readable only by an authorised session or through a delivery channel the product contract names."

**Friction.** Penny's `uploadTypes` are three image formats and PDF. A feedback board whose screenshots download instead of rendering is broken as a product, so a download disposition cannot hold for published image attachments.

**What Penny did.** REQ-011 supersedes BASE-INPUT-003 by ID, for published image attachments only, and carries its own test. It is the only supersession in the contract.

**Suggested shared fix.** Split BASE-INPUT-003 into the storage and authorisation guarantee (which no seed should ever need to supersede) and a separate disposition clause that already permits inline rendering for an explicitly allow-listed image type set. Every seed with a public surface that displays user-uploaded images will otherwise supersede a security-flavoured baseline clause for a presentation reason, which is exactly the supersession that should be rare and load-bearing.

## 2. BASE-PUBLIC-001 forbids cookies, but public actors need a persistent credential

**Baseline text.** "Public surfaces (widgets, booking pages, forms, status pages) set no cookies, load nothing from third-party domains, and send no visitor data before the visitor's first interaction."

**Friction.** Penny requires a verified requester identity to submit, vote, comment, follow, subscribe, and record an outcome (REQ-002). That identity must persist across page loads on a surface where cookies are forbidden.

**What Penny did.** REQ-023 states the mechanism explicitly: a browser-local token created at the requester's first interaction, so no portal surface sets a cookie and BASE-PUBLIC-001 is satisfied rather than superseded. `CONTRACT.example.md` reaches the same answer independently in WIDGET-002.

**Suggested shared fix.** Name the sanctioned mechanism in BASE-PUBLIC-001 itself ("a credential persisted in browser-local storage, created no earlier than the visitor's first interaction, is permitted"). Two of two seeds have now reinvented it, and a seed that guesses "cookie" instead ships a silent baseline violation.

## 3. BASE-ACCESS-002's session ceiling is written for operators but reads generically

**Baseline text.** "A session expires after at most 30 days of inactivity; sign-out revokes that session. Every operator endpoint requires a valid session and returns 401 without one."

**Friction.** The first sentence is unscoped and the second is operator-scoped. A seed with a non-operator authenticated actor cannot tell whether the 30-day ceiling binds it. Requester sessions have a very different usability profile from operator sessions — a requester who votes twice a year should not have to re-verify constantly.

**What Penny did.** Assumed the ceiling binds, and set the requester token in REQ-023 to 30 days of inactivity to match.

**Suggested shared fix.** Scope the first sentence to operator sessions and add a second clause for public-actor credentials with its own ceiling, or state that the 30-day ceiling is universal so no seed has to guess.

## 4. BASE-DATA-002 leaves no room for the bookkeeping that BASE-OPS-003 requires

**Baseline text.** "No user data is deleted automatically. Only sessions and rate-limit state expire." — against BASE-OPS-003, "Queue consumers and webhook handlers produce the same result when a message is delivered twice."

**Friction.** Idempotency is only implementable with retained keys: Penny keeps public submission idempotency keys (REQ-013) and provider event IDs (REL-007). Retaining them forever is unbounded growth; expiring them is an automatic deletion the baseline appears to forbid.

**What Penny did.** Bounded both at 30 days and stated explicitly that the keys hold no personal data, so BASE-DATA-002's "user data" does not cover them.

**Suggested shared fix.** Add idempotency keys and webhook event IDs to BASE-DATA-002's expiry list beside sessions and rate-limit state. Any seed that satisfies BASE-OPS-003 needs them.

## 5. AGENTS.md says how many policies, but not what disqualifies one

**Shared text.** "Policies replace a product decision. Default in a feature's `policies.ts`, overridable from ext. `conversation.assignment.v1`. About eight per seed, each for a customisation buyers are known to want."

**Friction.** The count is enforceable; the quality bar is not. The bootstrap pass produced nine policies, three of which (`evidence.review.v1`, `request.merge.v1`, `release.publication.v1`) had defaults of the form "any operator may do X". Those are authorisation checks, not product decisions — and in a single-owner seed whose own contract opens with "There are no roles" (OPS-001), they are a role system arriving through the extension surface. They also crowd out the policies buyers genuinely want. This review removed all three and spent the budget on `request.vote-eligibility.v1` and `release.recipient-eligibility.v1`.

**Suggested shared fix.** Add one sentence to the policy bullet: a policy replaces a product decision, not an authorisation check; "who may do X" belongs in a policy only where the seed has a real actor distinction. The same paragraph could note that a policy whose default cannot be stated as an alternative behaviour is not a policy.

## 6. The `seed.json` limits / in-clause latency rule is stated once and easy to lose

**Shared text.** "`seed.json → limits` holds tested capacity and rate limits as data, produced by the load test; latency that defines a feature stays in its clause, capacity does not."

**Friction.** The rule is correct and well-hidden. The bootstrap pass put the operator search budget in both places (`OPS-004` "within 500ms" and `limits.searchLatencyMsP95: 500`), creating two sources of truth for one number. Nothing catches this.

**Suggested shared fix.** Have `seed-spec validate` reject a `limits` key whose name ends in `LatencyMs*` or whose value also appears as a duration inside a clause, rather than relying on a reviewer to notice.

## Current native configuration boundary

Active product operators retain equal product operation access. The maintained
native owner alone configures editor/portal appearance; requester host SSO and
scoped API keys do not confer installation authority. Delivery/tracker state
uses explicit provenance and reconciliation, never automatic commitments or
publication. Optional outbound transport and custom domains need reviewed shared
owner-deploy support; no product fallback or source-custody exception is added.
