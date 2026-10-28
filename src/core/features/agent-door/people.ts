import type { PennyRuntime } from '@/core/app/runtime'
import { operatorAuth } from '../auth/operator'
import { operatorAuthPeople } from '../../../../base/modules/agent-door/operator-people.ts'
import type { PeopleAdapter, Person } from '../../../../base/modules/agent-door/types.ts'

/** OA is the native authority; product operators are immutable attribution IDs. */
export function nativePeople(runtime: PennyRuntime): PeopleAdapter {
 const db=runtime.database.binding
 const native=operatorAuthPeople({db,session:request=>operatorAuth(runtime).getSession(request)})
 const admitted=async(id:string):Promise<Person|null>=>{
  const person=await native.person(id)
  if(!person?.active||!await db.prepare('SELECT 1 FROM penny_operator_bindings WHERE native_operator_id=?').bind(id).first())return null
  return person
 }
 const setupOwner=()=>db.prepare('SELECT claim_id AS id FROM oa_bootstrap LIMIT 1').first<{id:string}>()
 return {...native,person:admitted,
  async sponsor({sub}){
   const owner=await db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>()
   if(owner?.owner_id===sub){const binding=await setupOwner();return binding?admitted(binding.id):null}
   const row=await db.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state NOT IN('conflict','inactive')").bind(sub).first<{operator_id:string|null}>()
   return row?.operator_id?admitted(row.operator_id):null
  },
  async businessMember(person){
   const owner=await db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>()
   if(owner?.owner_id&&(await setupOwner())?.id===person.id)return {id:owner.owner_id,role:'owner'}
   const row=await db.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND business_id IS NOT NULL AND state NOT IN('conflict','inactive')").bind(person.id).first<{business_id:string;business_role:string}>()
   return row?{id:row.business_id,role:row.business_role==='admin'?'editor':null}:null
  },
  async session(request){const person=await native.session(request);return person?admitted(person.id):null},
 }
}
