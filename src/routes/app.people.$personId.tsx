import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {PersonPage} from '@/core/features/people/page'
export const Route=createFileRoute('/app/people/$personId')({loader:({location})=>loadOperatorResources({data:location.href}),component:PersonPage})
