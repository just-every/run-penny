const frame=document.querySelector('iframe[data-penny]'),origin=new URL(frame.src).origin
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.type!=='penny-host-ready'||event.data?.version!==1)return
 const response=await fetch('/identity',{credentials:'same-origin',cache:'no-store'})
 if(!response.ok)return
 const identity=await response.json()
 frame.contentWindow.postMessage({type:'penny-host-identity',version:1,...identity},origin)
})
