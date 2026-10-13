# A reversible local Canny trial

Keep your current tool if its evidence, decisions and follow-up work. Bring one
real decision and one saved export; compare completeness, operator time and
anything missing before deciding whether Penny is useful. This trial changes
only a separate local Penny installation. Support remains **documented format,
synthetic-only** until your real records have been inspected; it is not a
replacement, hosted-delivery or public-release acceptance.
Every live Canny account step in this procedure is owner-only; agents must never
access the live account.

## 1. Take one export — owner action, live Canny account

This export step is an owner action; no agent has performed it.
Read the current [Exporting feedback guide](https://help.canny.io/en/articles/3889198-exporting-feedback)
(Ideas and classic sections), read 2026-10-13 Australia/Brisbane. For Ideas,
choose the intended view, review its filters/visible fields and use **Export view**;
an Ideas export holds at most 10,000 records, so split a larger workspace into views.
For classic, choose one board's **Export Data**. Keep the download private and
record the view/board, export time and selection scope. Keep Canny unchanged.
Before applying, write down the real heading row: the guide names the classic
columns (Post Title, Post Detail, Score (Total Votes), Comment Count, Date created,
Image URLs, Post Status, Post URL, Tags, Post Author, Category, Owner, Associated
MRR), but one third-party guide lists `Score` and `Post Owner`. Penny keeps any extra
classic heading as a named private omission, and the aggregate check applies to
`Score (Total Votes)` only, so a file headed `Score` shows its score as an unchecked omission.
The trial passes only when every row of the Canny acceptance table in
`docs/CANNY-MIGRATION.md` passes on your file.

Check the saved file against the repository guide `docs/CANNY-MIGRATION.md`.
Ideas requires a supplied stable idea ID or URL, which the article does not
guarantee. If absent, stop and record the limitation; never invent IDs or treat
names/counts as identities. Do not make new API calls or start a paid trial for
this procedure. Aggregate counts cannot replace detailed votes/comments/insights.

## 2. Start a separate local installation

Use a checkout with no valuable local records. From its root:

```sh
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email YOUR_EMAIL
node scripts/rer.mjs dev --login
```

Keep dev in the foreground; run later commands in another terminal. Open its
`RER_OPEN` outbox link, open the newest sign-in message and press **Confirm**.
Complete **Finish setup**. This uses ordinary local sign-in rather than a dev
identity session, whose cookie cannot be used by the archive/import transport.
No hosted mail provider or Canny account is contacted.

Create an owner-only `private` directory (0700). Save the supplied CSV,
`source.json` manifest and `operator-session.json` with mode 0600, outside Git.
The session file contains exactly `{"cookie":"..."}` with the current
`operator_session_local` browser cookie. Copy it privately; never put the value
in argv, screenshots, logs or this worksheet. The repository guide `docs/MOVE-IN.md` gives classic and Ideas manifest shapes, status/visibility and column mappings.
Use the saved loopback origin below, or replace it consistently with your initial
setup port. Do not edit a refused source to hide missing relationships.

## 3. Prepare, preview and read the receipt

Use fresh output paths; existing private output files are refused.

```sh
pnpm run feedback:import -- prepare --source private/source.json --out private/prepared.json
pnpm run feedback:import -- preview --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --out private/preview.json
pnpm run feedback:import -- receipt --preview private/preview.json
```

Open `private/preview.json` and the receipt. On `/app/data`, uploading
`private/prepared.json` shows the same private preview. Review status, visibility,
rows read/applied/skipped, skip reasons, every aggregate total, named omissions
and unresolved relationships. Require zero job-created mail and notification rows.
If a heading/key is absent, a relationship is unresolved or an omission matters
to your decision, record it and stop before apply. Do not approve rejected mapping.

Copy the exact reviewed fingerprint into this nonsecret shell variable:

```sh
PENNY_TRIAL_FINGERPRINT='REVIEWED_FINGERPRINT'
pnpm run feedback:import -- apply --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --fingerprint "${PENNY_TRIAL_FINGERPRINT:?}"
```

Save the returned job ID in `PENNY_TRIAL_JOB`. If the state is not `completed`,
continue the same bounded job; repeat status/resume until `completed`. A killed
request resumes by the saved ID, never a new namespace or import.

```sh
PENNY_TRIAL_JOB='RETURNED_JOB_ID'
pnpm run feedback:import -- status --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

## 4. Compare three named records, then undo and re-apply

Before importing, name three real source records in the worksheet: **A — most
supported**, **B — distinctive multiline/Unicode wording**, and **C — private or
sensitive context**. Write each exact source title and supplied key.

**Current Canny comparison — owner action, live account, read-only:** by hand,
open those same three records in your current Canny account. Compare each one
with Penny, the saved Canny export and the source-view notes recorded when taking
it: wording, mapped status/visibility, attribution, source reference and
omissions. This inspection is owner-only; agents must not access the account.
Count rows rather than treating aggregate vote totals as destination votes.
Use read-only inspection; a native edit/vote/comment/merge/decision/publication
would intentionally block unchanged-only undo. Historical people gain no login,
verification, consent or outreach permission; requests are still held.

```sh
pnpm run feedback:import -- undo --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- status --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

Continue the same reversal job to `undone`. Inspect removed/kept/conflict counts,
retained originals and zero mail/notification rows. If later native work caused
a conflict, stop; do not delete it or bypass its fence. Ordinary undo keeps exact
private originals; erasure is a separate destructive operation.

Preview the identical source again in a fresh private file, read its receipt,
and copy that reviewed fingerprint into `PENNY_TRIAL_FINGERPRINT`. Re-apply uses
the same namespace and source keys and creates a new job generation after undo.
Do not change the namespace to bypass conflicts or erasure fences.

```sh
pnpm run feedback:import -- preview --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --out private/reapply-preview.json
pnpm run feedback:import -- receipt --preview private/reapply-preview.json
PENNY_TRIAL_FINGERPRINT='NEW_REVIEWED_FINGERPRINT'
pnpm run feedback:import -- apply --source private/source.json --origin http://127.0.0.1:8787 --session-file private/operator-session.json --fingerprint "${PENNY_TRIAL_FINGERPRINT:?}"
PENNY_TRIAL_JOB='NEW_RETURNED_JOB_ID'
pnpm run feedback:import -- status --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- resume --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
pnpm run feedback:import -- receipt --job "${PENNY_TRIAL_JOB:?}" --origin http://127.0.0.1:8787 --session-file private/operator-session.json
```

Repeat status/resume on this new job until `completed`.

Read the new applied receipt and compare A/B/C again; they must be recreated once
with the same supplied wording and no external effects. On completion, stop the
foreground dev process with Ctrl-C and confirm it has exited, or use:

```sh
node scripts/rer.mjs dev --stop
```

## Trial worksheet — private, one page

These cells deliberately say **not measured** until you run the trial. No real
export or operator time has been supplied. Fill the result from source counts,
the actual receipts and your clock; keep identities and source contents private.

| Check | Source/export | Penny after apply / after undo / after re-apply | Operator minutes / omission that matters |
| --- | --- | --- | --- |
| Export scope and timestamp; board/view/filter | Not recorded | Same intended scope? Not checked | Not measured |
| Idea/post rows | Not counted | Not counted / not counted / not counted | Not measured |
| Supplied individual people/votes/comments (if present) | Not counted | Not counted / not counted / not counted | Counts alone create none |
| Aggregate-only columns and totals | Not inventoried | Not checked against receipt | Which lost detail matters? Not recorded |
| Destination rows by table; skipped rows/reasons | Not mapped | Not checked against receipt | Not recorded |
| A — most supported: exact title + source key | Not selected | Wording/status/reference not checked | Not measured |
| B — multiline/Unicode: exact title + source key | Not selected | Exact wording not checked | Not measured |
| C — sensitive: exact title + source key | Not selected | Held/private treatment not checked | Not measured |
| Named omissions/unresolved relationships | Not inventoried | Not checked | Blocking omission? Not recorded |
| Job-created mail/notification rows | No imported audience | Must be 0 / 0 / 0; not measured | Any nonzero result: stop |
| Reversal: removed/kept/conflicts/originals | Source stays unchanged | Not checked | Later native work must survive |
| Total preparation/comparison/recovery time | Current-tool time not measured | Penny time not measured | Anything missing? Not recorded |

Stop if your current tool works, the export lacks a stable key, the omissions
undermine your real decision, any count disagrees, reversal conflicts, or the
trial adds work without improving evidence or follow-up. Keep your subscription
and original export. Source ownership also means deployment and maintenance
responsibility; this local trial proves neither hosted notifications nor a full
replacement workflow.
