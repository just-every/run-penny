import assert from 'node:assert/strict'
import test from 'node:test'
import {pennyPlan} from '../../scripts/deployment/plan.mjs'
test('[NOTIFY-002] setup timezone is an optional validated deployment binding with unchanged minute Cron',()=>{
 const options={origin:'https://rer-seedproof-penny.fixture.workers.dev',mailProvider:'sendgrid',mailFrom:'penny@example.test'}
 const defaultPlan=pennyPlan({migrations:[]},options)
 assert.equal(Object.hasOwn(defaultPlan.vars,'WORKSPACE_TIMEZONE'),false)
 const plan=pennyPlan({migrations:[]},{...options,workspaceTimezone:'Pacific/Honolulu'})
 assert.equal(plan.vars.WORKSPACE_TIMEZONE,'Pacific/Honolulu');assert.deepEqual(plan.crons,['* * * * *'])
 for(const workspaceTimezone of ['', 'Invalid/Place'])assert.throws(()=>pennyPlan({migrations:[]},{...options,workspaceTimezone}),/IANA-timezone/)
})
test('[NOTIFY-002 BASE-SECRET-002] offline format doctor rejects invalid optional timezone without requiring it',async()=>{
 const {validateConfiguration}=await import('../../scripts/operations-config.mjs')
 const env={APP_ORIGIN:'https://penny.fixture.invalid',PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',SENDGRID_API_KEY:'fixture-key',AUTH_SECRET:'synthetic-auth-secret-'.repeat(3),OPERATOR_EMAIL:'owner@example.test'}
 assert.doesNotThrow(()=>validateConfiguration(env))
 assert.doesNotThrow(()=>validateConfiguration({...env,WORKSPACE_TIMEZONE:'Pacific/Honolulu'}))
 assert.throws(()=>validateConfiguration({...env,WORKSPACE_TIMEZONE:'Invalid/Zone'}),/invalid-WORKSPACE_TIMEZONE/)
})
