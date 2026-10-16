import {useEffect,useState,type ReactNode} from 'react'
import {fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {fieldClass} from '../../auth/client-mutations'

// Where each tracker value comes from, with direct links. Shown beside the field it explains.
export function Help({id,children}:{id?:string;children:ReactNode}){return <p id={id} className="text-sm leading-6 text-penny-muted">{children}</p>}
export const External=({href,children}:{href:string;children:ReactNode})=><a className={textLinkClass} href={href} target="_blank" rel="noopener noreferrer">{children}</a>

export function WebhookUrl({id}:{id:string}){
 const [origin,setOrigin]=useState('');useEffect(()=>setOrigin(location.origin),[])
 const local=/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|$)/.test(origin)
 return <label className={fieldLabelClass}>Webhook URL for your tracker<input readOnly value={origin&&id?`${origin}/api/integrations/trackers/${id}`:''} className={`${fieldClass} font-mono text-sm`} onFocus={event=>event.currentTarget.select()}/><span className="mt-1 block text-sm font-normal text-penny-muted">{local?<>This copy of Penny runs on your computer at {new URL(origin).host}, which Linear and Jira cannot reach, so they cannot send it issue updates. Use the webhook URL your hosted Penny shows (after <code>rer deploy</code>) instead. Linking existing issues works here.</>:'Paste this into the tracker’s new webhook. It starts working once you save this connection.'}</span></label>
}

/** Linear keeps the key and the webhook on two settings pages; both steps are here together. */
export function LinearSteps(){
 return <div className="rounded-lg border border-penny-line bg-penny-paper p-4 text-sm leading-6 text-penny-ink"><p className="font-semibold">In Linear, two steps</p><ol className="mt-1 list-decimal space-y-1 pl-5">
  <li>Open <External href="https://linear.app/settings/account/security">Settings → Account → Security &amp; access</External>, create a personal API key, and paste it below.</li>
  <li>Open <External href="https://linear.app/settings/api">Settings → Administration → API</External> (an admin can), choose <strong>New webhook</strong>, paste the webhook URL above, tick <strong>Issues</strong> and create it. Copy its <strong>Signing secret</strong> into the last field.</li>
 </ol></div>
}

export function LinearSecretHelp(){
 return <Help id="tracker-secret-help">From step 2: the new webhook’s <strong>Signing secret</strong> in Linear.</Help>
}

export function JiraSecretHelp({site}:{site:string}){
 const origin=/^https:\/\/[a-z0-9-]+\.atlassian\.net$/.test(site)?site:''
 return <Help id="tracker-secret-help">In Jira, open {origin?<External href={`${origin}/plugins/servlet/webhooks`}>Settings → System → WebHooks</External>:<>Settings → System → WebHooks</>}, choose <strong>Create a WebHook</strong>, paste the webhook URL above, tick <strong>Issue created</strong> and <strong>Issue updated</strong>, and paste the secret below into its <strong>Secret</strong> field.</Help>
}
