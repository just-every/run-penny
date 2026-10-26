import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tsImport} from 'tsx/esm/api'
const {lexicalTerms}=await tsImport('../../src/core/features/requests/suggestions.ts',import.meta.url)
export {lexicalTerms}
export const subsets=['paraphrase-positive','lexical-positive','hard-negative','easy-negative']
function invalid(reason){throw Object.assign(Error(reason),{code:'invalid_duplicates_set',safeReason:reason})}
export async function loadDuplicates(){
 const bytes=await readFile(new URL('../../tests/fixtures/ai/duplicates-v1/cases.json',import.meta.url))
 const set=JSON.parse(bytes),ids=new Set(),pairs=new Set(),counts=Object.fromEntries(subsets.map(s=>[s,0]))
 const id=value=>{if(typeof value!=='string'||!/^synthetic-penny-[1-9]\d*$/.test(value)||ids.has(value))invalid('Every record needs a unique synthetic-penny identifier.');ids.add(value)}
 const text=value=>{if(typeof value!=='string'||!value.trim())invalid('Titles and descriptions must be nonempty text.')}
 if(typeof set.version!=='string'||!/^\d+\.\d+\.\d+$/.test(set.version)||!Array.isArray(set.corpus)||!set.corpus.length||!Array.isArray(set.pairs)||set.pairs.length<300)invalid('The set needs a version, corpus and at least 300 labeled pairs.')
 for(const row of set.corpus){id(row.id);text(row.title);text(row.description);if(row.evidence!==undefined)text(row.evidence)}
 const corpus=new Map(set.corpus.map(row=>[row.id,row]))
 for(const pair of set.pairs){
  id(pair.id);text(pair.queryTitle)
  const row=corpus.get(pair.requestId),key=JSON.stringify([pair.queryTitle,pair.requestId])
  if(!row||pairs.has(key)||typeof pair.duplicate!=='boolean'||!subsets.includes(pair.subset))invalid('Pairs need unique query/candidate labels and valid corpus references.')
  pairs.add(key);counts[pair.subset]++
  if(pair.duplicate!==pair.subset.endsWith('positive'))invalid('Subset and duplicate label disagree.')
  const terms=new Set(lexicalTerms(`${row.title}\n${row.description}`)),shared=lexicalTerms(pair.queryTitle).filter(t=>terms.has(t))
  if(pair.subset==='paraphrase-positive'&&shared.length)invalid('A paraphrase positive shares a lexical term with its candidate.')
  if(pair.subset==='lexical-positive'&&!shared.length)invalid('A lexical positive must share a lexical term.')
  if(pair.subset==='hard-negative'&&!shared.some(term=>term.length>=4))invalid('A hard negative must share a key term of at least four characters.')
  if(pair.subset==='easy-negative'&&shared.length)invalid('An easy negative must share no lexical terms.')
 }
 if(Object.values(counts).some(n=>!n)||counts['hard-negative']/set.pairs.length<0.30)invalid('Every subset is required, including at least 30% hard negatives.')
 return {set,metadata:{set:'duplicates-v1',version:set.version,sha256:createHash('sha256').update(bytes).digest('hex'),corpusSize:set.corpus.length,pairs:set.pairs.length,subsets:counts,validator:'valid'}}
}
/** EVID-007 overlap, then slug order. Fixture ids are the corpus slugs. */
export function lexicalRank(query,corpus){
 const terms=lexicalTerms(query)
 return corpus.map(row=>{const words=new Set(lexicalTerms(`${row.title}\n${row.description}`));return {id:row.id,score:terms.filter(t=>words.has(t)).length}})
 .filter(row=>row.score>0).sort((a,b)=>b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0))
}
