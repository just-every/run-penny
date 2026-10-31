import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../../auth/native-tokens'
import {destination,integrationOperator} from '../../integrations/destinations'
import {integrationTransport,integrationAvailable} from '../../integrations/transport'
import {D1SqlDatabase} from '../../../../../base/modules/integrations/core/database.ts'
import {IntegrationsRepository} from '../../../../../base/modules/integrations/core/repository.ts'
import {createSlackNotifier} from '../../../../../base/modules/integrations/slack/notifier.ts'
import {answerAuthority,readAnswer,type Answer} from './answers'
import {askContext} from './context'
import {resolveCitations} from '../drafts'
export const slackInput=z.object({destinationId:z.string().uuid()}).strict()
export async function askDestinations(runtime:PennyRuntime,request:Request){
 const {db}=await integrationOperator(runtime,request)
 const rows=await db.prepare("SELECT d.id,d.name FROM penny_integration_destinations d JOIN penny_integration_credentials c ON c.id=d.id JOIN oa_operators o ON o.id=d.native_operator_id WHERE d.kind='slack' AND d.revoked_at IS NULL AND o.status='active' AND o.version=d.operator_version ORDER BY d.name,d.id").all<{id:string;name:string}>()
 return {destinations:rows.results,available:integrationAvailable(runtime)}
}
export async function currentAnswer(db:D1Database,id:string,actorId:string,role:string){
 const stored=await readAnswer(db,id,actorId),current=await askContext(db,stored.answer.question,role)
 const resolved=resolveCitations({paragraphs:stored.answer.paragraphs.map(p=>({...p,text:current.privacy.clean(p.text)}))},current.sources.filter(s=>stored.sourceIds.includes(s.id)))
 return {...stored.answer,...resolved,notices:[...new Set([...stored.answer.notices,...resolved.notices])],question:current.question}
}
/** One deliberate post, to one immutable chosen destination; no Cron fanout. */
export async function postAnswer(runtime:PennyRuntime,request:Request,id:string,destinationId:string){
 const {db,session,actor}=await answerAuthority(runtime,request),answer=await currentAnswer(db,id,actor.id,session.operator.role)
 const target=await destination(runtime,destinationId,'slack'),namespace='penny-ask',deliveryId='answer:'+id
 const repository=new IntegrationsRepository(new D1SqlDatabase(db),namespace),transport=integrationTransport(runtime)
 const existing=await repository.get(deliveryId)
 if(existing){
  if(existing.destinationId!==destinationId)throw new NativeError('ai_answer_destination_fixed',409,'This answer already has a chosen Slack destination. It cannot be sent somewhere else.')
  return {state:existing.state,destinationName:target.name}
 }
 const sections=[answer.question,...answer.paragraphs.flatMap(p=>p.text.match(/[\s\S]{1,500}/g)??[]),...answer.notices,...answer.citations.map(c=>`${c.label}: ${new URL(c.href,runtime.configuration.appOrigin).href}`)]
 if(sections.length>50)throw new NativeError('ai_answer_slack_too_large',413,'This answer is too long for one Slack post. Ask a more specific question.')
 const notifier=createSlackNotifier<Answer>({repository,incomingWebhook:async chosen=>(await destination(runtime,chosen,'slack')).endpoint,transport:{send:async wire=>{
  // Authority, archive epoch and destination checks immediately precede egress.
  await currentAnswer(db,id,actor.id,session.operator.role);await destination(runtime,destinationId,'slack')
  return transport.send(wire)
 }},templates:{'answer.chosen':a=>({summary:'Ask Penny: '+a.question.slice(0,500),sections})}})
 await notifier.enqueue({id:deliveryId,tenant:namespace,destinationId,event:'answer.chosen',mode:'incoming-webhook',data:answer},{maxAttempts:1,retryDelaysMs:[]})
 const delivered=await notifier.delivery.dispatch(deliveryId)
 return {state:delivered!.state,destinationName:target.name}
}
