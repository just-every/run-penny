import manifest from '../../../seed.json'

const publicPaths = manifest.deploy.publicPaths as readonly string[]

// A trailing slash means the rule is a prefix covering everything under it
// (the schema's own convention). The root path "/" is the one path that
// ends in "/" without being a meaningful prefix — every pathname starts
// with "/", so treating it as a prefix would match the whole app. It is
// matched exactly instead, same as every other non-prefix entry.
export function isDeclaredSessionlessPath(pathname: string): boolean {
  return publicPaths.some((rule) => rule.endsWith('/') && rule !== '/'
    ? pathname.startsWith(rule)
    : pathname === rule)
}

/** Sessionless documents: the root, sign-in, the public portal (its board at /portal/feedback) and the docs (DOCS-001). */
export function isPublicDocumentPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/signin' || pathname === '/portal' || pathname.startsWith('/portal/')
    || pathname === '/docs' || pathname.startsWith('/docs/')
}

/** Built assets, the self-hosted fonts, and the theme and mark Base's confirmation and /setup frames wear (public/). */
export function isPublicAssetPath(pathname: string): boolean {
  return pathname.startsWith('/assets/') || pathname.startsWith('/fonts/') || pathname.startsWith('/brand/') || pathname === '/rer-theme.css'
}

/** Vite serves the active module graph from these paths only in local mode. */
export function isLocalViteModulePath(pathname: string): boolean {
  const pnpmViteClientModule = /^\/node_modules\/\.pnpm\/vite@[^/]+\/node_modules\/vite\/dist\/client\/(?:client|env)\.mjs$/.test(pathname)

  const startClientEntry = /^\/node_modules\/\.pnpm\/@tanstack\+react-start@[^/]+\/node_modules\/@tanstack\/react-start\/dist\/(?:plugin\/default-entry\/(?:client\.tsx|start\.ts)|esm\/(?:client|client-rpc|index|useServerFn)\.js)$/.test(pathname)

  const startClientModule = /^\/node_modules\/\.pnpm\/@tanstack\+(react-start-client|react-router|router-core|start-client-core|history|router-utils|start-fn-stubs)@[^/]+\/node_modules\/@tanstack\/\1\/dist\/esm\/[a-zA-Z0-9_./-]+\.js$/.test(pathname)

  const browserSerializationModule = /^\/node_modules\/\.pnpm\/(seroval|seroval-plugins|cookie-es)@[^/]+\/node_modules\/\1\/dist\/(?:dev\/[a-zA-Z0-9_-]+\.js|index\.mjs)$/.test(pathname)

  const editorBrowserModule = /^\/base\/modules\/editor\/src\/(?:(?:index|react|lifecycle|config)\.tsx?|widget\/[a-z-]+\.ts)$/.test(pathname)

  // DOCS-001: the docs plugin's virtual modules, which a docs page imports again on client-side navigation.
  const docsModule = /^\/@id\/__x00__virtual:penny-docs(?:\/page\/[a-z0-9-]+)?$/.test(pathname)

  // The Data page derives the erasure journal from a hosted export in the browser.
  const archiveJournalModule = pathname === '/scripts/portability/archive-journal.mjs'

  return (editorBrowserModule || browserSerializationModule || startClientModule || startClientEntry || docsModule || archiveJournalModule || pathname === '/@id/virtual:tanstack-start-dev-client-entry'
    || pathname === '/@tanstack-start/styles.css'
    || pathname === '/@vite/client'
    || pathname.startsWith('/@vite/')
    || pathname === '/@react-refresh'
    || pathname.startsWith('/node_modules/.vite/')
    || pnpmViteClientModule
    || (pathname.startsWith('/src/') && !pathname.includes('.server.')))
}
