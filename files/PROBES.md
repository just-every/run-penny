# Runtime probes at 676857454ae3d817900f89ca1a104c7c2a7a1390

PROBE DATA-006 point 1: GET `/docs/openapi.json` through the built Worker -> 200 JSON; official OpenAPI 3.1 structural validation passed without a schema download. All 14 served operations had matching native HTTP cases and successful response schemas.

PROBE DATA-006 point 1 authentication: each documented operation using only its declared scope -> 200 or 201; missing, invalid, insufficient-scope and revoked credentials -> 401 with the documented error shape and all selected business custody rows unchanged.

PROBE DATA-006 point 1 admission: foreign Origin or cross-site mutation -> 403; wrong content type, malformed JSON, oversized body, invalid fields or invalid slugs -> 400; unsupported method -> 404; business snapshots unchanged.

PROBE DATA-006 point 1 response variants: held request detail, comments and status history -> 404 and no list entry; draft release detail -> 404 and no list entry. Native publication then produced the documented public release.

PROBE DATA-006 point 1 replay: repeat proxy vote for its existing customer -> created false; repeated status -> published true; repeated release publication -> identical release and version identifiers. Every selected business, consent and delivery snapshot remained equal.

PROBE DATA-006 point 1 privacy: hide vote totals and enable voter list through native board settings -> totals omitted from nonempty cards and detail, original author retained as the only public voter and proxy customer excluded. Disable voter list -> voters field absent while a positive total returned.

PROBE DATA-006 point 1 lifecycle results: native merge -> 200 JSON canonical lookup and 404 comment and history subresources; native unmerge then requester withdrawal -> 200 JSON withdrawn lookup, 404 subresources and no list entry. Unknown slug -> 404. Empty filters matched the ordinary list; unknown filter -> 400 with unchanged custody.

PROBE DATA-006 point 2: none, lifecycle-webhook signature and replay completion is explicitly omitted by the selected POINTS and remains a named Gap.

All probes are assertions in the existing built-Worker sanity journey, `tests/base/integration-openapi.test.ts`, run in NATIVE-TESTS.log. Native fixture publication was isolated. No provider or hosted publication was performed.
