import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicFeedbackHomePage } from '@/core/features/requests/ui/public-feedback-pages'

/** The installed public board, with the same filters and public resource loader as its compatibility route. */
export const Route = createFileRoute('/')({
  validateSearch: (search): { q?: string; status?: string; board?: string; sort?: 'recent' | 'votes' } => ({
    ...(typeof search.q === 'string' && search.q.trim() ? { q: search.q.trim() } : {}),
    ...(typeof search.status === 'string' && search.status ? { status: search.status } : {}),
    ...(typeof search.board === 'string' && search.board.trim() ? { board: search.board.trim() } : {}),
    ...(search.sort === 'recent' || search.sort === 'votes' ? { sort: search.sort } : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicFeedbackHomePage content={publicLandingConfig} /> },
})
