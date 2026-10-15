import type {Context} from 'hono'
import {matchedRoutes} from 'hono/route'
import {z} from 'zod'

/** BASE-INPUT-001: every API path parameter is an identifier, slug or a
 * composite `event:destination` delivery key. Services still look each one up;
 * anything else is refused before a handler runs. */
const pathParameter=z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/)

export function validPathParameters(context:Context):boolean{
 if(!context.req.path.startsWith('/api/'))return true
 const segments=context.req.path.split('/')
 for(const {path} of matchedRoutes(context)){
  const pattern=path.split('/')
  for(const [index,part] of pattern.entries()){
   if(!part.startsWith(':'))continue
   let value:string
   try{value=decodeURIComponent(segments[index]??'')}catch{return false}
   if(!pathParameter.safeParse(value).success)return false
  }
 }
 return true
}
