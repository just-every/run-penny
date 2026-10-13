# Optional editor source

Copy `src/` into the application and compile it with its own same-origin assets.
There is no remote executable loader, registry dependency, or second protocol.
The eight files in `src/widget/` match the recorded SHA-256 hashes in
`provenance.json`. The closure derives from service
`a14e142a90662d9f7b6cac259da2561ad15ea597`, whose bounded protocol repair passed
independent review of both ready/load orderings, challenge rotation and the real
widget/service pair. The module is verified locally with native
consumer browser checks. The current module retains that source
revision in provenance and records its discovery adaptation with hashes. It
negotiates protocol version 1 with the platform; unversioned shipped page bridges
are a platform compatibility concern, not a reason to weaken session checks.

`pnpm verify:editor` generates a separately committed native consumer from the
current Base commit, installs its frozen dependency graph, typechecks and builds
it, then runs the module and native browser suites. The consumer uses real local
workerd/D1 and persisted operator auth, with a labeled management fixture and no
model calls. Visual edits and stale-session rejection run at 1440 and 390 pixels;
compiled edits also cover sign-in and the native NotFound leaf. Base `verify`
includes this command. Temporary consumers and build outputs are removed after
success or failure; set `TMPDIR` to control their location.

The consumer's default-seed typecheck uses checkout-local, gitignored `.cache/typecheck.tsbuildinfo` inside that package; deleting it forces a full check, while `build` still builds the real Worker and assets.

## Native owner gate and configuration

A public page, `/setup`, data attribute or URL parameter is never owner authority.
Use the product's existing server session and owner role check, including direct
config requests. `examples/config-response.ts` supplies a no-store JSON response
adapter; its callbacks must use that existing authority and installation config.
Return only `{config:{enabled,managementOrigin,installationId},expiresAt}`. Never
include an admin token, management credential, cookie, or signing secret. Grants
last at most 60 seconds and the example lasts 30. Independently authenticated
management sessions and installation authorization are still required.

`createOwnerEditor()` creates one lifecycle for the native owner shell. Call
`setOwner(true)` only for a current server-authorized owner, then
`await refresh(configLoader('/api/editor/config', location.origin))`. Invalid
config is rejected before any iframe/management request. Errors reject visibly:
show them in the owner's existing error surface. Config refresh aborts its pending
request and invalidates old continuations. The existing mount remains bounded by
its current expiry during revalidation. An equivalent enabled config renews only
that expiry, preserving the open iframe, negotiated session and draft. Changed
config replaces the mount; disabled, invalid or rejected config removes it.
`setOwner(false)` synchronously removes the mount
on logout/role loss; owner replacement must call `setOwner` even if both users
are owners. `revoke()` removes it on config loss, and `dispose()` is repeat-safe.
All asynchronous loaders receive an AbortSignal; stale results are inert even
when cancellation is ignored. Grant expiry removes the mount automatically.

Integrate the native session/config revocation event with `setOwner(false)` or
`revoke()` immediately; renew through the server on focus/session refresh or a
product-owned subscription. A silent server change is observed no later than the
short lease, not instantaneously. The module does not claim a cross-tab or server
push authorization mechanism. Do not persist grants in browser storage.
On plain window focus, recheck the native session and refresh; call `setOwner`
only when its identity or authority changes. Revoking before an unchanged focus
check closes the editor unnecessarily.

`OwnerEditor` in `src/react.tsx` is a thin binding. Use stable `load` and `onError`
callbacks, and update `authorized` on native session changes. Its layout cleanup
prevents the old iframe surviving a commit. For immediate event-time revocation,
use the framework-neutral controller directly from your existing session store.

## Compiled edits, hydration and navigation

Install compiled JSON for every visitor before the owner gate:

```ts
import { installCompiledLiveEdits, setLiveEditsReady } from './editor';
import compiled from './editor/visual-edits.json';
if (typeof document !== 'undefined') {
  setLiveEditsReady(false); // before hydration can begin
  installCompiledLiveEdits(compiled);
}
```

Pause with `setLiveEditsReady(false)` on router navigation start. Resume only from
the actual hydrated destination leaf (including lazy routes), with
`useEditorLeafReady(routeKey)` or `setLiveEditsReady(true)` after its rendered
lifecycle. Wire every rendered destination, including public sign-in/error pages reached by native redirects. The reference has four regular leaves (`/`, `/reference`, `/app`, and `/signin`) plus its explicit `NotFound` component; omitting sign-in leaves the one runtime paused on navigation and direct hydration. A root/layout effect or router notification alone is insufficient.
Keep the same copied runtime instance: do not add a second applier. Editor cleanup
clears private pending overlays and preserves the page-owned compiled manager.
Unmounting an owner shell must never dispose published edits.

`src/visual-edits.json` is an initial empty file only for a new adopter. Preserve
all existing entries and revisions; never overwrite an existing JSON with this
empty file. Accepted edits carry `{revision,edits}`, with selectors grounded in
pre-edit text and tag/role. Source sync writes the adopter's configured visual
JSON path (the current service default is `src/editor/visual-edits.json`).

## Source and lock handling

A locked edition retains its real `sources.lock.json`; the service updates its
actual owned-file metadata mechanically. Descriptor projects may omit this file
and use the registered project descriptor's provenance. Absence alone means
lockless: unreadable, malformed or inconsistent *present* locks must fail. Never
invent a lock or discard a broken one. No lock migration or JSON overwrite is
part of copying this module. The service source-lock/descriptor lane and trusted
build profile are separate dependencies; this module does not implement them.

## CSP in both directions

