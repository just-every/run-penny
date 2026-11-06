import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
process.on('exit',code=>console.log('PROBE_NODE_EXIT '+code))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const head=git('rev-parse','HEAD')
assert.equal(git('status','--porcelain'),'')
const require=createRequire(pathToFileURL(resolve('package.json')))
const {chromium}=require('@playwright/test')
const {startBrowserRuntime}=await import(pathToFileURL(resolve('tests/browser/base-runtime.mjs')))
const {browserOptions}=await import(pathToFileURL(resolve('tests/browser/browser-options.mjs')))
const runtime=await startBrowserRuntime()
let browser
const errors=[],rows=[]
try {
  browser=await chromium.launch(browserOptions())
  const context=await browser.newContext({viewport:{width:390,height:844}})
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  async function visit(path) {
    const response=await page.goto(runtime.origin+path,{waitUntil:'networkidle'})
    const ssr=await response.text()
    await page.waitForFunction(()=>Object.keys(document.querySelector('h1')??{}).some(key=>key.startsWith('__reactFiber$')))
    return {response,ssr}
  }
  const known=await visit('/docs/install')
  assert.equal(known.response.status(),200)
  assert.equal(await page.locator('.docs-prose').count(),1)
  const paragraph=page.locator('.docs-prose p').first()
  const controlText=(await paragraph.innerText()).trim(),controlHtml=await paragraph.innerHTML()
  assert.ok(controlText.length>0&&known.ssr.includes(controlHtml))
  rows.push({path:'/docs/install',status:known.response.status(),proseContainers:1,controlTextLength:controlText.length})
  for(const path of ['/docs/no-such-page','/docs/install/no-such-page']) {
    const {response,ssr}=await visit(path)
    const ssrBody= /class="[^"]*docs-(?:prose|page-head)[^"]*"|id="docs-content"|<article(?:\s|>)/i.test(ssr)
    const hydratedBodies=await page.locator('.docs-prose, .docs-page-head, #docs-content, article').count()
    const html=await page.locator('html').evaluate(element=>element.outerHTML)
    const bodyText=await page.locator('body').innerText()
    assert.equal(response.status(),404)
    assert.equal(ssrBody,false)
    assert.equal(hydratedBodies,0)
    assert.ok(!ssr.includes(controlHtml)&&!html.includes(controlHtml)&&!bodyText.includes(controlText))
    rows.push({path,status:response.status(),ssrDocumentationBody:ssrBody,hydratedDocumentationBodies:hydratedBodies,ssrControlProse:ssr.includes(controlHtml),hydratedControlProse:html.includes(controlHtml)})
    console.log(`PROBE DOCS-001 point 8: GET ${path} -> HTTP ${response.status()}, no docs body or control prose in SSR or hydrated HTML`)
  }
  assert.deepEqual(errors,[])
  assert.equal(git('rev-parse','HEAD'),head)
  assert.equal(git('status','--porcelain'),'')
  await writeFile('../packet/PROBE.json',JSON.stringify({head,clean:true,width:390,rows,pageErrors:errors,journeyBlob:git('rev-parse','HEAD:tests/browser/route-review.mjs'),runtime:'Emitted production Worker, fresh native D1, actual Chromium; no docs mock.'},null,2)+'\n')
  await context.close()
} finally {
  await browser?.close()
  await runtime.close()
}
