import { validatePlan } from '../../base/modules/deploy-kit/validation.mjs'
/** Reviewed disposable target. All remote identities remain within Penny's prefix. */
export function pennyPlan(artifact, {origin,mailFrom,operatorEmail='operator@example.com',suffix='',mailProvider,eventVerification=false,workspaceTimezone}) {
 if (suffix && !/^[a-z0-9-]{1,20}$/.test(suffix)) throw new Error('invalid-penny-deploy-suffix')
 if (!['sendgrid','resend'].includes(mailProvider)) throw new Error('MAIL_PROVIDER-must-be-sendgrid-or-resend')
 if(workspaceTimezone!==undefined){if(typeof workspaceTimezone!=='string'||!workspaceTimezone.trim()||/^[+-]/.test(workspaceTimezone.trim()))throw new Error('WORKSPACE_TIMEZONE-must-be-an-IANA-timezone');try{new Intl.DateTimeFormat('en',{timeZone:workspaceTimezone}).format()}catch{throw new Error('WORKSPACE_TIMEZONE-must-be-an-IANA-timezone')}}
 const providerKey=mailProvider==='sendgrid'?'SENDGRID_API_KEY':'RESEND_API_KEY'
 const eventKey=mailProvider==='sendgrid'?'SENDGRID_EVENT_PUBLIC_KEY':'RESEND_WEBHOOK_SECRET'
 const worker = `rer-seedproof-penny${suffix ? '-'+suffix : ''}`
 const url = new URL(origin)
 if (url.protocol !== 'https:' || url.origin !== origin || !url.hostname.startsWith(worker+'.') || !url.hostname.endsWith('.workers.dev')) throw new Error('workers-dev-origin-required')
 if (!mailFrom || /[\r\n]/.test(mailFrom) || !operatorEmail.includes('@')) throw new Error('MAIL_FROM-and-OPERATOR_EMAIL-required')
 return validatePlan({version:1,worker,compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],
  d1:[{binding:'DB',name:worker+'-db',migrations:artifact.migrations.map(({binding,...migration})=>{if(binding!=='DB')throw new Error('unexpected-migration-binding');return migration})}],
  r2:[{binding:'FILES',name:worker+'-files'}],queues:[{binding:'JOBS',name:worker+'-jobs',consumer:{batch_size:1,max_retries:3,max_concurrency:1}}],durableObjects:[],crons:['* * * * *'],
  secrets:[{binding:'AUTH_SECRET',environment:'AUTH_SECRET'},{binding:'SETUP_TOKEN',environment:'SETUP_TOKEN'},{binding:providerKey,environment:providerKey},...(eventVerification?[{binding:eventKey,environment:eventKey}]:[])],
  vars:{PENNY_ENVIRONMENT:'production',APP_ORIGIN:origin,OPERATOR_EMAIL:operatorEmail,MAIL_PROVIDER:mailProvider,MAIL_FROM:mailFrom,...(workspaceTimezone===undefined?{}:{WORKSPACE_TIMEZONE:workspaceTimezone})}})
}
