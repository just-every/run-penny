import { dataLabelClass } from '@/core/ui/app/classes'
import type { RequestVoter } from './request-supporters'
export function VoteImportanceBreakdown({voters,labels}:{voters:readonly RequestVoter[];labels:readonly string[]}){
 const people=new Map(voters.map(voter=>[voter.id,voter.importance??null])),counts=new Map<number|null,number>()
 for(const importance of people.values())counts.set(importance,(counts.get(importance)??0)+1)
 const levels=[...new Set([...labels.map((_,index)=>index+1),...[...counts.keys()].filter((value):value is number=>value!==null)])].sort()
 return <section className="mt-4 border-t border-penny-line pt-4" aria-label="Vote importance breakdown"><h4 className="font-bold text-penny-ink">Importance</h4><dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
 {[...levels,null].map(level=><div key={level??'none'}><dt className={dataLabelClass}>{level===null?'Not specified':labels[level-1]??`Previous level ${level}`}</dt><dd className="mt-1 text-lg font-bold tabular-nums">{counts.get(level)??0}</dd></div>)}
 </dl><p className="mt-2 text-sm leading-6 text-penny-muted">Each customer counts once, including proxy votes. Importance never changes public vote totals.</p></section>
}
