import {createOwnerClaimHandler} from '../../../../base/modules/owner-claim/index.mjs'
import type {Hono} from 'hono'
import type {AppBindings} from '@/core/shared/bindings'
import type {PennyRuntime} from '@/core/app/runtime'

type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
export function registerOwnerClaimRoutes(app:Hono<Environment>):void {
 app.all('/auth/owner-claim',async c=>{
  c.header('Cache-Control','no-store')
  const runtime=c.get('runtime'),config=runtime.configuration,env=runtime.bindings
  if(!env.RER_OWNER_CLAIM_ISSUER||!env.RER_OWNER_CLAIM_PUBLIC_KEYS||!env.RER_INSTALLATION_ID||!config.appOrigin||!config.ownerEmail||!config.authSecret||!config.setupToken)return c.json({error:'owner_claim_unconfigured'},503)
  try {
   const handler=createOwnerClaimHandler({db:env.DB,authConfig:{origin:config.appOrigin,OWNER_EMAIL:config.ownerEmail.toLowerCase(),SESSION_SECRET:config.authSecret,SETUP_TOKEN:config.setupToken,local:['local','test'].includes(config.environment)&&new URL(config.appOrigin).protocol==='http:'},issuer:env.RER_OWNER_CLAIM_ISSUER,installationId:env.RER_INSTALLATION_ID,appOrigin:config.appOrigin,expectedEmail:config.ownerEmail.toLowerCase(),publicKeys:JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS),clientIp:request=>request.headers.get('CF-Connecting-IP')??(['local','test'].includes(config.environment)?'local':'')})
   return (await handler(c.req.raw))!
  } catch {return c.json({error:'owner_claim_configuration_invalid'},503)}
 })
}
