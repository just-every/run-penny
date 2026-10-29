import {VoteImportanceBreakdown} from './vote-importance-breakdown'
import {Link} from '@tanstack/react-router'
import {dataLabelClass,disclosureSummaryClass,textLinkClass} from '@/core/ui/app/classes'
import type {RequestVoter} from './request-supporters'

export interface RequestDemandContext {
 importanceLabels:readonly string[]
 demand:{voteCount:number;evidenceCount:number;accountCount:number}
 accounts:{id:string;slug:string;name:string}[]
 votesByAccount:{accountId:string;slug:string;name:string;voteCount:number}[]
 voters:RequestVoter[]
}

export function RequestDemand({context}:{context:RequestDemandContext}){
 const votes=new Map(context.votesByAccount.map(account=>[account.accountId,account.voteCount]))
 const unlinked=new Set(context.voters.filter(voter=>!voter.accountId).map(voter=>voter.id)).size
 return <section className="mt-5 border-t border-penny-line pt-5" aria-label="Customer demand">
  <h3 className="font-bold text-penny-ink">Customer demand</h3><a href="/api/operator/votes/export.csv" className={`${textLinkClass} inline-flex min-h-11 items-center text-sm`}>Export individual votes (CSV)</a>
  <dl className="mt-3 grid grid-cols-3 gap-3" aria-label="Demand figures">
   {([['Votes',context.demand.voteCount],['Linked evidence',context.demand.evidenceCount],['Distinct accounts',context.demand.accountCount]] as const).map(([label,value])=><div key={label}><dt className={dataLabelClass}>{label}</dt><dd className="mt-1 text-xl font-bold text-penny-ink tabular-nums">{value}</dd></div>)}
  </dl>
  <p className="mt-3 text-sm leading-6 text-penny-muted">Each person counts once. Accounts include those linked through voters or evidence; each account counts once.</p>
  {context.accounts.length||unlinked?<details className="group mt-3"><summary className={disclosureSummaryClass}>Votes by account</summary><ul className="divide-y divide-penny-line text-sm" aria-label="Votes by account">{context.accounts.map(account=><li key={account.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"><Link to="/app/accounts/$accountSlug" params={{accountSlug:account.slug}} className={`${textLinkClass} inline-flex min-h-11 min-w-0 items-center break-words`}>{account.name}</Link><span className="text-penny-muted tabular-nums">{votes.get(account.id)??0} {votes.get(account.id)===1?'vote':'votes'}</span></li>)}{unlinked?<li className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-2 text-penny-muted"><span>No linked account</span><span className="tabular-nums">{unlinked} {unlinked===1?'vote':'votes'}</span></li>:null}</ul><p className="mt-2 text-sm leading-6 text-penny-muted">A voter linked to several accounts appears in each account’s breakdown.</p></details>:null}
 <VoteImportanceBreakdown voters={context.voters} labels={context.importanceLabels}/>
 </section>
}
