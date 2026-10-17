# Two homepages: adopting the Lobby and the run site

Every seed has two versions of its homepage (owner, 12 October 2026):

1. **The run site**, `run-<seed>.com`: the seed's owner-approved marketing
   homepage, whose primary action reads **Run <Seed>** and opens `/run`, a page
   with the two commands that run the seed for free on your own computer. It is
   static, built by `rer build --site`.
2. **The installed instance**, the app someone runs or deploys: its `/` is the
   **Lobby**, a minimal page whose one action is **Sign in**, or **Finish
   setup** until the owner has claimed the installation.

Base builds the mechanism once (`foundation/runtime/identity.ts`, `lobby.ts`,
`setup-state.ts`, `run-site.ts`; `rer build --site`, `RER_SITE`,
`rer deploy --site`). `default-seed` and the foundation template adopt both; read
them as the worked example. The contract is in `SEED-COMMAND-CONTRACT.md`
(Installed homepage and run site). Vendored seeds can read the deploy target in
`scripts/base-cli/modules/deploy-kit/README.md`; package mode exposes the deploy
integration as `@runeditrun/rer/deploy`.

## Rules for every seed

- **The approved homepage is final.** Change only its primary call to action:
  it reads `Run <Seed>` and links to `/run`. Do not redraw, reword or restyle
  anything else, and keep the "100% free" hero line. The run site omits links
  to instance-only routes (`/signin`, `/login`, `/sign-in`, `/setup`, `/app`,
  `/auth/*`), so render the approved page's header Sign in pill only on the
  installed instance (a prop, as Vector's and Oncall's headers already have).
- **The Lobby is shared.** Do not write your own Lobby. Mount
  `setupStateResponse(request, env, claimed)` and
  `lobbyResponse(request, env, identity, claimed)` from `src/base/` before the
  document renderer and before any guard that 404s unknown public paths, after
  `staticAssetResponse`. `env` is `{ DB, AUTH_ORIGIN }` (your D1 binding and
  canonical origin), and `claimed` reads your durable owner claim (see
  [Claimed: the owner claim](#claimed-the-owner-claim)). Its look
  comes from the files your identity names: the `public/rer-theme.css`
  `--rer-*` tokens, the `fonts` stylesheet, the mark and a new
  `public/brand/band.svg`. A seed without `public/rer-theme.css` adds one
  declaring its `--rer-*` tokens (fonts, page, surface, text, muted, accent).
  Every one of them must be served at `/` on the installed instance and copied to
  the run site: a Worker that answers only listed public paths (Uptime's
  `publicPaths`) lists them too.
- **Add `public/brand/band.svg`**: the seed's floor art, a wide SVG
  (`viewBox="0 0 1440 300"`, `preserveAspectRatio="xMidYMax slice"`) in the seed's
  palette, the way the Lobby authority images show it. The run site's homepage
  and Run page may use it too.
- **Check at 1440x900 and 390x844**: the Lobby in both states and the run site's
  `/` and `/run`, beside the approved 12ui authority images for the Lobby and the
  Run page, with no horizontal scroll and the primary action above the fold.
- **Refresh shared behavior.** Vendored mode uses `node scripts/export-cli.mjs
  <seed>` from a Base checkout to refresh `scripts/base-cli/` and
  `scripts/base-onboarding/`. In package mode, pin a release with
  `pnpm add -D -E @runeditrun/rer@VERSION`. In either mode, copy
  `foundation/runtime/` to `src/base/` from the Base commit you adopt; the
  exporter copies it unchanged.

## Edition identity

Add one `EditionIdentity` value next to the seed's config (most seeds:
`src/ext/config.ts`, or a new `src/identity.ts` reading it):

| Field | From | Example (Cradle) |
| --- | --- | --- |
| `product` | the seed's name | `Cradle` |
| `deployment` | this installation's own name, from the owner's config (Slate `ownerIdentity.name`, Cradle `workspaceName`, Vector `ownerName`, Orbit `publicProductConfig.name`) | `Northwind` |
| `purpose` | one line about this installation, `{deployment}` for its name | `{deployment}’s records, views and business applications, in one private workspace.` |
| `tagline` | the seed's one line (the run site's meta description) | from the approved hero |
| `signInPath` | the seed's sign-in route | `/signin` (HappyToHelp `/login`, Uptime `/login`, Spool `/sign-in`) |
| `runSite` | `https://` + the domain in `deploy-site.json` | `https://run-cradle.com` |
| `installedHome` | `lobby`, or `page` for the seeds below | `lobby` |
| `manualSetupTokenClaim` | `true` only when a person must claim the owner with the setup token | `false` or omitted when RER claims the owner automatically |
| `theme`, `mark`, `band` | served paths | `/rer-theme.css`, `/brand/mark.svg`, `/brand/band.svg` |
| `fonts` | the served stylesheet with your `@font-face` rules; omit it when `theme` declares them | `/fonts/fonts.css` |

