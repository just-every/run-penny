import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { DataPage } from '@/core/features/data/ui/data-page'
import { pageHead } from '@/core/app/page-head'
export const Route=createFileRoute('/app/data')({ head: () => pageHead('Data'),loader:({location})=>loadOperatorResources({data:location.href}),component:DataPage})
