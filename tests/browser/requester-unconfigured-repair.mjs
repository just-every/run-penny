import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { origin,shot,manifest } from './requester-repair-support.mjs'
const browser=await chromium.launch({headless:true}),errors=[],checks=[]
try{
 assert.deepEqual(await (await fetch(origin+'/api/auth/capabilities')).json(),{transport:'unavailable'})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto(origin+'/portal/feedback/new');await page.getByText('Email delivery is not configured. Sign-in and new submissions are unavailable.',{exact:true}).waitFor();await shot(page,'unconfigured-submit',width)
  await page.goto(origin+'/signin');await page.getByText('Email delivery is unavailable until configured.',{exact:true}).waitFor();await shot(page,'unconfigured-signin',width)
  checks.push({width,unconfiguredCopy:true});await context.close()
 }
 const response=await fetch(origin+'/api/public/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Cannot submit',description:'Unconfigured',boardSlug:'unavailable',idempotencyKey:crypto.randomUUID()})})
 assert.equal(response.status,503);checks.push({submissionStatus:response.status})
 await manifest('unconfigured-manifest',errors,checks)
}finally{await browser.close()}
