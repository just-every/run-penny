export function workspaceOrigin(value){
 let url;try{url=new URL(value)}catch{throw Error('Enter your Penny HTTPS workspace URL.')}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Use a Penny HTTPS origin without credentials or a path. HTTP is allowed only for local development.')
 return url.origin
}
