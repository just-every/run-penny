export function measure(cases,detect,kinds){
 const totals=Object.fromEntries(kinds.map(kind=>[kind,{tp:0,fp:0,fn:0,tn:0}]))
 for(const row of cases){const predictions=detect(row.text)
  for(const kind of kinds){const labels=row.spans.filter(span=>span.kind===kind),found=predictions.filter(span=>span.kind===kind),same=(a,b)=>a.start===b.start&&a.end===b.end
   const tp=found.filter(span=>labels.some(label=>same(span,label))).length,score=totals[kind]
   score.tp+=tp;score.fp+=found.length-tp;score.fn+=labels.length-tp;if(!labels.length&&!found.length)score.tn++
  }
 }
 const metrics=score=>({...score,precision:score.tp+score.fp?score.tp/(score.tp+score.fp):1,recall:score.tp+score.fn?score.tp/(score.tp+score.fn):1,f1:2*score.tp+score.fp+score.fn?2*score.tp/(2*score.tp+score.fp+score.fn):1})
 return {byKind:Object.fromEntries(Object.entries(totals).map(([kind,score])=>[kind,metrics(score)])),micro:metrics(Object.values(totals).reduce((sum,row)=>Object.fromEntries(Object.keys(sum).map(key=>[key,sum[key]+row[key]])),{tp:0,fp:0,fn:0,tn:0}))}
}
