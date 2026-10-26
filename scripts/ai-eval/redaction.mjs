import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {detect,kinds,defaultRules} from '../../src/core/features/redaction/engine.ts'
import {measure} from './metrics.mjs'
const bytes=await readFile(new URL('../../tests/fixtures/ai/redaction-v1/cases.json',import.meta.url)),set=JSON.parse(bytes)
if(typeof set.version!=='string'||!Array.isArray(set.cases)||set.cases.length<200)throw Error('Invalid redaction set')
const ids=new Set()
for(const row of set.cases){if(ids.has(row.id)||typeof row.text!=='string'||!Array.isArray(row.spans))throw Error('Invalid excerpt');ids.add(row.id);for(const span of row.spans)if(!kinds.includes(span.kind)||!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<=span.start||span.end>row.text.length)throw Error('Invalid sensitive span')}
const scores=measure(set.cases,text=>detect(text,{...defaultRules,enabled:true}),kinds)
const failed=Object.entries(scores.byKind).filter(([kind,score])=>score.precision<0.90||score.recall<(['ssn','card'].includes(kind)?0.99:0.95)).map(([kind])=>kind)
console.log(JSON.stringify({set:'redaction-v1',version:set.version,sha256:createHash('sha256').update(bytes).digest('hex'),excerpts:set.cases.length,labeledSpans:set.cases.reduce((n,row)=>n+row.spans.length,0),...scores,passed:!failed.length,failed},null,2))
if(failed.length)process.exitCode=1
