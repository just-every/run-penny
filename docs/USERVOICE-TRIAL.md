# A reversible local UserVoice trial

Keep your current tool if it works. If its ideas, supporters and follow-up
already serve your decisions, stop here. Otherwise bring one real decision and
one saved UserVoice export, and compare completeness, operator time and
anything missing before deciding whether Penny is useful. This trial changes
only a separate local Penny installation. Support stays **documented format,
synthetic-only** until your real records have been inspected; this is not a
replacement, hosted-delivery or public-release acceptance.

Every step that touches your live UserVoice account is an owner action. No agent
has taken a UserVoice export, signed in to UserVoice or called its API.

## 1. Take two exports — owner action, live UserVoice account

This step is yours alone; no agent has performed it. Read
[Ideas and Idea & Voters Export](https://help.uservoice.com/hc/en-us/articles/9720398979091-Ideas-and-Idea-Voters-Export-Video),
[Understanding the Idea & Voters Export](https://help.uservoice.com/hc/en-us/articles/360035474133-Understanding-the-Idea-Voters-Export)
and [Column Definitions for Exports](https://help.uservoice.com/hc/en-us/articles/360035485693-Column-Definitions-for-Exports)
(read 2026-10-13 Australia/Brisbane).

1. In the UserVoice admin console, open the Idea grid and pick one view: **All
   ideas** for a complete history, or a forum or saved view. Write down every
   filter you apply (date range, forum, category, status, label, inactivity).
2. **Export → Export Current Dataset → Ideas** (the Regular Export). Choose
   **CSV**. Keep at least Idea ID, Idea Title, Idea Description, Created
   Timestamp and Public Status Name; add Idea Creator ID and Idea Creator Name,
   Forum ID and Voters Count.
3. With the **same view and filters**, **Export → Export Current Dataset → Idea &
   Voters** (the Analysis Export), as **CSV**. Keep at least Idea ID, User ID,
   User Name and Linked Idea Creation Date, plus Feedback Capturer and Feedback
   Captured By so proxy votes can be told apart. Leave out columns you do not
   need: each file must stay under 4 MiB.
4. If you only have an `.xlsx` file, open it in your spreadsheet app and use
   **Save As** (or **File → Export**) with **CSV UTF-8 (Comma delimited)**. Do
   not edit cells.
5. Record the export time and the filters. Keep UserVoice unchanged.

Take both files from the idea grid. The **All data** export in Settings → General
(one year at a time, vote totals only), an idea's **Supporters** tab export and the
Activity and Comments exports are different files with other headings; Penny refuses
them by name. A date range on the Ideas export makes that file a partial history, and
the Ideas & Voters export has no date filter, so declare `filtered` and write the filter down.

Check both files against the repository guide `docs/USERVOICE-MIGRATION.md`. If a
required heading is missing, a timestamp is not ISO 8601 with a timezone, or
the headings use legacy names, Penny refuses by name. Record that in the
worksheet; map legacy headings in `uservoice.headings` only when you are sure
what they mean, and never invent IDs or dates.

## 2. Start a separate local installation

Use a checkout with no valuable local records. From its root:

```sh
rer install
rer setup --owner-email YOUR_EMAIL
rer dev --login
```

Keep dev in the foreground and run later commands in another terminal. Open its
`RER_OPEN` outbox link, open the newest sign-in message and press **Confirm**,
then **Finish setup**. No hosted mail provider or UserVoice account is contacted.

Create an owner-only `private` directory (0700). Save `ideas.csv`, `voters.csv`,
a `source.json` manifest and `operator-session.json` there with mode 0600,
outside Git. The session file contains exactly `{"cookie":"..."}` with the
current `operator_session_local` browser cookie; never put the value in a
command, screenshot, log or this worksheet. Write `source.json` from the
manifest in `docs/USERVOICE-MIGRATION.md` (section "The manifest"): map
every Public Status Name, including blank as `""`, declare each file's `scope`
as `complete` or `filtered`, and copy your filters into `filter`.

## 3. Prepare, preview and read the receipt

Use fresh output paths; existing private output files are refused.

```sh
pnpm run feedback:import -- prepare --source private/source.json --out private/prepared.json
pnpm run feedback:import -- preview --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --out private/preview.json
pnpm run feedback:import -- receipt --preview private/preview.json
```

On `/app/data`, uploading `private/prepared.json` shows the same private
preview. Check: the partial-history warning if you declared `filtered`; ideas,
supporter rows, supporters and folded rows; the votes claimed by Voters Count
against the supporters supplied, and the aggregate-only difference; proxy and
unmarked supporters; named omissions; unresolved relationships; zero mail and
notification rows. If a refusal or omission matters to your decision, record
it and stop before apply.

```sh
PENNY_TRIAL_FINGERPRINT='REVIEWED_FINGERPRINT'
pnpm run feedback:import -- apply --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --fingerprint "${PENNY_TRIAL_FINGERPRINT:?}"
PENNY_TRIAL_JOB='RETURNED_JOB_ID'
pnpm run feedback:import -- status --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

Repeat status and resume on the same job until it reports `completed`. A killed
request resumes by the saved job ID, never by a new namespace or import.

## 4. Compare three named ideas, then undo and re-apply

Before importing, name three real ideas in the worksheet: **A — most
supported**, **B — distinctive multiline or non-English wording**, and **C —
one with proxy votes or a private forum**. Write each Idea ID and title.

**Current UserVoice comparison — owner action, live account, read-only:** by
hand, open those three ideas in UserVoice. In Penny, open `/app/moderation`,
find each imported request and open **Supporters**. Compare the wording,
mapped status and board, creator, the number of supporters, three named
supporters on A with their dates, and which of C's supporters are marked proxy.
Count supporters rather than trusting the claimed vote count. Read only: a
native edit, vote, comment, merge, decision link or publication would
intentionally block undo. Imported people gain no login, verification, consent
or outreach permission, and the requests stay held.

```sh
pnpm run feedback:import -- undo --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

Continue the same reversal job to `undone` and check removed and kept counts,
retained originals and zero mail and notification rows. If later native work
caused a conflict, stop; do not delete it or bypass the fence.

Re-apply with a fresh preview of the same files:

```sh
pnpm run feedback:import -- preview --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --out private/reapply-preview.json
pnpm run feedback:import -- receipt --preview private/reapply-preview.json
PENNY_TRIAL_FINGERPRINT='NEW_REVIEWED_FINGERPRINT'
pnpm run feedback:import -- apply --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --fingerprint "${PENNY_TRIAL_FINGERPRINT:?}"
PENNY_TRIAL_JOB='NEW_RETURNED_JOB_ID'
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

Compare A, B and C again: each must come back once, with the same wording and
supporters and no external effects. Then stop dev with Ctrl-C, or:

```sh
rer dev --stop
```

## 5. Erase one named supporter, then export and restore

Pick one real supporter you are willing to erase from this local copy. On
`/app/data` choose **Erase personal data**, the requester and **Preview erasure**:
the preview lists their records, and says in words when they also created an idea
(erasing them then removes that idea and every vote and comment others added to it). Confirm,
resume until the operation completes, then check: their records and original-file copies are
gone, the other supporters remain, and previewing the same files now says how many records were
erased earlier and that applying them will be refused. If the erasure is refused
with `erasure_ambiguous_copies`, follow "Erasing someone from a UserVoice import" in
`docs/USERVOICE-MIGRATION.md`. Then `rer export`, `rer reset --yes`, `rer import`, `rer setup` and
`rer export` again: the content hash and every table count must match.

The trial passes only when every row of the UserVoice acceptance table in
`docs/USERVOICE-MIGRATION.md` passes on your files.

## Trial worksheet — private, one page

Every cell says **not measured** until you run the trial. Fill it from the
exports, the receipts and your clock; keep identities and contents private.

| Check | UserVoice | Penny after apply / after undo / after re-apply | Operator minutes / what matters |
| --- | --- | --- | --- |
| Export view, filters and time; scope declared | Not recorded | Partial-history warning as expected? Not checked | Not measured |
| Ideas | Not counted | Not counted / not counted / not counted | Not measured |
| Supporter rows and supporters (unique User ID per idea) | Not counted | Not counted / not counted / not counted | Not measured |
| Claimed Voters Count against supplied supporters | Not counted | Aggregate-only difference not checked | Does the gap matter? Not recorded |
| Proxy supporters | Not counted | Not checked | Not measured |
| A — most supported: Idea ID, title, three supporters | Not selected | Wording, status, supporters not checked | Not measured |
| B — distinctive wording: Idea ID, title | Not selected | Exact wording not checked | Not measured |
| C — proxy votes or private forum: Idea ID, title | Not selected | Proxy marks and board not checked | Not measured |
| Omissions that matter (comments, merges, accounts, captured feedback, others) | Not inventoried | Not checked | Blocking? Not recorded |
| Refusals by name (headings, statuses, timestamps) | Not recorded | Not checked | Not recorded |
| Job-created mail and notification rows | No imported audience | Must be 0 / 0 / 0; not measured | Any nonzero result: stop |
| Undo: removed, kept, conflicts, originals | Source unchanged | Not checked | Later native work must survive |
| Total preparation, comparison and recovery time | Current-tool time not measured | Penny time not measured | Anything missing? Not recorded |

Stop if your current tool works, an export lacks Idea ID or User ID, timestamps
are refused, the omissions undermine your real decision, any count disagrees,
undo conflicts, or the trial adds work without improving evidence or follow-up.
Keep your UserVoice subscription and your original exports. Owning the source
also means owning deployment and maintenance; this local trial proves neither
hosted notifications nor a full replacement workflow.
