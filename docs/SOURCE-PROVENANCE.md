# Source provenance

Penny's public source is `https://github.com/just-every/run-penny`, and the README
clone command names it. The current version is 0.0.0; the first release is the
annotated tag `v0.0.0` on the repository's first commit, a parentless export of
the verified private tree.

## What the shipped records establish

`edition.json` names Penny's own source and the selected Base components, origin
paths and local mappings. `sources.lock.json` binds current tracked file bytes,
executable modes, the authoring tool and the selected `.edition/sources/`
comparison archives. Those archives retain upstream comparison bytes and modes.
`base/PROVENANCE.json` records the byte-exact copies individually; its root
revision is the common revision of those entries, not a replacement for their
per-file hashes and origin paths.

All active Base selections use
`eca838d6659f47f99338b8e638345bfe9191f3ba`. That revision and repository name
record historical origin. Base is private: these records do not promise public
access to that commit, nor claim it exists in Penny's public history. Earlier
revisions in dated evidence are historical receipts. A clean first-public tree
has its own commit identity and does not expose private source ancestry.

From an unchanged checkout, verify the shipped records without private Base
access or installed dependencies:

```sh
node scripts/edition-authoring/cli.mjs check
node scripts/verify-base-source.mjs
```

The package aliases are `pnpm source:check` and `pnpm verify:base-source`.
The first checks the selected retained archives and source lock; the second
checks copied files and modes against their shipped record. These establish
internal byte identity, not an independent attestation of private origins.
Do not run `source:lock` to accept an unexplained difference. An author stages
reviewed intentional changes before refreshing that lock.

With an authorized Base checkout containing the named revision, an author can
also compare the copy record directly with upstream and detect unrecorded
copies:

```sh
node scripts/edition-authoring/cli.mjs verify-base \
  --record base/PROVENANCE.json --base /absolute/path/to/base
```

This additional comparison is separate from the public offline check. A missing
or modified comparison archive fails verification; do not substitute a different
revision or invent a public-fetch origin.

## Reproduce the canonical public scan

Use caller-selected absolute paths for the separate Base checkout and the
parentless Penny public candidate. Keep the intended public identity explicit:

```sh
node "$BASE_CHECKOUT/scripts/publish-check.mjs" \
  --repo "$PENNY_PUBLIC_CANDIDATE" --ref main \
  --project just-every/penny \
  --repository https://github.com/just-every/run-penny
```

This command does not read `~/.env`; do not add `--env-file`, exclusions or
waivers. The dated prior-candidate result below is historical. A canonical scan
of the final integrated candidate is pending; this guide claims no `PASS`, public
push or owner action.

## Maintained delivery export

Base's `modules/delivery-producer/export.mjs` exports the delivery producer and
its selected schema files. Its portable `setup-manifest.mjs` changes exactly two
schema references: the import of `../../schema/setup-validation.mjs` becomes
`./schema/setup-validation.mjs`, and the URL for
`../../schema/SETUP.schema.json` becomes `./schema/SETUP.schema.json`.

That file is a maintained transformed export, so it must not be represented as
a byte-exact upstream copy. Its current bytes belong in Penny's source lock and
its edition mapping identifies the upstream comparison. Other exact producer
and schema copies retain their individual Base copy records. The adjacent
`packaging.json` is Penny's product policy supplied to the exporter; it is not a
Base source copy. Packaging and source verification establish no deployment,
registry admission or managed workflow execution.

## Saved Canny guide

The importer registry resolves `docs/CANNY-MIGRATION.md` from shipped bytes and
binds its content hash and size. Its evidence link names the intended public
Penny guide URL; `pnpm feedback:status` resolves that link locally and explicitly
leaves public availability unverified. It makes no network fetch.

The source revision records the historical guide origin using a non-fetching
identity, separate from that intended public link. It must not be paired with
the public Penny repository as though the private guide commit were publicly
available. [MOVE-IN](MOVE-IN.md) supplies the detailed import commands. The
status remains `documented format`, with synthetic-only evidence and no real
owner export; `seed.json.replaces` stays empty.

## Reproducing a parentless source tree

