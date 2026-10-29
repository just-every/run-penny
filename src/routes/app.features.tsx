import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {HierarchyPage} from '@/core/features/hierarchy/page'
import { pageHead } from '@/core/app/page-head'
export const Route=createFileRoute('/app/features')({ head: () => pageHead('Features'),loader:({location})=>loadOperatorResources({data:location.href}),component:HierarchyPage})
