import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'

// The external management/source-writing edge is a labeled local fixture.
// The application, native owner admission and copied editor run unchanged.
export async function editorProvider({parentOrigin,persist}) {
 const html=await readFile(new URL('./editor-provider.html',import.meta.url),'utf8')
 const state={requests:0,persisted:0}
 const server=createServer(async(req,res)=>{
  state.requests++
  try{
   if(req.method==='POST'&&req.url==='/source'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)throw Error('Fixture payload overflow')}
    await persist(JSON.parse(body));state.persisted++;res.writeHead(204).end();return
   }
   if(req.method!=='GET'||!req.url.startsWith('/editor?')){res.writeHead(404).end();return}
   res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':`frame-ancestors ${parentOrigin}`,'Cache-Control':'no-store'}).end(html)
  }catch{res.writeHead(400).end('Local fixture rejected source')}
 })
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)})
 return {origin:`http://127.0.0.1:${server.address().port}`,state,close:async()=>{server.closeAllConnections();await new Promise(done=>server.close(done))}}
}
