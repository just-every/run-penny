import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { DataPage } from '@/core/features/data/ui/data-page'
export const Route=createFileRoute('/app/data')({loader:({location})=>loadOperatorResources({data:location.href}),component:DataPage})
