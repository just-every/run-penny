import {createHmac} from 'node:crypto'
// Call only after the host server has authenticated this user. Never accept
// account or identity fields supplied by the iframe or browser request body.
export function signRequester(user,{secret,appOrigin,now=new Date()}){
 const claims=Buffer.from(JSON.stringify({aud:appOrigin,issuedAt:now.toISOString(),email:user.email,displayName:user.displayName,
  ...(user.accountId?{accountId:user.accountId,accountName:user.accountName}:{}),
  ...(user.revenueCents===undefined?{}:{revenueCents:user.revenueCents}),
  ...(user.renewalDate?{renewalDate:user.renewalDate}:{}),...(user.health?{health:user.health}:{}),
 })).toString('base64url')
 return {claims,signature:createHmac('sha256',secret).update(claims).digest('base64url')}
}
