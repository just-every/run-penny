import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import type {Rules} from './engine'
import {activeRun,type RedactionRun} from './run-view'
import {RulesForm} from './rules-form'
import {StoredRedaction} from './stored-redaction'

type Settings=Rules&{canConfigure:boolean;draftScope:string;latestRun:RedactionRun|null}
function OwnerSettings({initial}:{initial:Settings}){
 const [run,setRun]=useState(initial.latestRun),[saving,setSaving]=useState(false),[enabled,setEnabled]=useState(initial.enabled)
 return <><RulesForm initial={initial} draftScope={initial.draftScope} disabled={activeRun(run)} onSaving={setSaving} onChange={rules=>{setEnabled(rules.enabled);setRun(null)}}/><StoredRedaction run={run} setRun={setRun} enabled={enabled} saving={saving}/></>
}
export function RedactionSettings(){
 const [resource]=useOperatorResource<Settings>('/api/operator/settings/redaction')
 return <SectionCard id="evidence-redaction" icon="form" title="Sensitive evidence redaction" description="Rules mark sensitive wording before captured text is stored.">
  {resource.kind==='ready'&&resource.data.canConfigure?<OwnerSettings initial={resource.data}/>:<p>{resource.kind==='loading'?'Loading redaction settings…':'Owner access is required to configure redaction.'}</p>}
 </SectionCard>
}
