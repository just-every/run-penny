# Move saved feedback into Penny

Penny accepts saved Canny classic feedback CSV, Canny Ideas aggregate CSV, saved
Canny API-response JSON, and UserVoice's ideas-only and Ideas & Voters CSV
exports ([Move from UserVoice](USERVOICE-MIGRATION.md)).
Support is **documented format, synthetic-only**. No real owner export has been supplied, and
Penny makes no replacement claim. It never acquires a live API token or creates
a trial account. Prepare saved files privately, review a preview, then apply it
with a current native owner session.

The format references are Canny's [export guide](https://help.canny.io/en/articles/3889198-exporting-feedback)
and [API reference](https://developers.canny.io/api-reference). Classic CSV and
Ideas CSV are different. Ideas uses `ideas-csv` and explicit heading mappings; it is an aggregate source,
not individual insight history. See the [documented categories and source-key
limitation](CANNY-MIGRATION.md#official-references-read-2026-10-12-australiabrisbane). Save
every pagination page yourself; a partial selection remains a partial history.
Do not save request bodies, API credentials, cookies or signing material with
response files. Credential-bearing source data is refused, including fields a
mapping would omit.

## Files and explicit mapping

Create an owner-only directory containing the files and a `source.json` manifest.
Give every input file mode 0600 and keep it out of Git. The manifest has this shape:

```json
{
  "namespace": "my-saved-feedback",
  "statuses": { "open": "open", "planned": "planned" },
  "files": [
    { "name": "boards.json", "path": "boards.json", "kind": "boards", "version": "v1" },
    { "name": "users.json", "path": "users.json", "kind": "users", "version": "v2" },
    { "name": "posts.json", "path": "posts.json", "kind": "posts", "version": "v1" },
    { "name": "votes.json", "path": "votes.json", "kind": "votes", "version": "v2" },
    { "name": "comments.json", "path": "comments.json", "kind": "comments", "version": "v2" },
    { "name": "tags.json", "path": "tags.json", "kind": "tags", "version": "v1" }
  ]
}
```

Paths are relative to the manifest and cannot escape its directory. Each saved
JSON file contains an array of objects or the corresponding endpoint collection
(`boards`, `users`, `posts`, `items` for votes/comments, `tags`). Embedded author/voter
objects are accepted when their ID, name and original creation time are supplied.
An unresolved identity or relation is refused, never inferred from email/name.
The supported saved endpoint families are boards/posts/tags v1 and
users/votes/comments v2. Empty arrays and empty endpoint collections are retained without
invented records. A response declaring `hasMore` or `hasNextPage` displays a partial-history
warning; acquire all remaining pages yourself for a complete-history import.
Unknown fields stay in private originals and appear as named omissions.

Board ID/name, explicit `isPrivate` and original `created` are required. Posts
use ID, title, details, author, board, created, status and tag references. Map
each supplied status explicitly to `open`, `under_review`, `planned`,
`in_progress`, `shipped` or `declined`. Votes require post/voter references and
created time; duplicate votes for the same source person and post collapse with a
preview omission while every original source record remains retained. Comments
use `value`, author/post, created, explicit `internal`/`private` and optional
`parentID`. Parent references must resolve within the same original post.
Dates require a supplied timezone; ambiguous dates are refused. Board-level
`privateComments` and internal-board visibility also keep historical comments
private after any later board change. Saved files containing credentials,
share tokens or credential-bearing URLs are refused. Prepare a safe saved copy
first; the importer retains the exact bytes of that supplied copy.

Classic CSV uses the documented headings Post Title, Post Detail, Date created,
Post Status, Post URL and Post Author. Its manifest entry selects
`kind: "posts"`, `version: "classic-csv"` and `boardId`. Supply the corresponding
board through the manifest's `boards` array, with ID, name, `isPrivate` and created
time. Post URL is a credential-free HTTPS source ID. The author is a distinct
historical attribution for that row; the importer does not match names across
rows. Nonempty Tags cells require an explicit `tagMapping` from the entire cell
text to supplied tag IDs; tag definitions are separate saved JSON. No delimiter or
identity is guessed. Score (Total Votes), Comment Count and company/revenue columns are reported as
aggregate only. Image URLs, categories, owners and other unsupported columns
are retained and reported as omissions.
Aggregate counts cannot manufacture individual votes or comments. Quoted commas,
quoted newlines, CRLF, UTF-8 byte-order mark and Unicode are preserved.

### Ideas CSV

The manifest selects `kind: "posts", version: "ideas-csv"` and one explicit
`boardId`; supply the board as above. Map exact headings rather than assuming
that Canny's category descriptions are literal column names. A supplied idea ID
or credential-free HTTPS idea URL is mandatory as the stable source key.
An absent ID/URL cannot be recovered from the aggregate data: stop the trial
rather than inventing one. Never reuse a portal post URL as an idea key unless
the saved source explicitly identifies it as that idea's stable key.

The following heading names are **illustrative operator mappings**, not an
assertion that Canny exports them. Replace values with the exact physical headings
from your supplied file. If that file lacks a stable key or date/status/wording
column, preview refuses it; do not generate missing values.

```json
{
  "namespace": "my-saved-ideas",
  "statuses": { "Backlog": "open", "Planned": "planned" },
  "boards": [{
    "id": "reviewed-board", "name": "Imported ideas",
    "isPrivate": true, "created": "2026-10-12T00:00:00+10:00"
  }],
  "files": [{
    "name": "ideas.csv", "path": "ideas.csv", "kind": "posts",
    "version": "ideas-csv", "boardId": "reviewed-board",
    "ideas": {
      "key": "Idea URL", "title": "Title", "details": "Description",
      "status": "Status", "created": "Created",
      "aggregates": {
        "Insight count": "count", "User count": "count",
        "Company count": "count", "Companies": "company",
        "Votes": "count", "Comment Count": "count", "MRR": "revenue"
      },
      "omissions": ["Group", "Sub-group", "Owner", "Score"]
    }
  }]
}
```

Remove mappings for headings absent from your file; account for every present
heading exactly once. `ideas.key`, `title`, `details`, `status` and `created` are
required; optional `author` maps only an explicitly supplied historical author,
never the idea's Owner. Without `author`, attribution is unknown (`null`), with
no requester or initial submission manufactured. Supply timezone-qualified
dates; an ambiguous source date refuses rather than guessing a timezone.

`aggregates` maps actual headings to `count`, `company` or `revenue`. Count
cells require nonnegative integers; revenue cells require nonnegative plain numeric values (no currency symbols).
Their totals appear by heading. Text company cells report source-row coverage
with no numeric total; they are not resolved as accounts. The type describes
private retained source data, not a commercial-field import. Map explicitly
retained-only headings in `omissions`; unknown or multiply classified headings
refuse. Custom fields are accepted only through these explicit aggregate or
omission classifications, with no inferred semantics.

Every idea becomes an unpublished request awaiting moderation, with one
unreviewed evidence item holding the supplied description and original artifact
reference. Owner metadata does not create a contributor, login or operator.
Group/sub-group relationships, score/formula/custom values stay private as named
omissions or named aggregates. Unknown headings and absent required mapped
headings refuse by name. Count and company columns are aggregate only, even
when called votes or comments: they create no people, individual votes/comments,
follows, accounts or commercial context.

Saved Canny post API `mergeHistory` entries map their `post.id` and `created`
to a merge into the containing post. Both complete post records must be supplied;
the embedded summary cannot invent board, author or status. For separately
documented export relationships, add an owner-supplied relationship sidecar with `kind: "merges"`,
`version: "relationships-v1"`. Each object has `id`, `sourcePostId`,
`targetPostId` and original `created`. Keep its exact supplied provenance with
the saved files. Both posts must exist, privacy must agree, and merge chains must
be acyclic. There is no automatic duplicate discovery or destructive merging.

The [Canny switch guide](CANNY-MIGRATION.md) distinguishes the complete saved API
family from classic CSV plus supplemental JSON and gives counts, tag mapping,
source links and limitations. Only taking a new export touches Canny; operating
these saved files requires no live Canny account. The [trial script](TRIAL.md) keeps that owner action separate.

## Preview, apply and recover

Use the owner-only session file described in [data ownership](data-ownership.md).
Origins must be HTTPS or explicit loopback HTTP. Sessions never enter an import
plan, original file, command argument or output. The same-origin request header
is set by the maintained transport; redirects and TLS downgrade are refused.

For a populated Penny 4 installation, stop old Workers before upgrading and
apply the complete numbered migration inventory, including 0030–0035 and any later numbered migration. Keep its existing owner and settings, saved jobs and plans, and private originals; resume
an existing job with its saved ID and plan without previewing a retained legacy
plan. Before any archive restore, obtain and review the latest separate erasure
journal. Follow the [Canny upgrade guidance](CANNY-MIGRATION.md#review-apply-and-reverse)
and [archive restoration guide](data-ownership.md#archive-and-restoration).

```sh
pnpm run feedback:import -- prepare --source ./private/source.json --out ./private/prepared.json
pnpm run feedback:import -- preview --source ./private/source.json --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json --out ./private/preview.json
```

Open the private preview and check source counts, rejected rows, unsupported
fields, aggregate-only totals, individual unresolved relationships and exact
mapping. Its inline move-in receipt reports proposed destination counts and zero
job-created mail/notification rows. Preview is ephemeral and creates no saved
job. Read it from the private saved preview:

```sh
pnpm run feedback:import -- receipt --preview ./private/preview.json
```

On `/app/data`, select `prepared.json` to inspect the
same preview. Applying requires the exact fingerprint from that preview:

```sh
pnpm run feedback:import -- apply --source ./private/source.json --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json --fingerprint REVIEWED_FINGERPRINT
pnpm run feedback:import -- status --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json
pnpm run feedback:import -- resume --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json
```

Read the persisted receipt after each phase:

```sh
pnpm run feedback:import -- receipt --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json
```

The receipt shows source/read/applied/skipped rows by kind, skip reasons,
destination rows created by table, named omissions with counts, every unresolved
relationship, identity treatment and job-created mail/notification counts. After
undo it lists removed effects and conflicts/kept effects, with originals retained.
It stays private and requires current native owner authority.

The placeholders are safe receipt identifiers, never credentials. Each request
applies a bounded batch. Continue the persisted job until it reports completed;
do not submit a fresh import to recover a killed request. Committed checkpoints
survive Worker restart; an uncommitted D1 batch rolls back. A late SQL failure
retains the prior checkpoint and names refusal. Repair the condition, then resume
the same job or deliberately roll back its applied effects. Current authority is
checked within every native/journal transaction. Saved-feedback preview, apply,
history, originals, receipt and recovery require a current native owner.
After export, reset, import and setup, the destination owner can read, undo or
resume archived jobs, including unfinished forward work and reversal. Owner
handoff works even while the historical creator row still exists. A demoted
creator cannot retain access through their old job principal; revoked, expired
or outdated sessions cannot execute it.

New jobs bind to the installation's owner role. Legacy jobs retain their exact
principal, fingerprint, source custody and historical attribution; authority is
checked against the acting owner's current session and role, without rewriting
archive metadata. Ordinary non-owner operators cannot manage these jobs.

Identical source bytes, namespace and options replay without duplicate evidence
or product rows. Changed content/options under the same external identities
conflict; there is no silent update policy. Re-apply after completed undo uses
a fresh preview and a new job generation in the same namespace. Every mapped
post/idea has one unreviewed evidence item containing exactly supplied wording and artifact/source provenance.

```sh
pnpm run feedback:import -- undo --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json
pnpm run feedback:import -- rollback --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json
pnpm run feedback:import -- originals --job SAVED_JOB_ID --origin http://127.0.0.1:8787 --session-file ./private/operator-session.json --out ./private/originals.json
```

Undo requires completed work; rollback reverses partial work. Reversal checks
full native values and relationships. Later edits, votes, comments, follows,
merges/unmerges, shared identities, decisions or publications cause a visible
conflict and preserve native work. Reversal itself is checkpointed and resumed
through the saved job. Retained originals remain private after ordinary undo.

## Privacy, erasure and boundaries

Historical contributors are explicitly `historical-unverified`; Ideas without
a supplied author keep unknown attribution and create no contributor. Source email,
admin flags, host user IDs and commercial fields grant no native sign-in,
verified address, host claim, Base operator authority, subscription or email
permission. No account or MRR is inferred. Imported posts/comments await native
moderation; internal/private comments cannot be published. Import, repeat,
restore and undo send no mail or webhook and create no live publication effect.

Whole-product archives include import originals, journals, native attribution and
opaque erasure fences. Their independent archive refusal limits are documented
in [data ownership](data-ownership.md); overflowing exports refuse completion.
Saved import limits are 4 MiB per supplied file, 24 MiB total source bytes,
50,000 parsed/derived source records, 128 KiB per record and 24 MiB per persisted
plan page. A family can hit a file, transport or plan byte limit before its record limit.
Apply, resume and reversal use bounded batches, not one whole-history D1 write.
The local history evidence meters the paid D1 allowance of 1,000 statements per
Worker invocation. It does not qualify the free D1 allowance of 50 statements,
or establish hosted Worker memory or throughput capacity.
These are refusal limits, not hosted capacity or load-test claims.
New jobs divide the saved plan into bounded stream pages when it exceeds
512 KiB or 200 normalized records. Original files remain in their declared
private custody until erasure; mapping input is not retained as an extra copy.
The demonstrated pages for the same source were at most 350,896 expanded bytes
and completed selected-evidence erasure. The limits above remain refusal limits. An older flat plan
can be far larger than one request: a plan from a 2,296,922-byte CSV with 40
posts is about 20 MB. A record in a retained flat plan over 512 KiB is erased
through Base's staged erasure form; its private stage (post-erasure values only)
continues across resume requests, with every batch under Base's baseline and
stage guards, and publishes the tombstones, journal receipt and restore
checkpoint together. On local D1 a CSV-heavy 20.1 MB and a profile-heavy 19.9 MB
legacy plan both erase completely while everyone else keeps undo, resume and
restore. Before reserving erasure or deleting native records or files, Penny
compiles each step as it will run, in its own request budget; a step that
cannot fit one request is refused with HTTP 409
`feedback_legacy_erasure_upgrade_required` and nothing removed. Compatible
legacy jobs and completed legacy copies are repaired under
erasure/export/restore-checked custody; a large repair during export continues
on the next export (`feedback_export_repair_continuing`).
Large reversal first shows `preflighting`: resume the same job ID while Penny
checks every owned value and relationship. This persisted scan deletes nothing.
Only a complete scan under an unchanged native revision can begin reversal.

Erasing personal data withdraws the affected complete original source bundles,
including shared files that contain multiple people's data. Selected personal
data is redacted from normalized source and creation copies. Unrelated native
entities remain. Privacy cleanup resumes by the data-operation ID and keeps the
workspace locked until normalized import copies and files have been removed.
Receipts name withdrawn originals; original downloads then refuse. Opaque target
and source fences block old source resurrection. A restored archive preserves destination
installation authority; old actor-bound jobs do not confer new authority or
automatically execute. Reconfigure credentials separately and reconcile held
effects explicitly.

Live API acquisition, real-owner-export verification, company/MRR import,
redirect maps, a first-run switching UI, changelog/history expansion and imports
from tools other than the saved Canny and UserVoice sources above remain excluded. Fixture proof and a seed-local status proposal do
not establish a global importer registry entry or a public release.
