import { useState } from 'react'
import { useLoopOptions } from '@/core/app/ui/loop-form'
import { fieldClass } from '../../auth/client-mutations'
import { fieldLabelClass, insetPanelClass, secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../../requests/ui/operator-client'
import { RECEIVER_EVENT, RECEIVER_TENANT } from '../receiver-protocol'

/** A runnable Node 18+ script for the other tool: the exact headers, signature
 * and body this receiver checks (receiver.ts). */
function example(url: string, destination: string, requestId: string) {
  return `// send-penny-note.mjs — run with: PENNY_SIGNING_KEY=<the signing key> node send-penny-note.mjs
import { createHmac, randomUUID } from 'node:crypto'
const url = '${url}'
const body = JSON.stringify({ requestId: '${requestId}', note: 'Customer asked about CSV export on a support call.' })
const id = randomUUID(), timestamp = String(Math.floor(Date.now() / 1000))
const signed = JSON.stringify(['integrations.webhook.v1', '${RECEIVER_TENANT}', '${destination}', '${RECEIVER_EVENT}', id, timestamp, body])
const signature = createHmac('sha256', Buffer.from(process.env.PENNY_SIGNING_KEY, 'hex')).update(signed).digest('hex')
const response = await fetch(url, { method: 'POST', body, headers: {
  'content-type': 'application/json', 'webhook-id': id, 'webhook-tenant': '${RECEIVER_TENANT}', 'webhook-destination': '${destination}',
  'webhook-event': '${RECEIVER_EVENT}', 'webhook-timestamp': timestamp, 'webhook-signature': 'v1=' + signature,
} })
console.log(response.status, await response.text())
`
}
// operatorMutation reports a refusal's code with spaces, or its hint.
const outcomes: Record<string, string> = {
  'not found': 'That request no longer exists. Choose another.', 'integration destination unavailable': 'This receiver was revoked.',
  unauthenticated: 'Your session has ended. Sign in again to send a test.',
}

function Copy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return <button type="button" className={`min-h-11 ${textLinkClass}`} onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>{copied ? 'Copied' : label}</button>
}

/** Everything another tool needs to post a signed internal note, and a test. */
export function ReceiverGuide({ id, name, origin }: { id: string; name: string; origin: string }) {
  const options = useLoopOptions(), requests = options.kind === 'ready' ? options.data.requests : []
  const [chosen, setChosen] = useState(''), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false)
  const url = `${origin}/api/integrations/webhooks/${id}`, requestId = chosen || requests[0]?.id || '<request id>'
  const test = async () => {
    setBusy(true); setResult(null)
    try {
      const outcome = await operatorMutation(`/api/operator/integrations/destinations/${id}/test`, { requestId }) as { processed?: boolean }
      setResult({ ok: true, text: outcome.processed ? `Test note received. It is on “${requests.find(item => item.id === requestId)?.label ?? 'the request'}” as an internal note.` : 'Penny already had this test note; nothing was added twice.' })
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setResult({ ok: false, text: outcomes[code] ?? (/\s/.test(code) && code.length > 30 ? code : 'The test note was refused. Check the receiver is still active and try again.') })
    } finally { setBusy(false) }
  }
  return <details className="mt-3"><summary className="min-h-11 cursor-pointer font-semibold">How {name} sends a note</summary><div className="mt-3 space-y-4 text-sm leading-6">
    <div><p className="font-semibold">Receiver URL</p><p className="break-all font-mono">{url}</p><Copy text={url} label="Copy URL"/></div>
    <div><p className="font-semibold">Request</p><p>An HTTPS <code>POST</code> with a JSON body: <code>{'{"requestId": "…", "note": "…"}'}</code>. <code>requestId</code> is the Penny request the note belongs to; the note is up to 20,000 characters and stays internal.</p></div>
    <div><p className="font-semibold">Headers</p><ul className="list-disc pl-5">
      <li><code>content-type: application/json</code></li>
      <li><code>webhook-id</code>: a new unique ID for each note (letters, digits, <code>-_.:/</code>); sending the same ID twice adds the note once.</li>
      <li><code>webhook-tenant: {RECEIVER_TENANT}</code> and <code>webhook-destination: {id}</code></li>
      <li><code>webhook-event: {RECEIVER_EVENT}</code></li>
      <li><code>webhook-timestamp</code>: the current time in Unix seconds; Penny refuses notes more than 5 minutes off.</li>
      <li><code>webhook-signature: v1=</code> followed by the signature.</li>
    </ul></div>
    <div><p className="font-semibold">Signature</p><p>HMAC-SHA256, hex-encoded, keyed with the signing key’s bytes (the key is 64 hex characters), over this JSON array written without spaces: <code className="break-all">["integrations.webhook.v1","{RECEIVER_TENANT}","{id}","{RECEIVER_EVENT}",webhook-id,webhook-timestamp,body]</code>, where the last three are the header values and the exact body text.</p></div>
    <div><p className="font-semibold">Example</p><pre className={`${insetPanelClass} max-h-72 overflow-auto p-3 text-xs whitespace-pre-wrap break-all`}>{example(url, id, requestId)}</pre><Copy text={example(url, id, requestId)} label="Copy example"/></div>
    <div className="space-y-2"><p className="font-semibold">Send a test</p><p>Penny signs a sample note with this receiver’s key and posts it to the receiver, exactly as your tool would. The note appears on the request you choose.</p>
      <label className={fieldLabelClass}>Request for the test note<select className={fieldClass} value={requestId} onChange={event => setChosen(event.target.value)} disabled={!requests.length}>{requests.length ? requests.map(item => <option key={item.id} value={item.id}>{item.label}</option>) : <option>Create a feedback request first</option>}</select></label>
      <button type="button" className={secondaryButtonClass} disabled={busy || !requests.length} onClick={() => void test()}>{busy ? 'Sending…' : 'Send a test note'}</button>
      {result ? <p role={result.ok ? 'status' : 'alert'} className={result.ok ? '' : 'text-penny-danger'}>{result.text}</p> : null}
    </div>
  </div></details>
}
