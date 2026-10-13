# Historical Penny UI port visual evidence

These screenshots record the D1-backed UI port at runtime revision `dce6956`.
They were captured from a disposable clean clone after `pnpm install
--frozen-lockfile` and an unattended first `pnpm dev` boot created the local D1
schema and imported `sample-data/penny.v1.json`.

The public captures use only the sessionless public API. Operator captures use
a temporary one-hour D1 session whose token was hashed through the production
session helper before insertion; there is no development authentication bypass.
The temporary session and withdrawn-record proof existed only in the disposable
clone.

| File | Route | Viewport and state |
| --- | --- | --- |
| `01-landing.jpg` | `/` | 1536 × 960, published feedback and boards |
| `02-public-roadmap.jpg` | `/portal/roadmap` | 1536 × 960, approved public projection |
| `03-public-updates-empty.jpg` | `/portal/updates` | 1536 × 960, honest empty feed |
| `04-operator-overview.jpg` | `/app/overview` | 1536 × 960, authenticated D1 session |
| `05-operator-decision.jpg` | `/app/decisions/decision-scim-q4` | 1536 × 960, authenticated comparable brief |
| `06-operator-mobile-menu.jpg` | `/app/overview` | 390 × 844, authenticated menu open |

The same browser run exercised every mounted public and operator route at
desktop width, then representative public and operator pages at 390, 768, 1280,
and 1536 pixels. There was no horizontal overflow, console warning, console
error, or cross-origin browser resource. All three bundled Open Sans faces were
loaded from the Worker origin.

These 22 historical product captures were visually inspected on 9 October 2026. They are not current-head browser acceptance or image-container inspection. Current runtime evidence is recorded separately for its exact source head.
## Product landing and documentation

Captured 2026-10-10 from the local dev server (`http://127.0.0.1:4721`) at
revision `bdb8771` plus the star change (the polished drawings and the coin mark), captured after the
coin swap to "the penny is the thought", the landing drawings' coins' move to the full smooth drawing, and the copper stamp's move from the eight-arm asterisk to the freehand five-point star (files 01 to 04 recaptured then; 05 and 06 keep their earlier capture), with headless Chromium, reduced motion, and 2500 ms after the
network settled and fonts loaded. JPEG quality 82. Every capture returned HTTP 200 with no page or console
error.

| File | Route | Viewport |
| --- | --- | --- |
| `landing-docs/01-landing-1536.jpg` | `/` | 1536 × 960, viewport |
| `landing-docs/02-landing-390.jpg` | `/` | 390 × 844, viewport |
| `landing-docs/03-landing-full-1440.jpg` | `/` | 1440 × 900, full page (1440 × 4901) |
| `landing-docs/04-docs-install-1536.jpg` | `/docs/install` | 1536 × 960, viewport |
| `landing-docs/05-docs-install-390.jpg` | `/docs/install` | 390 × 844, viewport |
| `landing-docs/06-board-1536.jpg` | `/portal/feedback` | 1536 × 960, viewport |
