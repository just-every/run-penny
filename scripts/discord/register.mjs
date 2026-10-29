import {configuration,privateJson} from './config.mjs'
try{
 const config=configuration(await privateJson(process.argv[2]))
 const response=await fetch(`https://discord.com/api/v10/applications/${config.applicationId}/guilds/${config.guildId}/commands`,{method:'POST',redirect:'error',headers:{Authorization:`Bot ${config.botToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Send to Penny',type:3,default_member_permissions:'0'}),signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw Error('registration refused')
 await response.body?.cancel();console.log('Send to Penny registered. Grant selected members permission to use it in Discord Integrations settings.')
}catch{console.error('Discord command registration failed; check owner-only configuration and application/server permissions.');process.exitCode=1}
