import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {detect,kinds,defaultRules} from '../../src/core/features/redaction/engine.ts'
import {measure} from './metrics.mjs'
const args=process.argv.slice(2).filter(value=>value!=='--')
const options=new Map()
for(let index=0;index<args.length;index+=2){
 const key=args[index],value=args[index+1]
 if(!['--set','--output','--corpus'].includes(key)||!value||value.startsWith('--')||options.has(key))throw Error('Use --set redaction-v1 or duplicates-v1, optionally --output PATH and --corpus PATH for duplicates')
 options.set(key,value)
}
const selected=options.get('--set')
if(!['redaction-v1','duplicates-v1'].includes(selected)||selected==='redaction-v1'&&options.has('--corpus'))throw Error('Choose --set redaction-v1 or duplicates-v1. Other AI-011 sets are not implemented.')
async function report(value){
 const output=JSON.stringify(value,null,2)+'\n'
 if(options.has('--output'))await writeFile(options.get('--output'),output)
 process.stdout.write(output)
}
if(selected==='duplicates-v1'){
 const {duplicateCorpus,evaluateDuplicates}=await import('./duplicates.mjs')
 const corpus=await duplicateCorpus(options.get('--corpus')??new URL('../../tests/fixtures/ai/duplicates-v1/cases.json',import.meta.url))
 const {lexicalRuntime}=await import('./lexical-runtime.mjs')
 const runtime=await lexicalRuntime()
 try{await report(await evaluateDuplicates(corpus,runtime))}finally{await runtime.close()}
}else{
const bytes=await readFile(new URL('../../tests/fixtures/ai/redaction-v1/cases.json',import.meta.url)),set=JSON.parse(bytes)
if(typeof set.version!=='string'||!Array.isArray(set.cases)||set.cases.length<200)throw Error('Invalid redaction set')
const ids=new Set()
for(const row of set.cases){if(ids.has(row.id)||typeof row.text!=='string'||!Array.isArray(row.spans))throw Error('Invalid excerpt');ids.add(row.id);for(const span of row.spans)if(!kinds.includes(span.kind)||!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<=span.start||span.end>row.text.length)throw Error('Invalid sensitive span')}
const scores=measure(set.cases,text=>detect(text,{...defaultRules,enabled:true}),kinds)
const failed=Object.entries(scores.byKind).filter(([kind,score])=>score.precision<0.90||score.recall<(['ssn','card'].includes(kind)?0.99:0.95)).map(([kind])=>kind)
await report({set:'redaction-v1',version:set.version,sha256:createHash('sha256').update(bytes).digest('hex'),excerpts:set.cases.length,labeledSpans:set.cases.reduce((n,row)=>n+row.spans.length,0),...scores,passed:!failed.length,failed})
if(failed.length)process.exitCode=1
}
