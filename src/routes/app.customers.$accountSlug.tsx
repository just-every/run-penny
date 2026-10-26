import {PersonPage} from '@/core/features/people/page'
import {personIdFromPath} from '@/core/features/people/paths'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { AccountDetailRoute } from '@/core/features/accounts'

export const Route = createFileRoute('/app/customers/$accountSlug')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: CustomerDetail,
})

function CustomerDetail(){
 const {accountSlug}=Route.useParams(),personId=personIdFromPath('/app/customers/'+accountSlug)
 return personId?<PersonPage id={personId}/>:<AccountDetailRoute/>
}
