import { validateListSearch } from '@/core/features/workspace/list-query'
import { ListQueryRefusal } from '@/core/app/ui/list-query-refusal'
import { createFileRoute } from '@tanstack/react-router'
import { loadOperatorResources } from '@/core/app/loaders'
import { ModerationPage } from '@/core/features/requests/ui/moderation-page'
export const Route=createFileRoute('/app/moderation')({validateSearch:validateListSearch,errorComponent:ListQueryRefusal,loaderDeps:({search})=>search,loader:({location})=>loadOperatorResources({data:location.href}),component:ModerationPage})
