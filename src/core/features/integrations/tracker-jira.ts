import {z} from 'zod'
import {NativeError} from '../auth/native-tokens'
import {jiraOrigin} from './tracker-configuration'

/** A read of the owner's own Atlassian site with their API token, like Linear's
 * team list: never another host, never a redirect, and nothing is kept. */
const answer=z.object({values:z.array(z.object({id:z.string().regex(/^\d+$/),key:z.string(),name:z.string(),issueTypes:z.array(z.object({id:z.string().regex(/^\d+$/),name:z.string(),subtask:z.boolean().optional()})).default([])}))})
export type JiraProject={id:string;key:string;name:string;issueTypes:{id:string;name:string}[]}

/** The site's projects and each one's issue types by name, so setup needs no IDs. */
export async function jiraProjects(site:string,email:string,token:string):Promise<JiraProject[]>{
 const origin=jiraOrigin(site)
 let response:Response
 try{response=await fetch(`${origin}/rest/api/3/project/search?expand=issueTypes&maxResults=100`,{redirect:'manual',signal:AbortSignal.timeout(10_000),headers:{Accept:'application/json',Authorization:'Basic '+btoa(`${email}:${token}`)}})}
 catch{throw new NativeError('jira_unreachable',503,'Penny could not reach that Jira site. Check the address and try again.')}
 if([401,403].includes(response.status))throw new NativeError('jira_key_refused',422,'Jira did not accept that email and API token. Use the email you sign in to Jira with and a new API token.')
 const text=await response.text()
 if(!response.ok||text.length>1024*1024)throw new NativeError('jira_unreachable',503,'That Jira site did not answer as expected. Check the address and try again.')
 let parsed:z.infer<typeof answer>
 try{parsed=answer.parse(JSON.parse(text))}catch{throw new NativeError('jira_unreachable',503,'That Jira site did not answer as expected. Check the address and try again.')}
 return parsed.values.map(project=>({id:project.id,key:project.key,name:project.name,issueTypes:project.issueTypes.filter(type=>!type.subtask).map(({id,name})=>({id,name}))}))
}
