import { beforeEach } from 'vitest'
import { env,repairDatabase } from './requester-repair-fixture'
import './requester-final-identity.cases'
import './requester-final-custody.cases'
import './requester-final-pending.cases'
repairDatabase()
beforeEach(async()=>{
 let cursor:string|undefined
 do {const page=await env.FILES.list({cursor});if(page.objects.length)await env.FILES.delete(page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined}while(cursor)
})
