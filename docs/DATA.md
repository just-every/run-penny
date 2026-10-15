# Export and restore

Your Penny data is yours, and you can take a copy of it. This page covers the product archive, restoring into an empty installation and erasing personal data. Hosted restore and erasure have an authenticated API and CLI source path. Its verification is source-only, local TLS; proving it on a real installation is an owner action. The archive is not a full backup of installation authority.

## What the archive holds

The archive holds your business data and the original bytes of every request and evidence attachment. Hosted **Export workspace** and `rer export` produce a `penny.rer` archive and a separate erasure journal for `rer import`. The authenticated `data:export` command below uses a JSON archive for `data:import`; the local Data screen offers that JSON format as **Download backup**. It covers every table Penny classifies as product data, including wording and commitment revisions, release versions and outcomes, subscription permissions, review notes and notifications, and the audit trail. Each file is stored with its checksum, type and size. Penny checks all of it before it will restore anything.

A second, separate file, the **erasure journal**, records which personal data has been erased, so a restore cannot bring it back. Always keep the latest journal with the archive.

## What it leaves out

The archive is deliberately not an identity or installation backup.

- **Sign-in authority.** Operator and requester sessions, sign-in links, tokens and rate-limit records are not carried over. Restored credentials are disabled, so everyone signs in again. A new copy keeps its own operator bootstrap.
- **Secrets.** `AUTH_SECRET`, `SETUP_TOKEN`, your mail provider key and webhook keys are not in the archive. Keep them yourself.
- **Pending mail.** Queued notifications are held for review instead of being replayed, so a restore cannot email customers a second time. Local outbox messages are never included.
- **Migration records and locks.** These belong to the target installation.

## Limits

The authenticated JSON archive has these bounded review limits, not tested production capacities:

- 2,000 business rows and 2,000 erasure records
- 4 MiB for all business rows together, and separately 4 MiB for the erasure journal
- 10 MiB per file and 20 MiB of original files in total
- 32 MiB for the archive when sent or received

The maintained `rer` archive used by hosted **Export workspace** instead permits up to 500,000 business rows and 512 MiB record JSON, with the same original-file limits. Neither format is a tested production capacity claim.

If you are over a limit, the export stops with an error and never hands you a truncated archive. Export also refuses if Penny finds a table it does not know how to classify, a tracked attachment whose bytes are missing, or a file in storage that no record accounts for.

## Export

Open **Data** in the operator app at `/app/data`. On a hosted installation, the signed-in owner chooses **Export workspace**. Preparing the private snapshot and checking its original files can take about two minutes; larger workspaces may take longer. The screen shows the current stage, saved archive parts and elapsed time. Data changes pause during the export.

Reloading or closing the tab preserves the saved export. Return to Data and choose **Resume export** when no other tab or device is still preparing it. Completed snapshots also survive reloads: resume to recover the same download links. Download **both** the archive and erasure journal, then choose **Finish export** to remove the saved snapshot and release the workspace. **Abort export** removes it without finishing. No session file is needed for this browser workflow.

On a local installation, **Download backup** saves the JSON archive and journal as one private bundle. The authenticated JSON format is also available from your terminal. Use the script form of the command: bare `pnpm import` is pnpm's own lockfile command and does not restore Penny data.

```bash
npm run data:export -- private/archive.json --origin https://your-address --session-file private/session.json
npm run data:journal -- private/latest-journal.json --origin https://your-address --session-file private/session.json
```

