import {readdir,readFile} from 'node:fs/promises'
import {toJSONAsync} from 'seroval'
// Same emitted resolver/Seroval public transport used by migration tests. IDs
// are derived from the running build, never pinned or guessed.
export async function generatedOperatorTransport() {
 const directory='dist/server/assets',files=await readdir(directory)
 const resolver=files.find(file=>file.startsWith('__23tanstack-start-server-fn-resolver-'))
 if(!resolver)throw new Error('Emitted server-function resolver not found')
 const source=await readFile(`${directory}/${resolver}`,'utf8')
 const entry=[...source.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "(\w+)_createServerFn_handler"/g)].find(row=>row[2]==='loadOperatorResources')
 if(!entry)throw new Error('Emitted private loader not found')
 const payload=JSON.stringify(await toJSONAsync({data:'/app/accounts/proof-account-00'}))
 return `/_serverFn/${entry[1]}?${new URLSearchParams({payload})}`
}
export function generatedHeaders(origin){return {Origin:origin,'Sec-Fetch-Site':'same-origin','x-tsr-serverFn':'true',Accept:'application/json'}}
