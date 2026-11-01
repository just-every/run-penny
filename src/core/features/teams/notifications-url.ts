export function validNotificationUrl(value:string){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&((url.hostname.endsWith('.logic.azure.com')&&url.pathname.startsWith('/workflows/'))||(url.hostname.endsWith('.environment.api.powerplatform.com')&&url.pathname.startsWith('/powerautomate/automations/direct/workflows/')))}catch{return false}
}
