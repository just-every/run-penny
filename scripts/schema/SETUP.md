# Setup manifest version 1

Validate source bytes with `parseSetupManifestBytes`, then pass the parsed object
and `SETUP.schema.json` to `validateSetupManifest`. The latter checks both the
portable structural schema and cross-field semantics. Neither check alone is
sufficient. `node schema/validate.mjs --schema SETUP` validates the example.

A seed keeps one root `rer-setup.json`. The local installer, Base delivery
producer and platform all consume it through the same portable schema and value
functions. With `setup.manifestFile: "rer-setup.json"`, the producer requires
`JSON.stringify(manifest, null, 2)` plus a newline at rest and binds the exact
committed bytes; other source selections retain canonical emission.

The installer ignores platform-only `runtimeEditable`, `runtime` and `prefill`.
It renders unsupported extension fields ordinarily and leaves extension effects
to edition hooks. Binding-free extension-only manifests need no invented owner
input. A manifest declaring `prefill: "account-email"` must have exactly one
owner-claim step; multiple owner claims are always invalid. The schema still
requires at least one field and one step. Authenticated editions retain their
real owner claim; default-seed uses `setup-token` with `SETUP_TOKEN`.

Secret `input` metadata explicitly distinguishes `entered` and `managed` values.
An entered secret requires `ownerVisible: true` and cannot declare `generate`.
A managed secret requires `ownerVisible: false`; it may be generated or supplied
by service configuration. `ownerVisible` consistently means the owner can see or
supply that secret in both legacy and registry consumers. For compatibility,
generated secrets may omit `input` and retain their declared visibility. A
non-generated owner-visible secret must explicitly say `input: "entered"`.
Public fields cannot declare `input`, `generate` or `ownerVisible`. Secrets cannot
declare defaults, prefill, options or `runtimeEditable` (even false).

Public fields and groups may declare `audience: "owner" | "developer"`.
An omitted group audience means `"owner"`. A public field inherits its group's
audience when omitted, or defaults to `"owner"` without a group audience.
A field may narrow an owner group to `"developer"`; an explicit `"owner"` field
inside a `"developer"` group is refused, so a group cannot accidentally expose
one of its developer settings. Unknown values are refused with the field name
or group ID. Secrets cannot declare `audience`; their existing `ownerVisible`
and `input` contract is unchanged.

For example, `{"id":"technical","label":"Technical settings","audience":"developer"}`
makes public fields with `"group":"technical"` developer settings, even when
those fields omit `audience`. `setupFieldAudience(field, groups)` returns this
effective audience for a validated public field. The installer model also
exposes it through `fieldDefinition` and `groupDefinition`.
Consumers with an owner/developer distinction can use it to keep developer-only
settings away from owners. Base's local browser installer and `rer setup` have
no such distinction: both continue to render and validate all active public
fields, including developer settings. Audience does not change requiredness,
defaults, conditions, runtime editability or submitted values. Existing
manifests without audience keep their current behavior.

A field may declare `localDefault`, a value that only the zero-setup local
launch (`rer dev` on a checkout that is not set up) fills into an empty active
field. It takes one of three forms: a literal string for a public field, which
must pass `validateSetupValue`; `{"generate": "hex"}` or
`{"generate": "base64"}` for an entered secret (`input: "entered"` with
`ownerVisible: true`), a fresh random value written
only to the checkout's 0600 private settings and never printed or logged; or
`{"from": "origin"}` for a public url or text field, which takes the checkout's chosen
local origin. A secret never takes a literal, and an object declares exactly one
of `generate` and `from`. Explicit `rer setup`, `deploy`, the browser installer
and the platform never fill it; a manifest without it behaves as before.

`validateSetupValue(field, value)` is exported for install-time consumers and is
the same validator used for public defaults. It throws on non-string values,
values longer than 16,384 characters, malformed email (254 characters after
trim/lowercase), non-HTTP(S) or credential-bearing URLs, non-six-digit hex colours,
unsupported timezones and undeclared select choices. Empty strings represent
absence at install time for every kind, including select. Manifest select defaults
additionally must match a declared option, including an empty default: declare an
option with `value: ""` to use it. Requiredness is checked when accepting
a configuration, not when validating an optional default. Validation does not
normalize the saved value. `runtime.exclude` may name only declared fields.

