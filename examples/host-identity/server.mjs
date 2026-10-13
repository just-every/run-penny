import {createServer} from 'node:http'
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto'
import {readFile,lstat} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {signRequester} from './sign.mjs'
const hash=value=>createHash('sha256').update(value).digest()
const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
// A runnable loopback host application, with its own password/session and one
// server-owned user record. This is an example, not a production login system.
export function createHostExample(config){
 const url=new URL(config.appOrigin)
 if(url.origin!==config.appOrigin||!['http:','https:'].includes(url.protocol)||url.username||url.password||config.secret.length<32||!config.password)throw new Error('Invalid local host configuration.')
 const sessions=new Map(),script=readFile(new URL('./embed.js',import.meta.url))
 return createServer(async(request,response)=>{
  try{
   const pathname=new URL(request.url,'http://127.0.0.1').pathname
   response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff')
   const cookie=/(?:^|; )host_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie??'')?.[1]
   const signedIn=(sessions.get(cookie)??0)>Date.now()
   if(pathname==='/signin'&&request.method==='POST'){
    let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>4096)throw new Error('Invalid login.')}
    if(!timingSafeEqual(hash(new URLSearchParams(body).get('password')??''),hash(config.password))){response.writeHead(403);response.end('Sign-in refused.');return}
    const session=randomBytes(32).toString('hex');sessions.set(session,Date.now()+30*60000)
    response.setHeader('Set-Cookie',`host_session=${session}; HttpOnly; SameSite=Lax; Path=/`);response.writeHead(303,{Location:'/'});response.end();return
   }
   if(pathname==='/identity'&&request.method==='GET'){
    if(!signedIn){response.writeHead(401);response.end('Sign in to the host first.');return}
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(signRequester(config.user,config)));return
   }
   if(pathname==='/embed.js'&&request.method==='GET'){response.setHeader('Content-Type','text/javascript');response.end(await script);return}
   if(pathname==='/'&&request.method==='GET'){
    response.setHeader('Content-Type','text/html; charset=utf-8')
    response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Host application example</title><link rel="icon" href="data:,"><style>body{margin:0;font:16px system-ui}h1,form{margin:1rem}iframe{display:block;border:0;width:100%;height:calc(100vh - 5rem)}input,button{font:inherit;min-height:44px}</style><h1>Host application</h1>${signedIn?`<iframe title="Penny feedback" data-penny src="${escape(config.appOrigin)}/portal/feedback/new"></iframe><script src="/embed.js"></script>`:'<form method="post" action="/signin"><label>Host password <input name="password" type="password" required></label><button>Sign in to host</button></form>'}</html>`);return
   }
   response.writeHead(404);response.end('Not found.')
  }catch{response.writeHead(400);response.end('Host request refused.')}
 })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const file=resolve(process.argv[2]),status=await lstat(file)
  if(!status.isFile()||status.isSymbolicLink()||status.nlink!==1||(status.mode&0o777)!==0o600||status.uid!==process.getuid())throw new Error('Private configuration required.')
  const server=createHostExample(JSON.parse(await readFile(file,'utf8')))
  server.listen(41870,'127.0.0.1',()=>console.log('Local host example: http://127.0.0.1:41870'))
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close())
 }catch{console.error('Host example refused. Use an owner-only configuration file as documented.');process.exitCode=1}
}
