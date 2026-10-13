# Move saved Canny feedback into Penny

Use saved files, an existing Penny installation and a current operator session.
No Canny login, token, trial or live API call is part of this importer. Support is
**documented format, synthetic-only**. No real owner export has been tested;
`seed.json.replaces` stays empty. The seed-local registry is not global admission
or evidence that the intended public source repository has been published.

## Which Canny export do I have?

| Saved source | What Penny can carry | What it cannot reconstruct |
| --- | --- | --- |
| Classic board CSV (`classic-csv`) | One held request and exact-wording evidence per row; explicit status, board visibility and whole-cell tag mappings | Individual votes/comments, matched author identity, follows/consent, revenue, attachments or prior status history from aggregate cells |
| Ideas view CSV (`ideas-csv`) | One held request and exact-wording evidence per idea, with an operator-mapped supplied idea ID/URL, status and destination board | Individual insights, voters/comments or companies from totals; hierarchy, owner authority, scoring behavior, custom-field semantics or linked portal history |
| Saved API responses | Supplied boards/posts/tags v1 and users/votes/comments v2, complete-post merge history or explicit relationship sidecars | Missing pagination pages, absent relationships, company/MRR context, live verification/consent or subscriptions |

### Official references, read 2026-10-13 (Australia/Brisbane)

