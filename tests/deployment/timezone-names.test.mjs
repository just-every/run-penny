import assert from 'node:assert/strict'
import test from 'node:test'
import {pennyPlan} from '../../scripts/deployment/plan.mjs'
import {validateConfiguration} from '../../scripts/operations-config.mjs'
const options={origin:'https://rer-seedproof-penny.fixture.workers.dev',mailProvider:'sendgrid',mailFrom:'penny@example.test'}
const env={APP_ORIGIN:'https://penny.fixture.invalid',PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',SENDGRID_API_KEY:'fixture-key',AUTH_SECRET:'synthetic-auth-secret-'.repeat(3),OPERATOR_EMAIL:'owner@example.test'}
test('[NOTIFY-002] deployment rejects numeric timezone offsets but accepts named IANA aliases',()=>{
 for(const workspaceTimezone of ['+05:30','-08:00','+0530','+05','-2359'])assert.throws(()=>pennyPlan({migrations:[]},{...options,workspaceTimezone}),/IANA-timezone/)
 for(const workspaceTimezone of ['UTC','Etc/UTC','Etc/GMT+5','Australia/Brisbane','US/Eastern'])assert.equal(pennyPlan({migrations:[]},{...options,workspaceTimezone}).vars.WORKSPACE_TIMEZONE,workspaceTimezone)
})
test('[NOTIFY-002] doctor rejects numeric timezone offsets but accepts named IANA aliases',()=>{
 for(const WORKSPACE_TIMEZONE of ['+05:30','-08:00','+0530','+05','-2359'])assert.throws(()=>validateConfiguration({...env,WORKSPACE_TIMEZONE}),/invalid-WORKSPACE_TIMEZONE/)
 for(const WORKSPACE_TIMEZONE of ['UTC','Etc/UTC','Etc/GMT+5','Australia/Brisbane','US/Eastern'])assert.doesNotThrow(()=>validateConfiguration({...env,WORKSPACE_TIMEZONE}))
})
