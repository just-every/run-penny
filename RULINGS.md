# Penny rulings

Each ruling that shapes a clause in [CONTRACT.md](CONTRACT.md), with its date, who ruled and the clauses it governs. A clause states the outcome; the ruling states why. RL-1 to RL-99 are moved from Penny's own contract; RL-101 and above are ct's ruling pass.

### RL-1 — Two homepages

**Date:** 2026-10-12 · **Ruled by:** owner · **Clauses governed:** HOME-001, HOME-002, REQ-001.

**Owner decision (12 October 2026): two homepages.** An installed Penny serves its public board at `/` (with its search, status, board and sort parameters and Sign in); `/portal` and `/portal/` redirect to `/`, and `/portal/feedback` serves the same board. The HOME-002 product landing is the separate run site (run-penny.com, built from `src/site`), not a route of an installation. This supersedes HOME-002's `/` mapping and the redirect target below.

### RL-2 — Public board address

**Date:** 2026-10-12 · **Ruled by:** owner (installed-board decision, RL-1) · **Clauses governed:** HOME-001, REQ-001.

**Public board address (HOME-001, REQ-001).** Under the owner's 12 October 2026 installed-board decision above, an installation serves its public feedback board at `/`, with search, status, board, category and sort parameters, server rendering and customer-safe reads. `/portal` and `/portal/` answer `302` to `/` with the same query; `/portal/feedback` serves the same board as a compatibility address. Portal navigation, board filters, the submission page's way back, sign-in's "Back to feedback" and the operator's "Open public board" link use `/`. Existing board links to either `/` or `/portal/feedback` keep working; `/` does not redirect filtered board requests to a landing page. HOME-002's product landing lives at `/` on the separate run site (run-penny.com, built from `src/site`), not on the installation. The portal-home guarantees under REQ-001 apply at both board addresses: the board's home identifies the workspace by the owner's company name and logo (INT-007) and shows the owner's configured one-line portal description, makes no vendor, pricing, testimonial or metric claims, and exposes no operator-only data (REQ-001 tests: `trust-boundary.test.ts` for the configured description without server configuration, `read-spine.test.ts` for customer-safe projected reads). Security consequences: the installed root exposes the same customer-safe board as `/portal/feedback`; no operator data becomes public and no protection is relaxed.

### RL-3 — SendGrid delivery keys are correlation only

**Date:** before 2026-10-23 · **Ruled by:** policy decision recorded in the contract · **Clauses governed:** REL-006, REL-007.

**SendGrid policy decision (REL-006/REL-007):** the selected SendGrid transport has no provider-side duplicate suppression; its delivery key is correlation only. Ambiguous or interrupted sends stay unknown and are never automatically retried. This explicitly supersedes REL-006's ambiguous retry path for this transport. REL-007's provider-idempotency guarantee remains unsatisfied for SendGrid; local durable claims do not prove provider exactly-once delivery. Resend receives each delivery key as its `Idempotency-Key` and suppresses a duplicate within 24 hours; Penny still never replays an ambiguous send. Signed event receipts are retained without automatic deletion, consistent with BASE-DATA-002.

### RL-4 — Docs share the landing's header and footer

**Date:** before 2026-10-23 · **Ruled by:** recorded contract decision · **Clauses governed:** DOCS-001, HOME-002.

**Docs share the landing's header and footer (DOCS-001).** The docs use the landing's header and footer, so `/` and `/docs` read as one site, and the public board link is `/portal` as on the landing. Security consequences: none; the links are to the same public pages and no data or protection changes.

### RL-5 — Documentation site

**Date:** before 2026-10-23 · **Ruled by:** recorded contract decision · **Clauses governed:** DOCS-001.

**Documentation site (DOCS-001).** Operators get the install, portal, decision-loop, email, data and customization guides from the deployment itself rather than from the source repository. Affected IDs: `DOCS-001` and its mirrors in `seed.json` (capability `first-party-docs`, `deploy.publicPaths` and its notes) and `RELEASE.json`. Security consequences: `/docs` and `/docs/` become declared public document paths that serve fixed build-time pages and read no workspace data; no existing protection is relaxed.

### RL-6 — NOTIFY-004's dedicated inbound handler wording

**Date:** 2026-10-22 · **Ruled by:** contract round with CAP-009 · **Clauses governed:** NOTIFY-004, CAP-009.

NOTIFY-004 previously said: “The Worker has no mail handler and no route accepts a mail message.” With CAP-009 it now says: “The Worker accepts inbound mail only through CAP-009’s dedicated platform-invoked email handler; no HTTP route accepts a posted mail message.” NOTIFY-004 remains done. No issued release metadata is changed by this contract round.

NOTIFY-004’s no-handler sentence is superseded by the dedicated-handler wording, with status unchanged.

### RL-101 — Bulk actions inherit each operator's current permissions

**Date:** 2026-10-28 · **Ruled by:** ct · **Clauses governed:** TRIAGE-005.

**Question:** Must every bulk operation be restricted to Owner/Admin even where an operator may perform the equivalent individual action?

**Adopted/proposed default:** Owner/Admin-only current bulk slice; operator policy held pending ct.

**Outcome: replace.** Authorize each selected record and verb using the same current operator/board/feature permission as its individual action; tag/assign/review may be delegated, while merge, move, status and reasoned removal require their own rights. Preview the eligible selection and refused records without hidden-data leakage; commit/undo one attributed batch with rechecked authority and unchanged-state fences.

**Why:** Canny bulk-edits posts, while its role matrix gives some actions to Contributors and others to Managers/Owners. A blanket Owner/Admin limit is not that norm and would remove the promised operator workflow. The safe default is action-specific least privilege, never wider rights merely because many records are selected.

**Sources:**
- [Canny supports bulk merge, board move, owner, tag and category actions.](https://help.canny.io/en/articles/5578377-bulk-editing-posts)
- [Canny distinguishes Contributor, Manager and Owner permissions by action.](https://help.canny.io/en/articles/3847317-admin-roles)

**Placement:** Use TRIAGE-005's single batch authorization door rule, citing OPS-001 roles, ROLE-001 custom permissions, REQ-036 status and REQ-038 reasoned removal; do not create a second bulk role table.

**Current-main evidence:** CONTRACT.md:449 (clause), :799 (Status row); `48b05271ea2d931922738ae7ca04233e6f3ddc88`.

**Engineering/proof boundary:** Missing inbox batches, board/status/link/review/removal/merge operations remain unimplemented. Preserve the 200-item audited tag/assign journey and complete undo; no status promotion or blanket new role grant.
