import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

/** Exercise owner settings and the signed-out built document, without a second journey. */
export async function checkPortalIdentity({page,width,api,cookie,visit}) {
 const branding=JSON.parse(await readFile('src/branding.json','utf8'))
 const descriptions=[`synthetic-penny-${width}: Tell us which customer workflows need improvement.`,`synthetic-penny-${width}: Share your next workflow improvement and follow its progress.`]
 for(const [index,description] of descriptions.entries()) {
  const saved=await api('/api/operator/settings/branding',{description,accent:branding.accent,showLogo:true},{Cookie:cookie},'PUT')
  assert.equal(saved.status,200,'Owner can change the installed portal description')
  const {text}=await visit(page,width,{route:`configured-portal-${index}`,path:'/portal/feedback',auth:'signed-out',contains:description})
  assert.equal(await page.locator('header [data-rer-name]').innerText(),branding.name,'The portal displays the installation build-time branding label')
  assert.equal(await page.getByRole('link',{name:`${branding.name} feedback portal`,exact:true}).count(),1)
  assert.ok(!text.includes(index?descriptions[0]:branding.description),'The prior portal description is absent')
  assert.doesNotMatch(text,/\bpricing\b|\btestimonials?\b|trusted by \d|\d+% uptime|\$\d+\s*\/\s*month/i,'Portal makes no vendor, pricing, testimonial or metric claims')
  for(const privateText of ['Customer evidence records the account blocker','Identity review:','Which investment removes the enterprise blocker','The selected work clears the named customer gate'])assert.ok(!text.includes(privateText),'Operator-only source wording stays private')
 }
 assert.deepEqual(await page.context().cookies(),[],'Signed-out portal reading creates no session')
}