The application's HTTP Content-Security-Policy must retain its other directives
and same-origin script policy, adding the **exact management origin** to
`frame-src`, for example `frame-src 'self' https://manage.example`. Do not use `*`
or allow arbitrary query origins. Merge into the existing header; do not replace
its `script-src`, nonces, object-src or other protection.

The management `/editor` HTTP response must supply `frame-ancestors` containing
only independently registered application origins for the authorized installation,
for example `frame-ancestors https://application.example`. A `parentOrigin` query
is not registration or authorization. This directive requires an HTTP header;
a meta element cannot provide it. Management must replace conflicting SAMEORIGIN
X-Frame-Options for this route and retain other response protections. The actual
service header implementation is required before adoption is complete. Tests here
verify the browser's allow/deny behavior with a labeled fixture provider; they do
not certify the real service's origin registry or authorization.

## Verification and remaining gates

`node --test modules/editor/tests/*.test.ts` runs new lifecycle/provenance tests
and is picked up by unchanged Base `pnpm verify:modules`. The browser check is
`node --test modules/editor/tests/browser.test.mjs modules/editor/tests/session-rotation.browser.test.mjs modules/editor/tests/refresh.browser.test.mjs`; set `RER_ESBUILD_MODULE` and
`RER_PLAYWRIGHT_MODULE` to installed module entries if necessary, and
`RER_BROWSER_CHANNEL=chrome` to use installed Chrome. `RER_EDITOR_EVIDENCE` selects
an external directory for 1440/390 JPGs and a commit/hash manifest. The rotation
case exercises the copied bridge across navigation and iframe reload, rejects
retired authority, and confirms teardown preserves the compiled page runtime.
The owner-replacement case invalidates a previous authorized owner's pending grant.
The public API refresh case preserves an open iframe, its negotiated session and
unsent state through an equivalent grant, then proves the renewed expiry still
removes it.

`tests/create-consumer.mjs <directory>` copies committed default-seed plus its
sibling foundation runtime into a fresh, separately committed consumer, and adds
this module with native-session configuration routing through that dispatcher.
It never edits the canonical seed. Its adapter demonstrates native authorization;
fixture management is confined to browser tests. Run the consumer's unchanged
verification and the browser suite against its build as documented by the script.

Before landing, merge current Base main and run `TZ=UTC pnpm verify`. Its native
consumer checks use the persisted operator-auth and mail source from the current
Base tree. They prove local module behavior, not a product's actual adoption.
Service header integration, an adopter's native owner shell and a stage receipt
for edit → source → trusted build → deployed reload remain separate work. The
canonical default-seed and its existing tests are not modified by this module.

The fresh consumer enables its editor only when server bindings
`EDITOR_MANAGEMENT_ORIGIN` and `EDITOR_INSTALLATION_ID` are present. Missing
bindings leave the optional shell disabled through its native server loader; direct config requests return an explicit configuration error. It places the editor only under the existing
`/app` native session gate and rechecks that same session on config requests.
The consumer demonstrates lease expiration and route teardown; production adopters
must additionally wire their own logout/role/config event stream as described above.

For the isolated adopter demonstration, after committing the module:

```sh
node modules/editor/tests/create-consumer.mjs /new/consumer-directory
# Install the consumer's declared dependencies, or use a verified identical local dependency tree.
pnpm --dir /new/consumer-directory/default-seed verify
RER_EDITOR_EVIDENCE=/external/evidence RER_BROWSER_CHANNEL=chrome \
  node modules/editor/tests/consumer-browser.mjs /new/consumer-directory/default-seed
```

The browser command expects the preceding verification/build output and uses only
local workerd, local D1, test-only credentials, and the explicitly labeled fixture
provider from `tests/provider.mjs`. It records native authentication denial,
configuration headers, authorized mount, navigation cleanup and server logout
followed by lease expiry. Capture manifests bind the clean local consumer commit.
The consumer retains the sibling `foundation/runtime/dispatch.ts`; it does not
replace native dispatch or fabricate an owner-only `/setup` route.


### Nonempty native compiled-edit coverage

`tests/create-compiled-consumer.mjs <new-directory>` extends the native consumer
with test-only compiled edits for all four regular leaves and the native `NotFound` component. The reference asset
redirects direct loads to `/reference/` while client links use `/reference`, so
the test snapshot covers both exact published paths; the runtime does not
reinterpret or widen compiled edit scope. It also demonstrates
an application HTTP `frame-src` header allowing only self and the validated
management origin, retaining `base-uri` and `object-src`. This reference starts
without a CSP; the adapter refuses to replace an existing policy. An adopter
with a policy must merge the management origin into its existing `frame-src`
and keep its script/nonces and other restrictions. Apply equivalent headers to
static assets/HTML served before the Worker where needed. The management fixture's
`frame-ancestors` does not establish the actual service's header behavior.

Build this separate consumer, then run:

```sh
RER_NATIVE_CONSUMER_ROOT=/new-directory/default-seed \
RER_EDITOR_EVIDENCE=/external/native-evidence RER_BROWSER_CHANNEL=chrome \
  node --test --test-concurrency=1 modules/editor/tests/compiled-native.browser.test.mjs \
    modules/editor/tests/notfound-native.browser.test.mjs
```

The eleven new cases exercise all four regular routes through native client navigation,
direct hydration and reload, plus actual application response CSP, native CSRF
and session denial, private overlay cleanup and logout. The native 404 checks preserve
the HTTP 404 and cover its own rendered leaf on direct load, reload and router
history navigation. The tests read nonempty
compiled JSON from the consumer build and never installs a replacement runtime
from the browser. It must fail for sign-in when that leaf's readiness integration
is omitted. Run unchanged Base verification and the original native/browser
checks separately with their original empty compiled file: their preserved
heading assertions concern the unedited reference and remain unchanged.