The Lobby says the owner is set up and offers Sign in; before the claim it
reads "This <Seed> is waiting for its owner." It shows "You’ll need the setup
token from your install." only when `manualSetupTokenClaim` is true. Leave it
false or omit it when RER claims the owner automatically; the token is handled
by RER and the visitor does not need it. A signed-in owner sees the same Lobby
(it never varies by session) and uses Sign in or goes to the app.

A deployment name read from D1 at request time (Cradle's workspace name) is
installation data: the Lobby may read it on the server, the run site never does.

## Claimed: the owner claim

The installation is claimed as soon as its first owner exists and the setup
token can no longer create another owner. Base records that in `oa_bootstrap`,
and both shared responses read it by default. The owner may still need to sign
in and complete a first-run form at `/setup`; that does not keep the Lobby in
its unclaimed state.

A seed with native authentication passes a read of its own durable owner
record, the same one to both responses. For example, an installation using the
completed owner-claim ledger can use:

```ts
import { lobbyResponse } from './base/lobby'
import { claimedWhen, setupStateResponse } from './base/setup-state'
const claimed = claimedWhen('SELECT 1 FROM oc_owner_claims WHERE singleton = 1 AND completed = 1')
// in fetch, before the public-path guard:
const env2 = { DB: env.DB, AUTH_ORIGIN: env.AUTH_ORIGIN }
const state = await setupStateResponse(request, env2, claimed); if (state) return state
const lobby = await lobbyResponse(request, env2, identity, claimed); if (lobby) return lobby
```

`claimedWhen(sql)` is claimed when the query returns a row; for anything else
pass your own `(db) => Promise<boolean>`. Existing native adopters must update
callbacks that read first-run completion (such as `first_run_completed_at` or
`onboarding_completed_at`) to read their owner claim instead. Copying the shared
renderer alone cannot change a seed's supplied query.

Prove it on a fresh store: `/setup/state` answers `unclaimed` before the owner
claim, then `claimed` immediately after `rer setup` or `rer deploy` claims the
owner, before any first-run form is confirmed. A 503
`setup_unavailable` means the read failed: the table or column it names does not
exist in your schema.

## Run data and the site entry

Declare the run site in the command adapter:

```js
site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
```

`rer build --site` builds the entry for Node with your own Vite, so it imports
your components as the app does, CSS side-effect imports included. `config` is a
small Vite config with only the plugins your site pages need: the docs plugin
that serves your docs virtual module (Slate, Penny, Dial and Uptime use
`docsSite()`), React, and your CSS toolchain (Tailwind) if the pages use one.
Never name the app's `vite.config.ts`: its Cloudflare and TanStack Start plugins
run the Worker, not Node. Leave `config` out when the pages need no plugin.

```ts
// vite.site.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { docsSite } from './src/site/docs/build/plugin.ts'
export default defineConfig({ plugins: [docsSite(), react()] })
```

and add `deploy-site.json` (`{"version": 1, "domain": "run-<seed>.com"}`); list
it in `vite.config.ts` `server.fs.allow` when the Worker imports it. Keep every
Run page string and command in one `RunData` value (`src/site/run.ts` or
`run.json`):

| Field | Cradle | Uptime |
| --- | --- | --- |
| `name` | `Cradle` | `Uptime` |
| `repository` | `https://github.com/just-every/cradle` | `https://github.com/just-every/uptime-monitor` |
| `clone` | `npx -y @runeditrun/rer dev just-every/cradle` | `npx -y @runeditrun/rer dev just-every/uptime-monitor --dir uptime` |
| `folder` | `cradle` | `uptime` |
| `requirements` | `Runs on macOS, Linux or Windows with WSL2, with git. The installer brings Node when it is missing, and rer brings pnpm.` | same |
| `licence` | `MIT` | `MIT` |
| `docs` | `true` once `/docs` is built | `true` |
| `hosted` | `[]` | `[]` |

The Run page then reads, exactly: "Run <Seed> on your computer."; "100% free and
open source. Two lines, and <Seed> opens in your browser."; step 1 **Install rer**,
`curl -fsSL https://runeditrun.com/install.sh | sh`, "It installs rer for you
alone, with its own Node if you have no Node 22 or later. It changes no shell
settings: if its last line puts rer on your PATH, run that line before step 2.";
step 2 **Start <Seed>**, the `clone` line without `npx -y @runeditrun/` (`rer dev
just-every/cradle`), "rer gets <Seed>, installs everything, makes you the owner
and prints a link that opens <Seed> signed in. To start it again later: `cd
<folder> && rer dev`", and "Already have Node 22 or later? <clone> does both steps
in one line."; then the requirements line and "Source: <repository> · MIT
license". Step 2 runs on what the installer put on PATH alone, without npx. A
README's "Run locally" shows the same two lines, so the Run page and the README
agree. `hosted` is the slot for hosted options, shown as cards under step 2
when RER hosting opens; leave it empty until then.

`src/site/pages.tsx` exports `sitePages({ styles })`. Every CSS file your
components import (Landing's `import './styles'`, the docs styles) compiles into
one stylesheet; `styles` holds its site path, and each page links it in its head.
Return the approved homepage at `/`, rendered to a complete document with
`renderToStaticMarkup` from `react-dom/server`; `runPageHtml(identity, run)` at
`/run`; each docs page at `/docs` and `/docs/<slug>`, rendered from the same
components and docs module the app's docs routes use; `siteNotFoundHtml(identity,
run)` (or your own page) at `/404`; and the public files they use (`rer-theme.css`,
`fonts`, `brand`, your images and font folders). The site variant drops every
instance-only link (the header's and the footer's Sign in) and points the primary
action at `/run`; a component that uses TanStack `Link` renders a plain anchor
there. Uptime's entry, in full:

```tsx
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { run } from './run'
import { Landing } from './landing/Landing'
import { DocsIndex } from './docs/DocsIndex'
import { DocsArticle } from './docs/DocsArticle'
import { docsHead, docsPages } from './docs/pages'

export function sitePages({ styles }: SiteContext): SiteBuild {
  const document = (title: string, description: string | undefined, body: ReactElement) => '<!doctype html>' + renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}</head><body>{body}</body></html>)
  const head = (slug?: string) => { const rows = (docsHead(slug) as { meta?: Record<string, string>[] }).meta ?? []; return [rows.find(row => row.title)?.title ?? 'Docs · Uptime', rows.find(row => row.name === 'description')?.content] as const }
  return {
    pages: [
      { path: '/', html: document('Uptime — Sleep through the night', identity.tagline, <Landing variant="site" />) },
      { path: '/run', html: runPageHtml(identity, run) },
      { path: '/docs', html: document(...head(), <DocsIndex variant="site" />) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: document(...head(page.slug), <DocsArticle slug={page.slug} variant="site" />) })),
      { path: '/404', html: siteNotFoundHtml(identity, run) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'design-assets', 'favicon.svg'],
  }
}
```

The pages must work without JavaScript and load nothing from another origin.
`rer build --site` refuses a site that breaks any of that and names the problem
(an instance-only link, a missing file, another origin).

## Marketing seeds: approved page on the run site, Lobby installed

Slate, Cradle, Mango, Dial and Uptime on `main`; Vector, Nook, Orbit, Oncall and
Spool on their `brand/2026-10-11` or `style/2026-10-11` branches (and the
`owner-ui` merges of them).

1. Change the approved homepage's primary action to **Run <Seed>** linking to
   `/run` (the label "Run <Seed>" exists nowhere yet: Slate, Penny and Dial say
   "Deploy your own"; Vector, Pencil, Lamp, HappyToHelp, Orbit, Nook and Oncall
   "Get the code"; Uptime "Run your own"; Mango "Start your newsletter"; Cradle
   "Open your workspace"; Spool "Get Spool"). Everything else stays.
2. Serve the Lobby at the installed `/`: the homepage route moves to the site
   entry. Oncall (brand) and Spool (style) already send a signed-in operator to
   the app at `/`; that is accepted behaviour, so keep it and serve the Lobby to
   everyone else. The Lobby itself never varies by session.
3. Add `band.svg`, the identity value, the Run data, `deploy-site.json` and the
   adapter `site` option.
4. Docs on the run site: Slate, Cradle, Vector (brand), Penny, Mango, Dial, Orbit
   (brand), Nook, Uptime and Oncall (brand) render their `docs/site.json`
   pages; Cradle's docs are declared in `docs/site.json`. Spool renders its
   `docsResponse` markup. **Lamp needs docs source first**: it links its GitHub
   README. Until then set `docs: false` for Lamp.
5. `rer dev` prints `RER_SITE`; `rer build --site`; `rer deploy --site --dry-run`.

## Public-page seeds: the product page stays at the installed `/`

| Seed | Installed `/` | Add |
| --- | --- | --- |
| Lamp | the live status page on the page host (the app host's `/` is the marketing landing today) | `installedHome: 'page'`; Sign in (`/signin`) in the app host's header; the app host's `/` becomes the Lobby |
| Pencil | the owner's selected public form (`publicFlowSlug`), else the marketing page | `installedHome: 'page'`; keep the form branch; Sign in (`/signin`) in its header; with no public form the Lobby |
| Penny | the public board (`/portal`, moved to `/`) | `installedHome: 'page'`; Sign in (`/signin`) in the portal header |
| HappyToHelp | the Help Center (`/help`, moved to `/`) | `installedHome: 'page'`; Sign in (`/login`) in the Help Center header. Never touch `app.happytohelp.com`, the legacy production service |

For Lamp's app-host root and Pencil's root when no public form is selected,
pass `{ ...identity, installedHome: 'lobby' }` to `lobbyResponse` on that branch.
Their product-page identity keeps `installedHome: 'page'`: the public
`lobbyResponse` returns `null` for that identity, even at `/`, so passing it
unchanged cannot render the Lobby. Keep the page-host or selected-form branch
first, then call the shared Lobby with the branch-specific identity.

They still mount `setupStateResponse`, add `band.svg`, and publish the
marketing run site exactly as the marketing seeds do. Dial's booking pages and
Mango's `/subscribe` stay on their own paths; those seeds use the Lobby.

## Done when

- The installed `/` shows the Lobby (or the product page with Sign in) and
  `GET /setup/state` answers `unclaimed`, then `claimed` immediately after the
  owner claim, before first-run confirmation at `/setup`.
- `rer dev` prints `RER_SITE`, whose `/`, `/run` and docs answer; the approved
  page there differs from the owner-approved one only in its primary action.
- `rer build --site` and `rer deploy --site --dry-run` pass.
- Screenshots at 1440 and 390 sit beside the 12ui authority images.
