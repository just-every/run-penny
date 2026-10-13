# Move from UserVoice

Penny reads two saved UserVoice CSV exports: the ideas-only export and the
Ideas & Voters export. Each idea becomes a held request with one evidence item.
Each person who supported an idea becomes one historical attribution on that
request. Support is **documented format, synthetic-only**: it was built from
UserVoice's own column definitions and tested on synthetic files. No real
UserVoice export has been supplied, and Penny makes no replacement claim.
Nothing here logs in to UserVoice, calls its API or starts a trial.

The command reference, limits, recovery and privacy rules are shared with
every saved source and live in [Move saved feedback in](MOVE-IN.md). The
[UserVoice trial](USERVOICE-TRIAL.md) is a reversible local check with your own export.

## Official references, read 2026-10-12 (Australia/Brisbane)

- [Ideas and Idea & Voters Export [Video]](https://help.uservoice.com/hc/en-us/articles/9720398979091-Ideas-and-Idea-Voters-Export-Video)
  (updated 2026-08-24). Two export types: a **Regular Export (ideas only)** and an
  **Analysis Export (ideas and voters)**, as CSV or XLSX, with selectable fields.
- [Understanding the Idea & Voters Export](https://help.uservoice.com/hc/en-us/articles/360035474133-Understanding-the-Idea-Voters-Export)
  (updated 2026-08-24), linked from the article above. Each row is "an instance
  of support, feedback, or the initial creation of an idea". Count unique voters
  by User ID. A user linked to several accounts gets one row per account. The
  export has no comments.
- [Column Definitions for Exports](https://help.uservoice.com/hc/en-us/articles/360035485693-Column-Definitions-for-Exports)
  (updated 2026-05-29), linked from the article above as "more info about these
  options". This is the list of literal headings Penny accepts.
- [UserVoice Discovery Web Portal Setup Guide](https://help.uservoice.com/hc/en-us/articles/360034924334-UserVoice-Discovery-Web-Portal-Setup-Guide)
  (updated 2025-04-16). It describes portals and forums (a forum is "a distinct
  area for ideas about a certain topic or product") and links to UserVoice's
  [Import Ideas](https://help.uservoice.com/hc/en-us/articles/360035418293-Import-Ideas)
  and [Import Voters and Feedback](https://help.uservoice.com/hc/en-us/articles/360035418393-Import-Voters-and-Feedback)
  guides. Those describe files going *into* UserVoice, not its exports. Penny
  uses them only for two facts: UserVoice's timestamp form
  (`2016-01-01T00:00:00Z`) and that captured feedback is entered by staff on a
  customer's behalf.

The help pages refused automated page loads, so they were read through the Help
Center's public article API, which returns the same article text.

## Which UserVoice export do I have?

| Export | How UserVoice makes it | One row is | Carries | Cannot carry |
| --- | --- | --- | --- | --- |
| Regular Export (ideas only) | Idea grid → **Export** → **Export Current Dataset** → Ideas | One idea | Idea ID, title, description, created time, public and internal status, forum, category, labels, creator, counts such as Voters Count, Total Revenue | Individual supporters, comments, merge dates |
| Analysis Export (Ideas & Voters) | Same menu → **Idea & Voters** | One support, one captured feedback or the idea's creation; one more row per extra account | The idea columns again, plus each supporter (User ID, name, email), account fields, the link date (Linked Idea Creation Date), captured feedback and who captured it | Comments, and which account a supporter represented |
| Comment export | A separate UserVoice export | One comment | Comment activity | Not read by Penny |
| Either export as XLSX | Same menus, spreadsheet format | — | — | Refused. Save it as CSV first (below) |

Penny needs both CSV exports, taken with the **same view and filters**: the ideas
file creates the requests, and the voters file adds their supporters. An Ideas &
Voters file given as the ideas file is refused by name, because its rows repeat
each idea once per supporter.

### Save as CSV

UserVoice offers CSV directly; choose it. If you already have an `.xlsx`, open it
in your spreadsheet app and use **Save As** (or **File → Export**) with the
format **CSV UTF-8 (Comma delimited)**. Penny refuses a workbook with that same
instruction rather than reading it.

## What each column becomes

Headings are matched exactly as UserVoice's Column Definitions write them.

**Ideas file** (`kind: "posts"`, `version: "uservoice-ideas-csv"`):

| Heading | Penny |
| --- | --- |
| Idea ID | Required stable source key. Replaying the file never duplicates; a changed row under the same ID conflicts. The evidence source reads `ideas.csv · my-uservoice · Idea ID 101 (UserVoice)`: file, namespace, then the ID. |
| Idea Title | Request title. Required. |
| Idea Description | Request description and the evidence wording. If it is empty, the title is the evidence wording, named in the preview. |
| Created Timestamp | Original date of the request and evidence. Required. |
| Public Status Name | Mapped through your explicit `statuses` map, including an empty status (key `""`). Every unmapped name is refused by name. |
| Idea Creator ID, Idea Creator Name | The request's historical author, keyed by UserVoice's own user ID. An empty creator leaves attribution unknown. |
| Forum ID | With `uservoice.forums`, picks the reviewed board per forum; every unmapped forum is refused by name. Without it, every idea goes to the file's `boardId`. |
| Votes, Voters Count, Request Count, Comments Count, Notes Count, Inappropriate Flags Count, Supporting Accounts Count, `{Segment} Vote Count`, `{Segment} Supporting Accounts` | Aggregate counts, totalled in the preview. They create no votes, people or accounts. |
| Total Revenue, `{Segment} Total Revenue` | Aggregate revenue, totalled in the preview. No commercial record is created. |
| Every other documented column | Kept in the private original and named in the preview with its reason (see below). |

**Voters file** (`kind: "votes"`, `version: "uservoice-voters-csv"`):

| Heading | Penny |
| --- | --- |
| Idea ID | Links the supporter to the request from the ideas file. A missing idea is listed as an unresolved relationship and blocks apply. |
| User ID | Required. One person per UserVoice User ID. Names and emails are never used to match or merge people. |
| User Name | The historical supporter's display name. If empty, "UserVoice user" and the User ID. |
| Linked Idea Creation Date | Required: when the person supported the idea. It becomes the vote's original date. |
| Feedback Capturer, Feedback Captured By | Mark a proxy vote (below). The capturing admin gets no identity in Penny. |
| Every other column | Kept in the private original and named in the preview. The idea-level columns repeated on each row are not counted again. |

Rows for the same idea and User ID (an extra account, a captured feedback or a
repeat) fold into one supporter. The preview counts the rows read, the
supporters made and the rows folded.

**Supporter type.** UserVoice documents captured feedback as entered by staff on
a customer's behalf. A supporter whose every row was captured by someone else
(Feedback Capturer present and different from the User ID, or, without that
column, Feedback Captured By present) is **proxy**. Any other supporter is **not
marked as proxy**. Penny never calls a vote self-cast, because no documented
column says so. If neither capturer column was exported, the preview says that
proxy votes cannot be told apart and marks none. The type appears in the
preview, the receipt and the request's supporter list. It never upgrades a
supporter into anything more.

**Kept in the private original, with these reasons:**

- Email addresses, IP address, location, SSO and external user fields, browser
  and device: personal contact or device data never becomes a sign-in, a
  verified address, consent or an outreach audience.
- Account, company, opportunity, revenue and NPS fields: no account is created
  or linked. Link a request to an account natively when you choose to.
- Parent ID: the merge stays private because UserVoice exports no merge date.
  Merge natively.
- Moderation State: publication and moderation stay your separate decisions.
- Internal status fields: never mapped.
- Status update message, time and author: only the current public status name is mapped.
- Subscribed: never becomes a follow or a notification permission.
- Feedback ID, Feedback Description, Feedback Captured Team: captured feedback
  stays private and is not turned into evidence.
- Custom fields (`cv_…`, `user.external_user.cf_…`) and any other heading that
  UserVoice does not document: refused by name until you list it in
  `uservoice.omissions`, which keeps it private.

## Not stated by UserVoice, so refused rather than guessed

- **Timestamp format of exports.** The export articles do not give one. Penny
  accepts only ISO 8601 with a timezone, the form UserVoice's import templates
  document. Any other form is refused, naming the heading and the row.
- **Status names.** Statuses are defined per UserVoice account; a blank status
  means "No Status". There is no fixed set, so each name must be mapped.
- **Self-cast, proxy and authenticated-portal votes.** No export column records
  how a vote was cast or whether the person signed in. Only the documented
  capturer columns are used, as above.
- **The creation row.** A row can be "the initial creation of an idea", but no
  column marks it. It is treated as that person's support.
- **Votes versus Voters Count.** "Votes" is described as legacy and "Voters
  Count" as the number of voters, with no stated relation. Penny compares the
  supplied supporters with Voters Count when present, otherwise Votes, and
  names which one.
- **Legacy headings.** Files may say Suggestion instead of Idea or Supporter
  instead of Voter, but the exact headings are not listed. They are refused by
  name; map each to the documented heading in `uservoice.headings`.
- **A repeated heading.** The definitions list "Internal Status Update ID"
  twice. A file with two identical headings is refused; rename one in your
  saved copy before preparing it.
- **Number formats.** Counts must be plain whole numbers and revenue a plain
  number with no currency symbol or thousands separator.
- **What the view was filtered by.** The file does not record its filters, so
  you declare them (below).

## The manifest

```json
{
  "namespace": "my-uservoice",
  "statuses": { "": "open", "Under Review": "under_review", "Planned": "planned", "Completed": "shipped", "Declined": "declined" },
  "boards": [{ "id": "uservoice", "name": "UserVoice ideas", "isPrivate": true, "created": "2026-10-12T00:00:00+10:00" }],
  "files": [
    { "name": "ideas.csv", "path": "ideas.csv", "kind": "posts", "version": "uservoice-ideas-csv", "boardId": "uservoice",
      "uservoice": { "scope": "filtered", "filter": "All ideas, status open, forum Product", "omissions": ["cv_Priority"] } },
    { "name": "voters.csv", "path": "voters.csv", "kind": "votes", "version": "uservoice-voters-csv",
      "uservoice": { "scope": "filtered", "filter": "All ideas, status open, forum Product" } }
  ]
}
```

- `uservoice.scope` is required for each file: `complete` when the export holds
  every idea, or `filtered` when the view or a filter narrowed it. An undeclared
  scope is refused. A filtered file shows a **partial history** warning, with
  your `filter` text, on the preview and the receipt.
- `uservoice.forums` optionally maps each Forum ID to a board from `boards`.
- `uservoice.headings` optionally renames a heading in your file to the
  documented heading it means, such as `{"Suggestion ID": "Idea ID"}`.
- `uservoice.omissions` lists headings UserVoice does not document that you
  want kept private.
- Board visibility comes only from `isPrivate` on the board you supply.

## What the preview and receipt show

Besides the shared counts, a UserVoice import shows: the scope of each file and
any partial-history warning; the idea count; the supporter rows read, the
supporters made and the rows folded; the votes the ideas file claims (Voters
Count or Votes) against the supporters supplied for those ideas, with the
difference named **aggregate only**, which creates nothing; and the number of
proxy and unmarked supporters. Mail and notification rows created by the job
stay at zero.

## Identity and privacy

Every imported supporter and creator is a historical, non-authorizing
attribution: no login, no verified email, no consent, no outreach audience, no
follow and no account. A real person who later signs in with the same address
is a separate requester and sees none of the imported support. Requesters never
see other supporters, and public pages show only the vote count of a request
you have approved and published. Undo removes only what the job created, and
reports a conflict instead of deleting later native work. Erasing a supporter
or a request from this source withdraws the retained originals and leaves an
opaque fence, so replaying the file cannot bring them back. If two supporters
share a name or an address, erasing one is refused rather than rewriting the
other's retained copy.

## Erasing someone from a UserVoice import

Open **Workspace data**, choose the supporter or request and **Preview erasure**. The
preview lists every record that would go, and nothing is removed until you confirm.

- **A supporter who also created an idea.** Erasing the person removes that idea too,
  and every vote and comment other people added to it. The preview says so in words
  before you confirm. Erasing a supporter who created nothing removes only that person
  and their own votes.
- **After an erasure, the same file is refused.** The import preview says how many of
  its records were erased earlier and that applying it will be refused. Remove those
  rows from the saved copy (or leave them out of the next export) and preview again.
  Undoing an import never lifts the refusal.
- **Erasure refused with 409 `erasure_ambiguous_copies`.** Penny never rewrites another
  person's retained copy to remove someone else's name. If the person's name or an
  idea's title also sits inside another record, for example "Person u10" inside
  "Person u100", the preview names how many other records hold that text and the erasure
  is refused. Nothing was removed. To go on: erase the record whose text contains the
  other first, when you mean to erase it too (the longer name, "Person u100"); the
  shorter one then no longer sits inside anything and its preview is clean. If the
  longer record must stay, the refusal stands. In a 20,000-voter export, work from the
  longest names down. Two different people with the same name and address are also
  refused, and the same rule applies.
- **A trial under another namespace.** The evidence label carries the import namespace,
  so a trial import under a different namespace no longer shares a label with the live
  one, and a repeated file name and Idea ID alone never blocks an erasure. A trial of
  the very same file is different: its retained plan holds the same title, wording or
  name as a private copy, the preview lists it as a hold and the erasure is refused,
  because Penny will not leave a copy of the person behind. Import a trial from a
  sample, not from the file you will later erase from. A job applied before the
  namespace joined the label keeps its old label, and replaying it is still recognised
  as unchanged.

## What a first real export must show

Support stays documented format, synthetic-only until every row below passes on a real file of yours, checked on a separate local installation ([trial](USERVOICE-TRIAL.md)).

| Check | How | Passes when |
|---|---|---|
| Counts, source against Penny | Count unique Idea IDs in the ideas file, rows in the voters file, unique (Idea ID, User ID) pairs, unique User IDs, and the sum of Voters Count | Preview and receipt read: ideas = unique Idea IDs; supporter rows = voters rows; supporters = unique pairs; folded = rows − supporters; people = unique User IDs plus creators; the claimed-versus-supplied difference is named aggregate-only; mail and notification rows created by the job are zero |
| Headings refused by name | Add one invented heading, use a legacy `Suggestion ID`, leave a status unmapped, save one file as XLSX, drop the `scope` | Each is refused before any write, naming the heading, status, file or setting |
| Value sets refused by name | Read the real Public Status Name values, timestamp form, number forms and any `cv_*` columns | Every status is mapped by the owner; a timestamp that is not ISO 8601 with a timezone is refused naming the heading and row (if the real export uses another form, record it: that is a reader change, not a workaround); custom columns refused until listed in `uservoice.omissions` |
| Omissions that matter | Read the receipt's omission list against what the decision needs | Each omitted heading is named with its reason (emails, accounts and revenue, Parent ID merges, captured feedback text, internal status, moderation state); the owner records which of them the real decisions need and which Penny cannot carry |
| Partial history | Take a date-filtered or forum-filtered export | The `scope: filtered` warning and the filter text show on the preview and the receipt |
| Undo and re-apply | Undo the job, read the receipt, apply the same reviewed source again | Everything the job created is removed and nothing later is touched; the re-apply creates the same counts under a fresh job generation; an identical replay while applied adds nothing |
| Erasure of one named supporter | Pick one real supporter; preview, confirm and resume the erasure | The preview lists their records (and says so in words if they created an idea); afterwards their records and original-file copies are gone, other supporters remain, the journal holds a receipt of row counts and no value, and the same files then show an "erased earlier" line on the import preview and are refused on apply |
| Export and restore | `rer export`, `rer reset --yes`, `rer import`, `rer setup`, `rer export` | Equal content hash and every table count matches |

## Size

The shared limits apply: 4 MiB per file and 24 MiB in total. Choose only the
columns you need when exporting; a voters file with the four required columns,
the capturer columns and a name is small enough for 20,000 supporter rows. To
split a larger voters file, split it by idea: the same idea and User ID in two
files is refused as a conflict.