The current [Exporting feedback](https://help.canny.io/en/articles/3889198-exporting-feedback)
page (shown as updated that week) now carries the Ideas export itself, with a
separate classic section. The two articles earlier readings relied on,
[Exporting feedback — Ideas](https://help.canny.io/en/articles/14728321-exporting-feedback-ideas)
(P3, June 5, 2026) and [Exporting Ideas](https://help.canny.io/en/articles/14666898-exporting-ideas),
both answer 404 now. The [API reference](https://developers.canny.io/api-reference)
is authority for saved response objects, not Ideas CSV headings.

The Ideas export documents the following **data categories**, not literal CSV headings:

| Documented Ideas category | Penny treatment |
| --- | --- |
| Idea wording (title and description) | Request candidate and exact-provenance evidence; supplied wording preserved |
| Current status | Explicit manifest mapping; no status history invented |
| Group and sub-group | Private omission; not guessed as Penny board membership |
| Counts of insights, users and companies | Named aggregate-only totals; no individual records created |
| Score fields and formula field values | Private omissions; no ranking or scoring implementation copied |
| Any custom field visible in the view | Explicit named aggregate/omission mapping only; unknown headings refused |
| Owner and created date | Ownership omitted without authority; supplied timezone-qualified date used |

The export depends on the chosen view, and fields hidden in the view are absent.
It is limited to 10,000 records at a time, is a point-in-time snapshot and holds
only aggregate counts: insight notes and source URLs are not supplied. Do not treat
it as full feedback history, and split a larger workspace into several views.
The page does not guarantee an idea identifier/URL, a literal `Votes` or a
`Comment Count` heading in Ideas CSV. The
[scoring guide](https://help.canny.io/en/articles/12591059-scores-and-formulas-in-canny-ideas)
discusses votes as scoring input, which is not an export-heading guarantee.

The classic section now states its column names, "as they appear in the exported
file": Post Title, Post Detail, Score (Total Votes), Comment Count, Date created,
Image URLs, Post Status, Post URL, Tags, Post Author, Category, Owner and Associated
MRR. Penny maps the first nine as before. Image URLs, Category, Owner and Associated MRR
stay in the private original and are named as omissions; Associated MRR must be a plain
number. A users or voters export (an idea's Impact Overview, or the classic voter list)
lists up to 10 companies per user, with a Company Count and MRR/ARR column. Penny reads
neither: supply individual votes through saved API JSON. The API reference now also
documents Ideas, Groups, Insights and Opportunities objects, which the saved API reader
does not read; it keeps reading boards, posts and tags (v1) and users, votes and comments (v2).
If the supplied Ideas file has no stable idea ID/URL, stop:
Penny refuses it rather than inventing a key from title, position or count.

## Choose the saved source family

**Saved API JSON:** supply boards/posts/tags v1, and users/votes/comments v2.
The collection fields are `boards`, `posts`, `tags`, `users`, and `items` for both
votes and comments. Root arrays also work. Save all pages; a response declaring
more pages produces a partial-history warning. Remove credential/share-token
fields in a safe copy before import; Penny retains that copy exactly.

A post's `mergeHistory` supplies entries with `created` and `post.id`. Penny
imports each as a merge into the containing post only when both complete post
records exist. An embedded prior-post summary alone cannot supply its missing
board, author or status. Missing posts, repeated merge sources, cycles and
cross-privacy merges refuse. Do not also supply the same relationship in a
sidecar. There is no inferred duplicate discovery.

**Classic CSV plus supplemental JSON:** put each board's CSV in a separate file,
with explicit `boardId`. Supply board metadata as `boards` JSON or the manifest's
`boards` array, including visibility and original date. An all-board CSV without
board membership needs owner-reviewed separation first. Post URL is the source
post ID; saved supplemental votes/comments and merge relationships must reference
that exact URL. CSV authors remain distinct historical attributions per row;
matching names never links identities.

Classic CSV is not a complete account export. Score and Comment Count are
aggregates; they never create people, votes or comments. To include those resources,
supply individual saved vote/comment JSON with contributor IDs, original dates
and comment privacy. For known export merge relationships, supply a **Penny
sidecar**, `kind: "merges", version: "relationships-v1"`, containing an array
(or `merges` collection) of `{id, sourcePostId, targetPostId, created}` records.
This is explicit owner-supplied relationship data, not a Canny API response.

Map each nonempty CSV Tags cell to saved tag IDs explicitly. For example, this
file entry maps the whole cell; punctuation is not guessed as a separator:

```json
{
  "name": "ideas.csv", "path": "ideas.csv", "kind": "posts",
  "version": "classic-csv", "boardId": "ideas-board",
  "tagMapping": { "Accessibility, Mobile": ["tag-access", "tag-mobile"] }
}
```

Supply the referenced tag definitions separately (`kind: "tags", version: "v1"`,
with id, name and original created time). Missing or empty mappings for nonempty
cells refuse. Tags and assignments stay private. Penny preserves tag identities
but has no board-scoped tag namespace. Current status requires an explicit
manifest mapping; status-change history is not reconstructed. Images, revenue,
category/owner metadata and other unmapped fields remain in private originals.

### Ideas CSV: explicit operator mapping

Choose one destination board for the saved view. Supply that board's ID, name,
original date and explicit visibility in `boards` or saved board JSON. Ideas are
internal source records; choosing a public board still does not publish requests.
Review every status mapping. Do not infer visibility from a group, owner or count.

The Ideas manifest entry is `kind: "posts", version: "ideas-csv"`, with `boardId`
and explicit column mappings; use the concrete manifest in
[MOVE-IN](MOVE-IN.md#ideas-csv). Map the exact headings in your actual saved file,
including its own stable idea ID or credential-free HTTPS idea URL. Labels in
that example illustrate operator choices, not a guaranteed Canny schema.
A missing required mapped heading or an unknown heading refuses preview by name.
Known unmapped categories stay in exact private originals with named omissions.
Every count and company-level column appears as aggregate only with its total;
this creates no individual voter, commenter, follower, account or commercial field.
An owner label is source metadata, not an author identity or new operator.
If an author was not supplied, requester attribution stays unknown; no person or
initial submission is manufactured. Re-applying after a completed undo creates
a fresh job generation; use the same source/namespace and a fresh preview,
never a new namespace to evade an erasure fence.

## Review, apply and reverse

Follow [MOVE-IN](MOVE-IN.md#files-and-explicit-mapping) to create the private
manifest and run its exact prepare/preview/apply/status/resume/originals/undo
commands, or upload the prepared bundle at **Workspace data**. All supported source
families use the same native routes and Base import-kit journal. Review per-kind
counts, aggregate totals, omissions, rejections, individual unresolved relationships
and partial-history warnings before applying. Read the move-in receipt before and
after apply and after undo; its job-created mail and notification counts must be
zero. Receipt commands are in MOVE-IN and the [owner trial](TRIAL.md).
Keep one namespace for repeats of the same history. Never change namespace to
bypass a conflict or erasure fence.

For an existing Penny 4 installation, stop old workers before upgrading and
apply the complete numbered migration inventory before using this importer.
Migration 0026 installed maintained import-kit custody tables; apply all later
numbered migrations too, including 0030–0035. Migration 0034 appends move-in
receipt/bundle metadata and chunked private original storage; it does not rewrite
prior jobs, plans or applied SQL. Migration 0035 adds the private-original withdrawal
state, installation-owned resumable erasure work and revision-bound reversal
scan progress. Keep expanded schema on source rollback.
The populated-upgrade proof must
preserve existing rows, jobs and saved plans,
original files, native owner and settings. Before archive restore, obtain and
review the latest separate erasure journal. Resume existing jobs by their saved
ID and plan; do not re-preview retained legacy files or rewrite applied SQL.
Classic CSV, Ideas CSV and saved API imports remain supported. New jobs divide the saved plan into bounded stream pages when it
exceeds 512 KiB or 200 normalized records. Original files remain in their declared
private custody until erasure; mapping input is not retained as an extra copy. A resumable pre-upgrade flat plan is not necessarily erasable: Penny
checks the legacy boundary before reserving erasure or deleting native rows or
files, and returns HTTP 409 `feedback_legacy_erasure_upgrade_required` when
Base cannot publish that plan's erasure within its bounded invocation. An
already-pending oversized legacy erasure remains locked for future bounded Base
support. See [MOVE-IN](MOVE-IN.md#privacy-erasure-and-boundaries) for the tested
boundary and its refusal limits.

Apply stops at a durable checkpoint; reopen the saved job and resume by job ID.
Repeat adds no records. Undo removes unchanged imported effects and keeps the
originals; later native work blocks reversal. Erasure takes precedence over
original retention and refuses resurrection from old source data. Existing
persisted jobs resume from their saved plan. Older hand-prepared comments v1
files need conversion to the documented v2 saved format for a new preview;
this does not rewrite existing jobs or SQL migrations.

Imported people gain no email verification, consent, session or operator access.
Requests/comments remain held. No import sends mail, queues integrations or
publishes anything. Internal boards, historical private comments, addresses,
tags and commercial material stay outside public projections even after explicit
approval of a public request.

## Whole Penny archive handoff

This is separate from importing saved Canny files. The authenticated archive
format uses `data:export` and `data:journal` over HTTPS at the source, then
`data:import` only into an empty isolated local/test destination; see the exact
commands in [Archive and restoration](data-ownership.md#archive-and-restoration).
The native local portability format instead uses:

```sh
pnpm run export -- --output exports/penny.rer
pnpm run import -- --input exports/penny.rer --yes
```

Carry the source's latest separate
`exports/penny.rer.erasure-journal.json` unchanged for local portability.
Keep each archive paired with its command family. Preserve exact original bytes;
the destination keeps its own native authority, and restored effects stay held
for explicit reconciliation.

## What a first real export must show

Support stays documented format, synthetic-only until every row below passes on a real file of yours, checked on a separate local installation ([trial](TRIAL.md)).

| Check | How | Passes when |
|---|---|---|
| Counts, source against Penny | Count CSV rows (classic) or ideas (Ideas view) and the sums of Score (Total Votes), Comment Count, Associated MRR or the view's count columns | One held request and one evidence item per row; the receipt's aggregate totals equal the file's sums; no vote, comment, person or revenue record is created from a total |
| Headings refused by name | Add an invented heading to an Ideas file; remove the mapped idea ID/URL heading; use a file with no stable key | An unknown or missing Ideas heading and a missing key are refused by name before any write. A classic file keeps extra headings as named private omissions, so the owner reads the omission list instead |
| Value sets | Read the real status names, the tag cells, the date form and the Score and Owner headings | Every status and every non-empty tag cell has an explicit mapping; a date without a timezone is refused; confirm whether the file says `Score (Total Votes)` and `Owner` as Canny documents, or `Score` and `Post Owner` as one third-party guide lists |
| Omissions that matter | Read the omission list: Image URLs, Category, Owner, Associated MRR, group and sub-group, scores, custom fields | Each is named as kept private; the owner records what the real decisions need |
| Size | Ideas views export at most 10,000 records | An export at the cap is split into views; Penny's 4 MiB per-file limit is checked against the real size |
| Undo and re-apply | As UserVoice | As UserVoice |
| Erasure of one named person | A classic CSV author or a saved-API voter | As UserVoice: preview lists their records, the journal holds counts only, replay is refused |
| Export and restore | As UserVoice | As UserVoice |

## Synthetic fixtures and proof boundary

Saved fixtures and generated histories exercise the formats through native routes,
with originals, non-authorizing identities, replay, resumable batches, private
receipts, guarded reversal and erasure fences. Current passing checks and exact
heads belong in [ACCEPTANCE](../ACCEPTANCE.md), not an inferred promise from this
format guide. Import and archive limits are in [MOVE-IN](MOVE-IN.md#privacy-erasure-and-boundaries).

No real owner export, live Canny acceptance, hosted capacity, deployed provider
behavior, registry admission or public release is established by synthetic proof.
Run the [reversible local trial](TRIAL.md) with one owner-supplied export before
judging suitability. Keep your current tool if it works.
