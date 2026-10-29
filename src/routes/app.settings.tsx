import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { BoardSettings } from '@/core/features/requests/ui/board-settings'
import { pageHead } from '@/core/app/page-head'
export const Route=createFileRoute('/app/settings')({ head: () => pageHead('Feedback settings'),loader:({location})=>loadOperatorResources({data:location.href}),component:BoardSettings})
