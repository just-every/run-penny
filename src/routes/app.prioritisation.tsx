import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {PrioritisationPage} from '@/core/features/prioritisation/page'
export const Route=createFileRoute('/app/prioritisation')({loader:({location})=>loadOperatorResources({data:location.href}),component:PrioritisationPage})