Run this from a clean Penny checkout at the committed source ref being prepared.
`inspectSource` resolves that ref to its commit and tree and rejects a dirty
checkout. `cleanHistory` reads committed ordinary files and preserves their
`100644` or `100755` modes. Its temporary parent must already exist, be fresh,
and sit outside the source checkout; the `clean-source` child must not already
exist.

```sh
node --input-type=module <<'NODE'
import { mkdtemp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectSource } from './scripts/base-cli/modules/release/source.mjs';
import { cleanHistory } from './scripts/base-cli/modules/release/export.mjs';

const sourceRef = 'main';
const source = inspectSource(process.cwd(), sourceRef);
const temporary = await mkdtemp(resolve(dirname(source.repo), '.penny-clean-export-'));
const candidate = cleanHistory(source, temporary, false);

console.log({ sourceRoot: source.repo, sourceRef, sourceCommit: source.commit,
  sourceTree: source.tree, ...candidate });
NODE
```

The displayed `sourceCommit` and `sourceTree` identify the source input; `repo`
and `commit` identify the exported checkout and its only commit. Verify that
`git -C <repo> rev-list --count main` prints `1`, and that
`git -C <repo> rev-parse 'main^{tree}'` equals `sourceTree`. The export starts a
new Git repository on `main`, so it has no parent, tags, or remote and this
procedure performs no push. The commit message carries the committed version
and public release notes; the final `false` deliberately does not create the
version tag. Only an explicit `true` requests that annotation.

## Publication boundary

The public candidate is a reviewed parentless export of the final integrated
source. When it is ready for the separate Base publication scan, scan candidate
`main` with project `just-every/penny` and repository
`https://github.com/just-every/run-penny`, using the current separately checked-out
Base scanner. Do not pass `--env-file` or read `~/.env`; add no history or scan
exclusions, allowlists, or finding waivers. This procedure documents local tree
reproduction and makes no scan `PASS` claim. The root's final check owns any
result for its exact integrated candidate. Repository creation, public push,
production publication flip, version tag, provider setup or staging, registry
admission, and site pin remain owner actions.

### Historical canonical scan observation, 10 October 2026

Before this refresh, the complete canonical scan of the parentless Penny
candidate adopting Base `f7c6b757d5b7c467974e322073a57e34d361e327` returned
`FAIL` on 2026-10-10: five findings in
four documents and zero warnings. The selected history contained one commit,
one tree and 1,237 blobs; the scanner was Gitleaks 8.30.1. Four findings are
missing-reference hygiene findings and one is a private-reference hygiene
finding. The decrease from the earlier six-finding candidate followed
correction of Penny-owned generated-directory references. This receipt describes
that prior candidate, not the current adopted source.

The five findings were in four retained Base-owned documents. Comparison with
that earlier Base pin confirmed each copy was byte-for-byte unchanged. The
earlier `1b5ce616ac1f6b79c002b45b0de497a93938d4e4` adoption included the
upstream corrections summarized below:

| Penny path | Historical finding | Correction adopted from Base |
| --- | --- | --- |
| `SEED-COMMAND-CONTRACT.md` | Missing-project references where prose describes source-inspection commands and a local module directory. | Describe the commands as retained by edition-authoring and mark the local module path as a directory. |
| `scripts/base-cli/cli/README.md` | Missing-project references for two local module directories. | Mark both module paths as local directories. |
| `scripts/base-cli/modules/release/README.md` | A fictional repository example is read as a missing GitHub project. | Replace it with a clearly delimited project-identity placeholder, and explain that this differs from the HTTPS destination URL. |
| `scripts/edition-authoring/README.md` | Missing-project references in prose and a local module path, plus one private-source identifier read as a repository. | Say “commit and tree,” mark the local module path as a directory, and identify the unformatted value as a logical component ID while retaining repository fields in structured provenance. |

The four documentation corrections now come from the maintained upstream export
and exact-copy adoption, with no local edits to those Base documents. The same
pin includes scanner corrections for Unix path case and validation of canonical
schema-1 copy records against declared pins. No scanner exception or finding
waiver was added.

A new canonical scan of the final integrated parentless candidate remains
pending under the root review described above. The historical five-finding
`FAIL` is preserved as evidence for its earlier candidate; adopting corrected
source and regenerating custody records does not establish a current `PASS`.
The final scan must include this guide and its regenerated source lock.
