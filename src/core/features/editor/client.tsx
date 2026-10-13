import {useEffect,useState} from 'react'
import {useLocation,useRouter} from '@tanstack/react-router'
import {createOwnerEditor,configLoader,installCompiledLiveEdits,setLiveEditsReady} from '../../../../base/modules/editor/src'
import {useEditorLeafReady} from '../../../../base/modules/editor/src/react'
export {useEditorLeafReady}
import snapshot from '@/visual-edits.json'
if(typeof document!=='undefined'){setLiveEditsReady(false);installCompiledLiveEdits(snapshot)}
export function PennyEditor({authorized}:{authorized:boolean}) {
 const router=useRouter(),path=useLocation({select:location=>location.pathname}),[failure,setFailure]=useState(false)
 useEffect(()=>router.subscribe('onBeforeNavigate',()=>setLiveEditsReady(false)),[router])
 useEffect(()=>{
  const editable=path==='/portal/feedback'||path==='/portal/roadmap'||path.startsWith('/portal/roadmap/')||path==='/portal/updates'||path.startsWith('/portal/updates/')||(path.startsWith('/portal/feedback/')&&path!=='/portal/feedback/activity')
  if(!authorized||!editable)return
  const editor=createOwnerEditor();editor.setOwner(true)
  const refresh=()=>{void editor.refresh(configLoader('/api/editor/config',location.origin)).then(()=>setFailure(false)).catch(()=>{editor.revoke();setFailure(true)})}
  const revoke=()=>editor.setOwner(false)
  refresh();window.addEventListener('focus',refresh);window.addEventListener('penny-authority-changed',revoke)
  return ()=>{window.removeEventListener('focus',refresh);window.removeEventListener('penny-authority-changed',revoke);editor.dispose()}
 },[authorized,path])
 return failure?<p role="alert" className="fixed bottom-20 right-5 z-50 max-w-xs rounded-lg bg-white p-4 text-sm shadow">The page editor could not confirm owner access. Reload or sign in again.</p>:null
}
