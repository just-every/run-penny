import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PublicRoadmapDetail } from '@/core/features/roadmap/ui/public-roadmap-detail'
import { recordHead } from '@/core/app/page-head'
export const Route=createFileRoute('/portal/roadmap/$roadmapSlug')({ head: ({ loaderData, params }) => recordHead(loaderData, `/api/public/roadmap/${params.roadmapSlug}`, 'Roadmap'),loaderDeps:({search})=>search,loader:({location})=>loadPublicResources({data:location.href}),component:function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <PublicRoadmapDetail content={publicLandingConfig}/> }})
