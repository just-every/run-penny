import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const [applicationId,originInput,output]=process.argv.slice(2)
if(!applicationId||!originInput||!output||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId))throw Error('Usage: node scripts/teams-app.mjs <Entra-application-UUID> <https-installation-origin> <new-output-directory>')
const origin=new URL(originInput)
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('An HTTPS installation origin is required')
const directory=resolve(output)
await mkdir(directory,{recursive:false})
const manifest=JSON.parse(await readFile(new URL('../integrations/teams/manifest.json',import.meta.url),'utf8'))
manifest.id=applicationId;manifest.composeExtensions[0].botId=applicationId
manifest.developer.websiteUrl=origin.origin;manifest.developer.privacyUrl=origin.origin+'/docs/portal';manifest.developer.termsOfUseUrl=origin.origin+'/docs'
manifest.validDomains=[origin.hostname]
await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
for(const name of ['color.png','outline.png'])await copyFile(new URL('../integrations/teams/'+name,import.meta.url),resolve(directory,name))
console.log('Teams app files created. Review the manifest URLs, zip manifest.json and both icons, and install through Teams app management. Configure the bot messaging endpoint separately as documented.')
