import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {PrioritisationPage} from '@/core/features/prioritisation/page'
import { pageHead } from '@/core/app/page-head'
export const Route=createFileRoute('/app/prioritisation')({ head: () => pageHead('Prioritisation'),loader:({location})=>loadOperatorResources({data:location.href}),component:PrioritisationPage})
