import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { ModerationPage } from '@/core/features/requests/ui/moderation-page'
export const Route=createFileRoute('/app/moderation')({loader:({location})=>loadOperatorResources({data:location.href}),component:ModerationPage})
