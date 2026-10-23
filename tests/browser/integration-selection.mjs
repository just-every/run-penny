import assert from 'node:assert/strict'

/** Configure exactly the selected public event using the mounted operator form. */
export async function selectPublicIntegration({runtime,page,capture}){
 await page.goto(runtime.origin+'/app/settings')
 const form=page.getByRole('form',{name:'New integration destination',exact:true})
 await form.getByLabel('Connection name',{exact:true}).fill('synthetic-penny-public-webhook')
 await form.getByRole('combobox',{name:/^Connection type/}).selectOption('webhook')
 await form.getByLabel('Private HTTPS endpoint',{exact:true}).fill('https://events.example.com/penny')
 await form.getByRole('checkbox',{name:'status.published',exact:true}).check()
 for(const event of ['request.published','comment.published','release.published'])assert.equal(await form.getByRole('checkbox',{name:event,exact:true}).isChecked(),false,'[INT-001] other event kinds remain unselected')
 const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/operator/integrations/destinations'&&response.request().method()==='POST')
 await form.getByRole('button',{name:'Save connection',exact:true}).click()
 const response=await saved
 assert.equal(response.status(),201,'[INT-001] explicit selected destination is saved')
 const created=await response.json()
 assert.deepEqual(JSON.parse(await runtime.db.prepare('SELECT events_json FROM penny_integration_destinations WHERE id=?').bind(created.id).first('events_json')),['status.published'],'[INT-001] only the operator-selected kind is retained')
 await page.getByLabel('New signing key',{exact:true}).waitFor()
 await page.getByRole('button',{name:'I saved the signing key',exact:true}).click()
 const record=page.locator('li').filter({has:page.getByRole('button',{name:'Revoke synthetic-penny-public-webhook',exact:true})})
 assert.equal(await record.locator('input,textarea,select').count(),0,'[INT-001] a saved destination has no in-place editing control')
 await capture('selected-public-events',page.locator('section[aria-labelledby="destinations-heading"]'))
 return created
}
