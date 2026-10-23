import {downloadPrivate} from './data-actions'
import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {secondaryButtonClass} from '@/core/ui/app/classes'
export function CsvExports(){
 const [capability]=useOperatorResource<{canExport:boolean}>('/api/operator/data/csv-capability'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 if(capability.kind!=='ready'||!capability.data.canExport)return null
 async function download(kind:'requests'|'voters'){
  setBusy(true);setMessage('')
  try{await downloadPrivate(`${kind}.csv`,`penny-${kind}.csv`);setMessage('CSV downloaded. UTF-8 without a byte-order mark.')}catch(error){setMessage(error instanceof Error?error.message:'CSV could not be exported.')}finally{setBusy(false)}
 }
 return <div className="mt-4 space-y-3"><p className="text-sm text-penny-muted">Export all requests as UTF-8 CSV. The JSON archive remains the full backup.</p><div className="flex flex-wrap gap-3"><button className={secondaryButtonClass} disabled={busy} onClick={()=>void download('requests')}>Export requests CSV</button><button className={secondaryButtonClass} disabled={busy} onClick={()=>void download('voters')}>Export voters CSV</button></div><p role="status" className="empty:hidden">{message}</p></div>
}
