# sd-penny-c-f84 result

Product: just-every/run-penny. Branch: cloud/sd-penny-c-f84. Candidate: 980ecf08f2c0d5ab954b1053561e937bffa2f692. No PR was required or opened; branch push starts Verify Penny.

AI-011 is MISSING to PARTIAL relative to inspected main bc006e93ab58927b5db2d12d8ac35ff0a9341bf0, and PARTIAL to PARTIAL relative to the supplied f80 base c0c7df9f0d9e8f4ff5a0257c316ae415b139ca25. Main counts change from 79 done, 124 partial, 78 missing to 79 done, 125 partial, 77 missing, total 281. There is no new DONE claim.

The selected POINTS were already implemented by the supplied f80 commits. This run preserves both commits and integrates newer main with a merge, resolving the changelog by keeping both entries and regenerating the lock. It does not rebuild the corpus, add duplicate tests, change acceptance text, replace the production matcher or expand the assignment. The merge retains all 281 Status identities from each parent; table row counts stay 445. Main's newer search implementation and clause judgment remain intact.

## Completed selected scope

Point 1's duplicates-v1 portion: the repository holds 300 authored pairs across 100 candidate needs, including 100 hard negatives (33.33 percent) and 100 paraphrase positives with disjoint terms. The SPEC documents labeling, versioning, candidate competition and limitations. Existing redaction-v1 is retained.

Point 4's no-model lexical floor: eval:ai migrates isolated temporary D1 storage and calls the emitted production public suggestion route, which reuses ./src/core/features/requests/suggestions.ts. No provider configuration is supplied; outbound traffic is refused and counted. The command reports corpus version and hash, labeled-pair confusion counts, precision, recall, F1, top-five and paraphrase recall, model and prompt inapplicability and zero provider cost. Output reports can be saved to a chosen file. A weak lexical result is a measured floor and does not qualify semantic behavior.

The command sanity journey runs with provider credentials absent, reconciles a manually labeled billing control and every confusion entry, rejects a deliberately invalid label without producing a report, and retains the redaction evaluation. It is invoked from the existing duplicate-suggestion runtime journey in Verify's requester-board shard. No permanent registration or test count increase is introduced by f84; no assertion is removed, skipped, narrowed or conditioned. The focused native suggestion test uses a name filter; the five other tests remain unchanged and still belong to their normal Verify suite.

## Observed evaluation

Corpus version: 1.0.0. SHA-256: d5599bacbe1dc5c2812c3c8028419dc88cb0c9ccfdcd364ecd0d2bbf3f92031d.

Counts: 300 pairs; 100 candidates; 200 positives; 100 negatives; 100 hard negatives; 100 paraphrase positives.

Confusion matrix: TP 100, FP 100, FN 100, TN 0. Precision 0.50; recall 0.50; F1 0.50; top-five recall 0.50; paraphrase recall 0. Model and prompt are inapplicable. Provider calls 0; provider cost USD 0. AI-001's semantic bars are not met or qualified by this floor.

PROBE AI-011 point-1: eval:ai --set duplicates-v1 over the repository corpus -> 300 pairs, 100 hard negatives, 100 disjoint-term paraphrase positives; valid version and byte hash in report.
PROBE AI-011 point-4: GET /api/public/requests/suggestions from credential-free emitted Worker -> the lexical billing positive returned at rank 1, the billing correction negative returned at rank 1 (honest false positive), and the disjoint paraphrase absent (honest false negative); command matrix reconciles all 300 observations.

The existing redaction command passes on all 210 excerpts. Full actual reports are in duplicates-report.json and redaction-report.json.

## Verification and integration

- Launcher refresh and Git guards installed; the bundle credential was used only through the required helper and explicit gh environment loading. No alternative credential source was consulted.
- Fresh full-history clone; configured fleet identity and active publication hook. Every candidate commit, including both supplied side-parent commits, has fleet author and committer, with no co-author trailer.
- rer setup with non-interactive fleet owner completed, then rer build completed. Both ran through cloud_run. No deployment was performed.
- Command proof passes on the committed candidate using Node 22.20.0, including credential removal, native control, saved report, full confusion reconciliation, invalid corpus refusal and redaction.
- Credential-free duplicates and redaction reports were rerun on the committed candidate using Node 22.20.0. Typecheck passes under the same pin. The focused built-Worker EVID-007 route journey passes on the committed candidate with Node 22.20.0: one selected test, five filtered tests unchanged.
- First-party structural check, Base source custody check, source lock check and staged diff whitespace check pass.
- Contract generator write and check pass on the merged contract. Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main and are not committed. Their candidate freshness check therefore reports the expected stale generated views.
- No migration is added or edited; ledger check is not applicable. No screen or icon control is changed; browser screenshots and viewport checks are not applicable to this command-only integration.
- A pre-push rebase attempted to replay the supplied base commits and stopped on conflicts. It was aborted before any push. The guard refused that detached checkout. The original merge, its parents and the proven tree were restored and rechecked, then the named branch push succeeded on its first transport attempt. Published history was not rewritten.
- Changed text was inspected for credential patterns, email-shaped literals and accidental prose repository tokens. Reviewed matches were real repository paths, package imports and code division; there was no added address or provider-shaped credential. Full publication scanning is deferred to the maintained Mac lander under the cloud route; no COMPLETE scan or NEW 0 claim is made here.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0 before restoring generated files; ledger=none exit=0.