Conditions have exactly one of these shapes:

```json
{"field":"PROVIDER","equals":"custom"}
{"field":"PROVIDER_URL","nonEmpty":true}
```

Both operators together, neither operator, and `nonEmpty: false` are invalid.
A field's condition and presentation conditions must reference an earlier field
in the fields array. Equality retains its public text/select contract, including
exact membership for select values. Nonempty may reference any public kind,
including URL and email, and never a secret. Group presentations are evaluated
after the declared fields and may reference any declared public dependency.

`setupConditionMatches(condition, values)` is the shared exported evaluator.
`nonEmpty` means a string whose raw length is greater than zero; absent values,
objects and booleans do not match, while whitespace does. Equality uses strict
string equality; missing and empty are distinct. Consumers must use this same
predicate for field activation, field/group presentations and deployment coverage.
All presentations within one list share a discriminator and must be disjoint:
`nonEmpty` overlaps every nonempty equality and another `nonEmpty`; it is disjoint
from `equals: ""`. Presentation lists need not cover every value; no match hides
the field as in the existing consumer contract.

For deployment coverage, an always-required public dependency guarantees its
`nonEmpty` branch. Optional or conditional dependencies do not. A required select
has a finite domain of its nonempty option values; coverage may use the matching
predicate for every such option. For arbitrary required public strings, only the
nonempty branch guarantees coverage; a particular equality or an editable default
does not. Apply the effective presentation's required flag and activation before
counting a secret as required in every configuration. The consumer still checks
actual public values using `validateSetupValue` and refuses inactive/missing
required inputs at submission.

Extension IDs are edition-owned identifiers matching
`^[a-z][a-z0-9-]{0,63}$`. Consumers decide which extensions they implement; the Base
schema does not enumerate product capabilities.

`setup-negative-corpus.json` preserves all 28 original inline negative mutations,
the checked negative example and both strict-byte-parser negatives, plus review regression cases. Each
`operations` case clones `base`, then applies `set` or `delete` at its property-key
path; `file` cases load the referenced JSON, and `text`/`hex` cases exercise the
byte parser. Consumers should vendor this corpus and its referenced examples
alongside their pinned schema, semantic validator and original Base interpreter,
then compare that interpreter against any browser-compatible implementation.
Review additions carry `origin: "review"`. The review tests exercise the corpus
independently of the original assertions.

`setup-review-negative-corpus.json` carries the review suite's current manifest
rejections against its own small neutral `base`. Each case names its exact emitted
Base test in `source`, carries `origin: "review"`, and lists the `set` operations
that produce the invalid manifest. `validation` says whether the structural JSON
Schema check or the semantic check should reject it. Consumers can apply each
case to this base and compare their browser-compatible validator with the pinned
Base validator. The portability test checks that every current review rejection
has exactly one fixture case; the original corpus remains unchanged.

Optional dependencies use `dependencies: [{interface: "oidc-provider@1",
optional: true, cardinality: 1, address: "IDENTITY_PROVIDER", paths:
["/auth/oidc/auth/callback", "/auth/oidc/auth/logout"]}]`. The address names a
declared immutable URL answer. Provider seeds declare `provides` interface
strings. Lists, references and same-origin registration paths are validated by
the shared reader; selected provider documents supply the transitive graph
checked by `rer setup`, including optional edges. Invalid declarations/cycles
exit 2; missing required input or approval exits 3.

An owner-claim step may use `{type: "owner-claim", mode: "idp", emailField:
"OWNER_EMAIL", dependency: "oidc-provider@1", path: "/auth/owner-claim"}` when
that dependency is declared. Setup-token and signed modes remain supported.
See [the app-side link protocol](../modules/dependencies/README.md) for the
provider interoperability contract and private one-use CLI approvals.
