import { useCallback, useSyncExternalStore } from 'react'
import { LoopForm } from '@/core/app/ui/loop-form'
import { api,money,type Investigation,type Source,type Artifact } from './types'

export function LearningHeader({investigation,source,artifact,hasActive,pending,onSaved,onRefresh,onCorrect,onDisconnect,refreshStatus}:{investigation?:Investigation;source?:Source;artifact?:Artifact;hasActive:boolean;pending:boolean;onSaved:()=>void;onRefresh:()=>void;onCorrect:()=>void;onDisconnect:()=>void;refreshStatus:string}) {
 const deadline=Date.parse(investigation?.expiresAt??'')
 const subscribe=useCallback((changed:()=>void)=>{
  let timer:number|undefined
  const check=()=>{const remaining=deadline-Date.now();if(remaining>0)timer=window.setTimeout(check,Math.min(remaining,2147483647));else changed()}
  check();return()=>window.clearTimeout(timer)
 },[deadline])
 const expired=useSyncExternalStore(subscribe,useCallback(()=>Date.now()>=deadline,[deadline]),()=>false)
 const resume=investigation?.state==='paused',action=resume?'resume':'pause'
 const unavailable=!investigation||['revoked','held'].includes(investigation.state)
 const cannotResume=resume&&(source?.state!=='active'||expired||investigation.spentMicros+investigation.maxRunCostMicros>investigation.budgetMicros)
 return <header className="intro"><div><p className="eyebrow">PRODUCT LEAD WORKSPACE</p><h1>{investigation?.question.trim()||artifact?.body.question||'Turn customer evidence into a decision.'}</h1><p className="subtitle">Understand what is happening, compare ways to help, and learn what changed.</p></div>
 <section className="control-panel" aria-label="Learning controls"><div className="selectors"><div className="selector"><span className="small-label">SCOPE</span><span className="value">{investigation?.purpose??'No active investigation'}</span></div><div className="selector"><span className="small-label">USED OR RESERVED / GRANT</span><span className="value">{investigation?`${money(investigation.spentMicros)} / ${money(investigation.budgetMicros)}`:'No spend authorized'}</span></div></div>
 <div className="selected-controls" aria-label="Selected investigation controls">
 <LoopForm key={`${investigation?.id}-${action}`} frame="hidden" title={`${action} investigation`} action={`${api}/investigations/${investigation?.id}/control`} submit={resume?'Resume':'Pause'} onSaved={onSaved} transform={()=>({action})} disabled={pending||unavailable||cannotResume}><span className="sr-only">Applies to the selected investigation. Held, expired or exhausted grants require new authority before resuming.</span></LoopForm>
 <button type="button" onClick={onDisconnect} disabled={pending||!source||source.state!=='active'} title="Open this source's permissions and review disconnect effects">Disconnect</button>
 <LoopForm key={investigation?.id} frame="hidden" title="revoke investigation" action={`${api}/investigations/${investigation?.id}/control`} submit="Revoke grant" onSaved={onSaved} transform={()=>({action:'revoke'})} disabled={pending||!investigation||investigation.state==='revoked'}><span className="sr-only">Revokes the selected investigation and removes its copied observations, runs and derived history.</span></LoopForm>
 <button type="button" onClick={onCorrect} disabled={pending||!artifact} title="Open a correction for this investigation's current interpretation">Correct</button></div>
 <a className="permission-link" href="#capture-heading">Sources and permission</a>
 <div className="utility-controls"><LoopForm frame="hidden" title="Pause all learning" action={`${api}/control`} submit="Pause all" onSaved={onSaved} transform={()=>({action:'pause'})} disabled={pending||!hasActive}><span className="sr-only">Stops checks across every active investigation.</span></LoopForm><button type="button" onClick={onRefresh} disabled={pending}>Refresh learning</button></div>
 <p className="refresh-status" role="status" aria-live="polite">{refreshStatus}</p></section></header>
}
