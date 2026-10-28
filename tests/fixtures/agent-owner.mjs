/** Disposable setup through Penny's signed owner and native person doors. */
export default async function initialize({request,origin,claim,displayName,email,mail}) {
 const bootstrap=await request(new URL(claim.path,origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:claim.token,displayName,returnTo:'/agents'})});
 if(bootstrap.status!==303){console.error('Native signed owner claim status',bootstrap.status);throw new Error('Native signed owner claim failed');}
 const cookie=bootstrap.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');
 const person=async(path,body)=>{
  const response=await request(new URL(path,origin).href,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){console.error('Native fixture setup status',path,response.status);throw new Error('Native fixture setup refused');}
  return response;
 };
 await person('/api/operator/boards',{slug:'agent-public',name:'Customer requests',visibility:'public'});
 await person('/api/operator/boards',{slug:'agent-private',name:'Internal discovery',visibility:'internal'});
 const setup=await request(new URL('/setup',origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Synthetic Product Studio',postalAddress:'41 Example Road, Example City',timezone:'UTC',quietStart:'22',quietEnd:'8'}).toString()});
 if(setup.status!==303){console.error('Native first-run setup status',setup.status);throw new Error('Native first-run setup refused');}
 // The verifier captures only this run's synthetic owner's email.
 const json=async(path,body,headers={},expected=200)=>{const response=await request(new URL(path,origin).href,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});if(response.status!==expected)throw new Error(`Native customer fixture ${path}: ${response.status}`);return response.json()};
 await json('/api/public/identity/email',{email,displayName:'Synthetic customer'}, {},202);
 const message=mail.read({limit:20}).at(-1);
 const link=message?.text.match(/https?:\/\/[^\s]+#token=[^\s]+/)?.[0];
 if(!link)throw new Error('Native customer verification mail was not captured');
 const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
 const customer=await json('/api/public/identity/email/verify',{token});
 const auth={Authorization:'Bearer '+customer.token};
 const feedback=await json('/api/public/requests',{title:'Verifier customer delivery consent',description:'An actual verified customer requests a delivery update.',boardSlug:'agent-public',idempotencyKey:crypto.randomUUID()},auth,201);
 await json('/api/operator/moderation/'+feedback.slug,{verdict:'approved',title:'Verifier customer delivery consent',description:'An actual verified customer requests a delivery update.',boardSlug:'agent-public',displayName:'Synthetic customer'},{Cookie:cookie});
 const follow=await request(new URL('/api/public/requests/'+feedback.slug+'/follow',origin).href,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...auth},body:'{}'});
 if(follow.status!==204)throw new Error('Native follow consent refused');
 return bootstrap;
}
