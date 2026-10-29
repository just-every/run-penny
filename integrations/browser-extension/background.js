import {workspaceOrigin} from './workspace.js'

async function handoff(draft,origin){
 // Session data stays in extension memory/session storage, never a URL, page
 // localStorage or portable product record. No cookie or API token is read.
 await chrome.storage.session.set({lastReview:{draft,origin}})
 const tab=await chrome.tabs.create({url:origin+'/app/browser-capture'})
 for(let attempt=0;attempt<100;attempt++){
  const current=await chrome.tabs.get(tab.id)
  if(current.status==='complete'){
   if(new URL(current.url).origin!==origin||new URL(current.url).pathname!=='/app/browser-capture')throw Error('Sign in as an operator in Penny, then use Resume last review. Nothing was saved.')
   const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:payload=>{
    if(document.documentElement.dataset.pennyCapture!=='ready')return false
    window.postMessage({type:'penny-browser-draft',draft:payload},location.origin);return true
   },args:[draft]})
   if(result)return
  }
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 throw Error('Penny did not open the capture review. Check your session, then resume.')
}
async function capture({tabId,mode,screenshot}){
 const origin=workspaceOrigin((await chrome.storage.local.get('pennyOrigin')).pennyOrigin)
 if(!await chrome.permissions.contains({origins:[origin+'/*']}))throw Error('Open Penny Capture and grant access to your workspace first.')
 const tab=await chrome.tabs.get(tabId),url=new URL(tab.url)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('This browser page cannot be captured. Open an ordinary web page.')
 const [{result:snapshot}]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async check=>{
  let status=200
  if(check){try{const response=await fetch(location.href,{method:'HEAD',credentials:'same-origin',redirect:'manual',cache:'no-store'});status=response.status}catch{status=503}}
  const selection=window.getSelection(),element=document.activeElement
  // Passwords and text inputs are never read. Only the explicit document selection.
  const wording=element&&['INPUT','TEXTAREA'].includes(element.tagName)?'':selection?.toString()??''
  const source=new URL(location.href)
  return {pageUrl:source.href,wording:wording.slice(0,20000),observedAt:new Date().toISOString(),status}
 },args:[mode==='check']})
 if(snapshot.wording.length>=20000)throw Error('Choose a shorter passage (under 20,000 characters).')
 let image
 if(screenshot){
  const [active]=await chrome.tabs.query({active:true,windowId:tab.windowId})
  if(active?.id!==tabId)throw Error('The source tab changed. Try again with the intended page active.')
  image=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'})
  const after=await chrome.tabs.get(tabId),[stillActive]=await chrome.tabs.query({active:true,windowId:tab.windowId})
  if(stillActive?.id!==tabId||after.url!==tab.url)throw Error('The source tab changed during the screenshot. Nothing was saved.')
  if(image.length>8388608)throw Error('The screenshot is too large. Select text instead.')
 }
 if(mode==='capture'&&!snapshot.wording.trim()&&!image)throw Error('Select a passage or choose Include a screenshot before capturing.')
 await handoff({id:crypto.randomUUID(),mode,...snapshot,...(image?{image}:{})},origin)
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 // Only extension-owned pages can request capture; web pages have no messaging door.
 if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false
 const task=message.type==='penny-capture'?capture(message):message.type==='penny-resume'?(async()=>{const saved=(await chrome.storage.session.get('lastReview')).lastReview;if(!saved)throw Error('No review is waiting. Capture a page first.');await handoff(saved.draft,workspaceOrigin(saved.origin))})():null
 if(!task)return false
 task.then(()=>respond({ok:true}),error=>respond({ok:false,error:error.message}));return true
})
chrome.commands.onCommand.addListener(async command=>{
 if(command!=='capture-page')return
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await capture({tabId:tab.id,mode:'capture',screenshot:false})}catch{await chrome.action.openPopup()}
})
