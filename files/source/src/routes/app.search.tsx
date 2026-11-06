import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { validateListSearch } from '@/core/features/workspace/list-query'
import { ListQueryRefusal } from '@/core/app/ui/list-query-refusal'
import { SearchPage } from '@/core/features/workspace/ui/search-page'
export const Route=createFileRoute('/app/search')({validateSearch:validateListSearch,errorComponent:ListQueryRefusal,loaderDeps:({search})=>search,loader:({location})=>loadOperatorResources({data:location.href}),component:SearchPage})