- `--origin` is your deployment's exact HTTPS origin. Local HTTP is accepted only for `localhost`, `127.0.0.1` or `::1`. Paths, query strings, credentials in the URL and redirects to another host are refused.
- `--session-file` points to a JSON file with exactly one property, `cookie`, holding your operator session cookie as a `name=value` pair. Sign in to Penny as the owner. In browser developer tools, open Application (or Storage) → Cookies → your installation’s exact origin, then copy the native operator cookie’s value. The name is `__Host-operator_session` on a deployed copy and `operator_session_local` when you run locally, so the file looks like this, with your own value after the equals sign (20 to 4,096 letters, digits, `-` or `_`):

  ```json
  {"cookie": "__Host-operator_session=PASTE_THE_COOKIE_VALUE_HERE"}
  ```

  A bare value without the name is refused as an invalid operator session file. Create a private directory with mode 0700 and an empty regular file with mode 0600 before opening it in a local text editor and saving this JSON. Delete the file after use; signing out or session expiry invalidates it. Never put the cookie in a command, an environment variable or a screenshot, and never commit the file.

The files are written readable only by you. The archive holds private evidence: keep it somewhere private and never publish it. The examples keep their files in a `private/` folder inside the project, which Penny's `.gitignore` excludes so `git add -A` cannot pick up a session cookie or an archive. If you choose another place inside the project, ignore it too, or keep these files outside the project. A checksum detects accidental corruption. It does not prove who made the file.

## Restore into an empty copy

Restoring never overwrites anything. It needs a separate, empty copy of Penny: a freshly migrated database and an empty file bucket, with its own operator sign-in already working. If anything beyond that sign-in setup exists, restore refuses.

For an authenticated running installation, the command is:

```bash
npm run data:import -- private/archive.json --journal private/latest-source-journal.json --origin https://your-empty-destination --session-file private/destination-session.json
```

The journal is required, and it must be the latest one for that archive. Penny writes the files first, then applies the data in one step. If a step fails, it cleans up only what it created and keeps the maintenance lock until you resolve it. Writes elsewhere in the app are paused while an export or restore runs.

To prepare an empty local copy, run `rer setup --owner-email EMAIL`; it applies the schema without seeding anything, and `rer import` applies the migrations itself before restoring. Local data lives only in `.wrangler/state`, so start the built Worker against that same store.

If a restore is interrupted:

```bash
npm run data:status -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
npm run data:import -- private/archive.json --journal private/latest-source-journal.json --resume <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
npm run data:abort-restore -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
```

An old runner that genuinely stopped can be released with `npm run data:recover-runner`, but only after you have stopped it and its writers yourself. Never use it against a live runner.

Do not use raw database imports. They skip the journal and the other safeguards.

## Erase personal data

You can erase a requester, a request, an evidence item or an account. Erasing an operator is not supported, and an erasure that would touch an operator stops.

```bash
npm run data:erase-preview -- requesters <id> private/plan.json --origin http://localhost:15300 --session-file private/session.json
npm run data:erase -- private/plan.json --journal-out private/latest-journal.json --origin http://localhost:15300 --session-file private/session.json
```

Preview shows how many rows and files would go, and any copies Penny cannot attribute. Erase checks the preview again, removes dependent histories and personal records, anonymises surviving audit references, deletes original files and records journal tombstones. It reports complete only after the files are gone. Save the updated journal. If it is interrupted, `npm run data:resume-erasure` carries on. The local Data screen has this erasure flow. Hosted Data shows operation state and exact CLI commands for restore and erasure; these have no destructive screen button. Hosted browser exports use the separate workflow above.

Penny will not guess. If wording that matches the person appears in records that are not theirs, erasure stops until you resolve it, rather than deleting unrelated business data. It checks exact copies, including names, filenames and source labels, not paraphrases. Wording you explicitly approved for the public, such as a published request title, can remain in a published release or status update.

## Honest limits

- **Hosted proof is source-only, local TLS.** Current native operator authority, same-origin mutation, empty destination, current journal, maintenance and preview-hash fences still apply. Real hosted acceptance belongs to the owner.
- **It is not an identity backup.** Keep your secrets, and plan on signing in again after a restore.
- **A new copy cannot check that your journal is the latest.** An old archive with its old journal restored into a brand-new store is not prevented. Keep the newest journal safe.
- **Production-scale limits and timed cleanup are not proven.** The size limits above are not production-scale capacity claims.

The full technical record is in `docs/data-ownership.md` in the source.
