/* Conversation capability stays in memory; never in cookies or storage. */
const $=id=>document.getElementById(id)
const token=new URLSearchParams(location.hash.slice(1)).get('context');history.replaceState(null,'',location.pathname)
let replyId=null,busy=false
async function action(body){
 if(busy)return
 busy=true;$('error').hidden=true
 try{
  const response=await fetch('/api/integrations/helpscout/action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok)throw Error(data.error==='helpscout_reply_private'?'This reply contains private account details or internal notes. Edit it before sending.':data.error==='helpscout_context_expired'?'This sidebar expired. Reopen the conversation in Help Scout.':data.error==='helpscout_reply_already_attempted'?'This reply was already attempted. Check Help Scout before any further action.':data.error==='helpscout_reply_unknown'?'Delivery is uncertain. Check Help Scout; Penny will not retry.':data.error==='helpscout_capture_not_ready'?'Capture the conversation and refresh when background capture finishes.':data.error==='helpscout_customer_unmapped'?'No active customer email can be mapped for this conversation.':data.error==='helpscout_reply_stale'?'The public status changed. Refresh and review the new draft.':'Penny refused this action. Refresh the sidebar or ask the owner to check its settings.')
  return data
 }catch(error){$('error').textContent=error.message;$('error').hidden=false}finally{busy=false}
}
async function refresh(){
 const data=await action({action:'view'});if(!data)return
 $('conversation').textContent='Help Scout conversation '+data.conversationId
 $('notice').textContent=data.capture?'Capture: '+data.capture.state+' · Source: '+data.capture.sourceState+(data.capture.failure?' · '+(data.capture.failure==='source_removed'?'The source is no longer available.':data.capture.failure==='scope_changed'?'The selected capture scope changed.':data.capture.failure):''):'Not captured yet.'
 $('linked').textContent=data.linked?data.linked.title+' · '+data.linked.status.replaceAll('_',' '):'No published request linked.'
 const draft=data.replies[0];replyId=draft?.id??null;$('reply-text').value=draft?.body??'';$('reply-review').checked=false
 $('reply-state').textContent=!draft?'No reply prepared for the current public status.':draft.state==='unknown'?'Delivery is uncertain. Check this conversation in Help Scout and reconcile it there. Penny will not retry this reply.':draft.state==='sending'?'Delivery is in progress or awaiting confirmation. Check Help Scout before taking further action; Penny will not resend this reply.':draft.state==='sent'?'Reply sent. This reply cannot be sent again.':draft.state==='held'?'Reply held. Ask the owner to review source access, restored work or private wording in Penny before any further action.':'Draft ready for review. Nothing has been sent.'
 $('reply-warning').textContent=data.deliveryUncertain&&!['unknown','sending'].includes(draft?.state)?'An earlier reply still has uncertain delivery. Check this conversation in Help Scout and reconcile it there before sending another update. Penny will not retry the earlier reply.':''
 $('send').disabled=!draft||draft.state!=='draft'
}
$('refresh').onclick=refresh
$('capture').onclick=async()=>{if(await action({action:'capture'}))await refresh()}
$('search').onsubmit=async event=>{event.preventDefault();const data=await action({action:'search',query:$('query').value});if(!data)return;$('requests').replaceChildren(new Option('Choose a request',''),...data.requests.map(row=>new Option(row.title+' · '+row.status,row.id)))}
$('link').onclick=async()=>{if(!$('requests').value)return;if(await action({action:'link',requestId:$('requests').value}))await refresh()}
$('create').onsubmit=async event=>{event.preventDefault();const result=await action({action:'create',title:$('title').value,description:$('description').value,boardSlug:$('board').value});if(result){await refresh();$('notice').textContent='Request saved for moderation.'}}
$('vote').onsubmit=async event=>{event.preventDefault();if(await action({action:'vote',reviewed:$('vote-review').checked,source:$('source').value})){$('notice').textContent='Customer vote recorded once. No email subscription was created.';$('vote-review').checked=false}}
$('reply-text').oninput=()=>{$('reply-review').checked=false}
$('reply').onsubmit=async event=>{event.preventDefault();if(!replyId)return;const text=$('reply-text').value,result=await action({action:'send',replyId,text,reviewed:$('reply-review').checked}),message=$('error').textContent;await refresh();if(result)$('notice').textContent='Reviewed reply sent.';else{$('error').textContent=message;$('error').hidden=false;if(!$('send').disabled)$('reply-text').value=text}}
void refresh()
