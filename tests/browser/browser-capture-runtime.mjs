import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {startBrowserRuntime} from './base-runtime.mjs'

export async function captureRuntime(){
 const runtime=await startBrowserRuntime(),{origin}=runtime,reads=[]
 let sourceState='current'
 const source=createServer((request,response)=>{
  reads.push({method:request.method,url:request.url})
  const removed=sourceState==='removed',quote=sourceState==='changed'?'Please add weekly exports for our finance team.':'Please add monthly exports. Contact source.person@example.test.'
  response.writeHead(removed?404:200,{'Content-Type':'text/html; charset=utf-8'})
  response.end(`<!doctype html><html lang="en"><head><title>Customer source</title><link rel="icon" href="data:,"></head><body><main><h1>Customer conversation</h1><p id="quote">${quote}</p><p>UNSELECTED_PRIVATE_RECORD</p><label>Password<input type="password" value="UNSELECTED_PASSWORD"></label></main></body></html>`)
 })
 await new Promise(resolve=>source.listen(0,'127.0.0.1',resolve))
 const sourceUrl=`http://127.0.0.1:${source.address().port}/records/42?view=feedback#request`
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',expected=200){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Connection:'close',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.equal(response.status,expected,`${method} ${path}: ${await response.clone().text()}`);return response
 }
 const json=async(...args)=>{try{return await (await send(...args)).json()}catch(error){throw new Error('HTTP journey failed at '+args[0],{cause:error})}}
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 await json('/api/operator/boards',{slug:'finance',name:'Finance workflows',visibility:'public'},operator,'POST',201)
 const request=await json('/api/operator/requests',{title:'Monthly finance exports',description:'Finance needs recurring export files.',boardSlug:'finance'},operator,'POST',201)
 // A non-authorizing customer is created through the existing proxy door on a
 // different request, without verifying an address or granting permission.
 const other=await json('/api/operator/requests',{title:'Invoice search',description:'Find a historic invoice.',boardSlug:'finance'},operator,'POST',201)
 const customer=await json(`/api/operator/requests/${other.slug}/proxy-votes`,{contact:{displayName:'Nina Rao',email:'nina@example.test'},source:'Nina requested invoice search in a support conversation.'},operator)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 return {runtime,origin,sourceUrl,reads,request,customer,operator,json,send,
  changeSource:state=>{sourceState=state},
  addSession:async context=>{const at=Cookie.indexOf('=');await context.addCookies([{name:Cookie.slice(0,at),value:Cookie.slice(at+1),url:origin}])},
  close:async()=>{await new Promise(resolve=>source.close(resolve));await runtime.close()}}
}
