import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const sdkUrl='https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js'
const appOrigin='https://penny.example.test'
const assets=new URL('../../integrations/zendesk/assets/',import.meta.url)

// Only the external Zendesk SDK and its secure server proxy are fixtures.
// Penny authorization, contacts, requests and votes run through the real Worker.
export async function zendeskSidebar({page,origin,key,ticket}){
 const calls=[],errors=[]
 let settings={penny_origin:appOrigin,penny_host:'penny.example.test'}
 page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>{
  const url=request.url()
  assert.ok(url.startsWith(origin+'/__zendesk/assets/')||url===sdkUrl,`Unexpected sidebar network: ${url}`)
 })
 await page.exposeBinding('__zendeskSettings',()=>({settings}))
 await page.exposeBinding('__zendeskTicket',()=>ticket)
 await page.exposeBinding('__zendeskRequest',async(_source,options)=>{
  const url=new URL(options.url)
  assert.equal(url.origin,appOrigin)
  assert.equal(options.secure,true)
  assert.equal(options.cors,false)
  assert.equal(options.headers.Authorization,'Bearer {{setting.penny_api_key}}')
  assert.equal(JSON.stringify(options).includes(key),false)
  assert.match(url.pathname,/^\/api\/v1\/(?:requests|proxy-vote-contacts|boards)(?:\/|$)/)
  calls.push(options)
  const response=await fetch(origin+url.pathname+url.search,{
   method:options.type,redirect:'manual',
   headers:{Authorization:`Bearer ${key}`,...(options.contentType?{'Content-Type':options.contentType}:{})},
   ...(options.data===undefined?{}:{body:options.data})
  })
  return {ok:response.ok,status:response.status,body:await response.json()}
 })
 await page.route(origin+'/__zendesk/assets/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1)
  assert.ok(['iframe.html','sidebar.js','penny-api.js','sidebar.css'].includes(name))
  const contentType=name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript'
  await route.fulfill({contentType,body:await readFile(new URL(name,assets))})
 })
 await page.route(sdkUrl,route=>route.fulfill({contentType:'text/javascript',body:`
  const listeners = new Map();
  window.ZAFClient = {init: () => ({
   metadata: () => window.__zendeskSettings(),
   get: () => window.__zendeskTicket(),
   invoke: () => Promise.resolve({}),
   on: (event, callback) => listeners.set(event, callback),
   request: options => window.__zendeskRequest(options).then(result => {
    if (!result.ok) throw {status:result.status};
    return result.body;
   })
  })};
  window.__ticketChanged = () => listeners.get('ticket.requester.id.changed')?.();
 `}))
 async function open(){await page.goto(origin+'/__zendesk/assets/iframe.html');await page.getByRole('form').count()}
 return {calls,errors,open,configure:value=>{settings=value},changeTicket:async value=>{ticket=value;await page.evaluate(()=>window.__ticketChanged())}}
}
