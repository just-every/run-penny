import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure,OperatorResourceLoading,OperatorResourceNotFound,OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { LearningHeader } from './learning-header'
import { LearningTabs, LearningPanel, type LearningTab } from './learning-tabs'
import { LearningCapture } from './learning-capture'
import { LearningArtifact,DecisionCard } from './learning-artifact'
import { InvestigationControls } from './learning-detail'
import { LearningResults } from './learning-results'
import { api,learningReason,type LearningHome } from './types'
import './learning.css'
export function LearningPage() {
 const [state,retry,request]=useOperatorResource<LearningHome>(api),search=useSearch({from:'/app/learning'}),navigate=useNavigate({from:'/app/learning'})
 const [refreshAttempt,setRefreshAttempt]=useState<number|null>(null),[target,setTarget]=useState<{investigationId:string;id:string;kind:'correct'|'source'}|null>(null)
 const handledTarget=useRef<typeof target>(null)
 const tab=search.tab??'learning',home=state.kind==='ready'?state.data:null
 const investigation=home?.investigations.find(i=>i.id===search.investigation)??home?.investigations[0]
 useEffect(()=>{
  if(home&&search.investigation!==investigation?.id)void navigate({search:previous=>({...previous,investigation:investigation?.id}),replace:true,resetScroll:false})
 },[home,search.investigation,investigation?.id,navigate])
 const artifact=[...home?.needsYou??[],...home?.learning??[]].find(a=>a.investigationId===investigation?.id),attention=home?.needsYou.find(a=>a.investigationId===investigation?.id)
 useEffect(()=>{
  if(!target||handledTarget.current===target)return
  if(target.investigationId!==investigation?.id){handledTarget.current=target;return}
  if(target.kind==='correct'&&tab!=='learning')return
  const element=document.getElementById(target.id)
  if(!element)return
  for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true
  const focus=element.querySelector<HTMLElement>(target.kind==='correct'?'textarea':'h3')??element
  focus.focus({preventScroll:true});focus.scrollIntoView({block:'center'});handledTarget.current=target
 },[target,investigation?.id,tab,artifact?.id])
 const refresh=()=>{setRefreshAttempt(request.attempt+1);retry()}
 const selectTab=(selected:LearningTab)=>{void navigate({search:previous=>({...previous,tab:selected,investigation:investigation?.id}),hash:'',resetScroll:false})}
 if(state.kind==='loading')return <OperatorResourceLoading label="Loading learning workspace…"/>
 if(state.kind==='session_expired')return <OperatorSessionExpired/>
 if(state.kind==='not_found')return <OperatorResourceNotFound title="Learning workspace unavailable">This installation does not have a learning workspace.</OperatorResourceNotFound>
 if(state.kind==='error')return <OperatorResourceFailure title={refreshAttempt===null?"Could not load learning.":"Could not refresh learning."} onRetry={refresh} status={state.status}/>
 if(!home)return null
 const source=home.sources.find(s=>s.id===investigation?.sourceId)
 const correct=()=>{if(investigation&&artifact){setTarget({investigationId:investigation.id,id:`learning-correction-${artifact.id}`,kind:'correct'});selectTab('learning')}}
 const disconnect=()=>{if(investigation&&source)setTarget({investigationId:investigation.id,id:`learning-source-${source.id}`,kind:'source'})}
 return <div className="penny-learning"><div className="workspace"><LearningHeader investigation={investigation} source={source} artifact={artifact} hasActive={home.investigations.some(i=>i.state==='active')} pending={request.pending} onSaved={retry} onRefresh={refresh} onCorrect={correct} onDisconnect={disconnect} refreshStatus={refreshAttempt===request.attempt?(request.pending?'Refreshing learning…':'Learning refreshed. No model check was run.'):''}/>

 {home.investigations.length>1?<label className="block mt-6"><span id="learning-investigation-label">Investigation</span><select aria-labelledby="learning-investigation-label" className="block w-full p-3" value={investigation?.id} onChange={e=>{void navigate({search:previous=>({...previous,investigation:e.target.value}),resetScroll:false})}}>{home.investigations.map(i=><option key={i.id} value={i.id}>{i.question}</option>)}</select></label>:null}
 <div className="learning-sections"><LearningTabs selected={tab} onSelect={selectTab} needsYou={Boolean(attention)}/>
 <LearningPanel id="results" selected={tab}>
 <section className="panel" aria-labelledby="results-heading"><header className="section-head"><span className="small-label">RESULTS</span><h2 id="results-heading">What actually happened</h2></header><LearningResults results={home.results.filter(r=>r.investigationId===investigation?.id)}/></section></LearningPanel>
 <LearningPanel id="learning" selected={tab}>
 <section className="panel" aria-labelledby="learning-heading"><header className="section-head"><span className="small-label">LEARNING</span><h2 id="learning-heading">{artifact?'Current question and next check':'A question starts with permitted evidence'}</h2></header><p className="quiet">{artifact?artifact.body.nextCheck:investigation?learningReason(investigation.lastReason):'Record one original feedback item, then give Penny a bounded purpose. It can propose the question and prepare a useful clarification.'}</p>{artifact?.body.work?<details><summary>Inspect prepared investigation work</summary><h3>{artifact.body.work.method}</h3><p>{artifact.body.work.evidenceObtained}</p><ol>{artifact.body.work.implementationBrief.map((step,i)=><li key={i}>{step}</li>)}</ol><p>{artifact.body.work.decisionImpact}</p><p>Prepared internal work; no contact, publication or production change.</p></details>:null}{investigation?<InvestigationControls key={investigation.id} investigation={investigation} onSaved={retry} sources={home.sources}/>:null}</section>
 {artifact?<LearningArtifact key={artifact.id} artifact={artifact} onSaved={retry}/>:null}
 </LearningPanel>
 <LearningPanel id="needs-you" selected={tab}>{attention?<DecisionCard key={attention.id} artifact={attention} onSaved={retry}/>:<aside className="decision" id="needs-you"><div className="decision-kicker">NEEDS YOU</div><h2>Nothing needs your decision.</h2><p className="decision-intro">Routine checks and unchanged progress stay quiet. A choice or permission boundary appears here when it matters.</p></aside>}</LearningPanel></div>
 <LearningCapture home={home} onSaved={retry}/></div></div>
}
