import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicFeedbackHomePage } from '@/core/features/requests/ui/public-feedback-pages'

/** REQ-001 (HOME-001 was superseded by HOME-002 on 9 October 2026). The public feedback board's canonical address. */
export const Route = createFileRoute('/portal/feedback/')({
  validateSearch: (search): { q?: string; status?: string; board?: string; category?:string;sort?: 'recent' | 'votes' | 'newest' | 'trending' } => ({
    ...(typeof search.q === 'string' && search.q.trim() ? { q: search.q.trim() } : {}),
    ...(typeof search.status === 'string' && search.status ? { status: search.status } : {}),
    ...(typeof search.board === 'string' && search.board.trim() ? { board: search.board.trim() } : {}),
    ...(typeof search.category==='string'&&search.category?{category:search.category}:{}),
    ...(search.sort === 'recent' || search.sort === 'votes' || search.sort === 'newest' || search.sort === 'trending' ? { sort: search.sort } : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicFeedbackHomePage content={publicLandingConfig} /> },
})
