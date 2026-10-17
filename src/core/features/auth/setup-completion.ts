import {workspaceClockInput,saveWorkspaceClock} from '../settings/workspace-clock'
import type {PennyRuntime} from '@/core/app/runtime'
import {operatorAuth} from './operator'
import {businessInput} from '../settings/mail-identity'
import {sessionGuard} from '../integrations/keys'
import {guardedDatabase} from '../integrations/guarded-database'
/** The product completion and Base's installation fact share native authority and one transaction. */
export async function completeProductSetup(request:Request,runtime:PennyRuntime):Promise<Response>{
 const origin=runtime.configuration.appOrigin,url=new URL(request.url)
 const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex','content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}
 const failure=(error:string,status:number)=>Response.json({error},{status,headers})
 if(url.origin!==origin||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))return failure('invalid_host',403)
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return failure('invalid_origin',403)
 const session=await operatorAuth(runtime).getSession(request)
 if(!session)return failure('authentication_required',401)
 if(session.operator.role!=='owner')return failure('owner_required',403)
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return failure('invalid_form',400)
 const form=await request.formData()
 if(form.get('confirm')!=='yes')return failure('confirmation_required',400)
 const input=businessInput.safeParse({companyName:form.get('companyName'),postalAddress:form.get('postalAddress')})
 if(!input.success)return failure('company_name_and_postal_address_required',400)
 const clock=workspaceClockInput.safeParse({timezone:form.get('timezone'),quietEnabled:form.get('quietEnabled')==='yes',quietStart:Number(form.get('quietStart')??'NaN'),quietEnd:Number(form.get('quietEnd')??'NaN')})
 if(!clock.success)return failure('workspace_timezone_and_quiet_hours_required',400)
 const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
 const db=guardedDatabase(runtime.database.binding,guard)
 await db.batch([
  saveWorkspaceClock(db,clock.data,new Date().toISOString(),true),
  db.prepare(`INSERT INTO penny_mail_identity(singleton,company_name,postal_address,updated_at) SELECT 1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM oa_first_run WHERE singleton=1) ON CONFLICT(singleton) DO UPDATE SET company_name=excluded.company_name,postal_address=excluded.postal_address,updated_at=excluded.updated_at`).bind(input.data.companyName,input.data.postalAddress,new Date().toISOString()),
  db.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING').bind(session.operatorId,Date.now()),
 ])
 return new Response(null,{status:303,headers:{...headers,location:'/app'}})
}
