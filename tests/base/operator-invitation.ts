import {expect} from 'vitest'
import {call,messages} from './support'

export const management='/api/operator/settings/operators'
export async function invited(cookie:Record<string,string>,email:string){
 const response=await call(management,{email},cookie);expect(response.status,await response.clone().text()).toBe(202)
 const message=messages.findLast(m=>m.to===email)!;expect(message).toBeDefined()
 const url=new URL(message.url),token=url.searchParams.get('token')!
 expect((await call(url.pathname+url.search)).status).toBe(200)
 expect((await call(url.pathname+url.search)).status).toBe(200)
 expect((await call('/auth/confirm',{token},{Origin:'https://evil.test'})).status).toBe(403)
 const confirmation=await call('/auth/confirm',{token});expect(confirmation.status).toBe(303)
 const operator={Cookie:confirmation.headers.get('Set-Cookie')!.split(';')[0]}
 const listing=await call(management,undefined,operator);expect(listing.status).toBe(200)
 const operators=(await listing.json() as {operators:{id:string;email:string}[]}).operators
 return {cookie:operator,id:operators.find(o=>o.email===email)!.id,token,operators}
}
