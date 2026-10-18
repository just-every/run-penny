import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {HierarchyPage} from '@/core/features/hierarchy/page'
export const Route=createFileRoute('/app/features')({loader:({location})=>loadOperatorResources({data:location.href}),component:HierarchyPage})
