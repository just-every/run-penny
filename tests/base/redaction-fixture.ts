import {expect,inject} from 'vitest'
import {reset,applyD1Migrations} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {incomingEmail} from './email-capture-fixture'
import {providerMessages} from './provider-messages'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'
type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
export async function proveRedaction(call:Call,fixture:()=>Promise<{operator:Record<string,string>}>,person:()=>Promise<Record<string,string>>){
 await reset();const migrations=inject('migrations') as {name:string;queries:string[]}[]
 await applyD1Migrations(env.DB,migrations.filter(row=>Number(row.name.slice(0,4))<90))
 await env.DB.batch([env.DB.prepare("INSERT INTO evidence_items(id,source_type,source_label,observed_at,review_state,created_at,updated_at) VALUES('synthetic-penny-prior','free_text','Synthetic prior capture','2026-10-01','unreviewed','2026-10-01','2026-10-01')"),env.DB.prepare("INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES('synthetic-penny-prior-version','synthetic-penny-prior',1,'Prior evidence survives upgrade','2026-10-01','2026-10-01')")])
 const old=(await env.DB.prepare('SELECT * FROM evidence_versions').all()).results
 await applyD1Migrations(env.DB,migrations);await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.prepare('SELECT * FROM evidence_versions').all()).results).toEqual(old)
 const g=await fixture(),read=async<T>(response:Response|Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 const rules={enabled:true,kinds:['ssn','card','phone','email','credential'],patterns:[] as string[]}
 expect(await read(call('/api/operator/settings/redaction',undefined,g.operator))).toMatchObject({enabled:false})
 await read(call('/api/operator/settings/redaction',rules,g.operator,'PUT'))
 const before=(await env.DB.prepare('SELECT * FROM penny_redaction_settings').all()).results
 expect((await call('/api/operator/settings/redaction',{...rules,patterns:['(a+)+$']},g.operator,'PUT')).status).toBe(422)
 expect((await env.DB.prepare('SELECT * FROM penny_redaction_settings').all()).results).toEqual(before)
 const ssn='234-56-7890',card='4111 1111 1111 1111',wording=`Synthetic Penny ticket: SSN ${ssn}; card ${card}; ACCOUNT-1234.`
 const capture=(text:string)=>read<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Synthetic capture source',wording:text,observedAt:'2026-10-22T09:00:00Z'},g.operator),201)
 const item=await capture(wording)
 const stored=await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first<string>('wording')
 expect(stored).toContain('[REDACTED:ssn]');expect(stored).toContain('[REDACTED:card]');expect(stored).not.toContain(ssn);expect(stored).not.toContain(card)
 await read(call('/api/operator/settings/email-capture',{captureAddress:'capture@penny.test',domains:['example.test']},g.operator,'PUT'))
 await incomingEmail({id:'<synthetic-penny-redaction@example.test>',body:wording})
 const email=await env.DB.prepare("SELECT v.wording FROM evidence_versions v JOIN evidence_items e ON e.id=v.evidence_id WHERE e.source_type='email'").first<string>('wording')
 expect(email).toBe(stored)
 const requester=await person()
 await read(call('/api/public/requests',{title:'Synthetic portal capture',description:wording,boardSlug:'feedback',idempotencyKey:'synthetic-penny-redaction-submission',emailUpdates:false},requester),201)
 expect(await env.DB.prepare("SELECT description FROM requests WHERE title='Synthetic portal capture'").first('description')).toBe(stored)
 const secretSearch=await read<{items:unknown[]}>(call('/api/operator/search?q='+encodeURIComponent(ssn),undefined,g.operator));expect(secretSearch.items).toEqual([])
 const search=await read<{items:unknown[]}>(call('/api/operator/search?q='+encodeURIComponent('Synthetic Penny ticket'),undefined,g.operator));expect(search.items.length).toBeGreaterThan(0);expect(JSON.stringify(search)).toContain('[REDACTED:ssn]');expect(JSON.stringify(search)).not.toContain(card)
 rules.patterns=['ACCOUNT-[0-9]{4}','synthetic-penny-rule@example.test']
 await read(call('/api/operator/settings/redaction',rules,g.operator,'PUT'))
 const newer=await capture('New capture ACCOUNT-5678')
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(newer.id).first('wording')).toBe('New capture [REDACTED:custom]')
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('ACCOUNT-1234')
 expect((await call('/api/operator/settings/redaction/preview',{},requester)).status).toBe(401)
 const preview=await read<{records:number;changes:number;planHash:string;irreversible:boolean}>(call('/api/operator/settings/redaction/preview',{},g.operator))
 expect(preview.records).toBeGreaterThanOrEqual(preview.changes);expect(preview.changes).toBeGreaterThan(0);expect(preview.irreversible).toBe(true)
 const applied=await read<{changed:number}>(call('/api/operator/settings/redaction/reapply',{planHash:preview.planHash,confirmIrreversible:true},g.operator));expect(applied.changed).toBe(preview.changes)
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('[REDACTED:custom]')
 const again=await read<{changes:number;planHash:string}>(call('/api/operator/settings/redaction/preview',{},g.operator));expect(again.changes).toBe(0)
 expect(await read(call('/api/operator/settings/redaction/reapply',{planHash:again.planHash,confirmIrreversible:true},g.operator))).toMatchObject({changed:0})
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='redaction.reapplied'").first('n')).toBe(2)
 const ruleEmail='synthetic-penny-rule@example.test'
 await read(call('/api/public/identity/email',{email:ruleEmail,displayName:'Synthetic rule subject'}),202)
 const sent=(await providerMessages().list()).find(row=>row.message.to.includes(ruleEmail))!,token=new URL(sent.message.text!.match(/https?:\/\/\S+/)![0]).hash.slice(7)
 await read(call('/api/public/identity/email/verify',{token}))
 const portable=await read<{archive:Archive;journal:ErasureJournal}>(call('/api/operator/data/export',undefined,g.operator))
 for(const value of [ssn,card])expect(JSON.stringify(portable)).not.toContain(value)
 expect(portable.archive.tables.penny_redaction_settings).toHaveLength(1)
 await reset();await applyD1Migrations(env.DB,migrations)
 const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303)
 const destination={Cookie:boot.headers.get('set-cookie')!.split(';')[0]}
 const complete=async(path:string,body:unknown)=>{let response=await call(path,body,destination);expect([200,202],await response.clone().text()).toContain(response.status);let result=await response.json() as {status:string;operationId:string};for(let step=0;result.status!=='complete'&&step<50;step++){response=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},destination);expect([200,202],await response.clone().text()).toContain(response.status);result=await response.json() as typeof result}expect(result.status).toBe('complete')}
 await complete('/api/operator/data/import',portable)
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('[REDACTED:ssn]')
 const restored=await read(call('/api/operator/search?q='+encodeURIComponent('Synthetic Penny ticket'),undefined,destination));expect(JSON.stringify(restored)).not.toContain(ssn);expect(JSON.stringify(restored)).toContain('[REDACTED:card]')
 const id=await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(ruleEmail).first('requester_id')
 const erasure=await read<{planHash:string;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',{table:'requesters',id},destination));expect(erasure.blockedCopies).toEqual([])
 await complete('/api/operator/data/erasure',{table:'requesters',id,planHash:erasure.planHash})
 expect(JSON.stringify(await read(call('/api/operator/data/export',undefined,destination)))).not.toContain(ruleEmail)
 expect(await env.DB.prepare('SELECT patterns_json FROM penny_redaction_settings').first('patterns_json')).toBe(JSON.stringify(['ACCOUNT-[0-9]{4}']))
}
