import {useEffect,useState} from 'react'
import {PageTitle} from '@/core/ui/app/PageTitle'
import {disclosureSummaryClass,fieldLabelClass,inputClass,primaryButtonClass,textLinkClass} from '@/core/ui/app/classes'
import {operatorMutation} from '../../requests/ui/operator-client'
import type {Answer} from '../ask/answers'
interface Destinations {destinations:{id:string;name:string}[];available:boolean}
/** The 12ui single-column question → answer → records → folded share layout. */
export function AskPanel({answerId}:{answerId?:string}){
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState<Answer|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[targets,setTargets]=useState<Destinations|null>(null),[chosen,setChosen]=useState(''),[postState,setPostState]=useState('')
 useEffect(()=>{
  let active=true
  async function load(){try{
   const response=await fetch('/api/operator/ai/ask/destinations');if(!response.ok)throw Error('Slack destinations could not be loaded.')
   const data=await response.json() as Destinations;if(active)setTargets(data)
   if(answerId){const r=await fetch('/api/operator/ai/ask/'+encodeURIComponent(answerId));if(!r.ok)throw Error('This answer is unavailable. Ask a new question.');const a=await r.json() as Answer;if(active){setAnswer(a);setQuestion(a.question)}}
  }catch(error){if(active)setMessage(error instanceof Error?error.message:'Ask Penny is unavailable.')}}
  void load();return ()=>{active=false}
 },[answerId])
 async function generate(){setBusy(true);setMessage('');setAnswer(null);setPostState('');setChosen('');try{
  const result=await operatorMutation('/api/operator/ai/ask',{question}) as Answer;setAnswer(result)
  window.history.replaceState(null,'','/app/ask?answer='+encodeURIComponent(result.id))
 }catch(error){setMessage(error instanceof Error?error.message:'An answer is unavailable.')}finally{setBusy(false)}}
 async function post(){if(!answer||!chosen)return;setBusy(true);setMessage('');try{
  const result=await operatorMutation(`/api/operator/ai/ask/${answer.id}/slack`,{destinationId:chosen}) as {state:string;destinationName:string}
  setPostState(result.state==='accepted'?`Posted to ${result.destinationName}.`:result.state==='uncertain'||result.state==='sending'?`Delivery to ${result.destinationName} is uncertain. Check Slack before taking further action; Penny will not resend this answer.`:`Slack did not accept this answer (${result.state}). Nothing else was posted.`)
 }catch(error){setMessage(error instanceof Error?error.message:'Slack could not receive this answer.')}finally{setBusy(false)}}
 return <section aria-label="Ask Penny" className="min-w-0 bg-white py-5 sm:py-8">
  <div className="mx-auto max-w-4xl space-y-7">
   <header><PageTitle size="app" eyebrow="Your customer evidence">Ask Penny</PageTitle><p className="mt-4 max-w-2xl text-lg leading-7 text-penny-soft">Ask a question. Follow the evidence behind the answer.</p></header>
   <form aria-label="Ask a question" className="space-y-3" onSubmit={e=>{e.preventDefault();void generate()}}>
    <label className={fieldLabelClass}>Your question<textarea className={`${inputClass} mt-2 min-h-28`} maxLength={2000} required minLength={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What are Enterprise accounts saying about SSO this quarter?" /></label>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-penny-muted">Private to you. Uses records your role can access.</p><button className={primaryButtonClass} disabled={busy||question.trim().length<3}>{busy?'Working…':'Ask Penny'}</button></div>
   </form>
   {message?<p role="alert" className="rounded-lg border border-penny-line bg-penny-paper p-4 text-base">{message}</p>:null}
   {answer?<>
    <article aria-label="Penny’s answer" className="min-w-0 rounded-xl border border-penny-line p-5 sm:p-6">
     <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-bold text-penny-ink">Penny’s answer</h2><p className="text-sm text-penny-muted">Metered cost: ${(answer.costMicros/1000000).toFixed(6)}</p></div>
     <div className="my-5 space-y-4 text-base leading-7">{answer.paragraphs.map((p,index)=><div key={index}><p className="whitespace-pre-wrap break-words">{p.text}</p>{p.citationIds.length?<p className="mt-1 flex flex-wrap gap-x-3 text-sm">{p.citationIds.map(id=>{const citation=answer.citations.find(c=>c.id===id);return citation?<a key={id} href={citation.href} className={`${textLinkClass} inline-flex min-h-11 items-center`}>{citation.label} {answer.citations.indexOf(citation)+1}</a>:null})}</p>:null}</div>)}</div>
     <div className="space-y-2">{answer.notices.map(n=><p role="status" key={n} className="rounded-lg bg-penny-paper p-3 text-sm leading-6">{n}</p>)}</div>
     <h3 className="mt-6 text-base font-bold">Verified supporting records</h3>
     <ol className="mt-2 divide-y divide-penny-line">{answer.citations.map((c,index)=><li key={c.id}><a className={`${textLinkClass} flex min-h-12 items-center py-2 text-base`} href={c.href}>{c.label} {index+1}</a></li>)}</ol>
    </article>
    <details className="group rounded-xl border border-penny-line px-5 py-3"><summary className={disclosureSummaryClass}>Share to Slack</summary><div className="space-y-4 py-3">
     <p className="text-base leading-6">This answer may contain private customer evidence. Choose the audience before posting.</p>
     {targets?.available&&targets.destinations.length?<><label className={fieldLabelClass}>Slack destination<select className={`${inputClass} mt-2`} value={chosen} onChange={e=>setChosen(e.target.value)} disabled={!!postState}><option value="">Choose a destination</option>{targets.destinations.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" className={primaryButtonClass} disabled={busy||!chosen||!!postState} onClick={()=>void post()}>Post answer to Slack</button></>:<p className="text-base">Add a Slack destination and delivery transport in <a className={textLinkClass} href="/app/settings">Settings</a> to post this answer.</p>}
     {postState?<p role="status" className="text-base font-semibold">{postState}</p>:null}
    </div></details>
   </>:<p className="border-t border-penny-line pt-6 text-base leading-7 text-penny-muted">Start with a customer need, a request or an account. Penny searches your stored evidence and shows the records that support its answer.</p>}
  </div>
 </section>
}
