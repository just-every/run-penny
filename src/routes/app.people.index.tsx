import {validateListSearch} from '@/core/features/workspace/list-query'
import {ListQueryRefusal} from '@/core/app/ui/list-query-refusal'
import {createFileRoute} from '@tanstack/react-router'
import {loadOperatorResources} from '@/core/app/loaders'
import {PeoplePage} from '@/core/features/people/page'
export const Route=createFileRoute('/app/people/')({validateSearch:validateListSearch,errorComponent:ListQueryRefusal,loaderDeps:({search})=>search,loader:({location})=>loadOperatorResources({data:location.href}),component:PeoplePage})
