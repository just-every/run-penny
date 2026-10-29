import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicRoadmapPage } from '@/core/features/roadmap/ui/public-roadmap-page'
import { pageHead } from '@/core/app/page-head'

export const Route = createFileRoute('/portal/roadmap/')({ head: () => pageHead('Roadmap'),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicRoadmapPage content={publicLandingConfig} /> },
})
