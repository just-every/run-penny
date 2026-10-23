import {readFile} from 'node:fs/promises'
import {csvRecords} from '../csv-records.mjs'
import assert from 'node:assert/strict'

export async function checkSavedViews({page,peerPage,width,json,ownerCookie,peerCookie,audit}){
 for(const kind of ['requests','evidence']){
  const prefix=`synthetic-penny-${kind}-${width}`,records=[]
  for(const suffix of ['B','A','other']){
   if(kind==='requests'){
    const title=suffix==='other'?'Outside saved view':`${prefix} ${suffix}`
    const record=await json('/api/operator/requests',{title,description:'Private supporting context for this request.',boardSlug:'accountability'},ownerCookie,'POST',201)
    await json(`/api/operator/moderation/${record.slug}`,{verdict:'approved',title,description:'Approved request context.',boardSlug:'accountability',displayName:'Product team'},ownerCookie)
    records.push(record)
   }else records.push(await json('/api/operator/evidence',{sourceType:'interview',wording:suffix==='other'?'Outside saved view':`${prefix} ${suffix}`,observedAt:'2026-10-17T10:00:00Z'},ownerCookie,'POST',201))
  }
  if(kind==='requests')await json(`/api/operator/requests/${records[0].slug}/proxy-votes`,{contact:{displayName:'synthetic-penny-voter'},source:'Customer explicitly requested this workflow.'},ownerCookie)
  const path=kind==='requests'?'/app/moderation':'/app/feedback',api=kind==='requests'?'/api/operator/moderation':'/api/operator/evidence'
  await page.goto(`${page.url().startsWith('http')?new URL(page.url()).origin:''}${path}?q=${prefix}&sort=name`)
  const origin=new URL(page.url()).origin,panel=page.getByRole('region',{name:'Saved views',exact:true})
  await panel.getByRole('combobox',{name:'Saved view',exact:true}).waitFor()
  const expected=await json(`${api}?q=${prefix}&sort=name`,undefined,ownerCookie)
  assert.deepEqual(expected.items.map(row=>row.id),[records[1].id,records[0].id])
  async function save(name,scope){
   const form=panel.getByRole('form',{name:'Save view',exact:true})
   if(!await form.isVisible())await panel.getByText('Save filters, sort and columns',{exact:true}).click()
   await form.getByRole('textbox',{name:'View name',exact:true}).fill(name)
   await form.getByRole('combobox',{name:'Visibility',exact:true}).selectOption(scope)
   if(kind==='requests')await form.getByRole('checkbox',{name:'Description',exact:true}).uncheck()
   else await form.getByRole('checkbox',{name:'Observed time',exact:true}).uncheck()
   await form.getByRole('button',{name:'Save new view',exact:true}).click()
   await panel.getByRole('status').filter({hasText:'View saved.'}).waitFor()
   await page.waitForURL(url=>url.searchParams.has('view'))
   return new URL(page.url()).searchParams.get('view')
  }
  const shared=await save(prefix+' shared','shared')
  assert.equal(await page.getByRole('combobox',{name:'Sort',exact:true}).inputValue(),'name','Saved sort is visible in the filter form')
  if(kind==='requests'){
   for(const family of ['requests','voters']){
    const downloading=page.waitForEvent('download')
    await page.getByRole('button',{name:`Export ${family} CSV`,exact:true}).click()
    const download=await downloading,rows=csvRecords(await readFile(await download.path(),'utf8'))
    assert.equal(await download.failure(),null)
    if(family==='requests')assert.deepEqual(rows.map(row=>row.request_id).sort(),expected.items.map(row=>row.id).sort())
    else {assert.equal(rows.length,1);assert.equal(rows[0].request_id,records[0].id);assert.equal(rows[0].voter,'synthetic-penny-voter');assert.equal(rows[0].proxy,'yes')}
   }
  }
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await audit(page,`saved-${kind}-shared`,{detail:panel})
  const privateView=await save(prefix+' private','private')
  assert.notEqual(shared,privateView)
  await audit(page,`saved-${kind}-private`,{detail:panel})
  await peerPage.goto(`${origin}${path}?view=${shared}`)
  const peers=peerPage.getByRole('region',{name:'Saved views',exact:true})
  await peers.getByRole('combobox',{name:'Saved view',exact:true}).selectOption(shared)
  await peerPage.getByText('Created by Owner · shared',{exact:true}).waitFor()
  const options=await peers.getByRole('combobox',{name:'Saved view',exact:true}).locator('option').allTextContents()
  assert.ok(options.some(name=>name.includes(prefix+' shared')))
  assert.ok(!options.some(name=>name.includes(prefix+' private')))
  assert.equal(await peerPage.getByRole('combobox',{name:'Sort',exact:true}).inputValue(),'name','A second operator sees the saved sort')
  const other=await json(`${api}?view=${shared}`,undefined,peerCookie)
  assert.deepEqual(other.items.map(row=>row.id),expected.items.map(row=>row.id))
  const rendered=await peerPage.locator(kind==='requests'?'article[id^="request-"]':'[id^="evidence-"][class*="penny-card"]').evaluateAll(nodes=>nodes.map(node=>node.id))
  assert.deepEqual(rendered,expected.items.map(row=>(kind==='requests'?'request-'+row.slug:'evidence-'+row.id)))
  if(kind==='requests')assert.equal(await peerPage.getByText('Approved request context.',{exact:true}).count(),0,'Saved columns hide the description')
  else for(const record of records.slice(0,2))assert.equal(await peerPage.locator('#evidence-'+record.id+' > div:first-child time').count(),0,'Saved columns hide observed time')
  await peerPage.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await audit(peerPage,`saved-${kind}-peer`,{detail:peers})
 }
}
