import type { OperatorResourceState } from './operator-resource'
import { OperatorResourceFailure, OperatorSessionExpired } from './operator-resource-state'

export function OperatorOptionsState({state,loading,failure,reload}:{
  state:OperatorResourceState<unknown>;loading:string;failure:string;reload:()=>void
}){
  if(state.kind==='ready')return null
  if(state.kind==='session_expired')return <OperatorSessionExpired/>
  if(state.kind==='loading')return <p role="status" className="text-sm">{loading}</p>
  return <OperatorResourceFailure title={failure} onRetry={reload} status={state.kind==='not_found'?404:state.status}/>
}
