import {z} from 'zod'
import {NativeError} from '../auth/native-tokens'

/** Linear's one fixed GraphQL endpoint, like a mail provider's API: a read with
 * the owner's personal key, never an operator-chosen destination. */
const LINEAR_API='https://api.linear.app/graphql'
const query='{ organization { id name } teams(first: 100) { nodes { id name } } }'
const answer=z.object({data:z.object({organization:z.object({id:z.uuid(),name:z.string()}),teams:z.object({nodes:z.array(z.object({id:z.uuid(),name:z.string()}))})})})

/** The workspace and its teams by name, so setup needs only the key. */
export async function linearTeams(apiKey:string):Promise<{organization:{id:string;name:string};teams:{id:string;name:string}[]}>{
 let response:Response
 try{response=await fetch(LINEAR_API,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10_000),headers:{'Content-Type':'application/json',Authorization:apiKey},body:JSON.stringify({query})})}
 catch{throw new NativeError('linear_unreachable',503,'Penny could not reach Linear. Try again in a moment.')}
 if(response.status===401||response.status===400)throw new NativeError('linear_key_refused',422,'Linear did not accept that API key. Make a new personal API key and paste it here.')
 const text=await response.text()
 // A redirect is never followed; it counts as an unexpected answer.
 if(!response.ok||text.length>256*1024)throw new NativeError('linear_unreachable',503,'Linear did not answer as expected. Try again in a moment.')
 let parsed:z.infer<typeof answer>
 try{parsed=answer.parse(JSON.parse(text))}catch{throw new NativeError('linear_key_refused',422,'Linear did not accept that API key. Make a new personal API key and paste it here.')}
 return {organization:parsed.data.organization,teams:parsed.data.teams.nodes}
}
