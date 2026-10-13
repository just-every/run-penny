export async function operatorMutation(path:string,body:unknown,method='POST') {
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!response.ok){const result=await response.json() as {error?:string;message?:string};throw new Error(result.message??result.error?.replaceAll('_',' ')??'Action failed')}
  return response.status===204?null:response.json()
}
