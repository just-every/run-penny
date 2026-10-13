import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicFeedbackDetailRoute } from '@/core/features/portal/ui/public-detail-routes'

export const Route = createFileRoute('/portal/feedback/$requestSlug')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicFeedbackDetailRoute content={publicLandingConfig} /> },
})
