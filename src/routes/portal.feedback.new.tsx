import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { SubmitFeedbackPage } from '@/core/features/portal/ui/submit-feedback'
import { pageHead } from '@/core/app/page-head'

export const Route = createFileRoute('/portal/feedback/new')({ head: () => pageHead('Share feedback'),
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <SubmitFeedbackPage content={publicLandingConfig} /> },
})
