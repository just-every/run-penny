import { createFileRoute } from '@tanstack/react-router'
import { DocsHomeRoute } from '@/core/features/docs/DocsRoutes'
import { docsHead } from '@/core/features/docs/head'
import { loadDocsPage } from '@/core/features/docs/load'

/**
 * DOCS-001. The docs home: docs/OVERVIEW.md, rendered at build time (docs/site.json lists every page). The page content is a
 * build artifact, not a workspace read.
 */
export const Route = createFileRoute('/docs/')({
  loader: () => loadDocsPage(''),
  head: ({ loaderData }) => docsHead(loaderData?.page),
  component: DocsHomeRoute,
})
