# Export and restore

Your Penny data is yours, and you can take a copy of it. This page covers the product archive, restoring into an empty installation and erasing personal data. Hosted restore and erasure have an authenticated API and CLI source path. Its verification is source-only, local TLS; proving it on a real installation is an owner action. The archive is not a full backup of installation authority.

## What the archive holds

The archive is one JSON file of your business data, plus the original bytes of every request and evidence attachment. It covers every table Penny classifies as product data, including wording and commitment revisions, release versions and outcomes, subscription permissions, review notes and notifications, and the audit trail. Each file is stored with its checksum, type and size. Penny checks all of it before it will restore anything.

A second, separate file, the **erasure journal**, records which personal data has been erased, so a restore cannot bring it back. Always keep the latest journal with the archive.

## What it leaves out

The archive is deliberately not an identity or installation backup.

- **Sign-in authority.** Operator and requester sessions, sign-in links, tokens and rate-limit records are not carried over. Restored credentials are disabled, so everyone signs in again. A new copy keeps its own operator bootstrap.
- **Secrets.** `AUTH_SECRET`, `SETUP_TOKEN`, your mail provider key and webhook keys are not in the archive. Keep them yourself.
- **Pending mail.** Queued notifications are held for review instead of being replayed, so a restore cannot email customers a second time. Local outbox messages are never included.
- **Migration records and locks.** These belong to the target installation.

## Limits

These are bounded review limits, not tested production capacities:

- 2,000 business rows and 2,000 erasure records
- 4 MiB for all business rows together, and separately 4 MiB for the erasure journal
- 10 MiB per file and 20 MiB of original files in total
- 32 MiB for the archive when sent or received

If you are over a limit, the export stops with an error and never hands you a truncated archive. Export also refuses if Penny finds a table it does not know how to classify, a tracked attachment whose bytes are missing, or a file in storage that no record accounts for.

## Export

The Data screen in the operator app, at `/app/data`, has a **Download backup** button that saves the archive and its journal as one private file. The same thing is available from your terminal. Use the script form of the command: bare `pnpm import` is pnpm's own lockfile command and does not restore Penny data.

```bash
pnpm run data:export -- private/archive.json --origin https://your-address --session-file private/session.json
pnpm run data:journal -- private/latest-journal.json --origin https://your-address --session-file private/session.json
```

- `--origin` is your deployment's exact HTTPS origin. Local HTTP is accepted only for `localhost`, `127.0.0.1` or `::1`. Paths, query strings, credentials in the URL and redirects to another host are refused.
- `--session-file` points to a JSON file with exactly one property, `cookie`, holding your operator session cookie as a `name=value` pair. Sign in to Penny in your browser and copy the cookie from there. The name is `__Host-operator_session` on a deployed copy and `operator_session_local` when you run locally, so the file looks like this, with your own value after the equals sign (20 to 4,096 letters, digits, `-` or `_`):

  ```json
  {"cookie": "__Host-operator_session=PASTE_THE_COOKIE_VALUE_HERE"}
  ```

  A bare value without the name is refused as an invalid operator session file. The file must be a regular file that only you can read (mode 0600). Never put the cookie in a command, an environment variable or a screenshot, and never commit the file.

The files are written readable only by you. The archive holds private evidence: keep it somewhere private and never publish it. The examples keep their files in a `private/` folder inside the project, which Penny's `.gitignore` excludes so `git add -A` cannot pick up a session cookie or an archive. If you choose another place inside the project, ignore it too, or keep these files outside the project. A checksum detects accidental corruption. It does not prove who made the file.

## Restore into an empty copy

Restoring never overwrites anything. It needs a separate, empty copy of Penny: a freshly migrated database and an empty file bucket, with its own operator sign-in already working. If anything beyond that sign-in setup exists, restore refuses.

For an authenticated running installation, the command is:

```bash
pnpm run data:import -- private/archive.json --journal private/latest-source-journal.json --origin https://your-empty-destination --session-file private/destination-session.json
```

The journal is required, and it must be the latest one for that archive. Penny writes the files first, then applies the data in one step. If a step fails, it cleans up only what it created and keeps the maintenance lock until you resolve it. Writes elsewhere in the app are paused while an export or restore runs.

To prepare an empty local copy, run `rer setup --owner-email EMAIL`; it applies the schema without seeding anything, and `rer import` applies the migrations itself before restoring. Local data lives only in `.wrangler/state`, so start the built Worker against that same store.

If a restore is interrupted:

```bash
pnpm run data:status -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
pnpm run data:import -- private/archive.json --journal private/latest-source-journal.json --resume <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
pnpm run data:abort-restore -- <operation-id> --origin http://localhost:15300 --session-file private/destination-session.json
```

An old runner that genuinely stopped can be released with `pnpm run data:recover-runner`, but only after you have stopped it and its writers yourself. Never use it against a live runner.

Do not use raw database imports. They skip the journal and the other safeguards.

## Erase personal data

You can erase a requester, a request, an evidence item or an account. Erasing an operator is not supported, and an erasure that would touch an operator stops.

```bash
pnpm run data:erase-preview -- requesters <id> private/plan.json --origin http://localhost:15300 --session-file private/session.json
pnpm run data:erase -- private/plan.json --journal-out private/latest-journal.json --origin http://localhost:15300 --session-file private/session.json
```

Preview shows how many rows and files would go, and any copies Penny cannot attribute. Erase checks the preview again, removes dependent histories and personal records, anonymises surviving audit references, deletes original files and records journal tombstones. It reports complete only after the files are gone. Save the updated journal. If it is interrupted, `pnpm run data:resume-erasure` carries on. The local Data screen has this flow. In hosted mode, a native owner can use **Export workspace** and download the Base archive and its matching erasure journal. Keep both files together for `rer import` into an empty local installation. If the export tab closes mid-way, the Data page shows **Export in progress** with **Resume export** and **Abort export** for the owner who started it. The screen also shows operation state and exact CLI commands; restore and erasure have no destructive screen button.

Penny will not guess. If wording that matches the person appears in records that are not theirs, erasure stops until you resolve it, rather than deleting unrelated business data. It checks exact copies, including names, filenames and source labels, not paraphrases. Wording you explicitly approved for the public, such as a published request title, can remain in a published release or status update.

## Honest limits

- **Hosted proof is source-only, local TLS.** Current native operator authority, same-origin mutation, empty destination, current journal, maintenance and preview-hash fences still apply. Real hosted acceptance belongs to the owner.
- **It is not an identity backup.** Keep your secrets, and plan on signing in again after a restore.
- **A new copy cannot check that your journal is the latest.** An old archive with its old journal restored into a brand-new store is not prevented. Keep the newest journal safe.
- **Production-scale limits and timed cleanup are not proven.** The size limits above are not production-scale capacity claims.

The full technical record is in `docs/data-ownership.md` in the source.
