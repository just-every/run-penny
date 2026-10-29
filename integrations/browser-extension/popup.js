import {workspaceOrigin} from './workspace.js'
const form=document.querySelector('form'),origin=document.querySelector('#origin'),status=document.querySelector('#status')
origin.value=(await chrome.storage.local.get('pennyOrigin')).pennyOrigin??''
document.querySelector('fieldset').disabled=false
for(const button of document.querySelectorAll('button'))button.disabled=false
async function run(mode){
 status.role='status';status.textContent='Preparing your review…';for(const button of document.querySelectorAll('button'))button.disabled=true
 try{
  const workspace=workspaceOrigin(origin.value)
  // Request only this installation; source reading uses the user's activeTab grant.
  if(!await chrome.permissions.request({origins:[workspace+'/*']}))throw Error('Workspace permission was declined. Nothing was captured.')
  await chrome.storage.local.set({pennyOrigin:workspace})
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true})
  const result=await chrome.runtime.sendMessage({type:'penny-capture',tabId:tab.id,mode,screenshot:document.querySelector('#screenshot').checked})
  if(!result?.ok)throw Error(result?.error??'Could not open your review.')
  status.textContent='Review opened in Penny. Saving requires your current operator session.'
 }catch(error){status.role='alert';status.textContent=error.message}finally{for(const button of document.querySelectorAll('button'))button.disabled=false}
}
form.addEventListener('submit',event=>{event.preventDefault();void run('capture')})
document.querySelector('#check').onclick=()=>void run('check')
document.querySelector('#resume').onclick=async()=>{const result=await chrome.runtime.sendMessage({type:'penny-resume'});status.role=result?.ok?'status':'alert';status.textContent=result?.ok?'Review reopened.':result?.error??'No pending review.'}
document.querySelector('#disconnect').onclick=async()=>{
 const value=(await chrome.storage.local.get('pennyOrigin')).pennyOrigin
 await chrome.storage.local.remove('pennyOrigin');await chrome.storage.session.clear()
 if(value)await chrome.permissions.remove({origins:[value+'/*']})
 origin.value='';status.textContent='Workspace disconnected. Drafts were cleared. Sign out in Penny to end your operator session.'
}
