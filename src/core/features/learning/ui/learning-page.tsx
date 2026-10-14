import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure,OperatorResourceLoading,OperatorResourceNotFound,OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { LoopForm } from '@/core/app/ui/loop-form'
import { LearningTabs, LearningPanel, type LearningTab } from './learning-tabs'
import { LearningCapture } from './learning-capture'
import { LearningArtifact,DecisionCard } from './learning-artifact'
import { InvestigationControls } from './learning-detail'
import { LearningResults } from './learning-results'
import { api,money,learningReason,type LearningHome } from './types'
import './learning.css'
export function LearningPage() {
 const [state,retry]=useOperatorResource<LearningHome>(api),search=useSearch({from:'/app/learning'}),navigate=useNavigate({from:'/app/learning'})
 const tab=search.tab??'learning',home=state.kind==='ready'?state.data:null
 const investigation=home?.investigations.find(i=>i.id===search.investigation)??home?.investigations[0]
 useEffect(()=>{
  if(home&&search.investigation!==investigation?.id)void navigate({search:previous=>({...previous,investigation:investigation?.id}),replace:true,resetScroll:false})
 },[home,search.investigation,investigation?.id,navigate])
 const selectTab=(selected:LearningTab)=>{void navigate({search:previous=>({...previous,tab:selected,investigation:investigation?.id}),hash:'',resetScroll:false})}
 if(state.kind==='loading')return <OperatorResourceLoading label="Loading learning workspace…"/>
 if(state.kind==='session_expired')return <OperatorSessionExpired/>
 if(state.kind==='not_found')return <OperatorResourceNotFound title="Learning workspace unavailable">This installation does not have a learning workspace.</OperatorResourceNotFound>
 if(state.kind==='error')return <OperatorResourceFailure title="Could not load learning." onRetry={retry} status={state.status}/>
 if(!home)return null
 const artifact=[...home.needsYou,...home.learning].find(a=>a.investigationId===investigation?.id),attention=home.needsYou.find(a=>a.investigationId===investigation?.id)
 return <div className="penny-learning"><div className="workspace"><header className="intro"><div><p className="eyebrow">PRODUCT LEAD WORKSPACE</p><h1>{investigation?.question.trim()||artifact?.body.question||'Turn customer evidence into a decision.'}</h1><p className="subtitle">Understand what is happening, compare ways to help, and learn what changed.</p></div><section className="control-panel" aria-label="Learning controls"><div className="selectors"><div className="selector"><span className="small-label">SCOPE</span><span className="value">{investigation?.purpose??'No active investigation'}</span></div><div className="selector"><span className="small-label">USED OR RESERVED / GRANT</span><span className="value">{investigation?`${money(investigation.spentMicros)} / ${money(investigation.budgetMicros)}`:'No spend authorized'}</span></div></div><div className="control-actions"><LoopForm frame="hidden" title="Pause all learning" action={`${api}/control`} submit="Pause all" onSaved={retry} transform={()=>({action:'pause'})} disabled={!home.investigations.length}><span className="sr-only">Stops checks across every investigation.</span></LoopForm><a href="#capture-heading">Sources and permission</a><button type="button" onClick={retry}>Refresh learning</button></div></section></header>
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