Proof sources: ./tests/runtime/ai-eval-command.mjs lines 19–76; ./scripts/ai-eval/duplicates.mjs lines 11–38 and 41–68; ./scripts/ai-eval/lexical-runtime.mjs; ./tests/runtime/duplicate-suggestions-scale.mjs lines 6–9; ./tests/base/penny-evidence.test.ts named EVID-007 journey. Relevant source and test bytes are identical to the supplied base; integration changes only main ancestry, changelog conflict resolution and the generated source lock.

## Remaining scope and rider assessment

AI-011 remains PARTIAL. Point 1 still lacks links-v1, merges-v1, extraction-v1, themes-v1 and spam-v1. R-13's two-person theme labeling and adjudication remain open. Points 2, 3 and 5 still need configured-model reports and capability bars, the deliberately degraded fixture-model failure gate, and dated model-evaluation receipts. AI-001 semantic quality and AI-012 automatic-rule prerequisites remain unqualified. These are explicit exclusions from this round, not completed behaviors or invented external blockers. All provider, device, account, Base, cross-seed, ct, UI and payment holds and release requirements remain unchanged.

DONE-RIDERS assessment is provided for clarity, without a DONE request:

1. Selected duplicate corpus and floor outcomes reached by the command proof; all other acceptance outcomes remain in Gap.
2. Nonempty real fixture data and independent three-case control prove the bounded floor; invalid labels are refused before reporting.
3. Command proof is wired into the existing push Verify journey; exact-candidate CI status is recorded separately and is not assumed green.
4. Exact committed candidate command proof and reports rerun; the native route journey also reruns on the committed candidate.
5. No new inherited duty or DONE claim; existing duties remain unchanged.
6. Gap names all omitted work; generator write and check pass locally before required generated-view restoration. Old Judged-from provenance remains inherited, with no new DONE assertion.
7. Acceptance text is unchanged; no rewrite or lost obligation.
8. No production authority or mutation door changes. Runtime evaluation has fresh fixture storage and no installation authority.
9. No provider, legal, device or semantic-quality claim. Cost is zero and outbound attempts are refused.
10. No new policy default or ruling is introduced.
11. Landing, exact-main verification, Run site and publication scan are fleet duties and are not claimed complete by evidence publication.

Pre-handoff self-check: selected user-visible command behaviors are exercised; no existing assertion was removed or weakened; no credential, erasure or capture replay path was changed; no screen was touched; lock is fresh. Publication scan and landing are explicitly pending fleet checks. The poor lexical metrics remain visible rather than being represented as AI qualification.

Plan changes to relay: AI-011 selected duplicates-v1 and no-model lexical floor are complete, with no new DONE count. Keep the existing holds and the remainder above; do not reselect these same completed points for another continuation. No other plan row was changed. PLAN.md records the complete execution plan.

CI: inspected main Verify 42172145288 and Run site 42172145197 both succeeded on bc006e93ab58927b5db2d12d8ac35ff0a9341bf0. Candidate Verify 42176297220 was discovered on push for 980ecf08f2c0d5ab954b1053561e937bffa2f692. Candidate Verify completed with failure only at the required generated-view freshness check: every one of the 29 failed shards names only Check generated contract documents. The source-lock step passed. The representative static job is 127755472510. Its archived failed log (Actions environment boilerplate excluded) and the local exact-candidate check both report: ACCEPTANCE.md: generated content differs; run contract-docs write. This is the explicitly permitted cloud exception; no generated view is committed and no repair or rerun is needed. The shard test commands did not run past this prerequisite, so no CI test execution or ordinary green conclusion is claimed. Local touched proof passed. Six GitHub invocations were used, with one exact-run status poll after the required 300-second interval. No PR, dispatch or rerun was used.

Evidence custody: the product ref was read back at the exact candidate SHA and the checkout was clean. The report packet is selected explicitly for the separate evidence ref; it includes no private configuration, bundle, environment dump, held-out material or symlink. The successfully published clone will be removed after evidence transfer verification. Product READY is permitted by the generated-view-only Verify exception; full scan, regenerated landing views, exact landing checks and Run site remain the maintained fleet lander’s work.
