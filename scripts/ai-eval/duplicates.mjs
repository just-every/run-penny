import {tsImport} from 'tsx/esm/api'
import {loadDuplicates,lexicalRank} from './duplicates-set.mjs'
import {duplicateMetrics,qualityBars,cosine} from './duplicates-metrics.mjs'
import {evalTransport} from './embeddings-transport.mjs'
export const INPUT_TEMPLATE_VERSION='duplicates-input-1.0.0'
export const corpusInput=row=>`${row.title}\n${row.description}${row.evidence?`\n${row.evidence}`:''}`
export async function runDuplicates(model){
 const {set,metadata}=await loadDuplicates()
 const {embeddingsCall,EMBEDDINGS_ADAPTER_VERSION,DUPLICATE_SUGGESTION_THRESHOLD}=await tsImport('../../src/core/features/ai/embeddings.ts',import.meta.url)
 const lexical=duplicateMetrics(set,query=>lexicalRank(query,set.corpus),1)
 const base={...metadata,inputTemplateVersion:INPUT_TEMPLATE_VERSION,transport:'node-eval-openai-embeddings',lexical:{threshold:1,...lexical,requests:0,inputTokens:0,costMicros:0}}
 if(!model){console.log(JSON.stringify({...base,provider:null,model:null,adapterVersion:EMBEDDINGS_ADAPTER_VERSION,suggestionThreshold:DUPLICATE_SUGGESTION_THRESHOLD,ai001Bars:'not evaluated (lexical-only)',requests:0,inputTokens:0,costMicros:0,passed:true},null,2));return}
 const queries=[...new Set(set.pairs.map(pair=>pair.queryTitle))],inputs=[...set.corpus.map(corpusInput),...queries]
 const transport=evalTransport()
 let result
 try{result=await embeddingsCall({bindings:{PENNY_AI:process.env.PENNY_AI}},{provider:'openai',model,inputs,ceilingMicros:50000,maxInputTokens:500000,transport:transport.send})}
 catch(error){
  console.log(JSON.stringify({...base,provider:'openai',model,adapterVersion:EMBEDDINGS_ADAPTER_VERSION,suggestionThreshold:DUPLICATE_SUGGESTION_THRESHOLD,...transport.usage,ai001Bars:'not evaluated (model run incomplete)',inputTokens:null,costMicros:null,passed:false,error:error.code??'evaluation_failed',reason:error.safeReason??'The embeddings evaluation could not complete.',...(error.status?{httpStatus:error.status}:{}),...(error.classification?{classification:error.classification}:{})},null,2))
  process.exitCode=1;return
 }
 const queryVectors=new Map(queries.map((query,index)=>[query,result.vectors[set.corpus.length+index]]))
 const metrics=duplicateMetrics(set,query=>set.corpus.map((row,index)=>({id:row.id,score:cosine(queryVectors.get(query),result.vectors[index])})).sort((a,b)=>b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0)),DUPLICATE_SUGGESTION_THRESHOLD)
 const bars=qualityBars(metrics,lexical),passed=Object.values(bars).every(bar=>bar.met)
 console.log(JSON.stringify({...base,provider:result.provider,model:result.model,adapterVersion:EMBEDDINGS_ADAPTER_VERSION,suggestionThreshold:DUPLICATE_SUGGESTION_THRESHOLD,...metrics,...transport.usage,inputTokens:result.inputTokens,costMicros:result.costMicros,upperInputTokens:result.upperInputTokens,upperCostMicros:result.upperCostMicros,ai001Bars:bars,passed},null,2))
 if(!passed)process.exitCode=1
}
