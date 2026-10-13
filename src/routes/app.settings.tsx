import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { BoardSettings } from '@/core/features/requests/ui/board-settings'
export const Route=createFileRoute('/app/settings')({loader:({location})=>loadOperatorResources({data:location.href}),component:BoardSettings})
