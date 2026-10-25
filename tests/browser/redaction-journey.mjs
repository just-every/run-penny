import assert from 'node:assert/strict'
import {resolve,join} from 'node:path'
import {checkRedactionStates} from './redaction-states.mjs'

export async function reviewRedaction({page,runtime,goto,capture:capturePage}){
 async function capture(label,target=page){
  await target.evaluate(()=>window.scrollTo(0,0))
  await capturePage(label,target)
  if(!label.includes('item')){const clip=await target.locator('section[aria-labelledby=evidence-redaction]').boundingBox();assert.ok(clip);await target.screenshot({fullPage:true,clip,path:join(resolve(process.env.PENNY_EVIDENCE??'../evidence/decision-loop-resume'),`${label}-card-${target.viewportSize().width}.png`)})}
 }
 const origin=runtime.origin,root='/api/operator/settings/redaction'
 const old=await page.request.post(origin+'/api/operator/evidence',{headers:{Origin:origin},data:{sourceType:'free_text',sourceLabel:'Synthetic prior capture',wording:'Prior captured account ACCOUNT-1234.',observedAt:'2026-10-22T09:00:00Z'}})
 assert.equal(old.status(),201)
 await goto('/app/settings')
 const panel=page.locator('section[aria-labelledby=evidence-redaction]'),patterns=panel.getByLabel('Custom patterns',{exact:true})
 await capture('AI-008-empty')
 const enabled=page.waitForResponse(r=>r.url().endsWith(root)&&r.request().method()==='PUT')
 await panel.getByLabel('Enable redaction for new captures',{exact:true}).check()
 assert.equal((await enabled).status(),200)
 await panel.locator('[data-save-state="saved"]').waitFor()
 // An incomplete pattern cannot be saved, but its draft survives every way of leaving.
 await patterns.fill('ACCOUNT-[0-9]{')
 await page.reload();await panel.locator('[data-save-state="failed"]').waitFor()
 assert.equal(await patterns.inputValue(),'ACCOUNT-[0-9]{')
 await goto('/app/feedback');await page.goBack();await panel.locator('[data-save-state="failed"]').waitFor()
 assert.equal(await patterns.inputValue(),'ACCOUNT-[0-9]{')
 const draftPage=await page.context().newPage()
 await draftPage.goto(origin+'/app/settings');await draftPage.locator('[data-save-state="failed"]').waitFor()
 const draftPattern=draftPage.getByLabel('Custom patterns',{exact:true})
 assert.equal(await draftPattern.inputValue(),'ACCOUNT-[0-9]{')
 await draftPattern.fill('(unsupported)');await draftPage.close()
 await page.reload();await panel.locator('[data-save-state="failed"]').waitFor();assert.equal(await patterns.inputValue(),'(unsupported)')
 assert.equal(await panel.getByRole('alert').count(),1)
 const savedRules=await (await page.request.get(origin+root)).json()
 assert.deepEqual(savedRules.patterns,[])
 const refused=await page.request.put(origin+root,{headers:{Origin:origin},data:{...pickRules(savedRules),patterns:['(unsupported)']}})
 assert.equal(refused.status(),422,'unsafe patterns remain refused by the real route')
 await capture('AI-008-rules-save-failed')
 await patterns.fill('ACCOUNT-[0-9]{4}')
 await capture('AI-008-typed-pattern')
 await panel.locator('[data-save-state="saved"]').waitFor()
 assert.deepEqual((await (await page.request.get(origin+root)).json()).patterns,['ACCOUNT-[0-9]{4}'])
 // A network failure keeps the control value and offers a real retry.
 await page.route('**/api/operator/settings/redaction',route=>route.request().method()==='PUT'?route.abort():route.continue())
 const savePage=await page.context().newPage(),saveErrors=[]
 savePage.on('pageerror',error=>saveErrors.push(error.message))
 await savePage.goto(origin+'/app/settings')
 const savePanel=savePage.locator('section[aria-labelledby=evidence-redaction]'),email=savePanel.getByLabel('Email addresses',{exact:true})
 // Apply the failure to this page too; its intentional network error is isolated.
 await savePage.route('**/api/operator/settings/redaction',route=>route.request().method()==='PUT'?route.abort():route.continue())
 await email.uncheck();await savePanel.getByRole('button',{name:'Retry saving',exact:true}).waitFor()
 assert.equal(await email.isChecked(),false)
 assert.equal((await (await savePage.request.get(origin+root)).json()).kinds.includes('email'),true)
 await savePage.unrouteAll();const retried=savePage.waitForResponse(r=>r.url().endsWith(root)&&r.request().method()==='PUT')
 await savePanel.getByRole('button',{name:'Retry saving',exact:true}).click();assert.equal((await retried).status(),200)
 await savePanel.locator('[data-save-state="saved"]').waitFor()
 assert.equal((await (await savePage.request.get(origin+root)).json()).kinds.includes('email'),false)
 assert.deepEqual(saveErrors,[]);await savePage.close();await page.unrouteAll()
 // Restore the owner's default kinds through the real route; Pattern help's example supplies the pattern.
 assert.equal((await page.request.put(origin+root,{headers:{Origin:origin},data:pickRules(savedRules)})).status(),200)
 await goto('/app/settings')
 const help=panel.getByText('Pattern help',{exact:true})
 await help.click()
 assert.ok((await help.boundingBox()).height>=44)
 // The example works when pasted: it saves, and the next capture stores its marker.
 await patterns.fill(await panel.locator('code').innerText())
 await panel.locator('[data-save-state="saved"]').waitFor()
 await goto('/app/feedback')
 const form=page.getByRole('form',{name:'New evidence',exact:true})
 await form.getByLabel('Source',{exact:true}).selectOption('free_text')
 await form.getByLabel('Source label (required for free text)',{exact:true}).fill('Synthetic support ticket')
 await form.getByLabel('Original wording',{exact:true}).fill('Synthetic Penny ticket: SSN 234-56-7890 and card 4111 1111 1111 1111. ACCOUNT-1234.')
 await form.getByLabel('Observed time',{exact:true}).fill('2026-10-22T09:00')
 const recorded=page.waitForResponse(r=>r.url().endsWith('/api/operator/evidence')&&r.request().method()==='POST')
 await form.getByRole('button',{name:'Record evidence',exact:true}).click();const ticket=await recorded;assert.equal(ticket.status(),201)
 const stored=await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind((await ticket.json()).id).first('wording')
 assert.ok(stored.includes('[REDACTED:custom]'));assert.ok(!stored.includes('ACCOUNT-1234'))
 await page.getByText('Synthetic Penny ticket: SSN [REDACTED:ssn] and card [REDACTED:card]. [REDACTED:custom].',{exact:false}).first().waitFor()
 assert.ok(!(await page.locator('body').innerText()).includes('234-56-7890'))
 await capture('AI-008-redacted-item')
 await goto('/app/settings')
 await checkRedactionStates({page,runtime,goto,capture,panel,patterns,root,oldId:(await old.json()).id})
 await goto('/app/feedback')
 await page.getByText('Prior captured account [REDACTED:custom].',{exact:false}).first().waitFor()
 assert.ok(!(await page.locator('body').innerText()).includes('ACCOUNT-1234'))
 await capture('AI-008-reapplied-item')
}
function pickRules(settings){return {enabled:settings.enabled,kinds:settings.kinds,patterns:settings.patterns}}
