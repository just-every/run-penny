import {useEditorLeafReady} from '@/core/features/editor/client'
import {useLocation} from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { RequesterActivityPage } from '@/core/features/requests/ui/requester-activity-page'
export const Route = createFileRoute('/portal/feedback/activity')({component:function PublicLeaf() { useEditorLeafReady(useLocation({select:location=>location.pathname})); return <RequesterActivityPage content={publicLandingConfig}/> }})
