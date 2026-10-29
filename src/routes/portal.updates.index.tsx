import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicUpdatesPage } from '@/core/features/releases/ui/public-release-pages'
import { pageHead } from '@/core/app/page-head'

export const Route = createFileRoute('/portal/updates/')({ head: () => pageHead('Updates'),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicUpdatesPage content={publicLandingConfig} /> },
})
