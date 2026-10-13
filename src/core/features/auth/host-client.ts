let headers:Record<string,string>={},name='',until=0
export function hostRequesterHeaders(){if(Date.now()>=until){headers={};name=''}return {...headers}}
export function hostRequesterName(){hostRequesterHeaders();return name}
export function clearHostIdentity(){headers={};name='';until=0;window.dispatchEvent(new Event('penny-requester-changed'))}
export async function acceptHostIdentity(value:unknown){
 if(!value||typeof value!=='object')throw new Error('Host sign-in is unavailable. Verify your email instead.')
 const record=value as Record<string,unknown>
 if(typeof record.claims!=='string'||typeof record.signature!=='string'||record.claims.length>4096||record.signature.length>128)throw new Error('Host sign-in is unavailable. Verify your email instead.')
 const credential={'X-Penny-Identity':record.claims,'X-Penny-Identity-Signature':record.signature}
 const response=await fetch('/api/public/identity/host',{method:'POST',headers:{'Content-Type':'application/json',...credential},body:'{}',credentials:'omit',cache:'no-store'})
 if(!response.ok){clearHostIdentity();throw new Error('Host sign-in is unavailable. Verify your email instead.')}
 const grant=await response.json() as {displayName:string;expiresAt:number}
 headers=credential;name=grant.displayName;until=grant.expiresAt;window.dispatchEvent(new Event('penny-requester-changed'))
}
