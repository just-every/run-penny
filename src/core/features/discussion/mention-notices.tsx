import { useEffect,useState } from 'react'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../requests/ui/operator-client'
interface Notice {noteId:string;requestId:string;slug:string;title:string;author:string;body:string;kind:'mention'|'publication';href:string|null}
export function MentionNotices(){
 const [notices,setNotices]=useState<Notice[]>([]),[error,setError]=useState('')
 async function load(){const response=await fetch('/api/operator/discussion/mentions');if(!response.ok)throw new Error('Mentions unavailable.');setNotices(((await response.json()) as {mentions:Notice[]}).mentions)}
 useEffect(()=>{void load().catch(reason=>setError(reason.message))},[])
 return <section aria-label="Your mentions" className="my-4 rounded-xl border border-penny-line p-4"><h2 className="font-bold text-penny-ink">Your mentions</h2>{notices.length?<ul className="divide-y divide-penny-line">{notices.map(notice=><li key={notice.noteId} className="space-y-2 py-3"><p>{notice.kind==='publication'?'Scheduled publication needs your attention:':`${notice.author} mentioned you on`} <a className="underline" href={notice.href??`/app/moderation?item=${encodeURIComponent(notice.requestId)}#note-${encodeURIComponent(notice.noteId)}`}>{notice.title}</a></p><p className="whitespace-pre-wrap break-words">{notice.body}</p><button className={secondaryButtonClass} onClick={()=>void operatorMutation(`/api/operator/discussion/mentions/${notice.noteId}/dismiss`,{}).then(load).catch(reason=>setError(reason.message))}>{notice.kind==='publication'?'Dismiss notice':'Dismiss mention'}</button></li>)}</ul>:<p className="text-sm text-penny-muted">No new mentions.</p>}{error?<p role="alert">{error}</p>:null}</section>
}
