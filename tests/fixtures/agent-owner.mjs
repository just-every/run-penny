/** Disposable setup through Penny's signed owner and native person doors. */
export default async function initialize({request,origin,claim,displayName}) {
 const bootstrap=await request(new URL(claim.path,origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:claim.token,displayName,returnTo:'/agents'})});
 if(bootstrap.status!==303){console.error('Native signed owner claim status',bootstrap.status);throw new Error('Native signed owner claim failed');}
 const cookie=bootstrap.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');
 const person=async(path,body,method='POST')=>{
  const response=await request(new URL(path,origin).href,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){console.error('Native fixture setup status',path,response.status);throw new Error('Native fixture setup refused');}
  return response;
 };
 await person('/api/operator/boards',{slug:'agent-public',name:'Customer requests',visibility:'public'});
 await person('/api/operator/boards',{slug:'agent-private',name:'Internal discovery',visibility:'internal'});
 const setup=await request(new URL('/setup',origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Synthetic Product Studio',postalAddress:'41 Example Road, Example City',timezone:'UTC',quietStart:'22',quietEnd:'8'}).toString()});
 if(setup.status!==303){console.error('Native first-run setup status',setup.status);throw new Error('Native first-run setup refused');}
 await person('/api/operator/settings/ai',{monthlyBudgetMicros:100000000,includePrivate:false,choices:[{capability:'summary',provider:'anthropic',model:'penny-conformance-model'},{capability:'reply',provider:'anthropic',model:'penny-conformance-model'}]},'PUT');
 // The core fixture uses native person preparation; customer mail is deferred.
 const created=await person('/api/operator/requests',{title:'Verifier public delivery evidence',description:'Owner-reviewed delivery evidence for the core read adapters.',boardSlug:'agent-public',evidenceIds:[]});
 const feedback=await created.json();
 await person('/api/operator/requests/'+feedback.slug+'/moderate',{verdict:'approved'});
 return bootstrap;
}
