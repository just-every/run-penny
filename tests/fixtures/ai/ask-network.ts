/** Deterministic fake only at the model/Slack network edge. */
export function askNetwork(input:{sources:{id:string;text:string}[]}){
 return {paragraphs:[{text:'The stored report export evidence describes friction with CSV reporting. It supports reviewing date filters, without committing a delivery date.',citationIds:[...input.sources.map(s=>s.id),'evidence:missing-record']}]}
}
export const askProvider={name:'ask-network',modules:true,compatibilityDate:'2026-08-31',script:`
import {WorkerEntrypoint} from 'cloudflare:workers';
export default class extends WorkerEntrypoint {
 async send(wire){
  if(wire.url.startsWith('https://hooks.slack.com/')){
   if(wire.url!=='https://hooks.slack.com/services/synthetic-penny-1/synthetic-penny-2/synthetic-penny-3')throw Error('An unchosen Slack destination received a post');
   return {status:200,headers:{},body:'ok'};
  }
  if(wire.url!=='https://api.anthropic.com/v1/messages')throw Error('Unexpected model destination');
  const request=JSON.parse(wire.body),input=JSON.parse(request.messages[0].content);
  if(JSON.stringify(input).includes('4800000')||JSON.stringify(input).includes('Renewal discussion is internal'))throw Error('Commercial context crossed the model edge');
  const answer={paragraphs:[{text:'The stored report export evidence describes friction with CSV reporting. It supports reviewing date filters, without committing a delivery date.',citationIds:[...input.sources.map(s=>s.id),'evidence:missing-record']}]};
  return {status:200,headers:{},body:JSON.stringify({content:[{type:'text',text:JSON.stringify(answer)}],stop_reason:'end_turn',usage:{input_tokens:103,output_tokens:211}})};
 }
}`}
