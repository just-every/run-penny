import {exports} from 'cloudflare:workers'
import {expect} from 'vitest'
export async function incomingEmail(options:{id?:string|null;from?:string;alignment?:string;body?:string;headers?:Record<string,string>;attachment?:boolean;attachmentBytes?:number;size?:number}={}){
 const from=options.from??'operator@example.test',id=options.id===undefined?'<synthetic-penny-message-1@example.test>':options.id
 const headers=new Headers({from,to:'capture@penny.test','authentication-results':options.alignment??`mx.cloudflare.net; dmarc=pass header.from=${from.split('@')[1]}`,...(id?{'message-id':id}:{}),...options.headers})
 const body=options.body??'---------- Forwarded message ---------\r\nFrom: Customer <synthetic-penny-1@example.test>\r\nDate: Thu, 22 Oct 2026 09:00:00 +0000\r\nSubject: Export request\r\nTo: Operator <operator@example.test>\r\n\r\nPlease add scheduled exports.'
 let raw=[...headers].map(([key,value])=>`${key}: ${value}`).join('\r\n')+'\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'+body
 if(options.attachment)raw=[...headers].map(([key,value])=>`${key}: ${value}`).join('\r\n')+'\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="synthetic-penny-boundary"\r\n\r\n--synthetic-penny-boundary\r\nContent-Type: text/plain\r\n\r\n'+body+'\r\n--synthetic-penny-boundary\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="synthetic-penny-captured-original.pdf"\r\n\r\n'+(options.attachmentBytes?'x'.repeat(options.attachmentBytes):'synthetic-penny-attachment')+'\r\n--synthetic-penny-boundary\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="refused.txt"\r\n\r\nnot an allowed attachment type\r\n--synthetic-penny-boundary--\r\n'
 const bytes=new TextEncoder().encode(raw),forbidden=()=>{throw new Error('Capture attempted an outbound email effect')}
 await (exports.default as unknown as {email:(event:unknown)=>Promise<void>}).email({from,to:'capture@penny.test',headers,rawSize:options.size??bytes.byteLength,raw:new Blob([bytes]).stream(),setReject:forbidden,forward:forbidden,reply:forbidden})
}
export async function proveEmailCapture(call:(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>,db:D1Database,operator:Record<string,string>){
 expect((await call('/api/operator/settings/email-capture',{captureAddress:'penny@localhost.test',domains:[]},operator,'PUT')).status).toBe(409)
 expect((await call('/api/operator/settings/email-capture',{captureAddress:'capture@penny.test',domains:['example.test']},operator,'PUT')).status).toBe(200)
 const before=await db.prepare('SELECT count(*) n FROM evidence_items').first<number>('n')
 await incomingEmail({attachment:true})
 await incomingEmail({id:'<synthetic-penny-message-2@example.test>',body:'-----Original Message-----\r\nFrom: Customer <synthetic-penny-2@example.test>\r\nSent: Thursday, October 22, 2026 09:00\r\nTo: Operator <operator@example.test>\r\nSubject: Reports\r\n\r\nPlease improve reports.'})
 expect(await db.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(before!+2)
 const captured=(await db.prepare("SELECT id,named_speaker,source_label FROM evidence_items WHERE source_type='email' ORDER BY named_speaker").all<{id:string;named_speaker:string;source_label:string}>()).results
 expect(captured.map(row=>row.named_speaker)).toEqual(['synthetic-penny-1@example.test','synthetic-penny-2@example.test'])
 expect(captured[0].source_label).toContain('allowed types')
 expect(await db.prepare('SELECT count(*) n FROM attachments WHERE evidence_id=?').bind(captured[0].id).first('n')).toBe(1)
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN('penny_email_capture_refusals') ORDER BY name").all<{name:string}>()).results
 const snapshot=async()=>Promise.all(tables.map(async({name})=>(await db.prepare(`SELECT * FROM "${name}"`).all()).results))
 const initial=await snapshot()
 for(const input of [{},{id:null},{id:'<synthetic-penny-forged@example.test>',from:'outside@unlisted.test',body:'---------- Forwarded message ---------\r\nFrom: operator@example.test\r\n\r\nForged admitted sender'},{id:'<synthetic-penny-absent@example.test>',alignment:''},{id:'<synthetic-penny-duplicate-auth@example.test>',alignment:'mx.cloudflare.net; dmarc=pass header.from=example.test, mx.cloudflare.net; dmarc=pass header.from=example.test'},{id:'<synthetic-penny-3@example.test>',alignment:'mx.cloudflare.net; dmarc=fail header.from=example.test'},{id:'<synthetic-penny-4@example.test>',from:'penny@example.test'},{id:'<synthetic-penny-5@example.test>',from:'outside@unlisted.test'},{id:'<synthetic-penny-6@example.test>',headers:{'in-reply-to':'<penny-notification@example.test>'}},{id:'<synthetic-penny-7@example.test>',size:100000000}]){await incomingEmail(input);expect(await snapshot()).toEqual(initial)}
 const countsResponse=await call('/api/operator/settings/email-capture',undefined,operator);expect(countsResponse.status).toBe(200)
 const counts=(await countsResponse.json() as {refusals:{reason:string;count:number}[]}).refusals
 expect(counts).toContainEqual({reason:'duplicate_message',count:1})
 for(const row of counts){expect(Object.keys(row).sort()).toEqual(['count','reason']);expect(row.reason).toMatch(/^[a-z_]+$/);expect(Number.isSafeInteger(row.count)&&row.count>0).toBe(true)}
 await incomingEmail({id:'<synthetic-penny-8@example.test>',body:'A direct BCC copy without a forwarded header.'})
 expect(await db.prepare("SELECT named_speaker,source_label FROM evidence_items WHERE source_label LIKE '%not forwarded%'").first()).toMatchObject({named_speaker:'operator@example.test'})
 await incomingEmail({id:'<synthetic-penny-large@example.test>',attachment:true,attachmentBytes:11*1024*1024,body:'From: Customer <synthetic-penny-3@example.test>\r\nSent: Thursday, October 22, 2026\r\nTo: Operator <operator@example.test>\r\nSubject: Large file\r\n\r\nPlease review the large document.'})
 const large=await db.prepare("SELECT id,source_label FROM evidence_items WHERE named_speaker='synthetic-penny-3@example.test'").first<{id:string;source_label:string}>()
 expect(large?.source_label).toContain('per-file size')
 expect(await db.prepare('SELECT count(*) n FROM attachments WHERE evidence_id=?').bind(large!.id).first('n')).toBe(0)
 return captured
}
