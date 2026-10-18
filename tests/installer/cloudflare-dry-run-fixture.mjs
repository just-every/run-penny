// Network edge only: the real rer deploy command and Penny adapter still run.
import {appendFileSync} from 'node:fs'

const account='a'.repeat(32),root=`https://api.cloudflare.com/client/v4/accounts/${account}`
globalThis.fetch=async(input,init={})=>{
 const url=typeof input==='string'?input:input.url,method=init.method??'GET'
 appendFileSync(process.env.PENNY_DRY_RUN_REQUESTS,JSON.stringify({url,method})+'\n')
 if(method!=='GET')throw new Error('Dry run attempted a provider mutation')
 if(url===`${root}/workers/subdomain`)return Response.json({success:true,result:{subdomain:'penny-fixture'},errors:[]})
 if(url===`${root}/workers/scripts/penny-production/settings`)return Response.json({success:false,result:null,errors:[{code:10007,message:'Worker does not exist'}]},{status:404})
 throw new Error('Unexpected dry-run network request')
}
