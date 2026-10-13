import type { UserVoiceReceipt } from '../uservoice-receipt'

function Count({ label, value }: { label: string; value: number | string }) {
  return <div className="flex justify-between gap-4 border-b border-penny-line py-2 last:border-0"><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>
}

export function UserVoiceReceiptSection({ history }: { history: UserVoiceReceipt }) {
  const filtered = history.files.filter(file => file.scope === 'filtered')
  return <div className="space-y-3" aria-label="UserVoice history">
    <h4 className="font-bold text-penny-ink">UserVoice history</h4>
    {filtered.length ? <div role="note" className="space-y-1 border-l-2 border-penny-copper pl-4 text-sm leading-6 text-penny-ink">
      <p className="font-bold">Partial history</p>
      {filtered.map(file => <p key={file.name} className="break-words">{file.name} is a filtered export{file.filter ? `: ${file.filter}` : ''}. Ideas and supporters outside that filter are not part of this import.</p>)}
    </div> : <p className="text-sm leading-6 text-penny-muted">Every file is declared a complete export.</p>}
    <dl className="max-w-xl text-sm">
      <Count label="Ideas" value={history.ideas}/>
      <Count label="Supporter rows read" value={history.voterRows}/>
      <Count label="Supporters (one per idea and person)" value={history.supporters}/>
      <Count label="Rows folded into a supporter already counted" value={history.groupedRows}/>
      {history.claimed ? <>
        <Count label={`Claimed by ${history.claimed.field}`} value={history.claimed.total}/>
        <Count label="Supplied supporters on those ideas" value={history.claimed.supplied}/>
        <Count label="Aggregate only, creates nothing" value={history.aggregateOnly ?? 0}/>
      </> : null}
    </dl>
    <div className="space-y-2">
      <h5 className="font-bold text-penny-ink">Supporter type</h5>
      <dl className="max-w-xl text-sm">
        <Count label="Entered by a UserVoice admin (proxy)" value={history.supporterTypes.proxy}/>
        <Count label="Not marked as proxy" value={history.supporterTypes.unmarked}/>
      </dl>
      <p className="text-sm leading-6 text-penny-muted">{history.proxyDistinguishable
        ? 'Each type stays visible on the request. Neither grants a login, a verified address or permission to contact anyone.'
        : 'The Feedback Capturer columns were not exported, so proxy votes cannot be told apart. No supporter is marked as proxy.'}</p>
    </div>
  </div>
}
