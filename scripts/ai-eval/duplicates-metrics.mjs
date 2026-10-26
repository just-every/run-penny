export function duplicateMetrics(set,rank,threshold){
 const rankings=new Map(),score={tp:0,fp:0,fn:0,tn:0}
 let positives=0,topFive=0,paraphrases=0,paraphraseHits=0
 const bySubset={}
 for(const pair of set.pairs){
  if(!rankings.has(pair.queryTitle))rankings.set(pair.queryTitle,rank(pair.queryTitle).filter(row=>row.score>=threshold))
  const ranked=rankings.get(pair.queryTitle),predicted=ranked.some(row=>row.id===pair.requestId)
  const outcome=pair.duplicate?(predicted?'tp':'fn'):(predicted?'fp':'tn')
  score[outcome]++
  const subset=bySubset[pair.subset]??={tp:0,fp:0,fn:0,tn:0,positivePairs:0,topFiveHits:0}
  subset[outcome]++
  if(pair.duplicate){subset.positivePairs++;if(ranked.slice(0,5).some(row=>row.id===pair.requestId))subset.topFiveHits++}
  if(pair.duplicate){positives++;if(ranked.slice(0,5).some(row=>row.id===pair.requestId))topFive++}
  if(pair.subset==='paraphrase-positive'){paraphrases++;if(predicted)paraphraseHits++}
 }
 const precision=score.tp+score.fp?score.tp/(score.tp+score.fp):1,recall=score.tp/(score.tp+score.fn)
 for(const row of Object.values(bySubset)){
  row.precision=row.tp+row.fp?row.tp/(row.tp+row.fp):1
  row.recall=row.tp+row.fn?row.tp/(row.tp+row.fn):1
  row.f1=row.precision+row.recall?2*row.precision*row.recall/(row.precision+row.recall):0
  row.topFiveRate=row.positivePairs?row.topFiveHits/row.positivePairs:null
 }
 return {...score,bySubset,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,topFiveRate:topFive/positives,positivePairs:positives,topFiveHits:topFive,paraphraseRecall:paraphraseHits/paraphrases,paraphrasePairs:paraphrases,paraphraseHits}
}
export function qualityBars(model,lexical){
 const bar=(value,minimum)=>({value,minimum,met:value>=minimum})
 return {precision:bar(model.precision,0.90),recall:bar(model.recall,0.85),topFive:bar(model.topFiveRate,0.90),paraphraseRecall:bar(model.paraphraseRecall,lexical.paraphraseRecall+0.15)}
}
export function cosine(a,b){
 let dot=0,aa=0,bb=0
 for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
 return dot/Math.sqrt(aa*bb)
}
