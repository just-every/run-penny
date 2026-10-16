import {useEffect,useState,type ReactNode} from 'react'
import {fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {fieldClass} from '../../auth/client-mutations'

// Where each tracker value comes from, with direct links. Shown beside the field it explains.
export function Help({id,children}:{id?:string;children:ReactNode}){return <p id={id} className="text-sm leading-6 text-penny-muted">{children}</p>}
const External=({href,children}:{href:string;children:ReactNode})=><a className={textLinkClass} href={href} target="_blank" rel="noopener noreferrer">{children}</a>

export function WebhookUrl({id}:{id:string}){
 const [origin,setOrigin]=useState('');useEffect(()=>setOrigin(location.origin),[])
 return <label className={fieldLabelClass}>Webhook URL for your tracker<input readOnly value={origin&&id?`${origin}/api/integrations/trackers/${id}`:''} className={`${fieldClass} font-mono text-sm`} onFocus={event=>event.currentTarget.select()}/><span className="mt-1 block text-sm font-normal text-penny-muted">Paste this into the tracker’s new webhook. It starts working once you save this connection.</span></label>
}

export function LinearSecretHelp(){
 return <Help id="tracker-secret-help">In <External href="https://linear.app/settings/api">Linear → Settings → API</External>, choose <strong>New webhook</strong>, paste the webhook URL above, tick <strong>Issues</strong> and create it. Open the webhook and copy its <strong>Signing secret</strong> here.</Help>
}

export function JiraIdHelp({site}:{site:string}){
 const origin=/^https:\/\/[a-z0-9-]+\.atlassian\.net$/.test(site)?site:''
 return <Help id="jira-id-help">{origin?<>Signed in to Jira in this browser, open <External href={`${origin}/rest/api/3/project`}>your projects</External> and copy your project’s <code>id</code> (a number, not its key). Then open <External href={`${origin}/rest/api/3/issuetype`}>issue types</External> and copy the <code>id</code> of the type Penny should use, such as Task.</>:'Enter your Jira site first; links to the project and issue type IDs appear here.'}</Help>
}

export function JiraSecretHelp({site}:{site:string}){
 const origin=/^https:\/\/[a-z0-9-]+\.atlassian\.net$/.test(site)?site:''
 return <Help id="tracker-secret-help">In Jira, open {origin?<External href={`${origin}/plugins/servlet/webhooks`}>Settings → System → WebHooks</External>:<>Settings → System → WebHooks</>}, choose <strong>Create a WebHook</strong>, paste the webhook URL above, tick <strong>Issue created</strong> and <strong>Issue updated</strong>, and paste the secret below into its <strong>Secret</strong> field.</Help>
}

export function JiraTokenHelp(){
 return <Help>Only needed to create issues from Penny. Make an API token at <External href="https://id.atlassian.com/manage-profile/security/api-tokens">Atlassian account → API tokens</External> and enter the email you sign in to Jira with.</Help>
}
