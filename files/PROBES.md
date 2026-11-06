# DOCS-001 point 8 public-door probes

PROBE DOCS-001 8 positive control: GET /docs/install in the mounted emitted Worker at 390 -> HTTP 200; one nonempty .docs-prose body; real paragraph HTML appears in SSR and mounted document.
PROBE DOCS-001 8 unknown single slug: GET /docs/no-such-page after the nonempty published page at 390 -> HTTP 404; docs prose, heading container and article absent in SSR and after explicit React hydration; published control prose absent from SSR, hydrated HTML and reread visible body text.
PROBE DOCS-001 8 nested slug: GET /docs/install/no-such-page at 390 -> HTTP 404; the same docs and positive-control exclusion assertions pass in SSR and the hydrated document.

Desktop captures use the same three routes at 1440; assertions run once at 390 as required. These probe outcomes are read from the bounded journey progress; the final full script result and committed-head binding are recorded in the browser receipt and REPORT.md.
