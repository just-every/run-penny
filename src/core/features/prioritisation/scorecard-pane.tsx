import {useRef,useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {Link} from '@tanstack/react-router'
import {OperatorResourceFailure,OperatorResourceLoading,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {WorkspaceLink} from '../workspace/ui/workspace-link'
import {roundMutation,roundMutationFailure,type RoundMutationFailure} from '../requests/ui/round-mutation'
import {fieldClass} from '../auth/client-mutations'
import {paperCardClass,disclosureSummaryClass,primaryButtonClass,secondaryButtonClass,textLinkClass} from '@/core/ui/app/classes'
import type {ScorecardResult} from './scorecards'
import type {ScorecardList} from './scorecard-editor'
export function Scorecards(){
 const [list,reload]=useOperatorResource<ScorecardList>('/api/operator/scorecards'),[selected,setSelected]=useState('')
 if(list.kind==='loading')return <OperatorResourceLoading label="Loading scorecards…"/>
 if(list.kind==='session_expired')return <OperatorSessionExpired/>
 if(list.kind!=='ready')return <OperatorResourceFailure title="Could not load scorecards." onRetry={reload}/>
 const id=selected||list.data.cards[0]?.id
 return <section className={`${paperCardClass} p-5`} aria-label="Scorecards"><h2 className="text-xl font-bold">Scorecards</h2>{list.data.canConfigure?<WorkspaceLink className={`${textLinkClass} inline-flex min-h-11 items-center text-sm`} href="/app/settings#settings-scorecards">Manage scorecards in Settings</WorkspaceLink>:null}{list.data.cards.length?<><label className="mt-3 block text-sm font-semibold">Scorecard<select aria-label="Scorecard" className={fieldClass} value={id} onChange={e=>setSelected(e.target.value)}>{list.data.cards.map(card=><option key={card.id} value={card.id}>{card.name}</option>)}</select></label><ScorecardDetail key={id} id={id} scorerId={list.data.scorerId}/></>:<p className="mt-3">No scorecards yet.</p>}</section>
}
function ScorecardDetail({id,scorerId}:{id:string;scorerId:string}){
 const [resource,reload,request]=useOperatorResource<ScorecardResult>('/api/operator/scorecards/'+id),[limit,setLimit]=useState(25)
 const [drafts,setDrafts]=useState<Record<string,ScoreDraft>>({}),[opened,setOpened]=useState<string[]>([])
 if(resource.kind==='loading')return <OperatorResourceLoading label="Loading scored ideas…"/>
 if(resource.kind==='session_expired')return <OperatorSessionExpired/>
 if(resource.kind!=='ready')return <OperatorResourceFailure title="Could not load scored ideas." onRetry={reload}/>
 const card=resource.data
 return <div className="mt-5 space-y-5">{card.versions.map(version=><section key={version.version} aria-label={`Criteria version ${version.version}`}><h3 className="text-lg font-bold">Criteria version {version.version}{version.version===card.revision?' · Current':''}</h3><p className="mt-2 break-words text-sm text-penny-muted">{version.criteria.map(c=>`${c.name}: 1–${c.scale}, weight ${c.weight}`).join(' · ')}</p><ol className="mt-4 space-y-3" aria-label={`Scorecard ranking version ${version.version}`}>{version.ideas.filter(idea=>version.version===card.revision||idea.score!==null).slice(0,limit).map((idea,index)=><li key={idea.id} data-score-state={idea.score===null?'unscored':'scored'} data-weighted-result={idea.score??undefined} className="min-w-0 rounded-lg border border-penny-line p-4"><h4 className="break-words text-base font-bold">{index+1}. {idea.title}</h4><p className="mt-2 text-sm font-semibold">{idea.score===null?'Unscored':`Mean of ${idea.scorers.length} ${idea.scorers.length===1?'scorer':'scorers'}: ${Number(idea.score.toFixed(2))}`}</p><ul className="mt-3 space-y-3" aria-label="Scorer inputs">{idea.scorers.map((scorer,index)=><li key={index} className="break-words text-sm"><strong>{scorer.name}</strong> · {version.criteria.map((c,i)=>`${c.name} ${scorer.values[i]} × ${c.weight}`).join(' + ')} · Weighted result {Number(scorer.weighted.toFixed(4))}</li>)}</ul>{version.version===card.revision?<details className="mt-3" open={opened.includes(idea.id)} onToggle={e=>{const open=e.currentTarget.open;setOpened(ids=>open?[...new Set([...ids,idea.id])]:ids.filter(id=>id!==idea.id))}}><summary className={disclosureSummaryClass}>Score this idea</summary><ScoreForm key={card.revision+':'+idea.id} id={id} scorerId={scorerId} ideaId={idea.id} version={version} values={idea.scorers.find(s=>s.own)?.values} draft={drafts[idea.id]} onDraft={draft=>setDrafts(drafts=>({...drafts,[idea.id]:draft}))} reloading={request.pending} onReload={reload} onSaved={reload}/></details>:null}</li>)}</ol>{limit<version.ideas.filter(idea=>version.version===card.revision||idea.score!==null).length?<button className="mt-3 min-h-11 underline" type="button" onClick={()=>setLimit(n=>n+25)}>Show more scored ideas</button>:null}</section>)}</div>
}
type CriteriaVersion=ScorecardResult['versions'][number]
interface ScoreDraft {criteria:CriteriaVersion['criteria'];values:string[]}
function ScoreForm({id,scorerId,ideaId,version,values,draft,onDraft,reloading,onReload,onSaved}:{id:string;scorerId:string;ideaId:string;version:CriteriaVersion;values?:number[];draft?:ScoreDraft;onDraft:(draft:ScoreDraft)=>void;reloading:boolean;onReload:()=>void;onSaved:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState<RoundMutationFailure|null>(null),writing=useRef(false)
 // Keep only criteria with the same position, name and scale across versions.
 const inputs=version.criteria.map((criterion,index)=>draft?(draft.criteria[index]?.name===criterion.name&&draft.criteria[index]?.scale===criterion.scale?draft.values[index]??'':''):String(values?.[index]??''))
 return <form aria-label="Score idea" className="mt-3 space-y-3" onSubmit={async e=>{
  e.preventDefault();if(writing.current||reloading)return;writing.current=true;const form=new FormData(e.currentTarget);setBusy(true);setMessage('');setFailure(null)
  try{await roundMutation(`/api/operator/scorecards/${id}/scores/${scorerId}`,{ideaId,version:version.version,values:version.criteria.map((_,i)=>Number(form.get('criterion-'+i)))},'PUT');setMessage('Saved');onSaved()}catch(error){setFailure(roundMutationFailure(error,"Couldn't save your scores."))}finally{writing.current=false;setBusy(false)}
 }}>{version.criteria.map((criterion,index)=><label key={index} className="block text-sm font-semibold">{criterion.name} (1–{criterion.scale})<input className={fieldClass} type="number" required name={'criterion-'+index} min={1} max={criterion.scale} step={1} value={inputs[index]} onChange={e=>onDraft({criteria:version.criteria,values:inputs.map((value,i)=>i===index?e.target.value:value)})}/></label>)}<button className={primaryButtonClass} disabled={busy||reloading}>Save my scores</button>{message?<p role="status" className="text-sm">{message}</p>:null}{failure?<div className="text-sm"><p role="alert">{failure.message}</p>{failure.action==='retry'?<button className={`${secondaryButtonClass} mt-2`} disabled={busy}>Retry</button>:failure.action==='reload'?<button type="button" className={`${secondaryButtonClass} mt-2`} disabled={reloading} onClick={onReload}>Reload</button>:failure.action==='sign_in'?<Link to="/signin" className={`${secondaryButtonClass} mt-2`}>Sign in now</Link>:null}</div>:null}</form>
}
