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
 return {...native,person:admitted,
  async sponsor(claims){const person=await native.sponsor(claims);return person?admitted(person.id):null},
  async session(request){const person=await native.session(request);return person?admitted(person.id):null},
 }
}
