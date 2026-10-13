// Trusted controller: no source build, package scripts, ambient login or arbitrary domains.
import { lstat,writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cloudflare } from '../../base/modules/deploy-kit/provider.mjs'
import { deploy } from '../../base/modules/deploy-kit/deploy.mjs'
import { verifyHealth } from '../../base/modules/deploy-kit/health.mjs'
import { readArtifact,regularBytes } from '../../base/modules/deploy-kit/artifact.mjs'
import { assert } from '../../base/modules/deploy-kit/validation.mjs'
import { pennyPlan } from './plan.mjs'
import { registerDeploymentCrons } from './cron-registration.mjs'
async function main(){
 const env=process.env,mode=process.argv[2]
 assert(process.argv.length===3&&['deploy','health'].includes(mode),'usage-deploy-or-health')
 assert(!env.NODE_OPTIONS&&!env.NODE_PATH,'unsafe-node-environment')
 for(const key of ['CF_THROWAWAY_ACCOUNT_ID','CF_THROWAWAY_API_TOKEN','RER_DEPLOY_ARTIFACT','RER_DEPLOY_ARTIFACT_SHA256','RER_DEPLOY_SOURCE_SHA','RER_DEPLOY_RUN_ID','RER_DEPLOY_RUN_ATTEMPT','RER_DEPLOY_RECEIPT','MAIL_FROM','MAIL_PROVIDER'])assert(env[key]?.trim(),`missing-${key}`)
 assert(resolve(env.RER_DEPLOY_RECEIPT)===env.RER_DEPLOY_RECEIPT,'receipt-path-must-be-absolute')
 const expected={sha256:env.RER_DEPLOY_ARTIFACT_SHA256,sourceSha:env.RER_DEPLOY_SOURCE_SHA,runId:env.RER_DEPLOY_RUN_ID,runAttempt:env.RER_DEPLOY_RUN_ATTEMPT}
 const artifact=await readArtifact(env.RER_DEPLOY_ARTIFACT,expected)
 const api=cloudflare({accountId:env.CF_THROWAWAY_ACCOUNT_ID,token:env.CF_THROWAWAY_API_TOKEN})
 const account=await api.request('/workers/subdomain')
 assert(typeof account.subdomain==='string'&&/^[a-z0-9-]+$/.test(account.subdomain),'invalid-workers-subdomain')
 const suffix=env.PENNY_DEPLOY_SUFFIX??'',worker=`rer-seedproof-penny${suffix?'-'+suffix:''}`
 const plan=pennyPlan(artifact,{origin:`https://${worker}.${account.subdomain}.workers.dev`,mailFrom:env.MAIL_FROM,mailProvider:env.MAIL_PROVIDER,eventVerification:Boolean(env[env.MAIL_PROVIDER==='sendgrid'?'SENDGRID_EVENT_PUBLIC_KEY':'RESEND_WEBHOOK_SECRET']),operatorEmail:env.OPERATOR_EMAIL??'operator@example.com',workspaceTimezone:env.WORKSPACE_TIMEZONE,suffix})
 let previousReceipt
 try{const stat=await lstat(env.RER_DEPLOY_RECEIPT);assert((stat.mode&0o077)===0,'receipt-permissions');previousReceipt=JSON.parse(await regularBytes(env.RER_DEPLOY_RECEIPT,1048576));assert(previousReceipt.source.sha===artifact.source.sha&&previousReceipt.artifactSha256===expected.sha256&&previousReceipt.run.id===artifact.run.id&&previousReceipt.run.attempt===artifact.run.attempt,'receipt-custody-mismatch')}catch(error){if(error.code!=='ENOENT')throw error}
 if(mode==='health'){assert(previousReceipt,'missing-receipt');await verifyHealth({api,plan,receipt:previousReceipt})}
 else {
  const receipt=await deploy({api,plan,artifact,artifactSha256:expected.sha256,previousReceipt,repeatOnly:Boolean(previousReceipt),env,onReceipt:async receipt=>{if(!previousReceipt)await writeFile(env.RER_DEPLOY_RECEIPT,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600})}})
  await registerDeploymentCrons(api,plan,receipt.changed)
 }
 console.log(JSON.stringify({ok:true,command:mode,worker,source:artifact.source.sha}))
}
try{await main()}catch(error){console.error(JSON.stringify({ok:false,code:/^[a-zA-Z0-9_-]+$/.test(error.message)?error.message:'deployment-failed'}));process.exitCode=1}
