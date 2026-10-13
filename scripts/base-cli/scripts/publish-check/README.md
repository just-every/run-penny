# Publication scan implementation

See [setup, command and scope](../publish-check-README.md).

`git_history.py` delegates revision resolution, traversal, tree inventory and
blob reads to system Git (`rev-parse`, `rev-list`, `ls-tree`, `cat-file --batch`).
`gitleaks.py` runs the pinned scanner in git, directory and stdin modes and keeps
its report private until translating it into the value-free v3 envelope.
Hexadecimal credential assignments also use a Gitleaks rule without generic
entropy or English stopword filters. Both assignment rules go through the same
location-bound Source/module identity classification; provider and environment findings
remain independent.
`tree_scan.py` applies the kept text and licence policy. `history_scan.py`
assigns release, working-tree and historical scopes. The Node entry point bounds
the whole operation and stops its private process group on timeout/cancellation.

Git message records carry their kind explicitly. Only commit records enable the
bounded public coauthor address rule described in the command guide; a file named
`@commit-message` has no special status. `public_hygiene.py` matches complete raw
`Co-Authored-By` lines in the final trailer paragraph case-insensitively and
masks only the accepted address for email inspection, leaving names, other
addresses and every other rule intact.

Binary metadata decoding, Git protocol/object/ref modelling, frozen comparison,
resumable inspection and their tests have been removed. Tests live in `tests.py`
and `coverage_tests.py` and construct disposable repositories with actual Git.

`content_identities.py` binds generic-api-key and hex-api-key occurrences to
exact JSON value locations. `source_metadata.py` enumerates digest fields in the
formats emitted by `edition-authoring/cli.mjs` and `sources.mjs`: lock manifest,
toolchain, parent/baseline pins and file SHA-256 values; retained archive keys,
content digests and dependency pins; and the source origins' revision or
projection identities. These are format classifications independent of selected
graphs, canonical serialization, archive preimages and authoring freshness.
`source_shapes.py` first checks the documented local record types, immutable
origin identity, source selections and file/pin records. A malformed archive or
lock grants no identity roles; unknown extra fields never gain a role.
`provenance_pins.py` keeps the existing module revision classification.

`json_identity.py` rejects duplicate members and non-JSON constants and binds
native findings to exact string byte spans. Only documented structural fields
with the declared digest length qualify. An extra credential field, arbitrary
nested field or copy of the digest on the same minified line remains a finding.
Provider and known environment findings are independent. Native git/dir matches
stay in the private temporary report and memory; values are never added to the
public report. Authoring's integrity checks remain unchanged.

`copy_identities.py` proves the maintained `base-copies.json` and portable
`base/PROVENANCE.json` copy-inventory SHA-256 values
against every declared file's bytes and regular-file mode in the same scanned
tree. Historical matches use only that commit's blobs; present files cannot
rescue a historical mismatch. Working-tree preimages reject linked paths.
Only the exact native match at a proved inventory field is classified. There
is no filename, hash-value or comma-delimited credential exemption.

`checksum_maps.py` classifies a file-name to digest map (`'0005_operator_auth.sql':
'<sha256>'`, in JSON, JavaScript, YAML or similar) in any file outside the
content-identity documents above. The native match must sit in a run of
`name: digest` entries separated only by commas, semicolons, whitespace and line
comments, and every entry in that run must name a regular file in the same scanned
tree (a path, or a trailing path component) whose bytes hash to that SHA-256. One
entry that does not prove, a 40-hex value, a key that names no tree file, or a hex
value with no file-name key keeps the native finding. Historical matches use only
that commit's blobs and working-tree preimages reject linked paths. There is no
path, filename, hash-value or repository exemption. `hit_location.py` resolves
the native match's exact bytes for both proofs.

`trust_bundle.py` classifies an email match as public CA certificate metadata
only when all of these hold: the file's path is an artifact listed by a committed
`trust-bundle.json` in its directory and its bytes hash to the SHA-256 pinned
there; that manifest's webpki-roots release and checksum are exactly the one the
same directory's `Cargo.lock` locks from crates.io; and the match lies entirely
inside an attribute value of a subject Name parsed (`der.py`, strict DER) from
those bytes, where the anchor's subject Name and SubjectPublicKeyInfo DER both
occur in the file and hash to one anchor entry of the manifest. With the verified
subject values blanked, no email may remain, and every match must be one found
inside them; otherwise the file keeps `hygiene.email`. Historical blobs use their
own commit's manifest and lock; working-tree files use the selected commit's.
The build that produces the artifacts (`modules/egress-service/tls/build.mjs`)
regenerates the manifest, and its `--check` mode rejects a stale one. An
alphabetic top-level domain label ends before a following digit, so a match
ends at the DER string's boundary rather than absorbing the next tag byte.
